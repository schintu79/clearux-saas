// ============================================================
// ClearUX Audit Engine — Main Orchestrator
// ============================================================

import { createServiceSupabase } from '@/lib/supabase-server'
import { crawlPages } from './crawler'
import { runFullAnalysis, generateReport } from './analyzer'
import { generatePdfReport } from './pdf'
import { sendAuditComplete } from './email'
// import { captureAuditScreenshots } from './screenshots' // removed — screenshots disabled for speed
import { extractAllBrandFiles } from './brand-file-extractor'
import { checkResponsiveDesign } from './responsive-checker'
import { runTechnicalChecks } from '../pipeline/technical-checks'
import type { TechnicalAudit } from '../pipeline/technical-checks'
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
  progressPercent?: number,
) {
  const update: any = { status, updated_at: new Date().toISOString() }
  if (typeof progressPercent === 'number') update.progress_percent = progressPercent
  const { error } = await db
    .from('audits')
    .update(update)
    .eq('id', auditId)
  if (error) throw new Error(`Failed to update status: ${error.message}`)
}

async function setProgress(
  db: Supabase,
  auditId: string,
  progressPercent: number,
) {
  await db
    .from('audits')
    .update({ progress_percent: progressPercent, updated_at: new Date().toISOString() } as any)
    .eq('id', auditId)
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
    await setStatus(db, auditId, 'crawling', 5)
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

    // 2a. TECHNICAL HEALTH CHECKS — deterministic, zero LLM calls
    const technicalAudits: Map<string, TechnicalAudit> = new Map()
    for (const page of crawledPages) {
      if (page.rawHtml) {
        try {
          const techResult = runTechnicalChecks(page.rawHtml, page.loadTimeMs ?? null, page.url)
          technicalAudits.set(page.url, techResult)
        } catch (techErr) {
          console.error(`[audit-engine] Technical check error for ${page.url}:`, techErr)
        }
      }
    }

    // Store pages — batch insert for speed
    const pageRows = crawledPages.map((page) => ({
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
      load_time_ms: page.loadTimeMs ?? null,
      is_mobile_friendly: null,
      viewport_meta: null,
      crawled_at: page.crawledAt,
      technical_audit: technicalAudits.get(page.url) ?? null,
    }))
    if (pageRows.length > 0) {
      await db.from('audit_pages').insert(pageRows as any)
    }

    await db
      .from('audits')
      .update({ pages_crawled: crawledPages.length, updated_at: new Date().toISOString() } as any)
      .eq('id', auditId)

    const techCheckedCount = technicalAudits.size
    await setProgress(db, auditId, 25)
    await log(db, auditId, 'crawl_completed', 'success', `Crawled ${crawledPages.length} page(s), technical checks on ${techCheckedCount}`)

    // 2b. RESPONSIVE CHECK — update audit_pages with mobile-friendly data
    try {
      const crawledUrls = crawledPages.map((p) => p.url).filter(Boolean)
      const maxResponsiveUrls = plan === 'free_preview' ? 1 : 3
      const responsiveResult = await checkResponsiveDesign(crawledUrls, maxResponsiveUrls)

      // Update audit_pages with mobile-friendly status
      for (const r of responsiveResult.results) {
        const mobileIssues = r.viewportIssues.filter((i: any) => i.viewport === 'Mobile').length
        await db
          .from('audit_pages')
          .update({
            is_mobile_friendly: mobileIssues === 0,
            viewport_meta: r.hasMobileViewport ? 'width=device-width, initial-scale=1' : null,
          } as any)
          .eq('audit_id', auditId)
          .eq('url', r.url)
      }

      // Store responsive findings — batch insert
      if (responsiveResult.findings.length > 0) {
        let sortOrderResp = 0
        const respRows = responsiveResult.findings.map((finding: any) => ({
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
          sort_order: sortOrderResp++,
        }))
        await db.from('audit_findings').insert(respRows as any)
      }

      await log(db, auditId, 'responsive_check_completed', 'success',
        `Responsive check: ${responsiveResult.findings.length} findings across ${responsiveResult.results.length} page(s)`)
    } catch (err) {
      console.error('[audit-engine] Responsive check error (non-fatal):', err)
      await log(db, auditId, 'responsive_check_error', 'warning', 'Responsive check failed — continuing without mobile data')
    }

    // 3. ANALYSING
    await setStatus(db, auditId, 'analysing', 35)

    const pageContent = crawledPages
      .map((p) => {
        let block = ''
        if (p.url) block += `URL: ${p.url}\n`
        if (p.title) block += `Title: ${p.title}\n`
        if (p.h1) {
          block += `H1: ${p.h1}\n`
        } else {
          block += `H1: [not captured — may exist in JS-rendered or streamed content]\n`
        }
        if (p.metaDescription) block += `Meta Description: ${p.metaDescription}\n`

        // Inject measured technical data so LLM findings are grounded in facts
        const tech = technicalAudits.get(p.url)
        if (tech) {
          block += `\n[MEASURED TECHNICAL DATA]\n`
          block += `Load time: ${tech.loadTimeMs ? `${tech.loadTimeMs}ms` : 'not measured'}\n`
          block += `DOM elements: ${tech.domElementCount} | HTML size: ${Math.round(tech.htmlSizeBytes / 1024)}KB\n`
          block += `Scripts: ${tech.scriptCount} | Stylesheets: ${tech.stylesheetCount} | Inline styles: ${tech.inlineStyleCount}\n`
          block += `Images: ${tech.totalImages} total, ${tech.imagesWithAlt} with alt, ${tech.imagesWithDimensions} with dimensions, ${tech.modernFormatImages} modern format\n`
          block += `Headings: ${tech.headings.length} total, ${tech.headings.filter(h => h.level === 1).length} H1s\n`
          if (tech.headingIssues.length > 0) block += `Heading issues: ${tech.headingIssues.map(i => i.description).join('; ')}\n`
          block += `Accessibility: lang=${tech.hasLangAttribute}, skipLink=${tech.hasSkipLink}, landmarks=${tech.landmarkCount}, ariaRoles=${tech.ariaRoleCount}\n`
          if (tech.accessibilityIssues.length > 0) block += `A11y issues: ${tech.accessibilityIssues.map(i => i.description).join('; ')}\n`
          block += `Links: ${tech.totalLinks} total (${tech.internalLinks} internal, ${tech.externalLinks} external)\n`
          if (tech.linkIssues.length > 0) block += `Link issues: ${tech.linkIssues.slice(0, 5).map(i => i.description).join('; ')}\n`
          block += `Scores: Performance ${tech.performanceScore}/100 | Images ${tech.imageScore}/100 | Headings ${tech.headingScore}/100 | Accessibility ${tech.accessibilityScore}/100 | Overall ${tech.overallScore}/100\n`
          block += `[/MEASURED TECHNICAL DATA]\n`
        }

        if (p.contentText) block += `Content:\n${p.contentText}\n`
        return block
      })
      .join('\n---\n')

    // Load brand identity files if brand_identity_id is set
    const brandIdentityId = (audit as any).brand_identity_id as string | null
    let brandContent = pageContent
    if (brandIdentityId) {
      try {
        const { data: brandFiles } = await db
          .from('brand_identity_files')
          .select('file_name, file_url, file_type')
          .eq('brand_identity_id', brandIdentityId)

        if (brandFiles && brandFiles.length > 0) {
          console.log(`[audit-engine] Extracting ${brandFiles.length} brand file(s)`)
          const extracted = await extractAllBrandFiles(
            brandFiles.map((f: any) => ({
              file_name: f.file_name as string,
              file_url: f.file_url as string,
              file_type: (f.file_type as string | null) ?? null,
            })),
          )

          const textParts = extracted
            .filter(e => (e.textContent && e.textContent.length > 0) || (e.visualDescription && e.visualDescription.length > 0))
            .map(e => {
              const parts: string[] = [`[Brand file: ${e.fileName}]`]
              if (e.textContent) parts.push(e.textContent)
              if (e.visualDescription) parts.push(`[Visual description]\n${e.visualDescription}`)
              return parts.join('\n')
            })

          if (textParts.length > 0) {
            const brandContext = textParts.join('\n\n---\n\n')
            brandContent = `=== BRAND IDENTITY GUIDELINES ===\n${brandContext}\n\n=== WEBSITE CONTENT ===\n${pageContent}`
            await log(db, auditId, 'brand_files_extracted', 'success',
              `Extracted content from ${extracted.length} brand file(s)`)
          }
        }
      } catch (brandErr) {
        console.error('[audit-engine] Brand file extraction error (non-fatal):', brandErr)
        await log(db, auditId, 'brand_files_error', 'warning', 'Failed to extract brand files — brand consistency analysis will be limited')
      }
    }

    // Always use built-in 24-category analysis (6 pillars × 4 categories)
    // DB checklist_categories are deprecated — they only had 16 categories
    let allFindings: AuditFinding[] = []
    let sortOrder = 0

    console.log('[audit-engine] Running built-in 24-category analysis')
    // Use brand-enriched content for analysis so brand consistency categories get brand context
    const findings = await runFullAnalysis(brandContent, audit as any, userFocus, language)

    // Batch-insert all findings in one DB call for speed
    const findingRows = findings.map((finding) => ({
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
      category_index: finding.categoryIndex ?? null,
    }))

    if (findingRows.length > 0) {
      const { data: inserted } = await db
        .from('audit_findings')
        .insert(findingRows as any)
        .select()
      if (inserted) allFindings.push(...(inserted as any[]))
    }

    await setProgress(db, auditId, 80)
    await log(db, auditId, 'full_analysis_completed', 'success', `Built-in analysis: ${allFindings.length} findings`)

    // 4. GENERATING REPORT (screenshots removed — not user-facing)
    await setStatus(db, auditId, 'generating_report', 85)

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
    await setStatus(db, auditId, 'completed', 100)
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
