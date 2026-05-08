// ============================================================
// ClearUX Audit Engine — Main Orchestrator
// ============================================================

import { createServiceSupabase } from '@/lib/supabase-server'
import { crawlPages } from './crawler'
import { runFullAnalysis, generateReport } from './analyzer'
import { generatePdfReport } from './pdf'
import { sendAuditComplete } from './email'
import { captureAuditScreenshots } from './screenshots'
import type { AuditFinding } from '@/types/database'

type Supabase = ReturnType<typeof createServiceSupabase>

/* ── Helpers ───────────────────────────────────────────────── */

async function log(
  db: Supabase,
  auditId: string,
  event: string,
  status: 'info' | 'success' | 'error' | 'warning',
  message?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await db.from('audit_logs').insert({
      audit_id: auditId,
      event,
      status,
      message: message || null,
      metadata: metadata || {},
    } as any)
  } catch (err) {
    console.error('[audit-engine] log error:', err)
  }
}

async function setStatus(
  db: Supabase,
  auditId: string,
  status: string,
) {
  const { error } = await db
    .from('audits')
    .update({ status, updated_at: new Date().toISOString() } as any)
    .eq('id', auditId)
  if (error) throw new Error(`Failed to update status: ${error.message}`)
}

/* ── Timeout helper ────────────────────────────────────────── */

const AUDIT_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes max (deep crawls + AI analysis)

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Audit timed out after ${ms / 1000}s (${label})`)), ms),
    ),
  ])
}

/* ── Main orchestrator ─────────────────────────────────────── */

export async function processAudit(auditId: string): Promise<void> {
  // Wrap the entire pipeline in a 5-minute timeout
  return withTimeout(_processAuditInner(auditId), AUDIT_TIMEOUT_MS, 'processAudit')
}

async function _processAuditInner(auditId: string): Promise<void> {
  const db = createServiceSupabase()

  try {
    console.log(`[audit-engine] Starting audit ${auditId}`)

    // 1. Fetch audit details
    const { data: audit, error: auditErr } = await db
      .from('audits')
      .select('*, profiles(email, full_name)')
      .eq('id', auditId)
      .single()

    if (auditErr || !audit) throw new Error(`Audit not found: ${auditErr?.message}`)

    const userEmail = (audit as any).profiles?.email || ''
    const productUrl = (audit as any).product_url as string
    const plan = (audit as any).plan as string
    const userFocus = (audit as any).ux_concern as string | null
    const language = ((audit as any).language as string) || 'en'

    console.log(`[audit-engine] Language: ${language}, Plan: ${plan}`)

    // 2. CRAWLING
    await setStatus(db, auditId, 'crawling')
    await log(db, auditId, 'crawl_started', 'info', `Crawling ${productUrl}`)

    // Crawl more pages — deeper crawl for better coverage
    // Plans: 'starter' = quick scan, 'deep_dive' = full audit
    const maxPages = plan === 'free_preview' ? 5 : plan === 'starter' ? 8 : 25
    const crawledPages = await crawlPages(productUrl, maxPages)

    if (crawledPages.length === 0 || !crawledPages[0].contentText) {
      const hint = crawledPages[0]?.statusCode
        ? `HTTP ${crawledPages[0].statusCode}`
        : 'no response after trying multiple fetch strategies'
      throw new Error(
        `Failed to crawl ${productUrl} — ${hint}. ` +
        `We tried direct fetch, Jina Reader, and Google Cache but couldn't retrieve content. ` +
        `The site may be unreachable, require authentication, or use advanced bot protection. ` +
        `Please verify the URL is correct and publicly accessible.`
      )
    }

    // Store pages
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

    await log(db, auditId, 'crawl_completed', 'success', `Crawled ${crawledPages.length} page(s)`)

    // 3. ANALYSING
    await setStatus(db, auditId, 'analysing')

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

    // Always use built-in 24-category analysis (6 pillars × 4 categories)
    // DB checklist_categories are deprecated — they only had 16 categories
    let allFindings: AuditFinding[] = []
    let sortOrder = 0

    console.log('[audit-engine] Running built-in 24-category analysis')
    const findings = await runFullAnalysis(pageContent, audit as any, userFocus, language)

    for (const finding of findings) {
      const { data: inserted } = await db
        .from('audit_findings')
        .insert({
          audit_id: auditId,
          checklist_item_id: null,
          severity: finding.severity,
          title: finding.title,
          description: finding.description,
          evidence: null,
          page_url: finding.pageUrl || crawledPages[0]?.url || null,
          recommendation: finding.recommendation,
          estimated_impact: finding.estimatedImpact || null,
          target_element: finding.targetElement || null,
          screenshot_url: null,
          sort_order: sortOrder++,
        } as any)
        .select()
        .single()

      if (inserted) allFindings.push(inserted as any)
    }

    await log(db, auditId, 'full_analysis_completed', 'success', `Built-in analysis: ${allFindings.length} findings`)

    // 4. CAPTURE SCREENSHOTS — pages + highlighted findings (non-fatal)
    try {
      await log(db, auditId, 'screenshots_started', 'info', 'Capturing screenshots')

      const findingsForScreenshots = allFindings.map((f) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        targetElement: f.target_element,
        pageUrl: f.page_url,
      }))

      const { pageScreenshots, findingScreenshots } = await captureAuditScreenshots(
        findingsForScreenshots,
        crawledPages[0]?.url || productUrl,
        auditId,
        10,
      )

      // Update pages
      for (const [url, screenshotUrl] of pageScreenshots) {
        const { data: pages } = await db
          .from('audit_pages')
          .select('id')
          .eq('audit_id', auditId)
          .eq('url', url)
          .limit(1)
        if (pages && pages.length > 0) {
          await db.from('audit_pages').update({ screenshot_url: screenshotUrl } as any).eq('id', (pages[0] as any).id)
        }
      }

      // Update findings
      for (const [findingId, screenshotUrl] of findingScreenshots) {
        await db.from('audit_findings').update({ screenshot_url: screenshotUrl } as any).eq('id', findingId)
      }

      await log(db, auditId, 'screenshots_completed', 'success', `${pageScreenshots.size} page + ${findingScreenshots.size} finding screenshots`)
    } catch (err) {
      console.error('[audit-engine] Screenshot capture error (non-fatal):', err)
      await log(db, auditId, 'screenshots_error', 'warning', 'Screenshot capture failed')
    }

    // 5. GENERATING REPORT
    await setStatus(db, auditId, 'generating_report')

    const reportData = await generateReport(allFindings, audit as any, pageContent, userFocus, language)

    const severityCount = {
      critical: allFindings.filter((f) => f.severity === 'critical').length,
      high: allFindings.filter((f) => f.severity === 'high').length,
      medium: allFindings.filter((f) => f.severity === 'medium').length,
      low: allFindings.filter((f) => f.severity === 'low').length,
    }

    // Generate PDF
    let pdfUrl: string | null = null
    try {
      pdfUrl = await generatePdfReport(auditId, audit as any, reportData, allFindings, crawledPages)
    } catch (pdfErr) {
      console.error('[audit-engine] PDF generation error (non-fatal):', pdfErr)
      await log(db, auditId, 'pdf_error', 'warning', 'PDF generation failed — report is still available in dashboard')
    }

    // Insert report
    await db
      .from('reports')
      .insert({
        audit_id: auditId,
        executive_summary: reportData.executiveSummary,
        key_recommendation: reportData.keyRecommendation,
        total_issues: allFindings.length,
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
        raw_json: {
          ...reportData,
          selectedModules: (audit as any).selected_modules ?? null,
        },
        pdf_url: pdfUrl,
        pdf_generated_at: pdfUrl ? new Date().toISOString() : null,
      } as any)

    await log(db, auditId, 'report_generated', 'success', 'Report generated', {
      total_issues: allFindings.length,
      ...severityCount,
      has_pdf: !!pdfUrl,
    })

    // 5. COMPLETED
    await setStatus(db, auditId, 'completed')
    await db
      .from('audits')
      .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
      .eq('id', auditId)

    // Send email
    if (userEmail) {
      try {
        await sendAuditComplete(userEmail, auditId, productUrl)
      } catch (emailErr) {
        console.error('[audit-engine] Email error (non-fatal):', emailErr)
      }
    }

    await log(db, auditId, 'audit_completed', 'success', 'Audit completed')
    console.log(`[audit-engine] Audit ${auditId} completed — ${allFindings.length} findings`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[audit-engine] Audit ${auditId} FAILED:`, message)

    try {
      await setStatus(db, auditId, 'failed')
      await db
        .from('audits')
        .update({ crawl_error: message, updated_at: new Date().toISOString() } as any)
        .eq('id', auditId)
      await log(db, auditId, 'audit_failed', 'error', message)
    } catch {
      // Best effort
    }

    throw err
  }
}
