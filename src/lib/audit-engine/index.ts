// ============================================================
// ClearUX Audit Engine — Main Orchestrator
// ============================================================

import { createServiceSupabase } from '@/lib/supabase-server'
import { crawlPages } from './crawler'
import { runFullAnalysis, generateReport } from './analyzer'
import { generatePdfReport } from './pdf'
import { sendAuditComplete } from './email'
import { captureAuditScreenshots } from './screenshots'
import { extractAllBrandFiles } from './brand-file-extractor'
import { checkResponsiveDesign } from './responsive-checker'
import { runTechnicalChecks, formatTechnicalAuditForPrompt, type TechnicalCheckResult } from '@/lib/pipeline/technical-checks'
import { runCodeQualityChecks, type CodeQualityResult } from '@/lib/pipeline/code-quality-checker'
import { extractPerformanceData, aggregatePerformanceSummary, formatPerformanceForPrompt, generatePerformanceFindings } from '@/lib/pipeline/performance-checker'
import { enrichFindingsWithRoles, generateRoleSummaries } from '@/lib/pipeline/role-mapper'
import { runFullSpeedTest, generateSpeedFindings } from '@/lib/pagespeed'
import type { AuditFinding, PagePerformanceData, SpeedDataSummary } from '@/types/database'

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

async function setProgress(
  db: Supabase,
  auditId: string,
  percent: number,
) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  try {
    await db
      .from('audits')
      .update({ progress_percent: clamped, updated_at: new Date().toISOString() } as any)
      .eq('id', auditId)
  } catch (err) {
    // Progress is best-effort — never fail the audit because of it.
    console.error('[audit-engine] setProgress error:', err)
  }
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

  const stageStart: Record<string, number> = {}
  const tStart = Date.now()
  const stage = (label: string) => {
    const prev = Object.keys(stageStart).pop()
    const now = Date.now()
    if (prev) console.log(`[audit-timing] ${prev}: ${((now - stageStart[prev]) / 1000).toFixed(1)}s`)
    stageStart[label] = now
  }
  const stageDone = () => {
    const prev = Object.keys(stageStart).pop()
    if (prev) console.log(`[audit-timing] ${prev}: ${((Date.now() - stageStart[prev]) / 1000).toFixed(1)}s`)
    console.log(`[audit-timing] TOTAL: ${((Date.now() - tStart) / 1000).toFixed(1)}s`)
  }

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

    await setProgress(db, auditId, 5)

    // 2. CRAWLING
    await setStatus(db, auditId, 'crawling')
    stage('crawl')
    await log(db, auditId, 'crawl_started', 'info', `Crawling ${productUrl}`)

    // Crawl more pages — deeper crawl for better coverage
    // Plans: 'starter' = quick scan, 'deep_dive' = full audit
    const maxPages = plan === 'free_preview' ? 5 : plan === 'starter' ? 8 : 25
    const crawlOutput = await crawlPages(productUrl, maxPages)
    const crawledPages = crawlOutput.pages

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

    // Run technical checks on every crawled page so the results can be
    // persisted alongside the page record and surfaced in the "Technical
    // health" tab. Failures are non-fatal per page.
    const technicalAuditByUrl = new Map<string, TechnicalCheckResult>()
    const codeQualityByUrl = new Map<string, CodeQualityResult>()
    const performanceByUrl = new Map<string, PagePerformanceData>()
    for (const page of crawledPages) {
      try {
        const result = runTechnicalChecks({
          url: page.url,
          html: page.rawHtml ?? null,
          loadTimeMs: page.loadTimeMs,
          statusCode: page.statusCode,
        })
        technicalAuditByUrl.set(page.url, result)
      } catch (techErr) {
        console.error(`[audit-engine] Technical checks failed for ${page.url}:`, techErr)
      }
      try {
        const cqResult = runCodeQualityChecks(page.url, page.rawHtml ?? null)
        codeQualityByUrl.set(page.url, cqResult)
      } catch (cqErr) {
        console.error(`[audit-engine] Code quality checks failed for ${page.url}:`, cqErr)
      }
      try {
        const perfResult = extractPerformanceData({
          url: page.url,
          html: page.rawHtml ?? null,
          loadTimeMs: page.loadTimeMs,
        })
        performanceByUrl.set(page.url, perfResult)
      } catch (perfErr) {
        console.error(`[audit-engine] Performance checks failed for ${page.url}:`, perfErr)
      }
    }

    // Aggregate site-level performance summary
    const allPerfData = [...performanceByUrl.values()]
    const performanceSummary = allPerfData.length > 0 ? aggregatePerformanceSummary(allPerfData) : null

    // Store performance summary on audit
    if (performanceSummary) {
      await db
        .from('audits')
        .update({ performance_summary: performanceSummary } as any)
        .eq('id', auditId)
    }

    // Store pages
    for (const page of crawledPages) {
      const technicalAudit = technicalAuditByUrl.get(page.url) ?? null
      const codeQuality = codeQualityByUrl.get(page.url) ?? null
      const performanceData = performanceByUrl.get(page.url) ?? null
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
        load_time_ms: page.loadTimeMs,
        is_mobile_friendly: null,
        viewport_meta: null,
        technical_audit: technicalAudit,
        code_quality: codeQuality,
        performance_data: performanceData,
        crawled_at: page.crawledAt,
      } as any)
    }

    await db
      .from('audits')
      .update({ pages_crawled: crawledPages.length, updated_at: new Date().toISOString() } as any)
      .eq('id', auditId)

    await log(db, auditId, 'crawl_completed', 'success', `Crawled ${crawledPages.length} page(s)`)
    await setProgress(db, auditId, 25)
    stage('responsive')

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

      // Store responsive findings as audit findings
      let sortOrderResp = 0
      for (const finding of responsiveResult.findings) {
        await db.from('audit_findings').insert({
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
        } as any)
      }

      await log(db, auditId, 'responsive_check_completed', 'success',
        `Responsive check: ${responsiveResult.findings.length} findings across ${responsiveResult.results.length} page(s)`)
    } catch (err) {
      console.error('[audit-engine] Responsive check error (non-fatal):', err)
      await log(db, auditId, 'responsive_check_error', 'warning', 'Responsive check failed — continuing without mobile data')
    }

    // 2c. PERFORMANCE FINDINGS — convert metrics into actionable findings
    if (performanceSummary && allPerfData.length > 0) {
      try {
        const perfPageData = crawledPages
          .filter(p => performanceByUrl.has(p.url))
          .map(p => ({ url: p.url, perf: performanceByUrl.get(p.url)! }))

        const perfFindings = generatePerformanceFindings(performanceSummary, perfPageData)
        let sortOrderPerf = 0
        for (const pf of perfFindings) {
          await db.from('audit_findings').insert({
            audit_id: auditId,
            category_index: 12, // Performance category
            finding_type: 'strategic',
            fix_type: null,
            severity: pf.severity,
            title: pf.title,
            description: pf.description,
            evidence: pf.why_it_matters,
            page_url: pf.affected_pages[0] || crawledPages[0]?.url || null,
            recommendation: pf.recommendation,
            estimated_impact: pf.estimated_impact,
            target_element: null,
            screenshot_url: null,
            sort_order: sortOrderPerf++,
            detection_source: 'performance_checker',
            confidence_level: 'heuristic',
            default_owner: pf.owner_team === 'engineering' ? 'engineering' : pf.owner_team === 'marketing' ? 'marketing' : pf.owner_team === 'design' ? 'design' : 'product',
            performance_metric_type: pf.performance_metric_type,
            owner_team: pf.owner_team,
          } as any)
        }
        if (perfFindings.length > 0) {
          await log(db, auditId, 'performance_findings_generated', 'success',
            `Generated ${perfFindings.length} performance finding(s)`)
        }
      } catch (perfErr) {
        console.error('[audit-engine] Performance findings error (non-fatal):', perfErr)
      }
    }

    // 2d. PAGESPEED TEST — real Core Web Vitals via Google PageSpeed Insights
    if (productUrl) {
      try {
        const speedData = await runFullSpeedTest(productUrl)
        // Convert to DB-storable summary (strip raw diagnostics to reduce JSON size)
        const speedSummary: SpeedDataSummary = {
          mobile: speedData.mobile ? {
            score: speedData.mobile.score,
            strategy: 'mobile',
            metrics: speedData.mobile.metrics,
            issueCount: speedData.mobile.diagnostics.length,
            finalUrl: speedData.mobile.finalUrl,
            testedAt: speedData.mobile.testedAt,
          } : null,
          desktop: speedData.desktop ? {
            score: speedData.desktop.score,
            strategy: 'desktop',
            metrics: speedData.desktop.metrics,
            issueCount: speedData.desktop.diagnostics.length,
            finalUrl: speedData.desktop.finalUrl,
            testedAt: speedData.desktop.testedAt,
          } : null,
          testedAt: speedData.testedAt,
        }
        await db
          .from('audits')
          .update({ speed_data: speedSummary, speed_tested_at: speedData.testedAt } as any)
          .eq('id', auditId)

        // Generate speed-specific findings
        const speedFindings = generateSpeedFindings(speedData)
        let sortOrderSpeed = 100
        for (const sf of speedFindings) {
          await db.from('audit_findings').insert({
            audit_id: auditId,
            category_index: 12,
            finding_type: sf.fixableFromConsole ? 'specific' : 'strategic',
            fix_type: null,
            severity: sf.severity,
            title: sf.title,
            description: sf.description,
            evidence: null,
            page_url: productUrl,
            recommendation: sf.recommendation,
            estimated_impact: null,
            target_element: null,
            screenshot_url: null,
            sort_order: sortOrderSpeed++,
            detection_source: 'pagespeed_api',
            confidence_level: 'deterministic',
            default_owner: sf.ownerTeam,
            performance_metric_type: sf.metricType,
            owner_team: sf.ownerTeam,
          } as any)
        }
        if (speedFindings.length > 0) {
          await log(db, auditId, 'speed_findings_generated', 'success',
            `PageSpeed: score ${speedSummary.mobile?.score ?? '?'}(m) / ${speedSummary.desktop?.score ?? '?'}(d), ${speedFindings.length} finding(s)`)
        }
      } catch (speedErr) {
        console.error('[audit-engine] PageSpeed test error (non-fatal):', speedErr)
        await log(db, auditId, 'pagespeed_error', 'warning', 'PageSpeed API call failed — continuing without real CWV data')
      }
    }

    // 3. ANALYSING
    await setStatus(db, auditId, 'analysing')
    await setProgress(db, auditId, 35)
    stage('analyse')

    const pageContent = crawledPages
      .map((p) => {
        let block = ''
        if (p.url) block += `URL: ${p.url}\n`
        if (p.title) block += `Title: ${p.title}\n`
        if (p.h1) {
          block += `H1: ${p.h1}\n`
        } else {
          block += `H1: [not captured ��� may exist in JS-rendered or streamed content]\n`
        }
        if (p.metaDescription) block += `Meta Description: ${p.metaDescription}\n`
        if (p.contentText) block += `Content:\n${p.contentText}\n`
        const tech = technicalAuditByUrl.get(p.url)
        if (tech) {
          block += `Technical audit:\n${formatTechnicalAuditForPrompt(tech)}\n`
        }
        const perf = performanceByUrl.get(p.url)
        if (perf) {
          block += `${formatPerformanceForPrompt(perf)}\n`
        }
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
        await log(db, auditId, 'brand_files_error', 'warning', 'Failed to extract brand files — design consistency analysis will be limited')
      }
    }

    // Always use built-in 24-category analysis (6 pillars × 4 categories)
    // DB checklist_categories are deprecated — they only had 16 categories
    let allFindings: AuditFinding[] = []
    let sortOrder = 0

    console.log('[audit-engine] Running built-in 24-category analysis')
    // Use brand-enriched content for analysis so design consistency categories get brand context
    // Stream incremental progress per category so the loader doesn't sit at 35% for minutes
    const findings = await runFullAnalysis(
      brandContent,
      audit as any,
      userFocus,
      language,
      'deep',
      async (done, total) => {
        // Map per-category completion to 35 → 78
        const pct = 35 + Math.round((done / total) * 43)
        await setProgress(db, auditId, pct)
      },
    )

    for (const finding of findings) {
      const { data: inserted } = await db
        .from('audit_findings')
        .insert({
          audit_id: auditId,
          checklist_item_id: null,
          category_index: finding.categoryIndex ?? null,
          finding_type: finding.findingType || 'specific',
          fix_type: finding.fixType || null,
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

    // 3b. ROLE-BASED ENRICHMENT — assign owner roles, handoff payloads, and summaries
    try {
      const roleEnrichments = enrichFindingsWithRoles(allFindings as any)
      for (const enrichment of roleEnrichments) {
        await db
          .from('audit_findings')
          .update({
            owner_roles: enrichment.owner_roles,
            primary_owner_role: enrichment.primary_owner_role,
            handoff_ready: enrichment.handoff_ready,
            handoff_payload: enrichment.handoff_payload,
          } as any)
          .eq('id', enrichment.id)
      }
      // Generate and store role summaries on the audit
      const roleSummaries = generateRoleSummaries(allFindings as any, roleEnrichments)
      await db
        .from('audits')
        .update({ role_summaries: roleSummaries } as any)
        .eq('id', auditId)
      await log(db, auditId, 'role_enrichment_completed', 'success', `Role enrichment: ${roleEnrichments.length} findings enriched`)
    } catch (roleErr) {
      console.error('[audit-engine] Role enrichment error (non-fatal):', roleErr)
      await log(db, auditId, 'role_enrichment_error', 'warning', 'Role enrichment failed — findings still available without role metadata')
    }

    await setProgress(db, auditId, 80)
    stage('screenshots')

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
    await setProgress(db, auditId, 85)
    stage('report')

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

    await setProgress(db, auditId, 95)

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
    await setProgress(db, auditId, 100)

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
    stageDone()
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
