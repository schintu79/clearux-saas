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
import { crawlPages, formatHeadTagsForAnalysis, type HeadTagData } from '@/lib/audit-engine/crawler'
import { probeAIDiscovery, formatAIDiscoveryForAnalysis } from '@/lib/audit-engine/ai-discovery-probe'
import { validateStructuredData, formatValidationForAnalysis } from '@/lib/audit-engine/structured-data-validator'
import { analyzeCategory, generateReport, verifyFindings, UX_CATEGORIES } from '@/lib/audit-engine/analyzer'
import { generatePdfReport } from '@/lib/audit-engine/pdf'
import { sendAuditComplete, sendFreeAuditReady } from '@/lib/audit-engine/email'
import { captureAuditScreenshots } from '@/lib/audit-engine/screenshots'
import {
  identifyDuplicates,
  identifySpeculativeFindings,
  scoreFindings,
  recordFindingShown,
  recordAuditStats,
  postAuditLearn,
  classifyFinding,
  validateFixableRecommendation,
  isSimpleSite,
  filterSimpleSiteFindings,
} from '@/lib/audit-engine/pipeline'
import { identifyStarvedCategories, generateFindingsForStarvedCategories } from '@/lib/audit-engine/pipeline/minimum-findings'
import { AUDIT_MODULES, COMPLETE_AUDIT_SLUGS } from '@/lib/audit-modules'
import { extractAllBrandFiles } from '@/lib/audit-engine/brand-file-extractor'
import { checkResponsiveDesign } from '@/lib/audit-engine/responsive-checker'
import { runLlmProbe, formatLlmProbeForAnalysis } from '@/lib/audit-engine/pipeline/llm-probe'
import type { SiteGroundTruth } from '@/lib/audit-engine/pipeline/llm-probe'
import { calculateAIVisibilityScore } from '@/lib/audit-engine/ai-visibility-score'
import { calculatePageReadability } from '@/lib/audit-engine/page-ai-readability'
import { runCitationAudit } from '@/lib/audit-engine/ai-citation-audit'
import { generateFixPlaybooks } from '@/lib/audit-engine/fix-playbooks'
import { runMultiModelBenchmark } from '@/lib/audit-engine/pipeline/multi-model-probe'
import { detectIndustry, getUserBenchmarkPosition } from '@/lib/audit-engine/industry-benchmark'
import { generatePredictiveRecommendations } from '@/lib/audit-engine/predictive-recommendations'
import { checkWcagAutomated, buildWcagResults, parseHeuristicResponse, formatWcagForPrompt, type WcagCheckResult, type WcagAuditResult } from '@/lib/audit-engine/pipeline/wcag-checker'
import type { AuditFinding } from '@/types/database'
import { resolveCapability, inferDeployableType } from '@/lib/fix-action-model'

/* ── DB helpers (duplicated from index.ts to keep self-contained) ── */

function getDb() {
  return createServiceSupabase()
}

async function setStatus(auditId: string, status: string, progressPercent?: number) {
  const db = getDb()
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (typeof progressPercent === 'number') update.progress_percent = progressPercent
  const { error } = await db
    .from('audits')
    .update(update as any)
    .eq('id', auditId)
  if (error) throw new Error(`Failed to update status: ${error.message}`)
}

/**
 * Compute the action model fields to spread into an audit_findings insert.
 * Centralises the capability map resolution so every insertion path gets
 * consistent action model data.
 */
function computeActionModelFields(finding: {
  title: string; description: string; recommendation: string;
  fix_type?: string | null; finding_type?: string | null;
}) {
  const cap = resolveCapability({
    title: finding.title,
    description: finding.description,
    recommendation: finding.recommendation,
    fix_type: (finding.fix_type ?? null) as any,
    finding_type: (finding.finding_type ?? 'fixable') as any,
  })
  const deployableType = inferDeployableType({
    title: finding.title,
    description: finding.description,
    recommendation: finding.recommendation,
    fix_type: (finding.fix_type ?? null) as any,
  })
  return {
    fix_format: cap.patchFormat,
    is_editable: cap.editable,
    is_deployable: cap.deployable,
    approval_required: cap.approvalRequired,
    fix_status: 'unreviewed',
    deployable_type: deployableType,
    default_owner: cap.defaultOwner,
  }
}

async function setProgress(auditId: string, progressPercent: number) {
  const db = getDb()
  const { error } = await db
    .from('audits')
    .update({ progress_percent: progressPercent, updated_at: new Date().toISOString() } as any)
    .eq('id', auditId)
  if (error) console.error(`[inngest] progress update error:`, error.message)
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

/* ── Refund credit helper ── */
async function refundCredit(auditId: string) {
  try {
    const db = getDb()
    // Find the payment record for this audit
    const { data: payment } = await db
      .from('payments')
      .select('user_id, stripe_payment_intent_id')
      .eq('audit_id', auditId)
      .single()

    if (!payment) return // No payment to refund (e.g., free first audit)

    const paymentId = (payment as any).stripe_payment_intent_id as string
    const userId = (payment as any).user_id as string

    // Only refund credit-based or free-first payments (not Stripe payments)
    if (paymentId.startsWith('credit_') || paymentId.startsWith('free_first_')) {
      if (paymentId.startsWith('credit_')) {
        // Add credit back
        const { data: profile } = await db
          .from('profiles')
          .select('credits')
          .eq('id', userId)
          .single()

        const currentCredits = (profile as any)?.credits ?? 0
        await db
          .from('profiles')
          .update({ credits: currentCredits + 1, updated_at: new Date().toISOString() } as any)
          .eq('id', userId)
      }

      await auditLog(auditId, 'credit_refunded', 'success',
        paymentId.startsWith('free_first_') ? 'Free first audit — no credit to refund' : '1 credit refunded to user')
    }
  } catch (err) {
    console.error('[inngest] Refund error (non-fatal):', err)
  }
}

/* ── UX Categories — sourced from analyzer.ts (single source of truth) ── */

const UX_CATEGORY_NAMES = UX_CATEGORIES.map((c) => c.name)

/* ── The Inngest function ── */

export const processAuditFn = inngest.createFunction(
  {
    id: 'process-audit',
    retries: 0, // Don't retry — failed audits refund credits and show error UI
    concurrency: {
      limit: 3, // Lower concurrency to avoid API rate limits across parallel audits
    },
    triggers: [{ event: 'audit/process' as const }],
  },
  async ({ event, step }: { event: { data: { auditId: string } }; step: any }) => {
    const auditId = event.data.auditId

    try {
    // ── Transparency: track audit limitations for user-facing alerts ──
    // Each flag becomes a green info alert on the audit detail page,
    // explaining what limitation the engine faced and how it adapted.
    const auditLimitations: Array<{
      id: string
      title: string
      description: string
      tab?: string  // which tab to show this on (null = overview)
    }> = []

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

      // Parse selected_modules: new slug-based system
      const rawModules = (audit as any).selected_modules
      const selectedModules: string[] | null = Array.isArray(rawModules) && rawModules.length > 0
        ? rawModules.filter((v: any) => typeof v === 'string')
        : null

      // Backward compat: if no selected_modules, check legacy selected_pillars
      const rawPillars = (audit as any).selected_pillars
      const selectedPillars: number[] | null = Array.isArray(rawPillars) && rawPillars.length > 0
        ? rawPillars.filter((v: any) => typeof v === 'number' && v >= 0 && v <= 3)
        : null

      // Brand identity ID for brand consistency module
      const brandIdentityId: string | null = (audit as any).brand_identity_id || null

      return {
        userEmail: (audit as any).profiles?.email || '',
        productUrl: (audit as any).product_url as string,
        plan: (audit as any).plan as string,
        auditType: ((audit as any).audit_type as string) || 'website',
        userFocus: (audit as any).ux_concern as string | null,
        language: ((audit as any).language as string) || 'en',
        depthMode: ((audit as any).depth_mode as string) || 'standard',
        selectedModules, // null = complete audit, ['foundation', 'seo_structure'] = partial
        selectedPillars, // legacy fallback
        brandIdentityId, // for brand consistency module
      }
    })

    // ──────────────────────────────────────────────────────────
    // STEP 2: Crawl pages
    // ──────────────────────────────────────────────────────────
    const crawlResult = await step.run('crawl-pages', async () => {
      await setStatus(auditId, 'crawling', 5)
      await auditLog(auditId, 'crawl_started', 'info', `Crawling ${auditDetails.productUrl}`)

      const maxPages = auditDetails.plan === 'free_preview' ? 5 : auditDetails.plan === 'starter' ? 8 : 25
      const crawledPages = await crawlPages(auditDetails.productUrl, maxPages)

      if (crawledPages.length === 0 || !crawledPages[0].contentText) {
        // Check if the site was blocked by anti-bot protection
        const homePage = crawledPages[0]
        if (homePage?.blockedByBot) {
          throw new Error(
            `BLOCKED: ${auditDetails.productUrl} is protected by anti-bot technology (${homePage.blockReason || 'unknown protection'}). ` +
            `This website uses security measures that prevent automated tools from accessing its content. ` +
            `This is not a bug — it means the site's security is working as intended. ` +
            `Your credit has been refunded automatically. ` +
            `To audit this site, ask the site owner to whitelist the Fixpath crawler user-agent, ` +
            `or try again later if the protection is temporary.`
          )
        }

        const hint = homePage?.statusCode
          ? `HTTP ${homePage.statusCode}`
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
      // Filter out auth-gated pages that show login forms instead of real content
      const AUTH_PAGE_SIGNALS = [
        /(?:sign\s*in|log\s*in|login)\s+(?:to\s+)?(?:your\s+)?(?:account|dashboard|continue)/i,
        /(?:forgot|reset)\s+(?:your\s+)?password/i,
        /don.t\s+have\s+an?\s+account\?\s*(?:sign\s*up|register)/i,
        /(?:enter|provide)\s+your\s+(?:email|credentials|password)/i,
      ]
      const AUTH_PATH_SEGMENTS = ['/dashboard', '/app', '/admin', '/account', '/settings', '/profile', '/billing']

      const filteredPages = crawledPages.filter((p) => {
        const url = p.url || ''
        const isAuthPath = AUTH_PATH_SEGMENTS.some((seg) => url.includes(seg))
        if (!isAuthPath) return true
        // Page is behind a known auth path — check if content looks like a login form
        const content = (p.contentText || '').toLowerCase()
        const hitCount = AUTH_PAGE_SIGNALS.filter((pat) => pat.test(content)).length
        return hitCount < 2 // Need 2+ signals to consider it an auth wall
      })

      const pageContent = filteredPages
        .map((p) => {
          let block = ''
          if (p.url) block += `URL: ${p.url}\n`
          if (p.title) block += `Title: ${p.title}\n`
          if (p.h1) block += `H1: ${p.h1}\n`
          if (p.metaDescription) block += `Meta Description: ${p.metaDescription}\n`
          // Include structured head tag data so analyzer can assess SEO/meta/structured data
          if (p.headTags) {
            const headBlock = formatHeadTagsForAnalysis(p.headTags)
            if (headBlock) block += `Head Tags:\n${headBlock}\n`
          }
          if (p.contentText) block += `Content:\n${p.contentText}\n`
          return block
        })
        .join('\n---\n')

      await auditLog(auditId, 'crawl_completed', 'success', `Crawled ${crawledPages.length} page(s)`)

      // Collect head tags for downstream structured data validation
      const allHeadTags = filteredPages
        .filter((p) => p.headTags)
        .map((p) => ({ url: p.url, headTags: p.headTags! }))

      return {
        pageCount: crawledPages.length,
        pageContent, // Passed to analysis steps
        firstPageUrl: crawledPages[0]?.url || '',
        crawledUrls: crawledPages.map((p) => p.url).filter(Boolean) as string[],
        headTags: allHeadTags,
      }
    })

    // ── Transparency: limited pages crawled ──
    if (crawlResult.pageCount === 1) {
      auditLimitations.push({
        id: 'single_page_crawled',
        title: 'Single page analysed',
        description: 'We could only access one page on this website. This may happen if the site uses JavaScript rendering, has bot protection, or has few public pages. Scores and findings are based solely on the homepage.',
      })
    } else if (crawlResult.pageCount <= 3) {
      auditLimitations.push({
        id: 'few_pages_crawled',
        title: 'Limited pages analysed',
        description: `We analysed ${crawlResult.pageCount} pages on this website. Some sites limit crawling or have few public pages. The audit covers what was accessible, but deeper pages may contain additional issues.`,
      })
    }

    // ──────────────────────────────────────────────────────────
    // STEP 2b: Responsive design check (Puppeteer)
    // Renders crawled pages at 375, 768, 1024, 1440 viewports
    // and detects real layout issues (overflow, touch targets,
    // text size, etc). Findings go into category 11
    // (Mobile Experience & Responsive Design).
    // ──────────────────────────────────────────────────────────
    const responsiveCheck = await step.run('check-responsive-design', async () => {
      await setProgress(auditId, 15)
      try {
        const maxUrls = auditDetails.plan === 'free_preview' ? 1 : 3
        const result = await checkResponsiveDesign(crawlResult.crawledUrls, maxUrls)

        // Store responsive findings in audit_findings
        if (result.findings.length > 0) {
          const db = getDb()
          // Get current max sort_order
          const { data: existingFindings } = await db
            .from('audit_findings')
            .select('sort_order')
            .eq('audit_id', auditId)
            .order('sort_order', { ascending: false })
            .limit(1)

          let sortOrder = ((existingFindings?.[0] as any)?.sort_order ?? -1) + 1

          for (const finding of result.findings) {
            const cls = classifyFinding({ title: finding.title, description: finding.description, recommendation: finding.recommendation, severity: finding.severity, categoryIndex: finding.categoryIndex ?? null })
            await db.from('audit_findings').insert({
              audit_id: auditId,
              checklist_item_id: null,
              category_index: finding.categoryIndex ?? null,
              finding_type: cls.findingType,
              fix_type: cls.fixType,
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
              confidence_level: 'deterministic',
              detection_source: 'responsive_checker',
              ...computeActionModelFields({ title: finding.title, description: finding.description, recommendation: finding.recommendation, fix_type: cls.fixType, finding_type: cls.findingType }),
            } as any)
          }
        }

        // Update audit_pages with mobile-friendly data
        if (result.results.length > 0) {
          const db = getDb()
          for (const r of result.results) {
            const issueCount = r.viewportIssues.filter(i => i.viewport === 'Mobile').length
            await db
              .from('audit_pages')
              .update({
                is_mobile_friendly: issueCount === 0,
                viewport_meta: r.hasMobileViewport ? 'width=device-width, initial-scale=1' : null,
              } as any)
              .eq('audit_id', auditId)
              .eq('url', r.url)
          }
        }

        await auditLog(auditId, 'responsive_check_completed', 'success',
          `Responsive check: ${result.findings.length} findings across ${result.results.length} page(s)`, {
            findings_count: result.findings.length,
            pages_checked: result.results.length,
            viewports: [375, 768, 1024, 1440],
          })

        // Transparency: if no responsive issues found, note the checker's scope
        if (result.findings.length === 0) {
          auditLimitations.push({
            id: 'responsive_no_issues',
            title: 'No technical responsive issues detected',
            description: 'Our browser-based responsive check found no technical layout issues (overflow, undersized touch targets, missing viewport meta). This check focuses on measurable technical problems. Subjective visual quality aspects like content density, whitespace balance, and layout aesthetics are not covered by automated testing.',
            tab: 'responsive',
          })
        }

        return {
          summary: result.summary,
          findingsCount: result.findings.length,
        }
      } catch (err) {
        // Non-fatal — if Puppeteer fails (e.g., no Chromium in env),
        // the audit continues with text-based analysis only
        console.error('[inngest] Responsive check failed (non-fatal):', err)
        await auditLog(auditId, 'responsive_check_failed', 'warning',
          `Responsive check failed: ${err instanceof Error ? err.message : String(err)}. Continuing with text-based analysis.`)
        auditLimitations.push({
          id: 'responsive_check_unavailable',
          title: 'Visual responsive check unavailable',
          description: 'We could not render this website in a browser to check responsive layout issues. The responsive analysis is based on code inspection only, so some visual layout problems (spacing, readability, content density) may not be detected.',
          tab: 'responsive',
        })
        return { summary: '', findingsCount: 0 }
      }
    })

    // ──────────────────────────────────────────────────────────
    // STEP 2b2: WCAG 2.1 AA Compliance Check (Puppeteer)
    // Runs comprehensive automated accessibility checks against
    // all WCAG 2.1 Level AA criteria. Individual failures are
    // stored as findings; results are injected into the AI
    // analyzer context so it generates specific fixes, not
    // "conduct an audit" recommendations.
    // ──────────────────────────────────────────────────────────
    const wcagCheck = await step.run('check-wcag-compliance', async () => {
      try {
        const maxUrls = auditDetails.plan === 'free_preview' ? 1 : 3
        const { automatedResults, heuristicPrompts } = await checkWcagAutomated(crawlResult.crawledUrls, maxUrls)

        // Run AI heuristic analysis for criteria Puppeteer can't check
        const heuristicResults = new Map<string, WcagCheckResult[]>()
        for (const [url, prompt] of heuristicPrompts) {
          try {
            const Anthropic = (await import('@anthropic-ai/sdk')).default
            const anthropic = new Anthropic()
            const msg = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 2000,
              messages: [{ role: 'user', content: prompt }],
            })
            const text = msg.content.find(b => b.type === 'text')?.text || ''
            if (text) heuristicResults.set(url, parseHeuristicResponse(text))
          } catch {
            // Heuristic analysis failed — automated results still valid
          }
        }

        const wcagResult = buildWcagResults(automatedResults, heuristicResults)

        // Store WCAG findings in audit_findings (category 8 = Accessibility & WCAG)
        if (wcagResult.totalFindings > 0) {
          const db = getDb()
          const { data: existingFindings } = await db
            .from('audit_findings')
            .select('sort_order')
            .eq('audit_id', auditId)
            .order('sort_order', { ascending: false })
            .limit(1)

          let sortOrder = ((existingFindings?.[0] as any)?.sort_order ?? -1) + 1

          for (const page of wcagResult.pages) {
            for (const finding of page.findings) {
              const cls = classifyFinding({
                title: finding.title,
                description: finding.description,
                recommendation: finding.recommendation,
                severity: finding.severity,
                categoryIndex: 8, // Accessibility & WCAG Compliance
              })
              const wcagDesc = `[WCAG ${finding.wcagCriterion}] ${finding.description}`
              await db.from('audit_findings').insert({
                audit_id: auditId,
                checklist_item_id: null,
                category_index: 8, // Accessibility & WCAG Compliance
                finding_type: cls.findingType,
                fix_type: cls.fixType,
                severity: finding.severity,
                title: finding.title,
                description: wcagDesc,
                evidence: finding.evidence || null,
                page_url: finding.pageUrl || crawlResult.firstPageUrl,
                recommendation: finding.recommendation,
                estimated_impact: null,
                target_element: finding.element || null,
                screenshot_url: null,
                sort_order: sortOrder++,
                confidence_level: 'deterministic',
                detection_source: 'wcag_checker',
                ...computeActionModelFields({ title: finding.title, description: wcagDesc, recommendation: finding.recommendation, fix_type: cls.fixType, finding_type: cls.findingType }),
              } as any)
            }
          }
        }

        // Store WCAG checklist data in audit_pages for the UI panel
        if (wcagResult.pages.length > 0) {
          const db = getDb()
          for (const page of wcagResult.pages) {
            await db
              .from('audit_pages')
              .update({
                wcag_checklist: JSON.stringify(page.checklist),
                wcag_score: page.score,
              } as any)
              .eq('audit_id', auditId)
              .eq('url', page.url)
          }
        }

        await auditLog(auditId, 'wcag_check_completed', 'success',
          `WCAG 2.1 AA check: ${wcagResult.totalFindings} findings, score ${wcagResult.overallScore}/100`, {
            findings_count: wcagResult.totalFindings,
            pages_checked: wcagResult.pages.length,
            overall_score: wcagResult.overallScore,
          })

        return {
          summary: formatWcagForPrompt(wcagResult),
          findingsCount: wcagResult.totalFindings,
          overallScore: wcagResult.overallScore,
        }
      } catch (err) {
        console.error('[inngest] WCAG check failed (non-fatal):', err)
        await auditLog(auditId, 'wcag_check_failed', 'warning',
          `WCAG check failed: ${err instanceof Error ? err.message : String(err)}. Continuing with text-based analysis.`)
        auditLimitations.push({
          id: 'wcag_check_unavailable',
          title: 'Automated WCAG compliance check unavailable',
          description: 'We could not render this website in a browser to run WCAG 2.1 AA compliance checks. The accessibility analysis is based on AI text review only.',
          tab: 'findings',
        })
        return { summary: '', findingsCount: 0, overallScore: 0 }
      }
    })

    // ──────────────────────────────────────────────────────────
    // STEP 2c-2i COMBINED: Run all probe steps in parallel
    // These are independent: AI discovery, structured data,
    // page readability, LLM probe, citation audit, fix playbooks,
    // and multi-model benchmark. Running them in parallel saves
    // ~40-60s vs sequential execution.
    // ──────────────────────────────────────────────────────────
    const probeResults = await step.run('parallel-probes', async () => {
      await setProgress(auditId, 18)

      // ── AI Discovery probe ──
      const aiDiscoveryPromise = (async () => {
        try {
          const result = await probeAIDiscovery(auditDetails.productUrl)
          const summary = formatAIDiscoveryForAnalysis(result)
          await auditLog(auditId, 'ai_discovery_probed', 'info',
            `AI discovery: ${result.summary.signalCount}/4 signals found`)
          return { summary, result }
        } catch (err) {
          console.error('[inngest] AI discovery probe failed (non-fatal):', err)
          return { summary: '', result: null }
        }
      })()

      // ── Structured data validation ──
      const structuredDataPromise = (async () => {
        try {
          const headTagPages = crawlResult.headTags || []
          if (headTagPages.length === 0) {
            return { summary: '', findingsCount: 0, typesFound: [] as string[] }
          }
          const result = validateStructuredData(headTagPages)
          const summary = formatValidationForAnalysis(result)
          if (result.findings.length > 0) {
            const db = getDb()
            const { data: existingFindings } = await db
              .from('audit_findings')
              .select('sort_order')
              .eq('audit_id', auditId)
              .order('sort_order', { ascending: false })
              .limit(1)
            let sortOrder = ((existingFindings?.[0] as any)?.sort_order ?? -1) + 1
            for (const finding of result.findings) {
              // Structured data findings are always fixable (schema type)
              const classification = classifyFinding({
                title: finding.title,
                description: finding.description,
                recommendation: finding.recommendation,
                severity: finding.severity,
                categoryIndex: finding.categoryIndex ?? 17,
              })
              const validated = validateFixableRecommendation({
                ...finding, ...classification,
                title: finding.title,
                description: finding.description,
                recommendation: finding.recommendation,
                severity: finding.severity,
              })
              await db.from('audit_findings').insert({
                audit_id: auditId,
                checklist_item_id: null,
                category_index: finding.categoryIndex ?? 17,
                severity: finding.severity,
                title: finding.title,
                description: finding.description,
                evidence: null,
                page_url: finding.pageUrl || crawlResult.firstPageUrl,
                recommendation: finding.recommendation,
                estimated_impact: finding.estimatedImpact || null,
                target_element: null,
                sort_order: sortOrder++,
                status: 'open',
                dismissed: false,
                finding_type: validated.findingType,
                fix_type: validated.fixType,
                confidence_level: 'deterministic',
                detection_source: 'structured_data',
                ...computeActionModelFields({ title: finding.title, description: finding.description, recommendation: finding.recommendation, fix_type: validated.fixType, finding_type: validated.findingType }),
              } as any)
            }
          }
          return { summary, findingsCount: result.findings.length, typesFound: result.typesFound }
        } catch (err) {
          console.error('[inngest] Structured data validation failed (non-fatal):', err)
          return { summary: '', findingsCount: 0, typesFound: [] as string[] }
        }
      })()

      // ── Page readability ──
      const readabilityPromise = (async () => {
        try {
          const db = getDb()
          const headTagMap = new Map<string, HeadTagData>(
            (crawlResult.headTags || []).map((ht: { url: string; headTags: HeadTagData }) => [ht.url, ht.headTags]),
          )
          const pageBlocks = crawlResult.pageContent.split('\n---\n')
          for (const block of pageBlocks) {
            const urlMatch = block.match(/^URL: (.+)$/m)
            const titleMatch = block.match(/^Title: (.+)$/m)
            const h1Match = block.match(/^H1: (.+)$/m)
            const metaMatch = block.match(/^Meta Description: (.+)$/m)
            const contentMatch = block.match(/Content:\n([\s\S]+)$/m)
            if (!urlMatch) continue
            const url = urlMatch[1]
            const readability = calculatePageReadability({
              url,
              title: titleMatch?.[1] || null,
              h1: h1Match?.[1] || null,
              metaDescription: metaMatch?.[1] || null,
              contentText: contentMatch?.[1] || null,
              headTags: headTagMap.get(url) || null,
            })
            await db
              .from('audit_pages')
              .update({ ai_readability: readability } as any)
              .eq('audit_id', auditId)
              .eq('url', url)
          }
        } catch (err) {
          console.error('[inngest] Page readability calculation failed (non-fatal):', err)
        }
      })()

      // ── LLM Probe ──
      // NOTE: This is a function, NOT an IIFE — deferred to avoid concurrent
      // Anthropic API pressure. Called sequentially after lightweight probes.
      const runLlmProbeStep = async () => {
        try {
          const firstPage = crawlResult.pageContent.split('\n---\n')[0] || ''
          const titleMatch = firstPage.match(/^Title: (.+)$/m)
          const metaMatch = firstPage.match(/^Meta Description: (.+)$/m)
          const allContent = crawlResult.pageContent.toLowerCase()
          const hasPricing = allContent.includes('pricing') || allContent.includes('price') || allContent.includes('/mo') || allContent.includes('per month')
          let pricingText: string | null = null
          if (hasPricing) {
            const pricingIdx = crawlResult.pageContent.toLowerCase().indexOf('pricing')
            if (pricingIdx >= 0) pricingText = crawlResult.pageContent.substring(pricingIdx, pricingIdx + 1500)
          }
          const groundTruth: SiteGroundTruth = {
            siteName: titleMatch?.[1]?.split('|')[0]?.split('-')[0]?.trim() || null,
            siteDescription: metaMatch?.[1] || null,
            pricingText,
            offeringText: firstPage.substring(0, 2000),
            fullContent: crawlResult.pageContent,
            pages: crawlResult.crawledUrls.map((url: string) => {
              const pageBlock = crawlResult.pageContent.split('\n---\n').find((b: string) => b.includes(`URL: ${url}`))
              const pageTitleMatch = pageBlock?.match(/^Title: (.+)$/m)
              return { url, title: pageTitleMatch?.[1] || null }
            }),
          }
          let domain = ''
          try { domain = new URL(auditDetails.productUrl).hostname.replace(/^www\./, '') } catch {}
          const session = await runLlmProbe(domain, groundTruth)
          const summary = formatLlmProbeForAnalysis(session)
          const db = getDb()
          for (const r of session.results) {
            await db.from('llm_probe_results').insert({
              audit_id: auditId,
              question: r.question,
              answer: r.answer,
              accuracy: r.accuracy,
              accuracy_note: r.accuracyNote,
              cited_url: r.citedUrl,
              model_used: r.modelUsed,
            } as any)
          }
          await auditLog(auditId, 'llm_probe_completed', 'success',
            `LLM probe: ${session.accuracySummary.scorePercent}% accuracy`)
          return { summary, accuracyScore: session.accuracySummary.scorePercent, session }
        } catch (err) {
          console.error('[inngest] LLM probe failed (non-fatal):', err)
          return { summary: '', accuracyScore: 0, session: null }
        }
      }

      // ── Citation Audit ──
      const runCitationStep = async () => {
        try {
          const db = getDb()
          let domain = ''
          try { domain = new URL(auditDetails.productUrl).hostname.replace(/^www\./, '') } catch {}
          const pageBlocks = crawlResult.pageContent.split('\n---\n')
          const pages = pageBlocks.map((block: string) => {
            const urlMatch = block.match(/^URL: (.+)$/m)
            const titleMatch = block.match(/^Title: (.+)$/m)
            const contentMatch = block.match(/Content:\n([\s\S]+)$/m)
            return {
              url: urlMatch?.[1] || '',
              title: titleMatch?.[1] || null,
              contentSnippet: contentMatch?.[1]?.substring(0, 600) || '',
            }
          }).filter((p: { url: string }) => p.url)
          const result = await runCitationAudit(domain, pages)
          if (result.citations.length > 0) {
            const inserts = result.citations.map(c => ({
              audit_id: auditId,
              page_url: c.citedUrl || '',
              cited_text: c.citedText || c.claim,
              ai_context: c.claim,
              citation_type: c.citationType,
              model_used: 'claude-haiku',
            }))
            await db.from('ai_citations').insert(inserts as any)
          }
          await auditLog(auditId, 'citation_audit_completed', 'info',
            `Citation audit: ${result.citedPages.length} pages cited, citability: ${result.citabilityScore}%`)
          return result
        } catch (err) {
          console.error('[inngest] Citation audit failed (non-fatal):', err)
          return null
        }
      }

      // ── Multi-Model Benchmark ──
      const runMultiModelStep = async () => {
        try {
          const db = getDb()
          let domain = ''
          try { domain = new URL(auditDetails.productUrl).hostname.replace(/^www\./, '') } catch {}
          const pageBlocks = crawlResult.pageContent.split('\n---\n')
          const firstBlock = pageBlocks[0] || ''
          const titleMatch = firstBlock.match(/^Title: (.+)$/m)
          const metaMatch = firstBlock.match(/^Meta Description: (.+)$/m)
          const contentMatch = firstBlock.match(/Content:\n([\s\S]+)$/m)
          const firstPageContent = contentMatch?.[1] || firstBlock
          const allContentLower = crawlResult.pageContent.toLowerCase()
          let pricingText: string | null = null
          const pricingIdx = allContentLower.indexOf('pricing')
          if (pricingIdx >= 0) pricingText = crawlResult.pageContent.substring(pricingIdx, pricingIdx + 1500)
          const groundTruth: SiteGroundTruth = {
            siteName: titleMatch?.[1]?.split('|')[0]?.split('-')[0]?.trim() || null,
            siteDescription: metaMatch?.[1] || null,
            pricingText,
            offeringText: firstPageContent.substring(0, 2000),
            fullContent: crawlResult.pageContent.substring(0, 6000),
            pages: pageBlocks.map((block: string) => {
              const urlM = block.match(/^URL: (.+)$/m)
              const titleM = block.match(/^Title: (.+)$/m)
              return { url: urlM?.[1] || '', title: titleM?.[1] || null }
            }).filter((p: { url: string }) => p.url),
          }
          const comparison = await runMultiModelBenchmark(domain, groundTruth)
          for (const b of comparison.benchmarks) {
            await db.from('multi_model_probes').insert({
              audit_id: auditId,
              model_id: b.modelId,
              model_label: b.modelLabel,
              accuracy_score: b.accuracyScore,
              accurate_count: b.accurateCount,
              partial_count: b.partialCount,
              inaccurate_count: b.inaccurateCount,
              hallucinated_count: b.hallucinatedCount,
              no_data_count: b.noDataCount,
              total_questions: b.totalQuestions,
              results_json: b.results as any,
              status: b.status,
              error_message: b.errorMessage,
            } as any)
          }
          const industry = detectIndustry(
            auditDetails.productType,
            crawlResult.pageContent.substring(0, 3000),
          )
          await db.from('audits')
            .update({ detected_industry: industry } as any)
            .eq('id', auditId)
          await auditLog(auditId, 'multi_model_benchmark_completed', 'info',
            `Multi-model benchmark: avg ${comparison.averageAccuracy}% accuracy. Best: ${comparison.bestModel}`)
          return { comparison, industry }
        } catch (err) {
          console.error('[inngest] Multi-model benchmark failed (non-fatal):', err)
          return { comparison: null, industry: null }
        }
      }

      // ── Execution order: lightweight probes first, then API-heavy ones sequentially ──
      // This prevents 30+ concurrent Anthropic API calls from hitting rate limits.

      // Phase 1: Run lightweight probes in parallel (no Anthropic API calls)
      const [aiDisc, sdResult] = await Promise.all([
        aiDiscoveryPromise,
        structuredDataPromise,
        readabilityPromise,
      ])

      // Phase 2: Run LLM probe (5+1 Anthropic API calls)
      const llmProbe = await runLlmProbeStep()

      // Phase 3: Run citation audit (mostly HTTP fetches, 1 Anthropic call)
      const citation = await runCitationStep()

      // Phase 4: Run multi-model benchmark LAST (12+ API calls across providers + 4 grading)
      const multiModel = await runMultiModelStep()

      await setProgress(auditId, 25)

      return {
        aiDiscovery: aiDisc,
        structuredData: sdResult,
        llmProbe: llmProbe,
        citation: citation,
        multiModel: multiModel,
      }
    })

    // Unpack parallel probe results for downstream use
    const aiDiscovery = probeResults.aiDiscovery
    const structuredDataResult = probeResults.structuredData
    const llmProbeResult = probeResults.llmProbe
    const citationResult = probeResults.citation
    const multiModelResult = probeResults.multiModel

    // ──────────────────────────────────────────────────────────
    // STEP 2j: Fix Playbooks (fast, depends on probe results)
    // ──────────────────────────────────────────────────────────
    const playbooks = await step.run('fix-playbooks', async () => {
      try {
        const db = getDb()

        // Build playbook input from crawl data
        const pageBlocks = crawlResult.pageContent.split('\n---\n')
        const pages = pageBlocks.map((block: string) => {
          const urlMatch = block.match(/^URL: (.+)$/m)
          const titleMatch = block.match(/^Title: (.+)$/m)
          const metaMatch = block.match(/^Meta Description: (.+)$/m)
          return {
            url: urlMatch?.[1] || '',
            title: titleMatch?.[1] || null,
            metaDescription: metaMatch?.[1] || null,
          }
        }).filter((p: { url: string }) => p.url)

        const firstPage = pageBlocks[0] || ''
        const titleMatch = firstPage.match(/^Title: (.+)$/m)
        const metaMatch = firstPage.match(/^Meta Description: (.+)$/m)

        // Get head tags from first page
        const headTagEntries = crawlResult.headTags || []
        const firstHeadTags = headTagEntries.length > 0 ? headTagEntries[0].headTags : null

        // Check structured data types from ALL pages (not just first)
        const sdTypes: string[] = []
        function extractSdTypes(jsonLdItems: any[]) {
          for (const item of jsonLdItems) {
            // Handle @graph containers (e.g., Yoast SEO, WordPress plugins)
            if (item['@graph'] && Array.isArray(item['@graph'])) {
              extractSdTypes(item['@graph'])
            }
            if (item['@type']) {
              // Handle array @type (e.g., ["Organization", "LocalBusiness"])
              const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']]
              for (const t of types) {
                const normalized = String(t).trim()
                if (normalized && !sdTypes.includes(normalized)) {
                  sdTypes.push(normalized)
                }
              }
            }
          }
        }
        for (const entry of headTagEntries) {
          if (entry.headTags?.jsonLd) {
            extractSdTypes(entry.headTags.jsonLd)
          }
        }

        let domain = ''
        try { domain = new URL(auditDetails.productUrl).hostname.replace(/^www\./, '') } catch {}

        // Check AI discovery files from probe results (not string matching)
        const hasLlmsTxt = aiDiscovery.result?.summary?.hasLlmsTxt ?? false
        const hasAiPlugin = aiDiscovery.result?.summary?.hasAiPlugin ?? false

        const snippets = generateFixPlaybooks({
          domain,
          siteName: titleMatch?.[1]?.split('|')[0]?.split('-')[0]?.trim() || null,
          siteDescription: metaMatch?.[1] || null,
          pages,
          headTags: firstHeadTags as any || null,
          hasStructuredData: sdTypes.length > 0,
          structuredDataTypes: sdTypes,
          hasLlmsTxt,
          hasRobotsTxt: aiDiscovery.result?.robotsAI?.hasRobotsTxt ?? false,
          hasAiPlugin,
        })

        // Store playbooks
        if (snippets.length > 0) {
          const inserts = snippets.map(s => ({
            audit_id: auditId,
            playbook_type: s.type,
            title: s.title,
            description: s.description,
            code_snippet: s.code,
            language: s.language,
            priority: s.priority,
          }))
          await db.from('fix_playbooks').insert(inserts as any)
        }

        await auditLog(auditId, 'fix_playbooks_generated', 'info',
          `Generated ${snippets.length} fix playbook(s)`)

        return snippets
      } catch (err) {
        console.error('[inngest] Fix playbooks failed (non-fatal):', err)
        await auditLog(auditId, 'fix_playbooks_failed', 'warning',
          `Fix playbooks failed: ${err instanceof Error ? err.message : String(err)}`)
        return []
      }
    })

    // ──────────────────────────────────────────────────────────
    // STEP 3: Build site context map + set status to analysing
    // Creates a summary of what exists across ALL pages so the
    // analyzer has cross-page awareness (e.g., "founder bio exists
    // on /about" prevents false positive on homepage)
    // ──────────────────────────────────────────────────────────
    const siteContext = await step.run('build-site-context', async () => {
      await setStatus(auditId, 'analysing', 30)

      // Build a structured map of what each page contains
      const lines: string[] = []
      const pages = crawlResult.pageContent.split('\n---\n')
      for (const page of pages) {
        const urlMatch = page.match(/^URL: (.+)$/m)
        const titleMatch = page.match(/^Title: (.+)$/m)
        const h1Match = page.match(/^H1: (.+)$/m)
        if (urlMatch) {
          const url = urlMatch[1]
          const title = titleMatch?.[1] || ''
          const h1 = h1Match?.[1] || ''
          const contentPreview = page.replace(/^(URL|Title|H1|Meta Description|Content):.*\n?/gm, '').trim().substring(0, 300)
          lines.push(`- ${url} | "${title}" | H1: "${h1}" | Preview: ${contentPreview}...`)
        }
      }

      const siteMap = `SITE MAP — What exists across ALL crawled pages:
${lines.join('\n')}

IMPORTANT CROSS-PAGE CONTEXT:
The content below is from the ENTIRE site, not just one page. Before flagging something as "missing" (e.g., "no founder credentials", "no pricing transparency", "no FAQ"), check if it exists on ANY of the pages listed above. Many sites spread content across dedicated pages (About, Pricing, FAQ, Contact). Only flag something as missing if it genuinely doesn't exist ANYWHERE on the site.`

      // Fetch user's site notes + FULL previous audit baseline
      const noteDb = getDb()
      let domain = ''
      try { domain = new URL(auditDetails.productUrl).hostname.replace(/^www\./, '') } catch {}

      const { data: auditOwner } = await noteDb.from('audits').select('user_id').eq('id', auditId).single()
      const userId = (auditOwner as any)?.user_id

      let userContext = ''
      let previousCategoryScores: Array<{ name: string; score: number; summary: string }> = []
      let previousOverallScore = 0
      let previousTotalFindings = 0
      let previousRawFindings: Array<{
        title: string; severity: string; description: string; recommendation: string;
        estimated_impact: string | null; target_element: string | null; page_url: string | null;
        sort_order: number; status: string; dismissed: boolean; dismissal_reason: string | null;
      }> = []
      let previousExecutiveSummary = ''
      let previousReportJson: any = null
      if (domain && userId) {
        // Fetch site notes + previous audit ID in parallel
        const [siteNotesRes, prevAuditsRes] = await Promise.all([
          noteDb.from('site_notes')
            .select('note_type, title, content, category, finding_ref')
            .eq('user_id', userId).eq('domain', domain).eq('is_active', true)
            .order('created_at', { ascending: false }).limit(20),
          noteDb.from('audits')
            .select('id, product_url').eq('user_id', userId).neq('id', auditId)
            .eq('status', 'completed').ilike('product_url', `%${domain}%`)
            .order('completed_at', { ascending: false }).limit(1),
        ])

        // Site notes (dismissals, context, discussions)
        if (siteNotesRes.data && siteNotesRes.data.length > 0) {
          const noteLines = (siteNotesRes.data as any[]).map((n) => {
            const typeLabel = n.note_type === 'dismissal' ? 'SKIP' : n.note_type === 'discussion' ? 'CONTEXT' : 'NOTE'
            return `  [${typeLabel}] ${n.title}: ${n.content}`
          })
          userContext = `\nCLIENT NOTES — RESPECT THESE:\n${noteLines.join('\n')}\nDo NOT re-flag [SKIP] findings.`
        }

        // FULL previous audit baseline — scores + ALL findings with statuses
        if (prevAuditsRes.data && prevAuditsRes.data.length > 0) {
          const prevAuditId = (prevAuditsRes.data[0] as any).id

          // Fetch previous report scores + all findings (FULL data for baseline copy)
          const [prevReportRes, prevFindingsRes] = await Promise.all([
            noteDb.from('reports').select('overall_score, executive_summary, raw_json').eq('audit_id', prevAuditId).single(),
            noteDb.from('audit_findings')
              .select('title, severity, description, recommendation, estimated_impact, target_element, page_url, sort_order, status, dismissed, dismissal_reason, category_index')
              .eq('audit_id', prevAuditId)
              .order('sort_order', { ascending: true }).limit(60),
          ])

          // Previous category scores + full report as baseline
          if (prevReportRes.data) {
            const prevReport = prevReportRes.data as any
            previousOverallScore = prevReport.overall_score || 0
            previousExecutiveSummary = prevReport.executive_summary || ''
            previousReportJson = prevReport.raw_json || null
            const prevCatScores = prevReport.raw_json?.categoryScores
            if (Array.isArray(prevCatScores) && prevCatScores.length > 0) {
              // Store for deterministic baseline anchoring in generateReport
              previousCategoryScores = prevCatScores.map((c: any) => ({
                name: c.name as string,
                score: c.score as number,
                summary: (c.summary || '') as string,
              }))
              const scoreLines = prevCatScores.map((c: any) => `  ${c.name}: ${c.score}/100`)
              userContext += `\n\nPREVIOUS AUDIT BASELINE (overall: ${prevReport.overall_score}/100):
${scoreLines.join('\n')}

CRITICAL — SCORE CONSISTENCY:
The scores above are from the client's PREVIOUS audit of this SAME site. Your new scores MUST be calibrated against this baseline:
- If the site content has NOT changed for a category, the score should be SIMILAR (within 5-10 points). Do NOT randomly assign different scores for unchanged content.
- If the site content HAS improved (e.g., new alt text added, better CTA copy), the score should INCREASE and you should note what improved.
- If the site content has REGRESSED, the score should DECREASE and you should explain what got worse.
- A score swing of more than 15 points for the same unchanged content is a BUG in your analysis. Be consistent.`
            }
          }

          // All previous findings with their current status
          if (prevFindingsRes.data && prevFindingsRes.data.length > 0) {
            previousTotalFindings = prevFindingsRes.data.length
            previousRawFindings = (prevFindingsRes.data as any[]).map((f) => ({
              title: f.title, severity: f.severity, description: f.description,
              recommendation: f.recommendation, estimated_impact: f.estimated_impact,
              target_element: f.target_element, page_url: f.page_url,
              sort_order: f.sort_order, status: f.status, dismissed: f.dismissed,
              dismissal_reason: f.dismissal_reason,
            }))
            const findingLines = (prevFindingsRes.data as any[]).map((f) => {
              if (f.dismissed) return `  [SKIP] "${f.title}" — Dismissed: ${f.dismissal_reason || 'by user'}`
              if (f.status === 'fixed') return `  [FIXED] "${f.title}" — Client says resolved`
              if (f.status === 'in_progress') return `  [IN PROGRESS] "${f.title}" — Being worked on`
              return `  [OPEN] "${f.title}" (${f.severity})`
            })
            userContext += `\n\nPREVIOUS FINDINGS (${prevFindingsRes.data.length} total):
${findingLines.join('\n')}

RULES FOR RE-AUDIT:
- [SKIP] findings: Do NOT report these again. The client has dismissed them with a reason.
- [FIXED] findings: Verify if the fix is visible in the current content. If fixed, do not re-report. If still broken, re-report with a note that the fix may not have been deployed.
- [IN PROGRESS] findings: Check if the issue is still present. If still present, re-report at the same severity.
- [OPEN] findings: These were not addressed. If still present, re-report them. If the content has changed and the issue is resolved, do not re-report.
- NEW findings: Only report genuinely NEW issues not covered by any previous finding. Do not rephrase an existing finding as a "new" one.`
          }
        }
      }

      // Determine effective depth mode:
      // - 'deep' explicitly requested → always deep (fresh AI analysis, find new issues)
      // - 'baseline' explicitly requested → baseline (deterministic, copy previous findings)
      // - 'standard' (default re-audit) → baseline if previous audit exists (score stability),
      //   otherwise deep (first audit always needs full AI analysis)
      // This ensures re-audits produce consistent scores unless the user explicitly
      // requests a deep analysis via "Dig Deeper". Score swings of -30+ points on
      // unchanged sites were caused by always running non-deterministic AI analysis.
      let effectiveDepthMode: 'deep' | 'baseline' = 'deep'
      if (auditDetails.depthMode === 'baseline') {
        effectiveDepthMode = 'baseline'
      } else if (auditDetails.depthMode === 'standard' && previousRawFindings.length > 0) {
        // Standard re-audit with previous findings → use baseline for score stability
        effectiveDepthMode = 'baseline'
      }

      // Append responsive check results so the AI analyzer has browser-verified data
      const responsiveContext = responsiveCheck.summary
        ? `\n\n${responsiveCheck.summary}`
        : ''

      // Append LLM probe context so analyzer can reference AI perception gaps
      const llmProbeContext = llmProbeResult.summary
        ? `\n\n${llmProbeResult.summary}`
        : ''

      // Append WCAG check results so the AI analyzer has real compliance data
      const wcagContext = wcagCheck.summary || ''

      const fullContext = siteMap + userContext + responsiveContext + llmProbeContext + wcagContext

      await auditLog(auditId, 'site_context_built', 'success',
        `Site context built from ${lines.length} pages${userContext ? ' + user notes' : ''} | depth: ${effectiveDepthMode}`)
      return {
        context: fullContext,
        effectiveDepthMode,
        previousCategoryScores,
        previousOverallScore,
        previousTotalFindings,
        previousRawFindings,
        previousExecutiveSummary,
        previousReportJson,
      }
    })

    const effectiveDepthMode = siteContext.effectiveDepthMode

    console.log(`[inngest] Audit ${auditId}: depth mode = ${effectiveDepthMode} (requested: ${auditDetails.depthMode})`)
    await step.run('log-depth-mode', async () => {
      await auditLog(auditId, 'depth_mode', 'info',
        `Analysis depth: ${effectiveDepthMode}${effectiveDepthMode === 'baseline' ? ' — re-audit: copying previous findings, no AI analysis' : ' — full AI analysis'}`)
    })

    let verificationData: { verified: number; likelyFixed: number; poorlyFixed: number; results: Array<{ findingId: string; status: string; note: string }> } | null = null

    if (effectiveDepthMode === 'baseline') {
      // ════════════════════════════════════════════════════════════
      // BASELINE RE-AUDIT — NO AI ANALYSIS
      // Copy previous findings based on their status:
      //   [OPEN]        → copy as-is (issue still stands)
      //   [IN PROGRESS] → copy as-is (still being worked on)
      //   [FIXED]       → drop (user says it's fixed)
      //   [DISMISSED]   → drop (user dismissed it)
      // Score is 100% deterministic from previous baseline.
      // Same site + no status changes = EXACT same findings + EXACT same score.
      // ════════════════════════════════════════════════════════════
      await step.run('baseline-copy-findings', async () => {
        const db = getDb()
        const prevFindings = siteContext.previousRawFindings
        let sortOrder = 0
        let copiedCount = 0
        let droppedFixed = 0
        let droppedDismissed = 0

        for (const pf of prevFindings) {
          // Skip dismissed findings
          if (pf.dismissed) {
            droppedDismissed++
            continue
          }
          // Skip fixed findings
          if (pf.status === 'fixed') {
            droppedFixed++
            continue
          }
          // Copy [OPEN], [IN PROGRESS], [BACKLOG] findings as-is
          // Preserve finding_type/fix_type from previous audit if available
          const pfFindingType = (pf as any).finding_type || 'fixable'
          const pfFixType = (pf as any).fix_type || null
          await db.from('audit_findings').insert({
            audit_id: auditId,
            checklist_item_id: null,
            category_index: (pf as any).category_index ?? null,
            severity: pf.severity,
            title: pf.title,
            description: pf.description,
            evidence: null,
            page_url: pf.page_url,
            recommendation: pf.recommendation,
            estimated_impact: pf.estimated_impact || null,
            target_element: pf.target_element || null,
            screenshot_url: null,
            sort_order: sortOrder++,
            finding_type: pfFindingType,
            fix_type: pfFixType,
            confidence_level: (pf as any).confidence_level || 'heuristic',
            detection_source: 'gap_fill',
            ...computeActionModelFields({ title: pf.title, description: pf.description, recommendation: pf.recommendation, fix_type: pfFixType, finding_type: pfFindingType }),
          } as any)
          copiedCount++
        }

        await auditLog(auditId, 'baseline_findings_copied', 'success',
          `Baseline: ${copiedCount} findings carried forward, ${droppedFixed} fixed, ${droppedDismissed} dismissed`, {
            copied: copiedCount,
            dropped_fixed: droppedFixed,
            dropped_dismissed: droppedDismissed,
            total_previous: prevFindings.length,
          })

        return { copiedCount, droppedFixed, droppedDismissed }
      })

      // ════════════════════════════════════════════════════════════
      // VERIFICATION STEP — AI check against freshly crawled live site
      // Checks each copied finding to see if it's still present.
      // Does NOT affect scores — flags findings for user confirmation.
      // Results stored both in DB (if columns exist) and returned
      // directly so the report step doesn't depend on DB columns.
      // ════════════════════════════════════════════════════════════
      verificationData = await step.run('ai-verify-findings', async () => {
        const db = getDb()

        // Fetch the findings we just copied
        const { data: copiedFindings } = await db
          .from('audit_findings')
          .select('id, title, description, recommendation, page_url, severity, target_element')
          .eq('audit_id', auditId)
          .order('sort_order', { ascending: true })

        if (!copiedFindings || copiedFindings.length === 0) {
          await auditLog(auditId, 'verification_skipped', 'info', 'No findings to verify')
          return { verified: 0, likelyFixed: 0, poorlyFixed: 0, results: [] as Array<{ findingId: string; status: string; note: string }> }
        }

        // Use the freshly crawled page content for verification
        const freshContent = crawlResult.pageContent

        await auditLog(auditId, 'verification_started', 'info',
          `Verifying ${copiedFindings.length} findings against live site`)

        const verificationResults = await verifyFindings(
          copiedFindings as any[],
          freshContent,
          auditDetails.language,
        )

        // Try to update findings in DB (columns may not exist yet — graceful fallback)
        let likelyFixedCount = 0
        let poorlyFixedCount = 0
        for (const result of verificationResults) {
          try {
            await db
              .from('audit_findings')
              .update({
                verification_status: result.status,
                verification_note: result.note,
              } as any)
              .eq('id', result.findingId)
          } catch (e) {
            // Columns may not exist yet — that's OK, results are carried in memory
          }

          if (result.status === 'likely_fixed') likelyFixedCount++
          if (result.status === 'poorly_fixed') poorlyFixedCount++
        }

        await auditLog(auditId, 'verification_completed', 'success',
          `Verified ${verificationResults.length} findings: ${likelyFixedCount} likely fixed, ${poorlyFixedCount} poorly fixed, ${verificationResults.length - likelyFixedCount - poorlyFixedCount} confirmed open`, {
            total_verified: verificationResults.length,
            likely_fixed: likelyFixedCount,
            poorly_fixed: poorlyFixedCount,
            confirmed_open: verificationResults.length - likelyFixedCount - poorlyFixedCount,
          })

        return {
          verified: verificationResults.length,
          likelyFixed: likelyFixedCount,
          poorlyFixed: poorlyFixedCount,
          results: verificationResults.map(r => ({ findingId: r.findingId, status: r.status, note: r.note })),
        }
      })

      // ════════════════════════════════════════════════════════════
      // GAP FILL — Analyze modules that didn't exist in previous audit
      // If new modules (e.g., SEO Structure) were added after the
      // original audit, baseline copy has nothing to carry forward.
      // Detect those gaps and run fresh AI analysis on just the
      // missing categories so re-audits include full coverage.
      // ════════════════════════════════════════════════════════════
      const MODULE_SLUG_ORDER_BL = ['foundation', 'human_experience', 'inclusive_design', 'future_readiness', 'seo_structure', 'brand_consistency']

      // Determine which modules should be active for this audit
      let activeSlugsBl: string[]
      if (auditDetails.selectedModules) {
        activeSlugsBl = auditDetails.selectedModules
      } else if (auditDetails.selectedPillars) {
        activeSlugsBl = auditDetails.selectedPillars
          .filter((idx: number) => idx >= 0 && idx < 4)
          .map((idx: number) => MODULE_SLUG_ORDER_BL[idx])
        // Also include modules that are part of a complete audit but have no legacy index
        for (const mod of AUDIT_MODULES) {
          if (mod.includedInComplete && mod.legacyPillarIndex == null && !activeSlugsBl.includes(mod.slug)) {
            activeSlugsBl.push(mod.slug)
          }
        }
      } else {
        activeSlugsBl = [...COMPLETE_AUDIT_SLUGS]
      }

      // Skip brand_consistency if no brand identity provided
      if (activeSlugsBl.includes('brand_consistency') && !auditDetails.brandIdentityId) {
        activeSlugsBl = activeSlugsBl.filter(s => s !== 'brand_consistency')
      }

      // Check which modules had coverage in the previous audit
      const prevCategoryNames = new Set(
        siteContext.previousCategoryScores.map((c: { name: string }) => c.name)
      )

      // Find modules whose categories are ALL missing from previous scores
      const missingModuleSlugs: string[] = []
      for (const slug of activeSlugsBl) {
        const moduleIdx = MODULE_SLUG_ORDER_BL.indexOf(slug)
        if (moduleIdx === -1) continue
        const moduleCategoryNames = UX_CATEGORY_NAMES.slice(moduleIdx * 4, moduleIdx * 4 + 4)
        const hasAnyCoverage = moduleCategoryNames.some(name => prevCategoryNames.has(name))
        if (!hasAnyCoverage) {
          missingModuleSlugs.push(slug)
        }
      }

      if (missingModuleSlugs.length > 0) {
        await step.run('log-gap-fill', async () => {
          await auditLog(auditId, 'gap_fill_detected', 'info',
            `Baseline gap fill: ${missingModuleSlugs.length} new module(s) need fresh analysis: ${missingModuleSlugs.join(', ')}`)
        })

        // Build the set of category indices to analyze for missing modules
        const gapIndices = new Set<number>()
        for (const slug of missingModuleSlugs) {
          const moduleIdx = MODULE_SLUG_ORDER_BL.indexOf(slug)
          if (moduleIdx === -1) continue
          for (let c = moduleIdx * 4; c < moduleIdx * 4 + 4; c++) {
            if (c < UX_CATEGORY_NAMES.length) gapIndices.add(c)
          }
        }

        const gapCategories = UX_CATEGORY_NAMES.filter((_, idx) => gapIndices.has(idx))
        // Build a map from gapCategories position → original category index
        const gapCategoryIndices: number[] = []
        UX_CATEGORY_NAMES.forEach((_, idx) => { if (gapIndices.has(idx)) gapCategoryIndices.push(idx) })
        const aiDiscoveryBlockBl = aiDiscovery.summary ? `\n\n${aiDiscovery.summary}` : ''
        const structuredDataBlockBl = structuredDataResult.summary ? `\n\n${structuredDataResult.summary}` : ''
        const llmProbeBlockBl = llmProbeResult.summary ? `\n\n${llmProbeResult.summary}` : ''
        const contentWithContextBl = `${siteContext.context}\n\n${crawlResult.pageContent}${aiDiscoveryBlockBl}${structuredDataBlockBl}${llmProbeBlockBl}`

        // Handle brand context for brand_consistency gap fill
        let brandContentBl = contentWithContextBl
        const brandCategoryNamesBl = new Set(UX_CATEGORY_NAMES.slice(20, 24))
        if (missingModuleSlugs.includes('brand_consistency') && auditDetails.brandIdentityId) {
          try {
            const db = getDb()
            const { data: brandFiles } = await db
              .from('brand_identity_files')
              .select('file_name, file_url, file_type')
              .eq('brand_identity_id', auditDetails.brandIdentityId)

            if (brandFiles && brandFiles.length > 0) {
              const extracted = await extractAllBrandFiles(
                brandFiles.map((f: any) => ({
                  file_name: f.file_name as string,
                  file_url: f.file_url as string,
                  file_type: f.file_type as string | null,
                })),
              )
              const textParts = extracted
                .filter(e => e.textContent && e.textContent.length > 0)
                .map(e => `[Brand file: ${e.fileName}]\n${e.textContent}`)
              const brandContext = textParts.join('\n\n---\n\n')
              brandContentBl = `=== BRAND IDENTITY GUIDELINES ===\n${brandContext}\n\n=== WEBSITE CONTENT ===\n${contentWithContextBl}`
            }
          } catch (err) {
            console.error('[inngest] Brand file extraction error in gap fill (non-fatal):', err)
          }
        }

        // Count existing findings to set sort_order offset
        const existingFindingsCount = siteContext.previousRawFindings.filter(
          (f: any) => f.status !== 'fixed' && !f.dismissed
        ).length

        // Run AI analysis on gap categories in a single batch
        const gapBatchResult = await step.run('gap-fill-analysis', async () => {
          const db = getDb()
          let sortOrder = existingFindingsCount
          let findingsInGap = 0

          const gapResults = await Promise.all(
            gapCategories.map((categoryName) => {
              const isBrandCategory = brandCategoryNamesBl.has(categoryName)
              const content = isBrandCategory ? brandContentBl : contentWithContextBl
              return analyzeCategory(
                content, categoryName, [], auditDetails.userFocus, auditDetails.language, 'deep',
              )
            }),
          )

          for (let catIdx = 0; catIdx < gapResults.length; catIdx++) {
            const findings = gapResults[catIdx]
            const originalCatIdx = gapCategoryIndices[catIdx] ?? null
            for (const finding of findings) {
              const classification = classifyFinding({
                title: finding.title,
                description: finding.description,
                recommendation: finding.recommendation,
                severity: finding.severity,
                findingType: finding.findingType,
                fixType: finding.fixType,
                categoryIndex: originalCatIdx,
              })
              const validated = validateFixableRecommendation({
                title: finding.title,
                description: finding.description,
                recommendation: finding.recommendation,
                severity: finding.severity,
                ...classification,
              })
              await db.from('audit_findings').insert({
                audit_id: auditId,
                checklist_item_id: null,
                category_index: originalCatIdx,
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
                finding_type: validated.findingType,
                fix_type: validated.fixType,
                confidence_level: 'heuristic',
                detection_source: 'deep_analyzer',
                ...computeActionModelFields({ title: finding.title, description: finding.description, recommendation: finding.recommendation, fix_type: validated.fixType, finding_type: validated.findingType }),
              } as any)
              findingsInGap++
            }
          }

          return { findingsInGap, categoriesAnalyzed: gapCategories.length }
        })

        await step.run('log-gap-fill-done', async () => {
          await auditLog(auditId, 'gap_fill_completed', 'success',
            `Gap fill: analyzed ${gapBatchResult.categoriesAnalyzed} categories, found ${gapBatchResult.findingsInGap} new findings`)
        })
      }

    } else {
      // ════════════════════════════════════════════════════════════
      // DEEP MODE (first audit or explicit Dig Deeper) — FULL AI ANALYSIS
      // ════════════════════════════════════════════════════════════
      // ── Determine which modules (and thus categories) to analyze ──
      // Module slug → category index mapping (each module = 4 categories):
      //   foundation → 0-3, human_experience → 4-7, inclusive_design → 8-11,
      //   future_readiness → 12-15, seo_structure → 16-19, brand_consistency → 20-23
      const MODULE_SLUG_ORDER = ['foundation', 'human_experience', 'inclusive_design', 'future_readiness', 'seo_structure', 'brand_consistency']

      let activeSlugs: string[]
      if (auditDetails.selectedModules) {
        // New system: explicit module slugs from DB
        activeSlugs = auditDetails.selectedModules
      } else if (auditDetails.selectedPillars) {
        // Legacy fallback: convert old pillar indices to module slugs (0-3 only)
        activeSlugs = auditDetails.selectedPillars
          .filter((idx: number) => idx >= 0 && idx < 4)
          .map((idx: number) => MODULE_SLUG_ORDER[idx])
        // Also include modules that are part of a complete audit but have no legacy index
        // (e.g. seo_structure was added after the legacy pillar system)
        const legacyMappedSlugs = new Set(activeSlugs)
        for (const mod of AUDIT_MODULES) {
          if (mod.includedInComplete && mod.legacyPillarIndex == null && !legacyMappedSlugs.has(mod.slug)) {
            activeSlugs.push(mod.slug)
          }
        }
      } else {
        // Complete audit: all modules that are includedInComplete
        activeSlugs = [...COMPLETE_AUDIT_SLUGS]
      }

      // If brand_consistency is selected but no brand identity was provided, skip it
      if (activeSlugs.includes('brand_consistency') && !auditDetails.brandIdentityId) {
        activeSlugs = activeSlugs.filter(s => s !== 'brand_consistency')
        await auditLog(auditId, 'brand_skipped', 'warning', 'Brand Consistency module skipped — no brand identity selected')
      }

      // Build the set of category indices to analyze
      const selectedIndices = new Set<number>()
      for (const slug of activeSlugs) {
        const moduleIdx = MODULE_SLUG_ORDER.indexOf(slug)
        if (moduleIdx === -1) continue
        for (let c = moduleIdx * 4; c < moduleIdx * 4 + 4; c++) {
          if (c < UX_CATEGORY_NAMES.length) selectedIndices.add(c)
        }
      }

      let categoriesToAnalyze = UX_CATEGORY_NAMES.filter((_, idx) => selectedIndices.has(idx))

      // ── Fetch brand content if brand_consistency module is active ──
      let brandContext = ''
      if (activeSlugs.includes('brand_consistency') && auditDetails.brandIdentityId) {
        try {
          const db = getDb()
          const { data: brandFiles } = await db
            .from('brand_identity_files')
            .select('file_name, file_url, file_type')
            .eq('brand_identity_id', auditDetails.brandIdentityId)

          if (brandFiles && brandFiles.length > 0) {
            const extracted = await extractAllBrandFiles(
              brandFiles.map((f: any) => ({
                file_name: f.file_name as string,
                file_url: f.file_url as string,
                file_type: f.file_type as string | null,
              })),
            )
            const textParts = extracted
              .filter(e => e.textContent && e.textContent.length > 0)
              .map(e => `[Brand file: ${e.fileName}]\n${e.textContent}`)
            brandContext = textParts.join('\n\n---\n\n')
            await auditLog(auditId, 'brand_files_extracted', 'success',
              `Extracted content from ${extracted.length} brand file(s)`)
          }
        } catch (err) {
          console.error('[inngest] Brand file extraction error (non-fatal):', err)
          await auditLog(auditId, 'brand_extraction_error', 'warning',
            `Brand file extraction failed: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      const BATCH_SIZE = 8 // 8 parallel calls per batch — fast with Anthropic tier-3+ rate limits
      const batches = []
      for (let i = 0; i < categoriesToAnalyze.length; i += BATCH_SIZE) {
        batches.push(categoriesToAnalyze.slice(i, i + BATCH_SIZE))
      }

      const aiDiscoveryBlock = aiDiscovery.summary ? `\n\n${aiDiscovery.summary}` : ''
      const structuredDataBlock = structuredDataResult.summary ? `\n\n${structuredDataResult.summary}` : ''
      const llmProbeBlock = llmProbeResult.summary ? `\n\n${llmProbeResult.summary}` : ''
      const contentWithContext = `${siteContext.context}\n\n${crawlResult.pageContent}${aiDiscoveryBlock}${structuredDataBlock}${llmProbeBlock}`
      // Brand consistency categories get extra brand context prepended
      const brandContentWithContext = brandContext
        ? `=== BRAND IDENTITY GUIDELINES ===\n${brandContext}\n\n=== WEBSITE CONTENT ===\n${contentWithContext}`
        : contentWithContext
      // Brand consistency category names (indices 20-23)
      const brandCategoryNames = new Set(
        UX_CATEGORY_NAMES.slice(20, 24)
      )

      let totalFindingsCount = 0

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx]

        const batchResult = await step.run(`analyze-batch-${batchIdx + 1}`, async () => {
          const db = getDb()
          let sortOrder = totalFindingsCount
          let findingsInBatch = 0

          console.log(`[inngest] Batch ${batchIdx + 1}: ${batch.join(', ')}`)
          const batchResults = await Promise.all(
            batch.map((categoryName) => {
              // Use brand-enriched content for brand consistency categories
              const content = brandCategoryNames.has(categoryName)
                ? brandContentWithContext
                : contentWithContext
              return analyzeCategory(
                content,
                categoryName,
                [],
                auditDetails.userFocus,
                auditDetails.language,
                'deep', // Always 'deep' here — baseline path doesn't call analyzeCategory
              )
            }),
          )

          for (let catIdx = 0; catIdx < batchResults.length; catIdx++) {
            const findings = batchResults[catIdx]
            const categoryName = batch[catIdx]

            for (const finding of findings) {
              let resolvedPageUrl = crawlResult.firstPageUrl
              const crawledUrls = crawlResult.crawledUrls || [crawlResult.firstPageUrl]
              if (finding.pageUrl) {
                if (crawledUrls.includes(finding.pageUrl)) {
                  resolvedPageUrl = finding.pageUrl
                } else {
                  const match = crawledUrls.find((u: string) =>
                    u.replace(/\/$/, '') === finding.pageUrl!.replace(/\/$/, '') ||
                    finding.pageUrl!.includes(new URL(u).pathname)
                  )
                  if (match) resolvedPageUrl = match
                }
              }

              // Classify finding as fixable or strategic
              const rawClassification = classifyFinding({
                title: finding.title,
                description: finding.description,
                recommendation: finding.recommendation,
                severity: finding.severity,
                findingType: finding.findingType,
                fixType: finding.fixType,
                categoryIndex: finding.categoryIndex ?? null,
              })
              const classification = validateFixableRecommendation({
                ...finding,
                findingType: rawClassification.findingType,
                fixType: rawClassification.fixType,
              })
              await db.from('audit_findings').insert({
                audit_id: auditId,
                checklist_item_id: null,
                category_index: finding.categoryIndex ?? null,
                finding_type: classification.findingType,
                fix_type: classification.fixType,
                severity: finding.severity,
                title: finding.title,
                description: finding.description,
                evidence: null,
                page_url: resolvedPageUrl,
                recommendation: finding.recommendation,
                estimated_impact: finding.estimatedImpact || null,
                target_element: finding.targetElement || null,
                screenshot_url: null,
                sort_order: sortOrder++,
                ai_interpretation: finding.aiInterpretation || null,
                human_interpretation: finding.humanInterpretation || null,
                confidence_level: 'heuristic',
                detection_source: 'analyzer',
                ...computeActionModelFields({ title: finding.title, description: finding.description, recommendation: finding.recommendation, fix_type: classification.fixType, finding_type: classification.findingType }),
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

        // Granular progress: 30% → 65% spread across batches
        const batchProgress = Math.round(30 + ((batchIdx + 1) / batches.length) * 35)
        await step.run(`progress-batch-${batchIdx + 1}`, async () => { await setProgress(auditId, batchProgress) })
      }
    }

    // ──────────────────────────────────────────────────────────
    // QUALITY GATES: Dedup + speculative filter + relevance scoring
    // Combined into one step to eliminate Inngest cold-start overhead
    // ──────────────────────────────────────────────────────────
    await step.run('quality-gates', async () => {
      await setProgress(auditId, 65)
      const db = getDb()

      // ── 1. Deduplicate findings ───
      const { data: dedupFindings } = await db
        .from('audit_findings')
        .select('id, title, description, severity, page_url, sort_order')
        .eq('audit_id', auditId)
        .order('sort_order', { ascending: true })

      if (dedupFindings && dedupFindings.length >= 2) {
        const duplicateIds = identifyDuplicates(
          dedupFindings.map((f: any) => ({
            id: f.id,
            title: f.title || '',
            description: f.description || '',
            severity: f.severity || 'medium',
            page_url: f.page_url || null,
            sort_order: f.sort_order ?? 0,
          }))
        )
        if (duplicateIds.length > 0) {
          for (const id of duplicateIds) {
            await db.from('audit_findings').delete().eq('id', id)
          }
          await auditLog(auditId, 'findings_deduped', 'info',
            `Removed ${duplicateIds.length} duplicate finding${duplicateIds.length > 1 ? 's' : ''}`)
          console.log(`[inngest] Dedup: removed ${duplicateIds.length} duplicates from ${dedupFindings.length} findings`)
        }
      }

      // ── 2. Filter speculative findings ───
      const { data: specFindings } = await db
        .from('audit_findings')
        .select('id, title, description')
        .eq('audit_id', auditId)

      if (specFindings && specFindings.length > 0) {
        const hasHeadTags = crawlResult.pageContent.includes('Head Tags:')
        const speculativeIds = identifySpeculativeFindings(
          specFindings.map((f: any) => ({
            id: f.id,
            title: f.title || '',
            description: f.description || '',
          })),
          hasHeadTags,
        )
        if (speculativeIds.length > 0) {
          for (const id of speculativeIds) {
            await db.from('audit_findings').delete().eq('id', id)
          }
          await auditLog(auditId, 'speculative_filtered', 'info',
            `Removed ${speculativeIds.length} speculative/unverifiable finding${speculativeIds.length > 1 ? 's' : ''}`)
          console.log(`[inngest] Speculative filter: removed ${speculativeIds.length} findings`)
          const totalBefore = (specFindings?.length ?? 0)
          const removedRatio = totalBefore > 0 ? speculativeIds.length / totalBefore : 0
          if (speculativeIds.length >= 3 || removedRatio > 0.3) {
            auditLimitations.push({
              id: 'heavy_speculation_filtering',
              title: 'Quality filter applied',
              description: `Our quality filter removed ${speculativeIds.length} finding${speculativeIds.length > 1 ? 's' : ''} that could not be fully verified from the crawled content. We only report issues we can back with evidence from your site. If important areas seem under-reported, a re-audit with more pages may help.`,
            })
          }
        }
      }
    })

    // ──────────────────────────────────────────────────────────
    // Score findings by historical relevance (separate step —
    // involves its own DB reads that depend on dedup/filter above)
    // ──────────────────────────────────────────────────────────
    await step.run('score-relevance', async () => {
      try {
        const db = getDb()
        const { data: allFindings } = await db
          .from('audit_findings')
          .select('id, title, description, severity')
          .eq('audit_id', auditId)

        if (!allFindings || allFindings.length === 0) return

        const { scored, removedIds } = await scoreFindings(
          allFindings.map((f: any) => ({
            id: f.id,
            title: f.title || '',
            description: f.description || '',
            severity: f.severity || 'medium',
          })),
          db,
        )

        // Remove findings with very low relevance (consistently dismissed pattern)
        if (removedIds.length > 0) {
          for (const id of removedIds) {
            await db.from('audit_findings').delete().eq('id', id)
          }
          await auditLog(auditId, 'relevance_filtered', 'info',
            `Removed ${removedIds.length} low-relevance finding${removedIds.length > 1 ? 's' : ''} (historically dismissed >85% of the time)`)
          console.log(`[inngest] Relevance scorer: removed ${removedIds.length} findings`)
        }

        // Log scoring summary
        const lowCount = scored.filter(s => s.flag === 'low').length
        const medCount = scored.filter(s => s.flag === 'medium').length
        const noData = scored.filter(s => s.flag === 'no_data').length
        if (lowCount > 0 || medCount > 0) {
          console.log(`[inngest] Relevance: ${lowCount} low, ${medCount} medium, ${noData} no_data out of ${scored.length}`)
        }
      } catch (err) {
        // Relevance scoring is non-fatal — audit should complete without it
        console.error('[inngest] Relevance scorer error (non-fatal):', err)
        await auditLog(auditId, 'relevance_error', 'warning',
          `Relevance scoring failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    })

    // Verify findings count + update progress (combined to reduce step overhead)
    await step.run('verify-findings', async () => {
      const db = getDb()
      const { count: findingsCount } = await db
        .from('audit_findings')
        .select('id', { count: 'exact', head: true })
        .eq('audit_id', auditId)

      if ((findingsCount ?? 0) === 0) {
        console.warn(`[inngest] Audit ${auditId}: zero findings — continuing`)
        await auditLog(auditId, 'findings_warning', 'warning', 'Zero findings — site may be clean or all issues resolved')
      } else {
        await auditLog(auditId, 'findings_verified', 'success', `${findingsCount} findings verified`)
      }
      await setProgress(auditId, 75)
    })

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
        const { data: findingsWithTargets, error: findingsErr } = await db
          .from('audit_findings')
          .select('id, title, severity, target_element, page_url')
          .eq('audit_id', auditId)
          .order('sort_order', { ascending: true })

        if (findingsErr) {
          console.error(`[inngest] Screenshots: failed to fetch findings: ${findingsErr.message}`)
        }

        const findingsToCapture = (findingsWithTargets || []).map((f: any) => ({
          id: f.id as string,
          title: f.title as string,
          severity: f.severity as string,
          targetElement: f.target_element as string | null,
          pageUrl: f.page_url as string | null,
        }))

        const mainUrl = crawlResult.firstPageUrl || auditDetails.productUrl

        // Detailed pre-capture logging
        const uniquePageUrls = new Set([mainUrl, ...findingsToCapture.map(f => f.pageUrl).filter(Boolean)])
        console.log(`[inngest] Screenshots: mainUrl=${mainUrl}`)
        console.log(`[inngest] Screenshots: ${findingsToCapture.length} findings, ${uniquePageUrls.size} unique page URLs`)
        console.log(`[inngest] Screenshots: SCREENSHOTONE_API_KEY=${process.env.SCREENSHOTONE_API_KEY ? 'set' : 'MISSING'}`)
        console.log(`[inngest] Screenshots: SCREENSHOT_INTERNAL_KEY=${process.env.SCREENSHOT_INTERNAL_KEY ? 'set' : 'MISSING'}`)
        await auditLog(auditId, 'screenshots_debug', 'info',
          `Pre-capture: ${findingsToCapture.length} findings, ${uniquePageUrls.size} pages, mainUrl=${mainUrl}, s1Key=${process.env.SCREENSHOTONE_API_KEY ? 'set' : 'MISSING'}`)

        const { pageScreenshots, findingScreenshots } = await captureAuditScreenshots(
          findingsToCapture,
          mainUrl,
          auditId,
          5, // capture top 5 finding screenshots (critical + high priority)
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
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error('[inngest] Screenshot capture error (non-fatal):', errMsg)
        console.error('[inngest] Screenshot stack:', err instanceof Error ? err.stack : 'no stack')
        await auditLog(auditId, 'screenshots_error', 'warning', `Screenshot capture failed: ${errMsg.slice(0, 300)}`)
      }
    })

    // ──────────────────────────────────────────────────────────
    // STEP 9: Generate report
    // ──────────────────────────────────────────────────────────
    await step.run('generate-report', async () => {
      await setStatus(auditId, 'generating_report', 85)

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

      const reportContentWithContext = `${siteContext.context}\n\n${crawlResult.pageContent}`

      // Count fixed/dismissed from previous findings for baseline scoring
      const droppedFixed = siteContext.previousRawFindings.filter((f: any) => f.status === 'fixed').length
      const droppedDismissed = siteContext.previousRawFindings.filter((f: any) => f.dismissed).length

      const reportData = await generateReport(
        findings,
        audit as any,
        reportContentWithContext,
        auditDetails.userFocus,
        auditDetails.language,
        effectiveDepthMode,
        siteContext.previousCategoryScores.length > 0 ? {
          previousCategoryScores: siteContext.previousCategoryScores,
          previousOverallScore: siteContext.previousOverallScore,
          previousTotalFindings: siteContext.previousTotalFindings,
          previousExecutiveSummary: siteContext.previousExecutiveSummary,
          previousReportJson: siteContext.previousReportJson,
          droppedFixed,
          droppedDismissed,
        } : undefined,
      )

      const severityCount = {
        critical: findings.filter((f) => f.severity === 'critical').length,
        high: findings.filter((f) => f.severity === 'high').length,
        medium: findings.filter((f) => f.severity === 'medium').length,
        low: findings.filter((f) => f.severity === 'low').length,
      }

      // Use verification data directly from the step (not from DB columns which may not exist)
      const vData = effectiveDepthMode === 'baseline' ? (verificationData || { likelyFixed: 0, poorlyFixed: 0, verified: 0, results: [] }) : null
      if (vData) {
        const likelyFixedCount = vData.likelyFixed
        const poorlyFixedCount = vData.poorlyFixed || 0
        const confirmedOpenCount = vData.verified - likelyFixedCount - poorlyFixedCount
        const nothingChanged = droppedFixed === 0 && droppedDismissed === 0 && likelyFixedCount === 0 && poorlyFixedCount === 0

        reportData.verificationSummary = {
          likelyFixed: likelyFixedCount,
          poorlyFixed: poorlyFixedCount,
          confirmedOpen: confirmedOpenCount,
          totalVerified: vData.verified,
          nothingChanged,
        }

        // Store per-finding verification in report raw_json so UI can read it
        // even if DB columns don't exist yet
        reportData.verificationResults = vData.results

        // Enrich executive summary with verification insights
        if (likelyFixedCount > 0) {
          reportData.executiveSummary += ` Our AI verification detected that ${likelyFixedCount} finding${likelyFixedCount > 1 ? 's appear' : ' appears'} to have been addressed on the live site. Review ${likelyFixedCount > 1 ? 'them' : 'it'} and confirm the fix to update your score.`
        }
        if (poorlyFixedCount > 0) {
          reportData.executiveSummary += ` Warning: ${poorlyFixedCount} finding${poorlyFixedCount > 1 ? 's show' : ' shows'} signs of a poorly implemented fix that may have introduced new issues. Review ${poorlyFixedCount > 1 ? 'these findings' : 'this finding'} carefully.`
        }
      }

      // Generate PDF
      let pdfUrl: string | null = null
      try {
        pdfUrl = await generatePdfReport(auditId, audit as any, reportData, findings, [])
      } catch (pdfErr) {
        console.error('[inngest] PDF generation error (non-fatal):', pdfErr)
        await auditLog(auditId, 'pdf_error', 'warning', 'PDF generation failed — report is still available in dashboard')
      }

      // Calculate AI Visibility Score from all Phase 1 + 2 data
      const aiVisibility = calculateAIVisibilityScore({
        structuredData: structuredDataResult.typesFound?.length > 0
          ? { typesFound: structuredDataResult.typesFound, findings: [], totalBlocks: structuredDataResult.typesFound.length, validBlocks: structuredDataResult.typesFound.length, invalidBlocks: 0 }
          : null,
        llmProbe: llmProbeResult.session || null,
        aiDiscovery: aiDiscovery.result || null,
        headTags: crawlResult.headTags || [],
      })

      // Override the AI discoverability score with the real AI Visibility Score
      reportData.aiDiscoverabilityScore = aiVisibility.overall

      // Preserve original category scores as baseline for future recalculations
      // (when user marks findings as fixed/dismissed, scores recalculate from this baseline)
      const reportJsonWithBaseline = {
        ...reportData,
        _baselineCategoryScores: reportData.categoryScores,
        selectedPillars: auditDetails.selectedPillars, // legacy compat
        selectedModules: auditDetails.selectedModules, // new slug-based system
        aiVisibilityBreakdown: aiVisibility,
        auditLimitations: auditLimitations.length > 0 ? auditLimitations : undefined,
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
        ai_discoverability_score: aiVisibility.overall,
        content_score: reportData.contentScore,
        raw_json: reportJsonWithBaseline,
        pdf_url: pdfUrl,
        pdf_generated_at: pdfUrl ? new Date().toISOString() : null,
        ai_visibility_breakdown: aiVisibility,
        model_benchmarks: multiModelResult.comparison ? {
          models: multiModelResult.comparison.benchmarks.map((b: any) => ({
            modelId: b.modelId,
            modelLabel: b.modelLabel,
            accuracyScore: b.accuracyScore,
          })),
          bestModel: multiModelResult.comparison.bestModel,
          averageAccuracy: multiModelResult.comparison.averageAccuracy,
          insight: multiModelResult.comparison.insight,
        } : null,
      } as any)

      await auditLog(auditId, 'report_generated', 'success', 'Report generated', {
        total_issues: findings.length,
        ...severityCount,
        has_pdf: !!pdfUrl,
      })
    })

    // ──────────────────────────────────────────────────────────
    // STEP 9a: Snapshot industry benchmark into report
    // Freezes the benchmark at audit-completion time so the
    // "How you compare" section shows stable numbers that never
    // shift when new audits are added to the pool.
    // ──────────────────────────────────────────────────────────
    await step.run('snapshot-industry-benchmark', async () => {
      try {
        const db = getDb()

        // Fetch the report + audit industry
        const [{ data: report }, { data: audit }] = await Promise.all([
          db.from('reports')
            .select('ai_visibility_breakdown, overall_score, raw_json')
            .eq('audit_id', auditId)
            .single(),
          db.from('audits')
            .select('detected_industry')
            .eq('id', auditId)
            .single(),
        ])

        if (!report) return

        const aiVis = (report as any).ai_visibility_breakdown as { overall?: number } | null
        const score = aiVis?.overall || (report as any).overall_score || 0
        const industry = (audit as any)?.detected_industry || 'General'

        const benchmarkSnapshot = await getUserBenchmarkPosition(db, score, industry)

        // Store snapshot in report's raw_json so it's frozen forever
        const rawJson = (report as any).raw_json || {}
        rawJson._industryBenchmarkSnapshot = benchmarkSnapshot

        await db.from('reports')
          .update({ raw_json: rawJson } as any)
          .eq('audit_id', auditId)

        await auditLog(auditId, 'benchmark_snapshot', 'info',
          `Industry benchmark snapshot: ${industry} avg ${benchmarkSnapshot.benchmark.avgScore}, user score ${score} (${benchmarkSnapshot.rankLabel})`)
      } catch (err) {
        console.error('[inngest] Benchmark snapshot failed (non-fatal):', err)
        await auditLog(auditId, 'benchmark_snapshot_failed', 'warning',
          `Benchmark snapshot failed: ${err instanceof Error ? err.message : 'unknown'}`)
      }
    })

    // ──────────────────────────────────────────────────────────
    // STEP 9b: Minimum findings enforcement
    // After report generation, check for categories with low scores
    // but 0 findings. Generate targeted findings so users understand
    // WHY a category scored poorly.
    // ──────────────────────────────────────────────────────────
    await step.run('enforce-minimum-findings', async () => {
      try {
        const db = getDb()

        // 1. Fetch the report to get category scores + summaries
        const { data: report } = await db
          .from('reports')
          .select('raw_json')
          .eq('audit_id', auditId)
          .single()

        if (!report?.raw_json?.categoryScores) return

        const categoryScores = (report.raw_json as any).categoryScores as Array<{
          name: string; score: number; summary?: string
        }>

        // 2. Count findings per category index
        const { data: allFindings } = await db
          .from('audit_findings')
          .select('category_index')
          .eq('audit_id', auditId)

        const findingsPerCategory: Record<string, number> = {}
        for (const f of (allFindings || []) as any[]) {
          const catIdx = f.category_index
          if (catIdx != null && catIdx < categoryScores.length) {
            const catName = categoryScores[catIdx]?.name
            if (catName) {
              findingsPerCategory[catName] = (findingsPerCategory[catName] ?? 0) + 1
            }
          }
        }

        // 3. Identify starved categories (score < 70, 0 findings)
        const starved = identifyStarvedCategories(categoryScores, findingsPerCategory)

        if (starved.length === 0) {
          await auditLog(auditId, 'minimum_findings_ok', 'info',
            'All low-scoring categories have findings — no gap to fill')
          return
        }

        console.log(`[inngest] Minimum findings: ${starved.length} starved categories:`,
          starved.map(s => `${s.categoryName} (score ${s.score}, 0 findings)`).join(', '))

        // 4. Generate findings for starved categories
        const generated = await generateFindingsForStarvedCategories(
          starved,
          auditDetails.productUrl,
          auditDetails.language,
        )

        // 5. Insert generated findings into DB
        const { data: existingFindings } = await db
          .from('audit_findings')
          .select('sort_order')
          .eq('audit_id', auditId)
          .order('sort_order', { ascending: false })
          .limit(1)

        let sortOrder = ((existingFindings?.[0] as any)?.sort_order ?? -1) + 1
        let totalInserted = 0

        for (const [categoryIndex, findings] of generated) {
          for (const finding of findings) {
            const classification = classifyFinding({
              title: finding.title,
              description: finding.description,
              recommendation: finding.recommendation,
              severity: finding.severity,
              categoryIndex,
            })
            const validated = validateFixableRecommendation({
              title: finding.title,
              description: finding.description,
              recommendation: finding.recommendation,
              severity: finding.severity,
              ...classification,
            })
            await db.from('audit_findings').insert({
              audit_id: auditId,
              checklist_item_id: null,
              category_index: categoryIndex,
              severity: finding.severity,
              title: finding.title,
              description: finding.description,
              evidence: null,
              page_url: finding.pageUrl || auditDetails.productUrl,
              recommendation: finding.recommendation,
              estimated_impact: finding.estimatedImpact || null,
              target_element: finding.targetElement || null,
              screenshot_url: null,
              sort_order: sortOrder++,
              finding_type: validated.findingType,
              fix_type: validated.fixType,
              confidence_level: 'interpretive',
              detection_source: 'analyzer',
            } as any)
            totalInserted++
          }
        }

        // 6. Update report total_issues count
        if (totalInserted > 0) {
          const { data: currentReport } = await db
            .from('reports')
            .select('total_issues')
            .eq('audit_id', auditId)
            .single()

          const currentTotal = (currentReport as any)?.total_issues ?? 0
          await db
            .from('reports')
            .update({ total_issues: currentTotal + totalInserted } as any)
            .eq('audit_id', auditId)
        }

        // Transparency: let user know we generated findings from summary context
        if (totalInserted > 0) {
          auditLimitations.push({
            id: 'minimum_findings_generated',
            title: 'Additional findings generated',
            description: `${starved.length} categor${starved.length > 1 ? 'ies' : 'y'} scored below 70 but had no specific findings after quality filtering. We generated ${totalInserted} finding${totalInserted > 1 ? 's' : ''} from the category analysis to help you understand what needs improvement.`,
          })
        }

        await auditLog(auditId, 'minimum_findings_enforced', 'success',
          `Generated ${totalInserted} findings for ${starved.length} starved categories: ${starved.map(s => `${s.categoryName} (${s.score})`).join(', ')}`)

        // Update report raw_json with latest limitations (including this step's)
        if (auditLimitations.length > 0) {
          const { data: currentReport } = await db
            .from('reports')
            .select('raw_json')
            .eq('audit_id', auditId)
            .single()

          if (currentReport?.raw_json) {
            await db
              .from('reports')
              .update({
                raw_json: { ...(currentReport.raw_json as any), auditLimitations },
              } as any)
              .eq('audit_id', auditId)
          }
        }
      } catch (err) {
        // Non-fatal — audit can complete without minimum findings enforcement
        console.error('[inngest] Minimum findings enforcement error (non-fatal):', err)
        await auditLog(auditId, 'minimum_findings_error', 'warning',
          `Minimum findings enforcement failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    })

    // ──────────────────────────────────────────────────────────
    // PROPRIETARY PIPELINE: Record patterns + run learning
    // Logic lives in:
    //   src/lib/audit-engine/pipeline/relevance-scorer.ts (record shown)
    //   src/lib/audit-engine/pipeline/quality-stats.ts (aggregate stats)
    //   src/lib/audit-engine/pipeline/pattern-learner.ts (learn from data)
    // ──────────────────────────────────────────────────────────
    await step.run('pipeline-learn', async () => {
      const db = getDb()

      try {
        // 1. Fetch all final findings for this audit
        const { data: finalFindings } = await db
          .from('audit_findings')
          .select('title, description, severity, sort_order')
          .eq('audit_id', auditId)
          .order('sort_order', { ascending: true })

        if (!finalFindings || finalFindings.length === 0) return

        // 2. Record each finding in the patterns table (increments total_shown)
        for (const f of finalFindings as any[]) {
          await recordFindingShown(db, f.title, f.severity)
        }

        // 3. Record aggregate stats for this audit
        await recordAuditStats(db, auditId)

        // 4. Run lightweight post-audit learning check
        const titles = (finalFindings as any[]).map((f: any) => f.title)
        const learningResult = await postAuditLearn(db, titles)

        await auditLog(auditId, 'pipeline_learn', 'success',
          `Recorded ${finalFindings.length} finding patterns | Stats updated | New insights: ${learningResult.newInsights}`)
        console.log(`[inngest] Pipeline learn: ${finalFindings.length} patterns recorded, ${learningResult.newInsights} new insights`)
      } catch (learnErr) {
        // Learning is non-fatal — audit should complete even if learning fails
        console.error('[inngest] Pipeline learn error (non-fatal):', learnErr)
        await auditLog(auditId, 'pipeline_learn_error', 'warning',
          `Learning step failed: ${learnErr instanceof Error ? learnErr.message : String(learnErr)}`)
      }
    })

    // ──────────────────────────────────────────────────────────
    // STEP 10: Predictive recommendations (non-fatal)
    // Generates data-driven predictions based on fix patterns.
    // ──────────────────────────────────────────────────────────
    await step.run('predictive-recommendations', async () => {
      try {
        const db = getDb()

        // Get the report's overall score
        const { data: report } = await db
          .from('reports')
          .select('overall_score, ai_visibility_breakdown')
          .eq('audit_id', auditId)
          .single()

        if (!report) return

        const aiVis = (report as any).ai_visibility_breakdown as { overall?: number } | null
        const currentScore = aiVis?.overall || (report as any).overall_score || 50

        const predictiveReport = await generatePredictiveRecommendations(db, auditId, currentScore)

        // Store recommendations
        if (predictiveReport.recommendations.length > 0) {
          const inserts = predictiveReport.recommendations.map(r => ({
            audit_id: auditId,
            action: r.action,
            predicted_impact: r.predictedImpact,
            confidence: r.confidence,
            data_points: r.dataPoints,
            avg_improvement: r.avgImprovement,
            category: r.category,
            evidence: r.evidence,
          }))
          await db.from('predictive_recommendations').insert(inserts as any)
        }

        await auditLog(auditId, 'predictive_recommendations_generated', 'info',
          `Generated ${predictiveReport.recommendations.length} predictive recommendation(s)`)
      } catch (err) {
        console.error('[inngest] Predictive recommendations failed (non-fatal):', err)
        await auditLog(auditId, 'predictive_recommendations_failed', 'warning',
          `Predictive recommendations failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    })

    // ──────────────────────────────────────────────────────────
    // STEP 11: Complete audit and send email
    // ──────────────────────────────────────────────────────────
    await step.run('complete', async () => {
      const db = getDb()

      await setStatus(auditId, 'completed', 100)
      await db
        .from('audits')
        .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
        .eq('id', auditId)

      // Send email notification
      if (auditDetails.userEmail) {
        try {
          const emailAuditType = (auditDetails.auditType || 'website') as 'website' | 'brand_identity' | 'design'
          const isFreeAudit = auditDetails.plan === 'free_preview'
          if (isFreeAudit) {
            await sendFreeAuditReady(auditDetails.userEmail, auditId, auditDetails.productUrl, emailAuditType)
          } else {
            await sendAuditComplete(auditDetails.userEmail, auditId, auditDetails.productUrl, emailAuditType)
          }
        } catch (emailErr) {
          console.error('[inngest] Email error (non-fatal):', emailErr)
        }
      }

      await auditLog(auditId, 'audit_completed', 'success', 'Audit completed')
      console.log(`[inngest] Audit ${auditId} completed`)
    })

    return { success: true, auditId }

    } catch (err) {
      // Top-level failure handler: refund credit and mark audit as failed
      console.error(`[inngest] Audit ${auditId} FAILED:`, err)
      try {
        await refundCredit(auditId)
        const db = getDb()
        const errorMsg = err instanceof Error ? err.message : String(err)
        await db
          .from('audits')
          .update({
            status: 'failed',
            crawl_error: errorMsg.length > 500 ? errorMsg.slice(0, 500) : errorMsg,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', auditId)
        await auditLog(auditId, 'audit_failed', 'error', `Audit failed: ${errorMsg.slice(0, 200)}. Credit refunded.`)
      } catch (failErr) {
        console.error(`[inngest] Failed to handle audit failure for ${auditId}:`, failErr)
      }
      throw err // Re-throw so Inngest marks the run as failed
    }
  },
)
