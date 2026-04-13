// ============================================================
// ClearUX — Inngest Audit Processing Function
// Breaks the audit pipeline into steps so each fits within
// Vercel's serverless timeout (300s on Pro).
//
// Steps:
//   1. fetch-audit       — Load audit details from DB
//   2. crawl-pages       — Crawl the website, store pages in DB
//   3. analyze-batch-N   — AI analysis (3 categories per batch, 4 batches)
//   4. generate-report   — Executive summary + scores
//   5. complete          — Mark done, send email
// ============================================================

import { inngest } from '../client'
import { createServiceSupabase } from '@/lib/supabase-server'
import { crawlPages } from '@/lib/audit-engine/crawler'
import { analyzeCategory, runFullAnalysis, generateReport, UX_CATEGORIES } from '@/lib/audit-engine/analyzer'
import { generatePdfReport } from '@/lib/audit-engine/pdf'
import { sendAuditComplete } from '@/lib/audit-engine/email'
import { captureAuditScreenshots } from '@/lib/audit-engine/screenshots'
import type { AuditFinding } from '@/types/database'

/* ── DB helpers (duplicated from index.ts to keep self-contained) ── */

function getDb() {
  return createServiceSupabase()
}

async function setStatus(auditId: string, status: string) {
  const db = getDb()
  const { error } = await db
    .from('audits')
    .update({ status, updated_at: new Date().toISOString() } as any)
    .eq('id', auditId)
  if (error) throw new Error(`Failed to update status: ${error.message}`)
}

async function auditLog(
  auditId: string,
  event: string,
  status: 'info' | 'success' | 'error' | 'warning',
  message?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    const db = getDb()
    await db.from('audit_logs').insert({
      audit_id: auditId,
      event,
      status,
      message: message || null,
      metadata: metadata || {},
    } as any)
  } catch (err) {
    console.error('[inngest] log error:', err)
  }
}

/* ── UX Categories — sourced from analyzer.ts (single source of truth) ── */

const UX_CATEGORY_NAMES = UX_CATEGORIES.map((c) => c.name)

/* ── The Inngest function ── */

export const processAuditFn = inngest.createFunction(
  {
    id: 'process-audit',
    retries: 1,
    concurrency: {
      limit: 5, // Max 5 audits processing simultaneously (Inngest free plan limit)
    },
    triggers: [{ event: 'audit/process' as const }],
  },
  async ({ event, step }: { event: { data: { auditId: string } }; step: any }) => {
    const auditId = event.data.auditId

    // ──────────────────────────────────────────────────────────
    // STEP 1: Fetch audit details
    // ──────────────────────────────────────────────────────────
    const auditDetails = await step.run('fetch-audit', async () => {
      const db = getDb()

      const { data: audit, error } = await db
        .from('audits')
        .select('*, profiles(email, full_name)')
        .eq('id', auditId)
        .single()

      if (error || !audit) throw new Error(`Audit not found: ${error?.message}`)

      return {
        userEmail: (audit as any).profiles?.email || '',
        productUrl: (audit as any).product_url as string,
        plan: (audit as any).plan as string,
        userFocus: (audit as any).ux_concern as string | null,
        language: ((audit as any).language as string) || 'en',
      }
    })

    // ──────────────────────────────────────────────────────────
    // STEP 2: Crawl pages
    // ──────────────────────────────────────────────────────────
    const crawlResult = await step.run('crawl-pages', async () => {
      await setStatus(auditId, 'crawling')
      await auditLog(auditId, 'crawl_started', 'info', `Crawling ${auditDetails.productUrl}`)

      const maxPages = auditDetails.plan === 'starter' ? 8 : 25
      const crawledPages = await crawlPages(auditDetails.productUrl, maxPages)

      if (crawledPages.length === 0 || !crawledPages[0].contentText) {
        const hint = crawledPages[0]?.statusCode
          ? `HTTP ${crawledPages[0].statusCode}`
          : 'no response after trying multiple fetch strategies'
        throw new Error(
          `Failed to crawl ${auditDetails.productUrl} — ${hint}. ` +
          `We tried direct fetch, Jina Reader, and Google Cache but couldn't retrieve content. ` +
          `The site may be unreachable, require authentication, or use advanced bot protection.`
        )
      }

      // Store pages in DB
      const db = getDb()
      for (const page of crawledPages) {
        await db.from('audit_pages').insert({
          audit_id: auditId,
          url: page.url,
          title: page.title,
          h1: page.h1,
          meta_description: page.metaDescription,
          content_text: page.contentText,
          links_found: page.linksFound,
          broken_links: [],
          has_structured_data: false,
          structured_data: null,
          status_code: page.statusCode,
          load_time_ms: null,
          is_mobile_friendly: null,
          viewport_meta: null,
          crawled_at: page.crawledAt,
        } as any)
      }

      await db
        .from('audits')
        .update({ pages_crawled: crawledPages.length, updated_at: new Date().toISOString() } as any)
        .eq('id', auditId)

      // Build the aggregated page content for analysis
      const pageContent = crawledPages
        .map((p) => {
          let block = ''
          if (p.url) block += `URL: ${p.url}\n`
          if (p.title) block += `Title: ${p.title}\n`
          if (p.h1) block += `H1: ${p.h1}\n`
          if (p.metaDescription) block += `Meta Description: ${p.metaDescription}\n`
          if (p.contentText) block += `Content:\n${p.contentText}\n`
          return block
        })
        .join('\n---\n')

      await auditLog(auditId, 'crawl_completed', 'success', `Crawled ${crawledPages.length} page(s)`)

      return {
        pageCount: crawledPages.length,
        pageContent, // Passed to analysis steps
        firstPageUrl: crawledPages[0]?.url || '',
      }
    })

    // ──────────────────────────────────────────────────────────
    // STEP 3: Set status to analysing
    // ──────────────────────────────────────────────────────────
    await step.run('set-analysing', async () => {
      await setStatus(auditId, 'analysing')
    })

    // ──────────────────────────────────────────────────────────
    // STEP 4-7: Analyze categories in 4 batches of 3
    // Each batch is a separate step → separate serverless call
    // ──────────────────────────────────────────────────────────
    const BATCH_SIZE = 3
    const batches = []
    for (let i = 0; i < UX_CATEGORY_NAMES.length; i += BATCH_SIZE) {
      batches.push(UX_CATEGORY_NAMES.slice(i, i + BATCH_SIZE))
    }

    let totalFindingsCount = 0

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx]

      const batchResult = await step.run(`analyze-batch-${batchIdx + 1}`, async () => {
        const db = getDb()
        let sortOrder = totalFindingsCount
        let findingsInBatch = 0

        const batchResults = await Promise.all(
          batch.map((categoryName) =>
            analyzeCategory(
              crawlResult.pageContent,
              categoryName,
              [], // empty = use built-in checklist items
              auditDetails.userFocus,
              auditDetails.language,
            ),
          ),
        )

        for (let catIdx = 0; catIdx < batchResults.length; catIdx++) {
          const findings = batchResults[catIdx]
          const categoryName = batch[catIdx]

          for (const finding of findings) {
            await db.from('audit_findings').insert({
              audit_id: auditId,
              checklist_item_id: null,
              severity: finding.severity,
              title: finding.title,
              description: finding.description,
              evidence: null,
              page_url: finding.pageUrl || crawlResult.firstPageUrl,
              recommendation: finding.recommendation,
              estimated_impact: finding.estimatedImpact || null,
              target_element: finding.targetElement || null,
              screenshot_url: null,
              sort_order: sortOrder++,
            } as any)
          }

          findingsInBatch += findings.length
          await auditLog(auditId, 'category_analysed', 'success', `Analyzed: ${categoryName}`, {
            findings_count: findings.length,
          })
        }

        return { findingsInBatch, newSortOrder: sortOrder }
      })

      totalFindingsCount = batchResult.newSortOrder
    }

    // ──────────────────────────────────────────────────────────
    // STEP 8: Capture screenshots — page overviews + highlighted findings
    // Uses /api/screenshot endpoint so each capture gets its own
    // serverless invocation with dedicated memory and timeout.
    // ──────────────────────────────────────────────────────────
    await step.run('capture-screenshots', async () => {
      const db = getDb()

      await auditLog(auditId, 'screenshots_started', 'info', 'Capturing screenshots for pages and findings')

      try {
        // Fetch all findings with target_element and page_url
        const { data: findingsWithTargets } = await db
          .from('audit_findings')
          .select('id, title, severity, target_element, page_url')
          .eq('audit_id', auditId)
          .order('sort_order', { ascending: true })

        const findingsToCapture = (findingsWithTargets || []).map((f: any) => ({
          id: f.id as string,
          title: f.title as string,
          severity: f.severity as string,
          targetElement: f.target_element as string | null,
          pageUrl: f.page_url as string | null,
        }))

        const mainUrl = crawlResult.firstPageUrl || auditDetails.productUrl

        const { pageScreenshots, findingScreenshots } = await captureAuditScreenshots(
          findingsToCapture,
          mainUrl,
          auditId,
          10, // capture up to 10 finding screenshots
        )

        // Update audit_pages with their page-level screenshots
        for (const [url, screenshotUrl] of pageScreenshots) {
          const { data: pages } = await db
            .from('audit_pages')
            .select('id')
            .eq('audit_id', auditId)
            .eq('url', url)
            .limit(1)

          if (pages && pages.length > 0) {
            await db
              .from('audit_pages')
              .update({ screenshot_url: screenshotUrl } as any)
              .eq('id', (pages[0] as any).id)
          }
        }

        // Update findings with their highlighted screenshots
        let uploadedCount = 0
        for (const [findingId, screenshotUrl] of findingScreenshots) {
          await db
            .from('audit_findings')
            .update({ screenshot_url: screenshotUrl } as any)
            .eq('id', findingId)
          uploadedCount++
        }

        await auditLog(auditId, 'screenshots_completed', 'success',
          `Captured ${pageScreenshots.size} page + ${uploadedCount} finding screenshots`, {
            page_screenshots: pageScreenshots.size,
            finding_screenshots: uploadedCount,
          })
      } catch (err) {
        // Screenshots are non-fatal — audit can complete without them
        console.error('[inngest] Screenshot capture error (non-fatal):', err)
        await auditLog(auditId, 'screenshots_error', 'warning', 'Screenshot capture failed — audit will complete without screenshots')
      }
    })

    // ──────────────────────────────────────────────────────────
    // STEP 9: Generate report
    // ──────────────────────────────────────────────────────────
    await step.run('generate-report', async () => {
      await setStatus(auditId, 'generating_report')

      const db = getDb()

      // Fetch all findings from DB
      const { data: allFindings } = await db
        .from('audit_findings')
        .select('*')
        .eq('audit_id', auditId)
        .order('sort_order', { ascending: true })

      const findings = (allFindings || []) as AuditFinding[]

      // Fetch audit for generateReport
      const { data: audit } = await db
        .from('audits')
        .select('*')
        .eq('id', auditId)
        .single()

      const reportData = await generateReport(
        findings,
        audit as any,
        crawlResult.pageContent,
        auditDetails.userFocus,
        auditDetails.language,
      )

      const severityCount = {
        critical: findings.filter((f) => f.severity === 'critical').length,
        high: findings.filter((f) => f.severity === 'high').length,
        medium: findings.filter((f) => f.severity === 'medium').length,
        low: findings.filter((f) => f.severity === 'low').length,
      }

      // Generate PDF
      let pdfUrl: string | null = null
      try {
        pdfUrl = await generatePdfReport(auditId, audit as any, reportData, findings, [])
      } catch (pdfErr) {
        console.error('[inngest] PDF generation error (non-fatal):', pdfErr)
        await auditLog(auditId, 'pdf_error', 'warning', 'PDF generation failed — report is still available in dashboard')
      }

      // Insert report
      await db.from('reports').insert({
        audit_id: auditId,
        executive_summary: reportData.executiveSummary,
        key_recommendation: reportData.keyRecommendation,
        total_issues: findings.length,
        critical_count: severityCount.critical,
        high_count: severityCount.high,
        medium_count: severityCount.medium,
        low_count: severityCount.low,
        overall_score: reportData.overallScore,
        ux_score: reportData.uxScore,
        conversion_score: reportData.conversionScore,
        mobile_score: reportData.mobileScore,
        ai_discoverability_score: reportData.aiDiscoverabilityScore,
        content_score: reportData.contentScore,
        raw_json: reportData,
        pdf_url: pdfUrl,
        pdf_generated_at: pdfUrl ? new Date().toISOString() : null,
      } as any)

      await auditLog(auditId, 'report_generated', 'success', 'Report generated', {
        total_issues: findings.length,
        ...severityCount,
        has_pdf: !!pdfUrl,
      })
    })

    // ──────────────────────────────────────────────────────────
    // STEP 10: Complete audit and send email
    // ──────────────────────────────────────────────────────────
    await step.run('complete', async () => {
      const db = getDb()

      await setStatus(auditId, 'completed')
      await db
        .from('audits')
        .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
        .eq('id', auditId)

      // Send email notification
      if (auditDetails.userEmail) {
        try {
          await sendAuditComplete(auditDetails.userEmail, auditId, auditDetails.productUrl)
        } catch (emailErr) {
          console.error('[inngest] Email error (non-fatal):', emailErr)
        }
      }

      await auditLog(auditId, 'audit_completed', 'success', 'Audit completed')
      console.log(`[inngest] Audit ${auditId} completed`)
    })

    return { success: true, auditId }
  },
)
