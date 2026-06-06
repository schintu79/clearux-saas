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
import { runCrawlPreflight } from '@/lib/audit-engine/crawl-preflight'
import { probeAIDiscovery, formatAIDiscoveryForAnalysis } from '@/lib/audit-engine/ai-discovery-probe'
import { validateStructuredData, formatValidationForAnalysis } from '@/lib/audit-engine/structured-data-validator'
import { analyzeCategory, generateReport, verifyFindings, UX_CATEGORIES, detectSiteProfile } from '@/lib/audit-engine/analyzer'
import type { SiteProfile } from '@/lib/audit-engine/analyzer'
import { generatePdfReport } from '@/lib/audit-engine/pdf'
import { sendAuditComplete, sendFreeAuditReady } from '@/lib/audit-engine/email'
import { captureAuditScreenshots } from '@/lib/audit-engine/screenshots'
import {
  identifyDuplicates,
  identifyTemplateGroups,
  identifySpeculativeFindings,
  scoreFindings,
  recordFindingShown,
  recordAuditStats,
  postAuditLearn,
  classifyFinding,
  validateFixableRecommendation,
  isSimpleSite,
  filterSimpleSiteFindings,
  softenInterpretiveLanguage,
  identifyStaleFindings,
} from '@/lib/audit-engine/pipeline'
import { identifyStarvedCategories, generateFindingsForStarvedCategories } from '@/lib/audit-engine/pipeline/minimum-findings'
import { enrichWithCommunication, buildCommunicationForGenericFinding } from '@/lib/audit-engine/pipeline/communication-layer'
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
import { findModelBySlug } from '@/lib/ai/model-catalog'
import { detectIndustry, getUserBenchmarkPosition } from '@/lib/audit-engine/industry-benchmark'
import { generatePredictiveRecommendations } from '@/lib/audit-engine/predictive-recommendations'
import { runBrandIntelligenceAnalysis } from '@/lib/audit-engine/brand-intelligence'
import { runFullSpeedTest, generateSpeedFindings } from '@/lib/pagespeed'
import { checkWcagAutomated, buildWcagResults, parseHeuristicResponse, formatWcagForPrompt, type WcagCheckResult, type WcagAuditResult } from '@/lib/audit-engine/pipeline/wcag-checker'
import type { AuditFinding } from '@/types/database'
import { resolveCapability, inferDeployableType } from '@/lib/fix-action-model'
import { reconcileFindings, type ReconciliationResult } from '@/lib/audit-engine/pipeline/reconciliation'
import { PIPELINE_VERSION, stageProgress, getStage } from '@/lib/audit-engine/pipeline-spec'
import {
  logPipelineStarted,
  logPipelineCompleted,
  logPipelineFailed,
  logStageStarted,
  logStageCompleted,
  logStageFailed,
  logActivity,
} from '@/lib/audit-engine/activity-logger'

// ── Protected Site Audit Mode (feature-flagged) ──────────────
import { acquirePages, AcquisitionError, BROWSER_FALLBACK_CONFIG } from '@/lib/audit-engine/acquisition-pipeline'
import { getFeatureFlags } from '@/lib/feature-flags'
import { formatPagesForAnalysis } from '@/lib/audit-engine/normalized-page'
import { formatDiagnosticsMessage } from '@/lib/audit-engine/acquisition-diagnostics'

/* ── Timeout helper — prevents enrichment promises from hanging forever ── */
/* CRITICAL: This rejects on timeout rather than resolving to null.
   Promise.allSettled() in the caller handles rejections gracefully.
   The underlying promise may still run, but we don't wait for it. */

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    promise.then(v => { clearTimeout(timer); return v }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        console.warn(`[inngest] ${label} timed out after ${ms}ms — skipping`)
        reject(new Error(`${label} timed out after ${ms}ms`))
      }, ms)
    }),
  ]).catch(err => {
    // Swallow timeout errors — enrichment is non-fatal
    console.warn(`[inngest] ${label} failed: ${err?.message || err}`)
    return null
  })
}

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

async function setProgress(auditId: string, progressPercent: number, stage?: string) {
  const db = getDb()
  const update: Record<string, unknown> = {
    progress_percent: progressPercent,
    updated_at: new Date().toISOString(),
  }
  if (stage) update.audit_stage = stage
  const { error } = await db
    .from('audits')
    .update(update as any)
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
    onFailure: async ({ event }: { event: { data: { event: { data: { auditId: string } } } } }) => {
      // CRITICAL: This handler fires even when the serverless process is killed.
      // It runs as a SEPARATE invocation, so it isn't affected by the 300s timeout
      // that killed the main function.
      try {
        const auditId = event.data.event.data.auditId
        const db = createServiceSupabase()
        const { data } = await db
          .from('audits')
          .select('status, progress_percent')
          .eq('id', auditId)
          .single()

        if (!data) return

        const status = (data as any).status as string
        const progress = (data as any).progress_percent as number
        const terminalStatuses = ['completed', 'failed', 'completed_with_warnings', 'stalled']

        if (terminalStatuses.includes(status)) return // Already resolved

        // If we got past the report step (progress >= 82%), the audit has useful data
        const hasReport = progress >= 82
        const forcedStatus = hasReport ? 'completed_with_warnings' : 'failed'

        console.warn(`[inngest/onFailure] Audit ${auditId} stuck at status=${status} progress=${progress}%. Forcing to ${forcedStatus}.`)

        await db.from('audits').update({
          status: forcedStatus,
          progress_percent: hasReport ? 100 : progress,
          audit_stage: hasReport ? 'complete' : 'failed',
          completed_at: hasReport ? new Date().toISOString() : undefined,
          crawl_error: hasReport ? undefined : 'Pipeline timed out during enrichment. Your audit results are still available.',
          updated_at: new Date().toISOString(),
        } as any).eq('id', auditId)

        // Refund credit if audit truly failed (no usable report)
        if (!hasReport) {
          await refundCredit(auditId)
        }

        await logActivity(auditId, hasReport
          ? 'Audit completed with some enrichment steps skipped due to timeout.'
          : 'Audit failed due to pipeline timeout. Credit refunded.')
      } catch (err) {
        console.error('[inngest/onFailure] Recovery error:', err)
      }
    },
    triggers: [{ event: 'audit/process' as const }],
  },
  async ({ event, step }: { event: { data: { auditId: string } }; step: any }) => {
    const auditId = event.data.auditId
    const pipelineStartTime = Date.now()

    try {
    // ── Step-level timeout helper — wraps entire step body ──
    // Each Inngest step.run has its own Vercel 300s timeout, but
    // promises inside can hang forever (Puppeteer, AI APIs, slow DBs).
    // This helper wraps the step body in a Promise.race so we fail
    // fast rather than waiting for Vercel to kill the process.
    async function withStepTimeout<T>(
      fn: () => Promise<T>,
      ms: number,
      stepName: string,
      fallback?: T,
    ): Promise<T> {
      let timer: ReturnType<typeof setTimeout>
      try {
        return await Promise.race([
          fn(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              console.error(`[inngest] Step "${stepName}" exceeded ${ms}ms hard timeout — aborting`)
              reject(new Error(`Step "${stepName}" timed out after ${ms}ms`))
            }, ms)
          }),
        ])
      } catch (err) {
        clearTimeout(timer!)
        if (fallback !== undefined) {
          console.warn(`[inngest] Step "${stepName}" failed/timed out, using fallback:`, (err as Error)?.message)
          return fallback
        }
        throw err
      } finally {
        clearTimeout(timer!)
      }
    }

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

      // Brand identity ID for Design Consistency Brand DNA enrichment
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
        brandIdentityId, // for Design Consistency Brand DNA enrichment
      }
    })

    // ── Pipeline v1: stamp audit row and log start ──
    await step.run('pipeline-init', async () => {
      const db = getDb()
      await db.from('audits').update({
        pipeline_version: PIPELINE_VERSION,
        audit_stage: 'preflight',
        progress_percent: 1,
        updated_at: new Date().toISOString(),
      } as any).eq('id', auditId)
      await logPipelineStarted(auditId, PIPELINE_VERSION)
      await logActivity(auditId, `Audit pipeline ${PIPELINE_VERSION} started for ${auditDetails.productUrl}`)
    })

    // ══════════════════════════════════════════════════════════
    // BRAND IDENTITY FAST PATH — skip all website steps
    // Brand audits only need: extract files → analyze 6 categories → report → done
    // This cuts brand audit time from 15+ min to under 3 min.
    // ══════════════════════════════════════════════════════════
    if (auditDetails.auditType === 'brand_identity') {
      const brandFastResult = await step.run('brand-fast-extract', async () => {
        await setStatus(auditId, 'analysing', 10)
        await setProgress(auditId, 10, 'extracting')
        await auditLog(auditId, 'brand_fast_path', 'info', 'Using brand identity fast path — skipping website crawl')

        if (!auditDetails.brandIdentityId) {
          throw new Error('Brand identity audit requires a brand_identity_id. No brand was selected.')
        }

        const db = getDb()
        const { data: brandFiles } = await db
          .from('brand_identity_files')
          .select('file_name, file_url, file_type')
          .eq('brand_identity_id', auditDetails.brandIdentityId)

        if (!brandFiles || brandFiles.length === 0) {
          throw new Error('No brand files found. Upload at least one brand file before running a brand audit.')
        }

        const extracted = await extractAllBrandFiles(
          brandFiles.map((f: any) => ({
            file_name: f.file_name as string,
            file_url: f.file_url as string,
            file_type: f.file_type as string | null,
          })),
        )

        // Regression fix: Include visualDescription alongside textContent.
        // Previously only textContent was used, dropping all visual/image descriptions
        // from PDFs and images — causing Brand DNA comparison to miss logo, color,
        // and visual identity data entirely.
        const textParts = extracted
          .filter(e => (e.textContent && e.textContent.length > 0) || (e.visualDescription && e.visualDescription.length > 0))
          .map(e => {
            const parts = [`[Brand file: ${e.fileName}]`]
            if (e.textContent) parts.push(e.textContent)
            if (e.visualDescription) parts.push(`[Visual description]: ${e.visualDescription}`)
            return parts.join('\n')
          })
        const brandContent = textParts.join('\n\n---\n\n')

        if (!brandContent || brandContent.length < 50) {
          throw new Error('Could not extract meaningful content from brand files. Ensure files contain readable text or images with text.')
        }

        await auditLog(auditId, 'brand_files_extracted', 'success',
          `Extracted content from ${extracted.length} brand file(s) (${Math.round(brandContent.length / 1024)}KB)`)

        return { brandContent, filesCount: extracted.length }
      })

      // ── Analyze all 6 brand categories in parallel ──
      const brandAnalysisResult = await step.run('brand-fast-analyze', async () => {
        await setProgress(auditId, 30, 'analysing')

        const { BRAND_AUDIT_CATEGORIES: brandCats } = await import('@/lib/brand-audit-modules')
        const db = getDb()
        let totalFindings = 0

        const analysisResults = await Promise.all(
          brandCats.map(async (cat) => {
            const prompt = `You are auditing brand identity materials for the category: "${cat.name}".
${cat.analysisPrompt}

BRAND MATERIALS:
${brandFastResult.brandContent}

Respond in the user's requested language: ${auditDetails.language || 'en'}.
${auditDetails.userFocus ? `The user is specifically concerned about: ${auditDetails.userFocus}` : ''}

Analyze the brand materials and return findings as JSON array. Each finding:
{ "title": "...", "description": "...", "recommendation": "...", "severity": "critical|high|medium|low", "estimatedImpact": "..." }

Return 2-6 findings. Be specific and evidence-based. Reference specific files/content when possible.`

            try {
              const findings = await withTimeout(
                analyzeCategory(
                  brandFastResult.brandContent,
                  cat.name,
                  [],
                  auditDetails.userFocus,
                  auditDetails.language,
                  'deep',
                  siteProfile,
                ),
                45_000,
                `brand-analyze-${cat.name}`,
              )
              return { cat, findings: findings || [] }
            } catch (catErr) {
              console.error(`[inngest] Brand category "${cat.name}" timed out/failed:`, (catErr as Error)?.message)
              return { cat, findings: [] }
            }
          }),
        )

        // Insert all findings in one batch
        const batchInserts: any[] = []
        let sortOrder = 0
        for (const { cat, findings } of analysisResults) {
          const catIdx = brandCats.findIndex(c => c.slug === cat.slug)
          for (const finding of findings) {
            const classification = classifyFinding({
              title: finding.title,
              description: finding.description,
              recommendation: finding.recommendation,
              severity: finding.severity,
              categoryIndex: catIdx,
            })
            const validated = validateFixableRecommendation({
              ...finding,
              findingType: classification.findingType,
              fixType: classification.fixType,
            })
            batchInserts.push({
              audit_id: auditId,
              checklist_item_id: null,
              category_index: catIdx,
              finding_type: validated.findingType,
              fix_type: validated.fixType,
              severity: finding.severity,
              title: finding.title,
              description: finding.description,
              evidence: null,
              page_url: null,
              recommendation: finding.recommendation,
              estimated_impact: finding.estimatedImpact || null,
              target_element: null,
              sort_order: sortOrder++,
              confidence_level: 'heuristic',
              detection_source: 'brand_analyzer',
              communication: enrichWithCommunication([finding], null)[0]?.communication || null,
              ...computeActionModelFields({ title: finding.title, description: finding.description, recommendation: finding.recommendation, fix_type: validated.fixType, finding_type: validated.findingType }),
            })
          }
          totalFindings += findings.length
        }

        if (batchInserts.length > 0) {
          await db.from('audit_findings').insert(batchInserts as any)
        }

        await setProgress(auditId, 60, 'analysing')
        await auditLog(auditId, 'brand_analysis_complete', 'success',
          `Brand analysis: ${totalFindings} findings across ${brandCats.length} categories`)

        return { totalFindings, categoriesAnalyzed: brandCats.length }
      })

      // ── Quality gates (dedup) ──
      await step.run('brand-fast-quality', async () => {
        await setProgress(auditId, 70, 'quality')
        const db = getDb()
        const { data: dedupFindings } = await db
          .from('audit_findings')
          .select('id, title, description, severity, page_url, sort_order, confidence_level, detection_source')
          .eq('audit_id', auditId)
          .order('sort_order', { ascending: true })

        if (dedupFindings && dedupFindings.length >= 2) {
          const mappedFindings = dedupFindings.map((f: any) => ({
            id: f.id,
            title: f.title || '',
            description: f.description || '',
            severity: f.severity || 'medium',
            page_url: f.page_url || null,
            sort_order: f.sort_order ?? 0,
            confidence_level: f.confidence_level || 'heuristic',
            detection_source: f.detection_source || 'brand_analyzer',
          }))
          const duplicateIds = identifyDuplicates(mappedFindings)
          if (duplicateIds.length > 0) {
            await db.from('audit_findings').delete().in('id', duplicateIds)
            await auditLog(auditId, 'brand_dedup', 'info', `Removed ${duplicateIds.length} duplicate brand findings`)
          }
        }
      })

      // ── Generate brand report ──
      await step.run('brand-fast-report', async () => {
        await setStatus(auditId, 'generating_report', 80)
        await setProgress(auditId, 80, 'reporting')
        const db = getDb()

        const { data: allFindings } = await db
          .from('audit_findings')
          .select('*')
          .eq('audit_id', auditId)
          .order('sort_order', { ascending: true })

        const findings = (allFindings || []) as AuditFinding[]
        const { data: audit } = await db.from('audits').select('*').eq('id', auditId).single()

        const reportData = await generateReport(
          findings,
          audit as any,
          brandFastResult.brandContent,
          auditDetails.userFocus,
          auditDetails.language,
          'deep',
          undefined,
          siteProfile,
        )

        const severityCount = {
          critical: findings.filter((f) => f.severity === 'critical').length,
          high: findings.filter((f) => f.severity === 'high').length,
          medium: findings.filter((f) => f.severity === 'medium').length,
          low: findings.filter((f) => f.severity === 'low').length,
        }

        let pdfUrl: string | null = null
        try {
          pdfUrl = await withTimeout(
            generatePdfReport(auditId, audit as any, reportData, findings, []),
            30_000,
            'brand-pdf-generation',
          ) || null
        } catch (pdfErr) {
          console.error('[inngest] Brand PDF generation error (non-fatal):', pdfErr)
        }

        const reportJsonData = {
          ...reportData,
          _baselineCategoryScores: reportData.categoryScores,
          selectedModules: auditDetails.selectedModules,
        }

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
          content_score: reportData.contentScore,
          raw_json: reportJsonData,
          pdf_url: pdfUrl,
          pdf_generated_at: pdfUrl ? new Date().toISOString() : null,
        } as any)

        await auditLog(auditId, 'brand_report_generated', 'success',
          `Brand report: score ${reportData.overallScore}/100, ${findings.length} findings`)
      })

      // ── Complete ──
      await step.run('brand-fast-complete', async () => {
        const db = getDb()
        await setStatus(auditId, 'completed', 100)
        await setProgress(auditId, 100, 'complete')
        await db
          .from('audits')
          .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
          .eq('id', auditId)

        if (auditDetails.userEmail) {
          try {
            const isFreeAudit = auditDetails.plan === 'free_preview'
            if (isFreeAudit) {
              await sendFreeAuditReady(auditDetails.userEmail, auditId, auditDetails.productUrl, 'brand_identity')
            } else {
              await sendAuditComplete(auditDetails.userEmail, auditId, auditDetails.productUrl, 'brand_identity')
            }
          } catch (emailErr) {
            console.error('[inngest] Brand email error (non-fatal):', emailErr)
          }
        }

        await auditLog(auditId, 'brand_audit_completed', 'success', 'Brand identity audit completed (fast path)')
        console.log(`[inngest] Brand audit ${auditId} completed via fast path`)
      })

      return { success: true, auditId }
    }

    // ══════════════════════════════════════════════════════════
    // WEBSITE AUDIT PATH — full pipeline below
    // ══════════════════════════════════════════════════════════

    // ──────────────────────────────────────────────────────────
    // STEP 1.5: Pre-flight crawl check (fast — under 5 seconds)
    // Detects blocked/unreachable domains BEFORE the full crawl starts.
    // ──────────────────────────────────────────────────────────
    await step.run('crawl-preflight', async () => {
      await logStageStarted(auditId, 'preflight', 'Running preflight checks...')
      await logActivity(auditId, `Validating site accessibility for ${auditDetails.productUrl}`)
      await setStatus(auditId, 'crawling', stageProgress('preflight', 0))
      await setProgress(auditId, stageProgress('preflight', 0), 'preflight')
      await auditLog(auditId, 'preflight_started', 'info', `Pre-flight check on ${auditDetails.productUrl}`)

      const preflight = await withTimeout(
        runCrawlPreflight(auditDetails.productUrl),
        15_000,
        'crawl-preflight',
      ) || { status: 'unreachable' as const, reason: 'Preflight check timed out after 15s', httpStatus: null, durationMs: 15000 }

      await auditLog(auditId, 'preflight_complete', 'info',
        `Preflight: ${preflight.status} (${preflight.durationMs}ms)`,
        { status: preflight.status, reason: preflight.reason, httpStatus: preflight.httpStatus })

      if (preflight.status === 'crawl-blocked') {
        throw new Error(
          `BLOCKED: ${auditDetails.productUrl} has crawl restrictions enabled. ` +
          `${preflight.reason || 'The site is blocking automated requests.'}. ` +
          `This is common on sites using Cloudflare protection, aggressive bot detection, or robots.txt restrictions. ` +
          `Your credit has been refunded automatically. ` +
          `To audit this site, contact the site owner to whitelist the Fixpath crawler, or try a different URL.`
        )
      }

      if (preflight.status === 'unreachable') {
        throw new Error(
          `UNREACHABLE: We couldn't reach ${auditDetails.productUrl}. ` +
          `${preflight.reason || 'The site may be offline or the URL may be incorrect.'}. ` +
          `Please check the URL and try again. Your credit has been refunded automatically.`
        )
      }

      if (preflight.status === 'http-error') {
        throw new Error(
          `HTTP_ERROR: ${auditDetails.productUrl} returned an error response. ` +
          `${preflight.reason || `HTTP ${preflight.httpStatus}`}. ` +
          `The site may be down or the URL may be incorrect. Your credit has been refunded automatically.`
        )
      }

      // status === 'accessible' or 'partial' — advance stage immediately
      // so the UI doesn't stay stuck on "Preflight" during Inngest step overhead
      await logStageCompleted(auditId, 'preflight', 'Preflight checks passed')
      await setProgress(auditId, stageProgress('preflight', 1), 'crawling')
    })

    // STEP 2: Crawl pages
    // ──────────────────────────────────────────────────────────
    const crawlResult = await step.run('crawl-pages', async () => {
      await logStageStarted(auditId, 'crawling', 'Discovering site pages...')
      await setStatus(auditId, 'crawling', stageProgress('crawling', 0))
      await setProgress(auditId, stageProgress('crawling', 0), 'crawling')
      await auditLog(auditId, 'crawl_started', 'info', `Crawling ${auditDetails.productUrl}`)

      const maxPages = auditDetails.plan === 'free_preview' ? 5 : auditDetails.plan === 'starter' ? 20 : 25

      // ── Protected Site Mode: staged acquisition pipeline ────────
      // When the feature flag is on, use the new graduated fallback
      // chain instead of the binary crawl→validate logic below.
      // When off, the existing code runs completely unchanged.
      const featureFlags = getFeatureFlags()
      if (featureFlags.protectedSiteMode) {
        const acquisitionConfig = BROWSER_FALLBACK_CONFIG

        let acquisitionResult: Awaited<ReturnType<typeof acquirePages>>
        try {
          acquisitionResult = await acquirePages(
            auditDetails.productUrl,
            maxPages,
            auditId,
            acquisitionConfig,
            async (pct, stage) => { await setProgress(auditId, pct, stage) },
          )
        } catch (err) {
          // Log diagnostics on failure before re-throwing
          if (err instanceof AcquisitionError && featureFlags.acquisitionDiagnostics) {
            await auditLog(auditId, 'acquisition_diagnostics', 'warning',
              formatDiagnosticsMessage(err.diagnostics),
              { diagnostics: err.diagnostics })
          }
          throw err
        }

        // Merge acquisition limitations into audit-level limitations
        for (const lim of acquisitionResult.limitations) {
          auditLimitations.push(lim)
        }

        // Log diagnostics if enabled
        if (featureFlags.acquisitionDiagnostics) {
          await auditLog(auditId, 'acquisition_diagnostics', 'info',
            formatDiagnosticsMessage(acquisitionResult.diagnostics),
            { diagnostics: acquisitionResult.diagnostics })
        }

        // ── Store pages in DB (same schema as existing inserts) ──
        const db = getDb()
        const pageInserts = acquisitionResult.pages.map(page => ({
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
          crawled_at: page.acquiredAt,
          crawl_status: page.contentText && page.contentText.length > 50 ? 'success' : (page.blockedByBot ? 'blocked' : 'failed'),
          skip_reason: page.blockedByBot ? (page.blockReason || 'Bot protection') : null,
          canonical_url: page.headTags?.canonical || null,
          is_duplicate: false,
          page_type: 'content',
          fetch_strategy: page.acquisition.method,
        }))
        if (pageInserts.length > 0) {
          await db.from('audit_pages').insert(pageInserts as any)
        }

        // ── Build crawl summary (same shape as existing) ──
        const acqCrawlStats = acquisitionResult.crawlStats
        const acqAvgLoadTime = acquisitionResult.pages.filter(p => p.loadTimeMs).length > 0
          ? Math.round(acquisitionResult.pages.filter(p => p.loadTimeMs).reduce((sum, p) => sum + (p.loadTimeMs || 0), 0) / acquisitionResult.pages.filter(p => p.loadTimeMs).length)
          : null

        const acqCrawlSummary = {
          urls_discovered: acqCrawlStats.urlsDiscovered,
          pages_analyzed: acqCrawlStats.pagesAnalyzed,
          pages_skipped: acqCrawlStats.pagesSkipped,
          pages_blocked: acqCrawlStats.pagesBlocked,
          pages_duplicate: acqCrawlStats.pagesDuplicate,
          pages_excluded: acqCrawlStats.pagesExcluded,
          js_pages_detected: acqCrawlStats.jsPagesDetected,
          avg_load_time_ms: acqAvgLoadTime,
          discovery_sources: acqCrawlStats.discoverySources,
          excluded_urls: acqCrawlStats.excludedUrls,
          coverage_notes: [] as string[],
          // Additional observability from acquisition pipeline
          acquisition_state: acquisitionResult.state,
          acquisition_summary: {
            state: acquisitionResult.summary.state,
            pages_by_method: acquisitionResult.summary.pagesByMethod,
            pages_by_quality: acquisitionResult.summary.pagesByQuality,
            used_browser_fallback: acquisitionResult.summary.usedBrowserFallback,
            has_blocked_pages: acquisitionResult.summary.hasBlockedPages,
            detected_protection: acquisitionResult.summary.detectedProtection,
            pages_attempted: acquisitionResult.summary.pagesAttempted,
            pages_acquired: acquisitionResult.summary.pagesAcquired,
          },
        }

        if (acqCrawlStats.jsPagesDetected > 0) {
          acqCrawlSummary.coverage_notes.push(`${acqCrawlStats.jsPagesDetected} page(s) required JavaScript rendering`)
        }
        if (acqCrawlStats.pagesBlocked > 0) {
          acqCrawlSummary.coverage_notes.push(`${acqCrawlStats.pagesBlocked} page(s) blocked by bot protection`)
        }
        if (acquisitionResult.summary.usedBrowserFallback) {
          acqCrawlSummary.coverage_notes.push(`Browser rendering fallback used for ${acquisitionResult.summary.pagesByMethod.browser_render} page(s)`)
        }
        if (acqCrawlStats.pagesExcluded > 0) {
          acqCrawlSummary.coverage_notes.push(`${acqCrawlStats.pagesExcluded} URL(s) excluded (infrastructure, assets, or API paths)`)
        }

        await db
          .from('audits')
          .update({
            pages_crawled: acquisitionResult.pages.length,
            crawl_summary: acqCrawlSummary,
            crawl_started_at: acqCrawlStats.crawlStartedAt,
            crawl_completed_at: acqCrawlStats.crawlCompletedAt,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', auditId)

        // ── Auth-gated page filter (identical to existing logic) ──
        const ACQ_AUTH_PAGE_SIGNALS = [
          /(?:sign\s*in|log\s*in|login)\s+(?:to\s+)?(?:your\s+)?(?:account|dashboard|continue)/i,
          /(?:forgot|reset)\s+(?:your\s+)?password/i,
          /don.t\s+have\s+an?\s+account\?\s*(?:sign\s*up|register)/i,
          /(?:enter|provide)\s+your\s+(?:email|credentials|password)/i,
        ]
        const ACQ_AUTH_PATH_SEGMENTS = ['/dashboard', '/app', '/admin', '/account', '/settings', '/profile', '/billing']

        const acqAuthFiltered = acquisitionResult.pages.filter((p) => {
          const url = p.url || ''
          const isAuthPath = ACQ_AUTH_PATH_SEGMENTS.some((seg) => url.includes(seg))
          if (!isAuthPath) return true
          const content = (p.contentText || '').toLowerCase()
          const hitCount = ACQ_AUTH_PAGE_SIGNALS.filter((pat) => pat.test(content)).length
          return hitCount < 2
        })

        // ── Pre-analysis content quality filter (identical to existing) ──
        const ACQ_ERROR_PAGE_SIGNALS = [
          /^404\b|page\s+not\s+found|doesn.t\s+exist/i,
          /^403\b|access\s+denied|forbidden/i,
          /^500\b|internal\s+server\s+error/i,
          /under\s+(?:construction|maintenance)/i,
          /coming\s+soon/i,
        ]
        const ACQ_MIN_CONTENT_LENGTH = 200
        const acqSeenContentHashes = new Set<string>()

        const acqFilteredPages = acqAuthFiltered.filter((p, idx) => {
          if (idx === 0) {
            const hash = (p.contentText || '').substring(0, 500).toLowerCase().replace(/\s+/g, ' ')
            acqSeenContentHashes.add(hash)
            return true
          }
          const content = p.contentText || ''
          if (content.length < ACQ_MIN_CONTENT_LENGTH) return false
          if (ACQ_ERROR_PAGE_SIGNALS.some(pat => pat.test(content.substring(0, 500)))) return false
          const hash = content.substring(0, 500).toLowerCase().replace(/\s+/g, ' ')
          if (acqSeenContentHashes.has(hash)) return false
          acqSeenContentHashes.add(hash)
          return true
        })

        // ── Build analysis input (byte-identical format via formatPagesForAnalysis) ──
        const acqPageContent = formatPagesForAnalysis(acqFilteredPages, formatHeadTagsForAnalysis)

        const acqHeadTags = acqFilteredPages
          .filter((p) => p.headTags)
          .map((p) => ({ url: p.url, headTags: p.headTags! }))

        const acqCrawlQuality = acqFilteredPages.length >= 3 ? 'full' : acqFilteredPages.length >= 2 ? 'limited' : 'homepage-only'

        await logStageCompleted(auditId, 'crawling', `Acquired ${acquisitionResult.pages.length} pages (${acquisitionResult.state})`, { pageCount: acquisitionResult.pages.length, state: acquisitionResult.state })
        await auditLog(auditId, 'crawl_completed', 'success', `Acquired ${acquisitionResult.pages.length} page(s) — state: ${acquisitionResult.state}`)

        return {
          pageCount: acquisitionResult.pages.length,
          pageContent: acqPageContent,
          firstPageUrl: acquisitionResult.pages[0]?.url || '',
          crawledUrls: acquisitionResult.pages.map((p) => p.url).filter(Boolean) as string[],
          headTags: acqHeadTags,
          crawlQuality: acqCrawlQuality,
        }
      }

      // ── Legacy path (feature flag off — existing code unchanged) ──
      // 180s hard timeout on crawl — deep mode with 25 pages can be slow,
      // but anything beyond 3 minutes is a hung connection.
      const CRAWL_TIMEOUT_MS = 180_000
      const crawlOutput = await withTimeout(
        crawlPages(auditDetails.productUrl, maxPages, async (pct, stage) => {
          await setProgress(auditId, pct, stage)
        }),
        CRAWL_TIMEOUT_MS,
        'crawl-pages',
      )
      if (!crawlOutput) {
        throw new Error(
          `TIMEOUT: Crawling ${auditDetails.productUrl} took longer than ${CRAWL_TIMEOUT_MS / 1000}s. ` +
          `The site may be very slow to respond or have many pages that time out individually. ` +
          `Your credit has been refunded automatically. Try again later or with fewer pages.`
        )
      }
      const crawledPages = crawlOutput.pages
      const crawlStats = crawlOutput.stats

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

      // ── Fail-fast detection ──────────────────────────────────
      // Detect blocked, challenge, thin, rate-limited, or geo-blocked
      // pages BEFORE spending time on downstream analysis.
      const homeContentText = (crawledPages[0]?.contentText || '').replace(/\s+/g, ' ').trim()
      const SOFT_BLOCK_MARKERS = [
        /just a moment/i, /checking your browser/i, /enable javascript/i,
        /please turn javascript on/i, /this site requires javascript/i,
        /access denied/i, /captcha/i, /verify you are human/i,
        /cloudflare/i, /ray id/i, /challenge-platform/i,
        /datadome/i, /perimeterx/i, /incapsula/i,
        // Geo-blocking and rate-limiting patterns
        /not available in your (?:region|country)/i,
        /this content is not available/i,
        /rate limit(?:ed|ing)?\b/i, /too many requests/i,
        /automated (?:access|requests?) (?:not|is not) allowed/i,
      ]
      const matchedSoftBlock = SOFT_BLOCK_MARKERS.find(p => p.test(homeContentText))
      if (matchedSoftBlock) {
        throw new Error(
          `BLOCKED: ${auditDetails.productUrl} appears to use bot protection that blocks automated crawlers. ` +
          `The page content contains a challenge or verification prompt instead of the actual website. ` +
          `Your credit has been refunded automatically. ` +
          `To audit this site, ensure it allows automated access or contact the site owner to whitelist the Fixpath crawler.`
        )
      }
      if (homeContentText.length < 200) {
        throw new Error(
          `BLOCKED: ${auditDetails.productUrl} returned very little content (${homeContentText.length} characters). ` +
          `This typically happens when a site uses advanced bot protection, requires JavaScript rendering, ` +
          `or serves a challenge page to automated crawlers. ` +
          `Your credit has been refunded automatically. ` +
          `To audit this site, ensure it serves full HTML content to crawlers.`
        )
      }

      // Fail-fast: if >80% of crawled pages returned no content, the crawl is degraded
      const goodPages = crawledPages.filter(p => p.contentText && p.contentText.length >= 200)
      if (crawledPages.length > 3 && goodPages.length <= 1) {
        console.warn(`[inngest] Fail-fast: only ${goodPages.length}/${crawledPages.length} pages had usable content`)
        auditLimitations.push({
          id: 'degraded_crawl',
          title: 'Limited content access',
          description: `Only ${goodPages.length} of ${crawledPages.length} pages returned usable content. The site may have rate limiting, bot protection on inner pages, or require JavaScript rendering. Scores are based on the accessible pages only.`,
        })
      }

      // Store pages in DB — batch insert for speed (was individual inserts)
      const db = getDb()
      const pageInserts = crawledPages.map(page => ({
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
        crawl_status: page.contentText && page.contentText.length > 50 ? 'success' : (page.blockedByBot ? 'blocked' : 'failed'),
        skip_reason: page.blockedByBot ? (page.blockReason || 'Bot protection') : null,
        canonical_url: page.headTags?.canonical || null,
        is_duplicate: false,
        page_type: 'content',
        fetch_strategy: page.fetchStrategy || null,
      }))
      if (pageInserts.length > 0) {
        await db.from('audit_pages').insert(pageInserts as any)
      }

      // Build crawl summary payload
      const avgLoadTime = crawledPages.filter(p => p.loadTimeMs).length > 0
        ? Math.round(crawledPages.filter(p => p.loadTimeMs).reduce((sum, p) => sum + (p.loadTimeMs || 0), 0) / crawledPages.filter(p => p.loadTimeMs).length)
        : null

      const crawlSummary = {
        urls_discovered: crawlStats.urlsDiscovered,
        pages_analyzed: crawlStats.pagesAnalyzed,
        pages_skipped: crawlStats.pagesSkipped,
        pages_blocked: crawlStats.pagesBlocked,
        pages_duplicate: crawlStats.pagesDuplicate,
        pages_excluded: crawlStats.pagesExcluded,
        js_pages_detected: crawlStats.jsPagesDetected,
        avg_load_time_ms: avgLoadTime,
        discovery_sources: crawlStats.discoverySources,
        excluded_urls: crawlStats.excludedUrls,
        coverage_notes: [] as string[],
      }

      // Generate coverage notes
      if (crawlStats.jsPagesDetected > 0) {
        crawlSummary.coverage_notes.push(`${crawlStats.jsPagesDetected} page(s) required JavaScript rendering`)
      }
      if (crawlStats.pagesBlocked > 0) {
        crawlSummary.coverage_notes.push(`${crawlStats.pagesBlocked} page(s) blocked by bot protection`)
      }
      if (crawlStats.pagesExcluded > 0) {
        crawlSummary.coverage_notes.push(`${crawlStats.pagesExcluded} URL(s) excluded (infrastructure, assets, or API paths)`)
      }
      if (crawlStats.discoverySources.sitemap > 0) {
        crawlSummary.coverage_notes.push(`Sitemap found with ${crawlStats.discoverySources.sitemap} URLs`)
      }
      if ((crawlStats.discoverySources as any).firecrawlMap > 0) {
        crawlSummary.coverage_notes.push(`Firecrawl map discovered ${(crawlStats.discoverySources as any).firecrawlMap} URLs`)
      }

      await db
        .from('audits')
        .update({
          pages_crawled: crawledPages.length,
          crawl_summary: crawlSummary,
          crawl_started_at: crawlStats.crawlStartedAt,
          crawl_completed_at: crawlStats.crawlCompletedAt,
          updated_at: new Date().toISOString(),
        } as any)
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

      const authFiltered = crawledPages.filter((p) => {
        const url = p.url || ''
        const isAuthPath = AUTH_PATH_SEGMENTS.some((seg) => url.includes(seg))
        if (!isAuthPath) return true
        const content = (p.contentText || '').toLowerCase()
        const hitCount = AUTH_PAGE_SIGNALS.filter((pat) => pat.test(content)).length
        return hitCount < 2
      })

      // ── Pre-analysis content quality filter ──
      // Skip thin content, error pages, and near-duplicates before
      // expensive AI analysis to avoid wasting tokens on low-value pages.
      // Homepage is always kept regardless of content quality.
      const ERROR_PAGE_SIGNALS = [
        /^404\b|page\s+not\s+found|doesn.t\s+exist/i,
        /^403\b|access\s+denied|forbidden/i,
        /^500\b|internal\s+server\s+error/i,
        /under\s+(?:construction|maintenance)/i,
        /coming\s+soon/i,
      ]
      const MIN_CONTENT_LENGTH = 200 // characters — below this, content is too thin for useful AI analysis
      const seenContentHashes = new Set<string>()

      const filteredPages = authFiltered.filter((p, idx) => {
        // Always keep homepage (first page)
        if (idx === 0) {
          const hash = (p.contentText || '').substring(0, 500).toLowerCase().replace(/\s+/g, ' ')
          seenContentHashes.add(hash)
          return true
        }
        const content = p.contentText || ''
        // Skip thin content pages
        if (content.length < MIN_CONTENT_LENGTH) {
          console.log(`[inngest] Pre-filter: skipping thin page ${p.url} (${content.length} chars)`)
          return false
        }
        // Skip error pages
        if (ERROR_PAGE_SIGNALS.some(pat => pat.test(content.substring(0, 500)))) {
          console.log(`[inngest] Pre-filter: skipping error page ${p.url}`)
          return false
        }
        // Skip near-duplicate pages (first 500 chars match)
        const hash = content.substring(0, 500).toLowerCase().replace(/\s+/g, ' ')
        if (seenContentHashes.has(hash)) {
          console.log(`[inngest] Pre-filter: skipping near-duplicate page ${p.url}`)
          return false
        }
        seenContentHashes.add(hash)
        return true
      })

      if (filteredPages.length < authFiltered.length) {
        const skipped = authFiltered.length - filteredPages.length
        console.log(`[inngest] Pre-analysis filter: ${skipped} page(s) skipped (thin/error/duplicate), ${filteredPages.length} kept for AI analysis`)
      }

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

      await logStageCompleted(auditId, 'crawling', `Crawled ${crawledPages.length} pages`, { pageCount: crawledPages.length })
      await auditLog(auditId, 'crawl_completed', 'success', `Crawled ${crawledPages.length} page(s)`)

      // Collect head tags for downstream structured data validation
      const allHeadTags = filteredPages
        .filter((p) => p.headTags)
        .map((p) => ({ url: p.url, headTags: p.headTags! }))

      // Crawl quality flag: 'full' (3+ good pages), 'limited' (1-2), 'homepage-only' (1)
      const crawlQuality = filteredPages.length >= 3 ? 'full' : filteredPages.length >= 2 ? 'limited' : 'homepage-only'
      if (crawlQuality !== 'full') {
        console.log(`[inngest] Crawl quality: ${crawlQuality} (${filteredPages.length} usable pages from ${crawledPages.length} crawled)`)
      }

      return {
        pageCount: crawledPages.length,
        pageContent, // Passed to analysis steps
        firstPageUrl: crawledPages[0]?.url || '',
        crawledUrls: crawledPages.map((p) => p.url).filter(Boolean) as string[],
        headTags: allHeadTags,
        crawlQuality, // Used by downstream steps to adjust scope
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
    // STEP 2b: PARALLEL CHECKS — responsive, pagespeed, WCAG
    // These three checks are independent of each other and can
    // run concurrently within a single Inngest step, saving
    // ~25-60s of sequential execution + 2 cold starts.
    // ──────────────────────────────────────────────────────────
    const parallelChecks = await step.run('parallel-site-checks', async () => {
      await logStageStarted(auditId, 'checking', 'Running site checks...')
      await logActivity(auditId, 'Testing page speed, responsive design, and accessibility...')
      await setProgress(auditId, stageProgress('checking', 0), 'checking')

      // ── Responsive Design Check ──
      const responsivePromise = (async () => {
        try {
          const maxUrls = auditDetails.plan === 'free_preview' ? 1 : 3
          const result = await checkResponsiveDesign(crawlResult.crawledUrls, maxUrls)

          // Store responsive findings in audit_findings
          if (result.findings.length > 0) {
            const db = getDb()
            const { data: existingFindings } = await db
              .from('audit_findings')
              .select('sort_order')
              .eq('audit_id', auditId)
              .order('sort_order', { ascending: false })
              .limit(1)

            let sortOrder = ((existingFindings?.[0] as any)?.sort_order ?? -1) + 1

            const responsiveInserts = result.findings.map((finding) => {
              const cls = classifyFinding({ title: finding.title, description: finding.description, recommendation: finding.recommendation, severity: finding.severity, categoryIndex: finding.categoryIndex ?? null })
              return {
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
                communication: buildCommunicationForGenericFinding({ title: finding.title, description: finding.description, recommendation: finding.recommendation, estimatedImpact: finding.estimatedImpact || null, severity: finding.severity }, siteProfile),
                ...computeActionModelFields({ title: finding.title, description: finding.description, recommendation: finding.recommendation, fix_type: cls.fixType, finding_type: cls.findingType }),
              }
            })
            await db.from('audit_findings').insert(responsiveInserts as any)
          }

          // Update audit_pages with mobile-friendly data
          if (result.results.length > 0) {
            const db = getDb()
            await Promise.all(result.results.map((r) => {
              const issueCount = r.viewportIssues.filter(i => i.viewport === 'Mobile').length
              return db
                .from('audit_pages')
                .update({
                  is_mobile_friendly: issueCount === 0,
                  viewport_meta: r.hasMobileViewport ? 'width=device-width, initial-scale=1' : null,
                } as any)
                .eq('audit_id', auditId)
                .eq('url', r.url)
            }))
          }

          await auditLog(auditId, 'responsive_check_completed', 'success',
            `Responsive check: ${result.findings.length} findings across ${result.results.length} page(s)`, {
              findings_count: result.findings.length,
              pages_checked: result.results.length,
              viewports: [375, 768, 1024, 1440],
            })

          return { summary: result.summary, findingsCount: result.findings.length }
        } catch (err) {
          console.error('[inngest] Responsive check failed (non-fatal):', err)
          await auditLog(auditId, 'responsive_check_failed', 'warning',
            `Responsive check failed: ${err instanceof Error ? err.message : String(err)}. Continuing with text-based analysis.`)
          return { summary: '', findingsCount: 0 }
        }
      })()

      // ── PageSpeed Insights ──
      const pagespeedPromise = (async () => {
        if (auditDetails.auditType === 'brand_identity') return null
        try {
          await auditLog(auditId, 'pagespeed_started', 'info', `Running PageSpeed test for ${auditDetails.productUrl}`)
          const speedData = await runFullSpeedTest(auditDetails.productUrl)

          // Generate findings first so issueCount matches actual findings, not raw diagnostics
          const speedFindings = generateSpeedFindings(speedData)

          const mapSpeedResult = (r: typeof speedData.mobile) => r ? {
            score: r.score,
            categories: r.categories,
            strategy: r.strategy,
            metrics: r.metrics,
            issueCount: speedFindings.length,
            finalUrl: r.finalUrl,
            screenshotUrl: r.screenshotUrl,
            testedAt: r.testedAt,
          } : null

          const speedSummary = {
            mobile: mapSpeedResult(speedData.mobile),
            desktop: mapSpeedResult(speedData.desktop),
            testedAt: speedData.testedAt,
          }

          const db = getDb()
          await db
            .from('audits')
            .update({ speed_data: speedSummary, speed_tested_at: speedData.testedAt } as any)
            .eq('id', auditId)
          if (speedFindings.length > 0) {
            const findingRows = speedFindings.map((f, i) => ({
              audit_id: auditId,
              category: 'Performance & Page Speed',
              category_index: 23,
              title: f.title,
              description: f.description,
              recommendation: f.recommendation,
              severity: f.severity,
              detection_source: 'pagespeed_api',
              performance_metric_type: f.metricType || null,
              status: 'open' as const,
              position: 900 + i,
              communication: buildCommunicationForGenericFinding({ title: f.title, description: f.description, recommendation: f.recommendation, estimatedImpact: null, severity: f.severity }, siteProfile),
            }))
            await db.from('audit_findings').insert(findingRows)
          }

          await auditLog(auditId, 'pagespeed_completed', 'success',
            `PageSpeed: score ${speedSummary.mobile?.score ?? '?'}(m) / ${speedSummary.desktop?.score ?? '?'}(d), ${speedFindings.length} finding(s)`)
          return speedSummary
        } catch (err) {
          console.error('[process-audit] PageSpeed test error (non-fatal):', err)
          await auditLog(auditId, 'pagespeed_error', 'warning', 'PageSpeed API call failed — continuing without real CWV data')
          return null
        }
      })()

      // ── WCAG 2.1 AA Compliance Check ──
      const wcagPromise = (async () => {
        try {
          const maxUrls = auditDetails.plan === 'free_preview' ? 1 : 3
          const { automatedResults, heuristicPrompts } = await checkWcagAutomated(crawlResult.crawledUrls, maxUrls)

          const heuristicResults = new Map<string, WcagCheckResult[]>()
          const Anthropic = (await import('@anthropic-ai/sdk')).default
          const anthropic = new Anthropic()
          await Promise.all(Array.from(heuristicPrompts.entries()).map(async ([url, prompt]) => {
            try {
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
          }))

          const wcagResult = buildWcagResults(automatedResults, heuristicResults)

          if (wcagResult.totalFindings > 0) {
            const db = getDb()
            const { data: existingFindings } = await db
              .from('audit_findings')
              .select('sort_order')
              .eq('audit_id', auditId)
              .order('sort_order', { ascending: false })
              .limit(1)

            let sortOrder = ((existingFindings?.[0] as any)?.sort_order ?? -1) + 1

            const wcagInserts: any[] = []
            for (const page of wcagResult.pages) {
              for (const finding of page.findings) {
                const cls = classifyFinding({
                  title: finding.title,
                  description: finding.description,
                  recommendation: finding.recommendation,
                  severity: finding.severity,
                  categoryIndex: 8,
                })
                const wcagDesc = `[WCAG ${finding.wcagCriterion}] ${finding.description}`
                wcagInserts.push({
                  audit_id: auditId,
                  checklist_item_id: null,
                  category_index: 8,
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
                  communication: buildCommunicationForGenericFinding({ title: finding.title, description: wcagDesc, recommendation: finding.recommendation, estimatedImpact: null, severity: finding.severity }, siteProfile),
                  ...computeActionModelFields({ title: finding.title, description: wcagDesc, recommendation: finding.recommendation, fix_type: cls.fixType, finding_type: cls.findingType }),
                })
              }
            }
            if (wcagInserts.length > 0) {
              await db.from('audit_findings').insert(wcagInserts)
            }
          }

          if (wcagResult.pages.length > 0) {
            const db = getDb()
            await Promise.all(wcagResult.pages.map((page) =>
              db
                .from('audit_pages')
                .update({
                  wcag_checklist: JSON.stringify(page.checklist),
                  wcag_score: page.score,
                } as any)
                .eq('audit_id', auditId)
                .eq('url', page.url)
            ))
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
          return { summary: '', findingsCount: 0, overallScore: 0 }
        }
      })()

      // Run all three in parallel with a 120s master timeout.
      // Individual checks have their own try/catch, but if Puppeteer
      // or the PageSpeed API hangs, the Promise.all blocks forever.
      const SITE_CHECKS_TIMEOUT_MS = 120_000
      const [responsive, _pagespeed, wcag] = await Promise.race([
        Promise.all([
          responsivePromise,
          pagespeedPromise,
          wcagPromise,
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Parallel site checks exceeded 120s timeout')), SITE_CHECKS_TIMEOUT_MS),
        ),
      ]).catch(err => {
        console.error(`[inngest] Parallel site checks failed or timed out: ${err?.message || err}`)
        // Return safe defaults so the pipeline can continue
        return [
          { summary: '', findingsCount: 0 },  // responsive
          null,                                 // pagespeed
          { summary: '', findingsCount: 0, overallScore: 0 }, // wcag
        ] as any
      })

      // Handle transparency notes
      if (responsive.findingsCount === 0) {
        auditLimitations.push({
          id: 'responsive_no_issues',
          title: 'No technical responsive issues detected',
          description: 'Our browser-based responsive check found no technical layout issues (overflow, undersized touch targets, missing viewport meta). This check focuses on measurable technical problems. Subjective visual quality aspects like content density, whitespace balance, and layout aesthetics are not covered by automated testing.',
          tab: 'responsive',
        })
      }
      if (wcag.summary === '') {
        auditLimitations.push({
          id: 'wcag_check_unavailable',
          title: 'Automated WCAG compliance check unavailable',
          description: 'We could not render this website in a browser to run WCAG 2.1 AA compliance checks. The accessibility analysis is based on AI text review only.',
          tab: 'findings',
        })
      }

      await logStageCompleted(auditId, 'checking', 'Site checks complete')
      return { responsive, wcag }
    })

    const responsiveCheck = parallelChecks.responsive
    const wcagCheck = parallelChecks.wcag

    // ──────────────────────────────────────────────────────────
    // STEP 2c-2i COMBINED: Run all probe steps in parallel
    // These are independent: AI discovery, structured data,
    // page readability, LLM probe, citation audit, fix playbooks,
    // and multi-model benchmark. Running them in parallel saves
    // ~40-60s vs sequential execution.
    // ──────────────────────────────────────────────────────────
    const probeResults = await step.run('parallel-probes', async () => {
      await logStageStarted(auditId, 'probing', 'Probing AI models for brand knowledge...')
      await logActivity(auditId, 'Testing search visibility and AI perception...')
      await setProgress(auditId, stageProgress('probing', 0), 'probing')

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
            // Batch insert all structured data findings at once
            const sdInserts = result.findings.map(finding => {
              const classification = classifyFinding({
                title: finding.title, description: finding.description,
                recommendation: finding.recommendation, severity: finding.severity,
                categoryIndex: finding.categoryIndex ?? 17,
              })
              const validated = validateFixableRecommendation({
                ...finding, ...classification,
                title: finding.title, description: finding.description,
                recommendation: finding.recommendation, severity: finding.severity,
              })
              return {
                audit_id: auditId, checklist_item_id: null,
                category_index: finding.categoryIndex ?? 17, severity: finding.severity,
                title: finding.title, description: finding.description, evidence: null,
                page_url: finding.pageUrl || crawlResult.firstPageUrl,
                recommendation: finding.recommendation,
                estimated_impact: finding.estimatedImpact || null, target_element: null,
                sort_order: sortOrder++, status: 'open', dismissed: false,
                finding_type: validated.findingType, fix_type: validated.fixType,
                confidence_level: 'deterministic', detection_source: 'structured_data',
                communication: buildCommunicationForGenericFinding({ title: finding.title, description: finding.description, recommendation: finding.recommendation, estimatedImpact: finding.estimatedImpact || null, severity: finding.severity }, siteProfile),
                ...computeActionModelFields({ title: finding.title, description: finding.description, recommendation: finding.recommendation, fix_type: validated.fixType, finding_type: validated.findingType }),
              }
            })
            await db.from('audit_findings').insert(sdInserts as any)
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
          // Batch insert all LLM probe results at once
          if (session.results.length > 0) {
            const probeInserts = session.results.map(r => ({
              audit_id: auditId, question: r.question, answer: r.answer,
              accuracy: r.accuracy, accuracy_note: r.accuracyNote,
              cited_url: r.citedUrl, model_used: r.modelUsed,
            }))
            await db.from('llm_probe_results').insert(probeInserts as any)
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
          // Load user's AI model settings to determine which models to probe
          let enabledModelSlugs: string[] | undefined
          try {
            const { data: auditRow } = await db.from('audits').select('user_id').eq('id', auditId).single()
            const auditUserId = (auditRow as any)?.user_id
            if (auditUserId) {
              const { data: userSettings } = await db
                .from('ai_model_settings')
                .select('model_slug, enabled')
                .eq('user_id', auditUserId)
              if (userSettings && userSettings.length > 0) {
                const rawSlugs = (userSettings as any[])
                  .filter((s: any) => s.enabled)
                  .map((s: any) => s.model_slug)
                // Validate slugs against current catalog — stale slugs from
                // old model catalog versions get filtered out here
                const validSlugs = rawSlugs.filter((slug: string) => findModelBySlug(slug) != null)
                if (validSlugs.length > 0) {
                  enabledModelSlugs = validSlugs
                }
                // If ALL slugs are stale, leave undefined → uses catalog defaults
                if (validSlugs.length < rawSlugs.length) {
                  console.warn(`[inngest] Filtered out ${rawSlugs.length - validSlugs.length} stale model slug(s) from user settings`)
                }
              }
            }
          } catch {
            // If table doesn't exist yet or query fails, use defaults
          }
          const comparison = await runMultiModelBenchmark(domain, groundTruth, enabledModelSlugs)
          // Batch insert all multi-model benchmark results at once
          if (comparison.benchmarks.length > 0) {
            const benchInserts = comparison.benchmarks.map(b => ({
              audit_id: auditId, model_id: b.modelId, model_label: b.modelLabel,
              accuracy_score: b.accuracyScore, accurate_count: b.accurateCount,
              partial_count: b.partialCount, inaccurate_count: b.inaccurateCount,
              hallucinated_count: b.hallucinatedCount, no_data_count: b.noDataCount,
              total_questions: b.totalQuestions, results_json: b.results as any,
              status: b.status, error_message: b.errorMessage,
            }))
            await db.from('multi_model_probes').insert(benchInserts as any)
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

      // ── Run ALL probes in parallel for maximum speed ──
      // Lightweight probes (AI discovery, structured data, readability) run
      // alongside the heavier API probes (LLM probe, citation, multi-model).
      // Rate limit risk is acceptable — providers use per-minute token budgets
      // and our calls are spread across different providers (Anthropic, OpenAI,
      // Google, Perplexity).
      // Wrap all probes in a 90-second hard timeout to prevent indefinite blocking.
      // If any single probe hangs (rate limit, unresponsive model), the entire
      // Promise.all() would block. This timeout ensures forward progress.
      const PROBE_TIMEOUT_MS = 90_000
      const [aiDisc, sdResult, , llmProbe, citation, multiModel] = await Promise.race([
        Promise.all([
          aiDiscoveryPromise,
          structuredDataPromise,
          readabilityPromise,
          runLlmProbeStep(),
          runCitationStep(),
          runMultiModelStep(),
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Parallel probes exceeded 90s timeout')), PROBE_TIMEOUT_MS),
        ),
      ]).catch(err => {
        console.error(`[inngest] Parallel probes failed or timed out: ${err?.message || err}`)
        // Return safe defaults so the pipeline can continue
        return [
          { summary: '', result: null },          // aiDiscovery
          { summary: '', findingsCount: 0, typesFound: [] as string[] }, // structuredData
          undefined,                               // readability (unused)
          null,                                    // llmProbe
          null,                                    // citation
          { comparison: null, industry: null },    // multiModel
        ] as any
      })

      await setProgress(auditId, stageProgress('probing', 1))
      await logStageCompleted(auditId, 'probing', 'AI visibility probes complete')

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
      await logStageStarted(auditId, 'analysing', 'Analysing content...')
      await logActivity(auditId, 'Building site context map for cross-page awareness...')
      await setStatus(auditId, 'analysing', stageProgress('analysing', 0))
      await setProgress(auditId, stageProgress('analysing', 0), 'analysing')

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
      // Wrapped in withTimeout to prevent Supabase cold-start / pool stalls from blocking the step
      const CONTEXT_DB_TIMEOUT = 30_000 // 30s — generous but prevents 2+ min hangs
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
        id: string; title: string; severity: string; description: string; recommendation: string;
        estimated_impact: string | null; target_element: string | null; page_url: string | null;
        sort_order: number; status: string; dismissed: boolean; dismissal_reason: string | null;
        fix_status: string | null; finding_type: string; checklist_item_id: string | null;
      }> = []
      let previousExecutiveSummary = ''
      let previousReportJson: any = null
      let prevAuditId: string | null = null
      if (domain && userId) {
        // Fetch site notes + previous audit ID in parallel (with timeout to prevent stalls)
        const contextResult = await withTimeout(Promise.all([
          noteDb.from('site_notes')
            .select('note_type, title, content, category, finding_ref')
            .eq('user_id', userId).eq('domain', domain).eq('is_active', true)
            .order('created_at', { ascending: false }).limit(20),
          noteDb.from('audits')
            .select('id, product_url').eq('user_id', userId).neq('id', auditId)
            .eq('status', 'completed').ilike('product_url', `%${domain}%`)
            .order('completed_at', { ascending: false }).limit(1),
        ]), CONTEXT_DB_TIMEOUT, 'site-context-db')
        const [siteNotesRes, prevAuditsRes] = contextResult || [{ data: null }, { data: null }]

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
          prevAuditId = (prevAuditsRes.data[0] as any).id

          // Link current audit to previous via previous_audit_id
          await noteDb.from('audits')
            .update({ previous_audit_id: prevAuditId } as any)
            .eq('id', auditId)

          // Fetch previous report scores + all findings (FULL data for baseline copy)
          const prevDataResult = await withTimeout(Promise.all([
            noteDb.from('reports').select('overall_score, executive_summary, raw_json').eq('audit_id', prevAuditId).single(),
            noteDb.from('audit_findings')
              .select('id, title, severity, description, recommendation, estimated_impact, target_element, page_url, sort_order, status, dismissed, dismissal_reason, category_index, fix_status, finding_type, checklist_item_id')
              .eq('audit_id', prevAuditId)
              .order('sort_order', { ascending: true }).limit(60),
          ]), CONTEXT_DB_TIMEOUT, 'prev-audit-db')
          const [prevReportRes, prevFindingsRes] = prevDataResult || [{ data: null }, { data: null }]

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
              id: f.id, title: f.title, severity: f.severity, description: f.description,
              recommendation: f.recommendation, estimated_impact: f.estimated_impact,
              target_element: f.target_element, page_url: f.page_url,
              sort_order: f.sort_order, status: f.status, dismissed: f.dismissed,
              dismissal_reason: f.dismissal_reason,
              fix_status: f.fix_status || null,
              finding_type: f.finding_type || 'fixable',
              checklist_item_id: f.checklist_item_id || null,
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
        previousAuditId: prevAuditId || null,
      }
    })

    const effectiveDepthMode = siteContext.effectiveDepthMode
    console.log(`[inngest] Audit ${auditId}: depth mode = ${effectiveDepthMode} (requested: ${auditDetails.depthMode})`)

    // ──────────────────────────────────────────────────────────
    // STEP 3b: Detect site profile (industry, audience, context)
    // Runs once before any analysis. Lightweight (~2s Haiku call).
    // Feeds into analyzeCategory() so findings are context-aware.
    // ──────────────────────────────────────────────────────────
    const siteProfile: SiteProfile | null = await step.run('detect-site-profile', async () => {
      try {
        await logActivity(auditId, 'Detecting site industry and audience profile...')
        const profile = await withTimeout(
          detectSiteProfile(crawlResult.pageContent, auditDetails.productUrl),
          15_000,
          'detect-site-profile',
        )
        if (profile) {
          console.log(`[inngest] Site profile: ${profile.industryVertical} | ${profile.targetAudience} | ${profile.marketPosition}`)
          await auditLog(auditId, 'site_profile_detected', 'success',
            `${profile.industryVertical} | ${profile.targetAudience} | ${profile.audienceSophistication} | ${profile.marketPosition}`)
        }
        return profile
      } catch (err) {
        console.warn('[inngest] Site profile detection failed, using defaults:', err instanceof Error ? err.message : err)
        return null
      }
    })

    let verificationData: { verified: number; likelyFixed: number; poorlyFixed: number; results: Array<{ findingId: string; status: string; note: string }> } | null = null
    // Titles of previous findings verified as fixed on the live site (for deep mode).
    // Hoisted here so quality gates (which run after both branches) can access it.
    let deepVerifiedFixedTitles: Set<string> = new Set()

    // Helper: check if a brand identity has meaningful content beyond auto-populated fields
    async function hasMeaningfulBrandDna(brandIdentityId: string): Promise<boolean> {
      const db = getDb()
      // Check for uploaded brand files
      const { count } = await db
        .from('brand_identity_files')
        .select('id', { count: 'exact', head: true })
        .eq('brand_identity_id', brandIdentityId)
      if (count && count > 0) return true
      // Check for manually filled fields beyond auto-populated name+website_url
      const { data: identity } = await db
        .from('brand_identities')
        .select('description, brand_voice, tone_keywords, primary_colors, logo_url')
        .eq('id', brandIdentityId)
        .single()
      if (!identity) return false
      const hasDescription = !!identity.description?.trim()
      const hasVoice = !!identity.brand_voice?.trim()
      const hasTone = Array.isArray(identity.tone_keywords) && identity.tone_keywords.length > 0
      const hasColors = Array.isArray(identity.primary_colors) && identity.primary_colors.length > 0
      const hasLogo = !!identity.logo_url?.trim()
      return hasDescription || hasVoice || hasTone || hasColors || hasLogo
    }

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
        let droppedFixed = 0
        let droppedDismissed = 0

        // Build batch insert array — was individual INSERT loop
        const batchInserts: any[] = []
        for (const pf of prevFindings) {
          if (pf.dismissed) { droppedDismissed++; continue }
          if (pf.status === 'fixed') { droppedFixed++; continue }
          const pfFindingType = (pf as any).finding_type || 'fixable'
          const pfFixType = (pf as any).fix_type || null
          batchInserts.push({
            audit_id: auditId,
            checklist_item_id: null,
            category_index: (pf as any).category_index ?? null,
            severity: pf.severity,
            title: pf.title,
            description: pf.description,
            evidence: null,
            page_url: pf.page_url || crawlResult.firstPageUrl,
            recommendation: pf.recommendation,
            estimated_impact: pf.estimated_impact || null,
            target_element: pf.target_element || null,
            screenshot_url: null,
            sort_order: sortOrder++,
            finding_type: pfFindingType,
            fix_type: pfFixType,
            confidence_level: (pf as any).confidence_level || 'heuristic',
            detection_source: 'gap_fill',
            communication: buildCommunicationForGenericFinding({ title: pf.title, description: pf.description, recommendation: pf.recommendation, estimatedImpact: pf.estimated_impact || null, severity: pf.severity }, siteProfile),
            ...computeActionModelFields({ title: pf.title, description: pf.description, recommendation: pf.recommendation, fix_type: pfFixType, finding_type: pfFindingType }),
          })
        }

        if (batchInserts.length > 0) {
          await db.from('audit_findings').insert(batchInserts as any)
        }

        const copiedCount = batchInserts.length
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

        // Update findings in DB in parallel (columns may not exist yet — graceful fallback)
        let likelyFixedCount = 0
        let poorlyFixedCount = 0
        for (const result of verificationResults) {
          if (result.status === 'likely_fixed') likelyFixedCount++
          if (result.status === 'poorly_fixed') poorlyFixedCount++
        }
        try {
          await Promise.all(
            verificationResults.map(result =>
              db.from('audit_findings')
                .update({ verification_status: result.status, verification_note: result.note } as any)
                .eq('id', result.findingId)
            )
          )
        } catch (e) {
          // Columns may not exist yet — that's OK, results are carried in memory
        }

        // ── Remove likely_fixed findings from the report ──
        // Previously these stayed visible with a label. Now we actually
        // remove them so the report only shows real open issues. The
        // droppedFixed count in generateReport still accounts for them
        // when computing score improvement.
        const likelyFixedIds = verificationResults
          .filter(r => r.status === 'likely_fixed')
          .map(r => r.findingId)
        if (likelyFixedIds.length > 0) {
          await db.from('audit_findings').delete().in('id', likelyFixedIds)
          await auditLog(auditId, 'verified_fixed_removed', 'info',
            `Removed ${likelyFixedIds.length} finding${likelyFixedIds.length > 1 ? 's' : ''} verified as fixed on the live site`)
        }

        await auditLog(auditId, 'verification_completed', 'success',
          `Verified ${verificationResults.length} findings: ${likelyFixedCount} likely fixed (removed), ${poorlyFixedCount} poorly fixed, ${verificationResults.length - likelyFixedCount - poorlyFixedCount} confirmed open`, {
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
      const MODULE_SLUG_ORDER_BL = ['foundation', 'human_experience', 'inclusive_design', 'future_readiness', 'seo_structure', 'accessibility_readiness', 'design_consistency']

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

      // Design Consistency always runs. Brand DNA enrichment only when explicitly enabled.
      let includeBrandDnaEnrichmentBl = false
      if (activeSlugsBl.includes('brand_consistency') && auditDetails.brandIdentityId) {
        const hasMeaningful = await hasMeaningfulBrandDna(auditDetails.brandIdentityId)
        includeBrandDnaEnrichmentBl = hasMeaningful
      }
      // Normalize slug: 'brand_consistency' → 'design_consistency' for category resolution
      activeSlugsBl = activeSlugsBl.map(s => s === 'brand_consistency' ? 'design_consistency' : s)
      // Ensure design_consistency is always in the active set for baseline re-audits
      if (!activeSlugsBl.includes('design_consistency')) {
        activeSlugsBl.push('design_consistency')
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
        console.log(`[inngest] Baseline gap fill: ${missingModuleSlugs.length} new module(s): ${missingModuleSlugs.join(', ')}`)

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

        // Design Consistency gap fill — uses standard content by default.
        // When Brand DNA enrichment is enabled, prepend brand guidelines for comparison.
        let designConsistencyContentBl = contentWithContextBl
        const designConsistencyCategoryNamesBl = new Set(UX_CATEGORY_NAMES.slice(24, 28))
        if (missingModuleSlugs.includes('design_consistency') && includeBrandDnaEnrichmentBl && auditDetails.brandIdentityId) {
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
              // Regression fix: Include visualDescription alongside textContent.
              const textParts = extracted
                .filter(e => (e.textContent && e.textContent.length > 0) || (e.visualDescription && e.visualDescription.length > 0))
                .map(e => {
                  const parts = [`[Brand file: ${e.fileName}]`]
                  if (e.textContent) parts.push(e.textContent)
                  if (e.visualDescription) parts.push(`[Visual description]: ${e.visualDescription}`)
                  return parts.join('\n')
                })
              const brandCtx = textParts.join('\n\n---\n\n')
              // Regression fix: Strengthened from weak "ALSO compare" to dedicated comparison
              // section. RULE 5: Brand DNA comparison must highlight real mismatches.
              designConsistencyContentBl = `=== BRAND IDENTITY GUIDELINES (PRIMARY REFERENCE) ===\n${brandCtx}\n\n=== MANDATORY COMPARISON INSTRUCTION ===\nYour PRIMARY task for this category is to compare the website's actual implementation against the brand guidelines above. For EACH aspect of the brand guidelines (colors, typography, voice, tone, visual style, messaging patterns), check whether the website follows or deviates from them.\n\nYou MUST flag:\n- Any mismatch between documented brand colors/fonts and what the site actually uses\n- Voice/tone deviations from the brand personality\n- Visual style inconsistencies with brand guidelines\n- Messaging that contradicts the brand positioning\n\nDo NOT smooth over discrepancies. If the brand says "professional and authoritative" but the site uses casual slang, that is a HIGH severity finding. If the brand specifies specific colors but the site uses different ones, flag it.\n\n=== WEBSITE CONTENT (TO COMPARE AGAINST BRAND) ===\n${contentWithContextBl}`
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
            gapCategories.map(async (categoryName) => {
              const isDesignConsistencyCategory = designConsistencyCategoryNamesBl.has(categoryName)
              const content = isDesignConsistencyCategory ? designConsistencyContentBl : contentWithContextBl
              try {
                const result = await withTimeout(
                  analyzeCategory(
                    content, categoryName, [], auditDetails.userFocus, auditDetails.language, 'deep', siteProfile,
                  ),
                  45_000,
                  `gap-fill-${categoryName}`,
                )
                return result || []
              } catch (gapErr) {
                console.error(`[inngest] Gap-fill category "${categoryName}" timed out/failed:`, (gapErr as Error)?.message)
                return []
              }
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
                communication: buildCommunicationForGenericFinding({ title: finding.title, description: finding.description, recommendation: finding.recommendation, estimatedImpact: finding.estimatedImpact || null, severity: finding.severity }, siteProfile),
                ...computeActionModelFields({ title: finding.title, description: finding.description, recommendation: finding.recommendation, fix_type: validated.fixType, finding_type: validated.findingType }),
              } as any)
              findingsInGap++
            }
          }

          return { findingsInGap, categoriesAnalyzed: gapCategories.length }
        })

        console.log(`[inngest] Gap fill: analyzed ${gapBatchResult.categoriesAnalyzed} categories, found ${gapBatchResult.findingsInGap} new findings`)
      }

    } else {
      // ════════════════════════════════════════════════════════════
      // DEEP MODE PRE-VERIFICATION — Check if "open" findings were silently fixed
      // Most companies download the report, fix issues, and never update the
      // status in the dashboard. Before deep analysis, verify all [OPEN]
      // previous findings against the fresh crawl. Findings confirmed as
      // fixed get their labels updated so the AI analyzer doesn't re-report
      // them, and the quality gates filter also catches any that slip through.
      // ════════════════════════════════════════════════════════════
      if (siteContext.previousRawFindings.length > 0) {
        const deepPreVerify = await step.run('deep-pre-verify-findings', async () => {
          // Only verify findings that are still "open" (not fixed/dismissed by user)
          const openFindings = siteContext.previousRawFindings.filter(
            (f: any) => !f.dismissed && f.status !== 'fixed'
          )
          if (openFindings.length === 0) {
            return { verifiedFixedTitles: [] as string[], likelyFixed: 0 }
          }

          await auditLog(auditId, 'deep_pre_verify_started', 'info',
            `Pre-verifying ${openFindings.length} open findings against live site before deep analysis`)

          const verificationResults = await verifyFindings(
            openFindings.map((f: any) => ({
              id: f.id,
              title: f.title,
              description: f.description,
              recommendation: f.recommendation,
              page_url: f.page_url,
              severity: f.severity,
              target_element: f.target_element,
            })),
            crawlResult.pageContent,
            auditDetails.language,
          )

          const fixedTitles = verificationResults
            .filter(r => r.status === 'likely_fixed')
            .map(r => {
              const finding = openFindings.find((f: any) => f.id === r.findingId)
              return finding ? finding.title : ''
            })
            .filter(Boolean)

          const likelyFixed = fixedTitles.length
          if (likelyFixed > 0) {
            await auditLog(auditId, 'deep_pre_verify_completed', 'success',
              `Pre-verification: ${likelyFixed} of ${openFindings.length} open findings appear fixed on the live site`, {
                likely_fixed: likelyFixed,
                total_verified: openFindings.length,
              })
          }

          return { verifiedFixedTitles: fixedTitles, likelyFixed }
        })

        // Store verified-fixed titles for use in quality gates and context patching
        deepVerifiedFixedTitles = new Set(deepPreVerify.verifiedFixedTitles)

        // Update verificationData so the score calculation accounts for silently fixed findings
        if (deepPreVerify.likelyFixed > 0) {
          verificationData = {
            verified: deepPreVerify.verifiedFixedTitles.length,
            likelyFixed: deepPreVerify.likelyFixed,
            poorlyFixed: 0,
            results: [],
          }
        }
      }

      // Patch the context string: replace [OPEN] with [VERIFIED FIXED] for findings
      // confirmed as fixed on the live site, so the AI analyzer doesn't re-report them
      let patchedContext = siteContext.context
      for (const title of deepVerifiedFixedTitles) {
        // Replace the [OPEN] label with [VERIFIED FIXED] in the previous findings block
        const openPattern = `  [OPEN] "${title}"`
        const inProgressPattern = `  [IN PROGRESS] "${title}"`
        if (patchedContext.includes(openPattern)) {
          patchedContext = patchedContext.replace(
            openPattern,
            `  [VERIFIED FIXED] "${title}" — Confirmed fixed on live site`
          )
        } else if (patchedContext.includes(inProgressPattern)) {
          patchedContext = patchedContext.replace(
            inProgressPattern,
            `  [VERIFIED FIXED] "${title}" — Confirmed fixed on live site`
          )
        }
      }
      // Add a rule for the new label
      if (deepVerifiedFixedTitles.size > 0 && patchedContext.includes('RULES FOR RE-AUDIT:')) {
        patchedContext = patchedContext.replace(
          'RULES FOR RE-AUDIT:',
          'RULES FOR RE-AUDIT:\n- [VERIFIED FIXED] findings: These have been confirmed as fixed on the live site. Do NOT re-report them under any circumstances.'
        )
      }

      // ════════════════════════════════════════════════════════════
      // DEEP MODE (first audit or explicit Dig Deeper) — FULL AI ANALYSIS
      // ════════════════════════════════════════════════════════════
      await logActivity(auditId, 'Preparing analysis modules...')
      await setProgress(auditId, stageProgress('analysing', 0) + 1, 'analysing')

      // ── Determine which modules (and thus categories) to analyze ──
      // Module slug → category index mapping (each module = 4 categories):
      //   foundation → 0-3, human_experience → 4-7, inclusive_design → 8-11,
      //   future_readiness → 12-15, seo_structure → 16-19, accessibility_readiness → 20-23, design_consistency → 24-27
      const MODULE_SLUG_ORDER = ['foundation', 'human_experience', 'inclusive_design', 'future_readiness', 'seo_structure', 'accessibility_readiness', 'design_consistency']

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

      // Design Consistency always runs (categories 24-27) — evaluates the live site's
      // visual system consistency. Brand DNA enrichment is ONLY added when the user
      // explicitly enabled brand_consistency AND meaningful brand files exist.
      let includeBrandDnaEnrichment = false
      if (activeSlugs.includes('brand_consistency') && auditDetails.brandIdentityId) {
        try {
          const hasMeaningful = await withTimeout(
            hasMeaningfulBrandDna(auditDetails.brandIdentityId),
            10_000,
            'hasMeaningfulBrandDna',
          )
          includeBrandDnaEnrichment = !!hasMeaningful
        } catch {
          console.warn('[inngest] hasMeaningfulBrandDna timed out — skipping brand enrichment')
          includeBrandDnaEnrichment = false
        }
      }
      // Normalize slug: 'brand_consistency' → 'design_consistency' for category resolution
      activeSlugs = activeSlugs.map(s => s === 'brand_consistency' ? 'design_consistency' : s)
      // Ensure design_consistency is always in the active set
      if (!activeSlugs.includes('design_consistency')) {
        activeSlugs.push('design_consistency')
      }
      await withTimeout(
        auditLog(auditId, 'design_mode', 'info',
          `Design Consistency: always active. Brand DNA enrichment: ${includeBrandDnaEnrichment ? 'enabled (meaningful brand files found)' : 'disabled'}`),
        10_000,
        'auditLog-design-mode',
      )

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

      // ── Fetch brand content only when user explicitly enabled Brand DNA comparison ──
      // Wrapped with 60s timeout to prevent hanging outside step.run() boundary
      let brandContext = ''
      if (includeBrandDnaEnrichment && auditDetails.brandIdentityId) {
        const brandExtractionResult = await withTimeout(
          (async () => {
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
              // Regression fix: Include visualDescription alongside textContent.
              // Previously only textContent was used, dropping all visual/image descriptions
              // from PDFs and images — causing Brand DNA comparison to miss logo, color,
              // and visual identity data entirely.
              const textParts = extracted
                .filter(e => (e.textContent && e.textContent.length > 0) || (e.visualDescription && e.visualDescription.length > 0))
                .map(e => {
                  const parts = [`[Brand file: ${e.fileName}]`]
                  if (e.textContent) parts.push(e.textContent)
                  if (e.visualDescription) parts.push(`[Visual description]: ${e.visualDescription}`)
                  return parts.join('\n')
                })
              const ctx = textParts.join('\n\n---\n\n')
              await auditLog(auditId, 'brand_files_extracted', 'success',
                `Extracted content from ${extracted.length} brand file(s)`)
              return ctx
            }
            return ''
          })(),
          60_000,
          'brand-file-extraction',
        )
        brandContext = brandExtractionResult ?? ''
      }

      const BATCH_SIZE = 8 // 8 parallel calls per batch — fast with Anthropic tier-3+ rate limits
      const batches = []
      for (let i = 0; i < categoriesToAnalyze.length; i += BATCH_SIZE) {
        batches.push(categoriesToAnalyze.slice(i, i + BATCH_SIZE))
      }

      const aiDiscoveryBlock = aiDiscovery.summary ? `\n\n${aiDiscovery.summary}` : ''
      const structuredDataBlock = structuredDataResult.summary ? `\n\n${structuredDataResult.summary}` : ''
      const llmProbeBlock = llmProbeResult.summary ? `\n\n${llmProbeResult.summary}` : ''
      // Use patchedContext (which has [VERIFIED FIXED] labels) instead of siteContext.context
      const contentWithContext = `${patchedContext}\n\n${crawlResult.pageContent}${aiDiscoveryBlock}${structuredDataBlock}${llmProbeBlock}`
      // Design Consistency categories use standard content by default.
      // When Brand DNA enrichment is enabled, prepend brand guidelines for comparison.
      // Regression fix: Strengthened from weak "ALSO compare" afterthought to a dedicated
      // comparison section with explicit instructions. RULE 5: Brand DNA comparison must
      // highlight real mismatches, not smooth them over.
      const designConsistencyContent = brandContext
        ? `=== BRAND IDENTITY GUIDELINES (PRIMARY REFERENCE) ===\n${brandContext}\n\n=== MANDATORY COMPARISON INSTRUCTION ===\nYour PRIMARY task for this category is to compare the website's actual implementation against the brand guidelines above. For EACH aspect of the brand guidelines (colors, typography, voice, tone, visual style, messaging patterns), check whether the website follows or deviates from them.\n\nYou MUST flag:\n- Any mismatch between documented brand colors/fonts and what the site actually uses\n- Voice/tone deviations from the brand personality\n- Visual style inconsistencies with brand guidelines\n- Messaging that contradicts the brand positioning\n\nDo NOT smooth over discrepancies. If the brand says "professional and authoritative" but the site uses casual slang, that is a HIGH severity finding. If the brand specifies specific colors but the site uses different ones, flag it.\n\n=== WEBSITE CONTENT (TO COMPARE AGAINST BRAND) ===\n${contentWithContext}`
        : contentWithContext
      // Design Consistency category names (indices 24-27)
      const designConsistencyCategoryNames = new Set(
        UX_CATEGORY_NAMES.slice(24, 28)
      )

      let totalFindingsCount = 0
      await logActivity(auditId, `Starting deep analysis: ${categoriesToAnalyze.length} categories across ${batches.length} batch${batches.length === 1 ? '' : 'es'}...`)

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx]

        // Visibility: log each batch start so the user sees progress
        const batchStartProgress = Math.round(30 + (batchIdx / batches.length) * 35)
        await logActivity(auditId, `Analysing batch ${batchIdx + 1}/${batches.length}: ${batch.slice(0, 3).join(', ')}${batch.length > 3 ? '...' : ''}`)
        await setProgress(auditId, batchStartProgress, 'analysing')

        const batchResult = await step.run(`analyze-batch-${batchIdx + 1}`, async () => {
          const db = getDb()
          let sortOrder = totalFindingsCount
          let findingsInBatch = 0

          console.log(`[inngest] Batch ${batchIdx + 1}: ${batch.join(', ')}`)
          const CATEGORY_TIMEOUT_MS = 45_000 // 45s hard budget per category
          const batchResults = await Promise.all(
            batch.map(async (categoryName) => {
              const content = designConsistencyCategoryNames.has(categoryName)
                ? designConsistencyContent
                : contentWithContext
              try {
                const result = await withTimeout(
                  analyzeCategory(content, categoryName, [], auditDetails.userFocus, auditDetails.language, 'deep', siteProfile),
                  CATEGORY_TIMEOUT_MS,
                  `analyze-${categoryName}`,
                )
                return result || [] // withTimeout returns null on timeout
              } catch (err) {
                console.error(`[inngest] Category ${categoryName} failed:`, err)
                return []
              }
            }),
          )

          // Batch all findings for this analysis batch into a single insert
          const batchInserts: any[] = []

          for (let catIdx = 0; catIdx < batchResults.length; catIdx++) {
            const findings = batchResults[catIdx]
            const categoryName = batch[catIdx]
            const absoluteCatIdx = UX_CATEGORY_NAMES.indexOf(categoryName)

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
                categoryIndex: absoluteCatIdx >= 0 ? absoluteCatIdx : (finding.categoryIndex ?? null),
              })
              const classification = validateFixableRecommendation({
                ...finding,
                findingType: rawClassification.findingType,
                fixType: rawClassification.fixType,
              })
              // Build dual-layer communication JSONB
              const commFields = enrichWithCommunication([finding], siteProfile)
              const comm = commFields[0]?.communication || null

              batchInserts.push({
                audit_id: auditId,
                checklist_item_id: null,
                category_index: absoluteCatIdx >= 0 ? absoluteCatIdx : (finding.categoryIndex ?? null),
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
                communication: comm,
                ...computeActionModelFields({ title: finding.title, description: finding.description, recommendation: finding.recommendation, fix_type: classification.fixType, finding_type: classification.findingType }),
              })
            }

            findingsInBatch += findings.length
            await auditLog(auditId, 'category_analysed', 'success', `Analyzed: ${categoryName}`, {
              findings_count: findings.length,
            })
          }

          // Single batch insert for all findings in this analysis batch
          if (batchInserts.length > 0) {
            await db.from('audit_findings').insert(batchInserts as any)
          }

          // Granular progress: 30% → 65% spread across batches (inline to avoid extra step cold-starts)
          const batchProgress = Math.round(30 + ((batchIdx + 1) / batches.length) * 35)
          await setProgress(auditId, batchProgress)

          return { findingsInBatch, newSortOrder: sortOrder }
        })

        totalFindingsCount = batchResult.newSortOrder
      }
    }

    // ──────────────────────────────────────────────────────────
    // QUALITY GATES: Dedup + speculative filter + relevance scoring
    // Combined into one step to eliminate Inngest cold-start overhead
    // ──────────────────────────────────────────────────────────
    await step.run('quality-gates', async () => {
      await logStageStarted(auditId, 'quality_gates', 'Running quality checks on findings...')
      await setProgress(auditId, stageProgress('quality_gates', 0))
      const db = getDb()

      // ══════════════════════════════════════════════════════════
      // SINGLE FETCH: Load all findings once, operate in-memory
      // (Was 6 separate DB fetches — now 1 fetch + batch writes)
      // ══════════════════════════════════════════════════════════
      const { data: allQGFindings } = await db
        .from('audit_findings')
        .select('id, title, description, recommendation, severity, page_url, sort_order, confidence_level, detection_source, finding_type, fix_type, fix_payload, target_element')
        .eq('audit_id', auditId)
        .order('sort_order', { ascending: true })

      if (!allQGFindings || allQGFindings.length === 0) {
        console.warn(`[inngest] Audit ${auditId}: zero findings — continuing`)
        await auditLog(auditId, 'findings_warning', 'warning', 'Zero findings — site may be clean or all issues resolved')
        await setProgress(auditId, 75)
        return
      }

      // Working set — mutable array we filter in-place
      type ConfidenceLevel = 'heuristic' | 'deterministic' | 'interpretive'
      type DetectionSource = 'analyzer' | 'structured_data' | 'gap_fill' | 'responsive' | 'pagespeed' | 'wcag'
      let findings = allQGFindings.map((f: any) => ({
        id: f.id as string,
        title: (f.title || '') as string,
        description: (f.description || '') as string,
        recommendation: (f.recommendation || '') as string,
        severity: (f.severity || 'medium') as string,
        page_url: (f.page_url || null) as string | null,
        sort_order: (f.sort_order ?? 0) as number,
        confidence_level: (f.confidence_level || 'heuristic') as ConfidenceLevel,
        detection_source: (f.detection_source || 'analyzer') as DetectionSource,
        finding_type: (f.finding_type || 'fixable') as string,
        fix_type: (f.fix_type || null) as string | null,
        fix_payload: f.fix_payload,
        target_element: (f.target_element || null) as string | null,
      }))

      const idsToDelete = new Set<string>()
      const batchUpdates: Array<{ id: string; updates: Record<string, any> }> = []

      // ── 1. Deduplicate findings (confidence-aware) ───
      if (findings.length >= 2) {
        const duplicateIds = identifyDuplicates(findings)
        if (duplicateIds.length > 0) {
          for (const id of duplicateIds) idsToDelete.add(id)
          await auditLog(auditId, 'findings_deduped', 'info',
            `Removed ${duplicateIds.length} duplicate finding${duplicateIds.length > 1 ? 's' : ''}`)
          console.log(`[inngest] Dedup: removed ${duplicateIds.length} duplicates from ${findings.length} findings`)
          findings = findings.filter(f => !idsToDelete.has(f.id))
        }

        // ── 1b. Group template-based issues across pages ───
        if (findings.length >= 3) {
          const templateGroups = identifyTemplateGroups(findings)
          if (templateGroups.length > 0) {
            let totalAbsorbed = 0
            for (const group of templateGroups) {
              const pageList = group.pageUrls.slice(0, 5).join(', ')
              const suffix = group.pageCount > 5 ? ` and ${group.pageCount - 5} more` : ''
              const groupNote = `\n\nThis issue affects ${group.pageCount} pages: ${pageList}${suffix}.`
              const primary = findings.find(f => f.id === group.primaryId)
              if (primary) {
                primary.description += groupNote
                batchUpdates.push({ id: group.primaryId, updates: { description: primary.description } })
              }
              for (const id of group.absorbedIds) idsToDelete.add(id)
              totalAbsorbed += group.absorbedIds.length
            }
            findings = findings.filter(f => !idsToDelete.has(f.id))
            if (totalAbsorbed > 0) {
              await auditLog(auditId, 'template_grouped', 'info',
                `Grouped ${totalAbsorbed} repeated finding${totalAbsorbed > 1 ? 's' : ''} into ${templateGroups.length} template group${templateGroups.length > 1 ? 's' : ''}`)
              console.log(`[inngest] Template grouping: absorbed ${totalAbsorbed} findings into ${templateGroups.length} groups`)
            }
          }
        }
      }

      // ── 1c. Drop findings that match previously fixed, dismissed, or verified-fixed issues ───
      // Deep mode relies on AI prompt instructions to avoid re-reporting fixed/dismissed
      // findings, but the AI doesn't always comply. This programmatic filter catches
      // any that slip through by comparing new finding titles against:
      //   1. Previous findings marked as fixed (status === 'fixed') or dismissed
      //   2. Previous findings verified as fixed on the live site (deepVerifiedFixedTitles)
      if (
        effectiveDepthMode === 'deep' &&
        siteContext.previousRawFindings.length > 0 &&
        findings.length > 0
      ) {
        const fixedOrDismissed = siteContext.previousRawFindings.filter(
          (f: any) => f.status === 'fixed' || f.dismissed
        )
        // Also include titles verified as fixed on the live site (silently fixed, status still "open")
        const allFixedTitles = [
          ...fixedOrDismissed.map((f: any) => f.title),
          ...deepVerifiedFixedTitles,
        ]
        if (allFixedTitles.length > 0) {
          // Build a set of normalized previous titles for fast lookup
          const normalize = (s: string) =>
            s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
          const prevTitles = allFixedTitles.map((t: string) => normalize(t))

          const matchesFixed = (title: string): boolean => {
            const norm = normalize(title)
            for (const prev of prevTitles) {
              // Exact match
              if (norm === prev) return true
              // One title contains the other (catches rephrased variants)
              if (norm.length > 10 && prev.length > 10) {
                if (norm.includes(prev) || prev.includes(norm)) return true
              }
              // High word overlap (≥80% of words shared)
              const wordsA = new Set(norm.split(' ').filter(w => w.length > 2))
              const wordsB = new Set(prev.split(' ').filter((w: string) => w.length > 2))
              if (wordsA.size >= 3 && wordsB.size >= 3) {
                const overlap = [...wordsA].filter(w => wordsB.has(w)).length
                const smaller = Math.min(wordsA.size, wordsB.size)
                if (overlap / smaller >= 0.8) return true
              }
            }
            return false
          }

          const reReportedIds: string[] = []
          for (const f of findings) {
            if (matchesFixed(f.title)) reReportedIds.push(f.id)
          }

          if (reReportedIds.length > 0) {
            for (const id of reReportedIds) idsToDelete.add(id)
            findings = findings.filter(f => !idsToDelete.has(f.id))
            await auditLog(auditId, 'fixed_dismissed_filtered', 'info',
              `Removed ${reReportedIds.length} finding${reReportedIds.length > 1 ? 's' : ''} that match previously fixed or dismissed issues`)
            console.log(`[inngest] Fixed/dismissed filter: removed ${reReportedIds.length} re-reported findings`)
          }
        }
      }

      // ── 2. Filter speculative findings ───
      if (findings.length > 0) {
        const hasHeadTags = crawlResult.pageContent.includes('Head Tags:')
        const speculativeIds = identifySpeculativeFindings(
          findings.map(f => ({ id: f.id, title: f.title, description: f.description })),
          hasHeadTags,
        )
        if (speculativeIds.length > 0) {
          for (const id of speculativeIds) idsToDelete.add(id)
          const totalBefore = findings.length
          findings = findings.filter(f => !idsToDelete.has(f.id))
          await auditLog(auditId, 'speculative_filtered', 'info',
            `Removed ${speculativeIds.length} speculative/unverifiable finding${speculativeIds.length > 1 ? 's' : ''}`)
          console.log(`[inngest] Speculative filter: removed ${speculativeIds.length} findings`)
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

      // ── 3. Soften interpretive language (in-memory) ───
      if (findings.length > 0) {
        const languageFixes = softenInterpretiveLanguage(findings)
        if (languageFixes.length > 0) {
          const fixesByFinding = new Map<string, Record<string, string>>()
          for (const fix of languageFixes) {
            if (!fixesByFinding.has(fix.id)) fixesByFinding.set(fix.id, {})
            fixesByFinding.get(fix.id)![fix.field] = fix.fixed
          }
          for (const [findingId, updates] of fixesByFinding) {
            // Apply to in-memory finding too
            const f = findings.find(ff => ff.id === findingId)
            if (f) {
              if (updates.title) f.title = updates.title
              if (updates.description) f.description = updates.description
              if (updates.recommendation) f.recommendation = updates.recommendation
            }
            batchUpdates.push({ id: findingId, updates })
          }
          console.log(`[inngest] Language softener: updated ${fixesByFinding.size} interpretive finding${fixesByFinding.size > 1 ? 's' : ''}`)
        }

        // ── 4. Stale-result check for gap_fill findings ───
        const staleResults = identifyStaleFindings(findings, crawlResult.pageContent)
        if (staleResults.length > 0) {
          for (const stale of staleResults) idsToDelete.add(stale.id)
          findings = findings.filter(f => !idsToDelete.has(f.id))
          await auditLog(auditId, 'stale_findings_removed', 'info',
            `Removed ${staleResults.length} stale finding${staleResults.length > 1 ? 's' : ''} that reference content no longer present`)
          console.log(`[inngest] Stale check: removed ${staleResults.length} stale gap_fill findings`)
        }
      }

      // ── 5. Enrich proposed_value and affected_selector (in-memory) ───
      if (findings.length > 0) {
        let enriched = 0
        for (const f of findings) {
          const updates: Record<string, any> = {}
          if (f.finding_type === 'fixable' && f.recommendation) {
            const rec = f.recommendation.trim()
            const looksLikeCode = /<[a-z]|{"|@type|"@context|<meta|<title|<link|<script/i.test(rec)
            if (looksLikeCode || rec.length <= 500) {
              updates.proposed_value = rec
            }
          }
          if (f.target_element) {
            const te = f.target_element.trim()
            const looksLikeSelector = /^[.#\[]|^[a-z]+(\.|#|\[|>|\s+[a-z])|^<[a-z]/i.test(te)
            if (looksLikeSelector && te.length <= 200) {
              updates.affected_selector = te
            }
          }
          if (Object.keys(updates).length > 0) {
            batchUpdates.push({ id: f.id, updates })
            enriched++
          }
        }
        if (enriched > 0) {
          console.log(`[inngest] Evidence enrichment: populated proposed_value/affected_selector on ${enriched} finding${enriched > 1 ? 's' : ''}`)
        }
      }

      // ── 6. Score findings by historical relevance ───
      try {
        if (findings.length > 0) {
          const { scored, removedIds } = await scoreFindings(
            findings.map(f => ({
              id: f.id, title: f.title, description: f.description,
              severity: f.severity, confidence_level: f.confidence_level,
            })),
            db,
          )
          if (removedIds.length > 0) {
            for (const id of removedIds) idsToDelete.add(id)
            findings = findings.filter(f => !idsToDelete.has(f.id))
            await auditLog(auditId, 'relevance_filtered', 'info',
              `Removed ${removedIds.length} low-relevance finding${removedIds.length > 1 ? 's' : ''} (historically dismissed >85% of the time)`)
            console.log(`[inngest] Relevance scorer: removed ${removedIds.length} findings`)
          }
          const lowCount = scored.filter(s => s.flag === 'low').length
          const medCount = scored.filter(s => s.flag === 'medium').length
          const noData = scored.filter(s => s.flag === 'no_data').length
          if (lowCount > 0 || medCount > 0) {
            console.log(`[inngest] Relevance: ${lowCount} low, ${medCount} medium, ${noData} no_data out of ${scored.length}`)
          }
        }
      } catch (err) {
        console.error('[inngest] Relevance scorer error (non-fatal):', err)
        await auditLog(auditId, 'relevance_error', 'warning',
          `Relevance scoring failed: ${err instanceof Error ? err.message : String(err)}`)
      }

      // ══════════════════════════════════════════════════════════
      // BATCH WRITE: Apply all accumulated deletes + updates in bulk
      // ══════════════════════════════════════════════════════════
      const deleteIds = [...idsToDelete]
      if (deleteIds.length > 0) {
        await db.from('audit_findings').delete().in('id', deleteIds)
      }

      // Batch updates — group by finding ID to merge overlapping updates
      const mergedUpdates = new Map<string, Record<string, any>>()
      for (const { id, updates } of batchUpdates) {
        if (idsToDelete.has(id)) continue // skip updates for deleted findings
        const existing = mergedUpdates.get(id) || {}
        mergedUpdates.set(id, { ...existing, ...updates })
      }
      // Execute updates in parallel (Supabase handles individual rows)
      const updatePromises = [...mergedUpdates.entries()].map(([id, updates]) =>
        db.from('audit_findings').update(updates as any).eq('id', id)
      )
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises)
      }

      // ── 7. Verify findings count ───
      if (findings.length === 0) {
        console.warn(`[inngest] Audit ${auditId}: zero findings — continuing`)
        await auditLog(auditId, 'findings_warning', 'warning', 'Zero findings — site may be clean or all issues resolved')
      } else {
        await auditLog(auditId, 'findings_verified', 'success', `${findings.length} findings verified`)
      }
      await setProgress(auditId, stageProgress('quality_gates', 1))
      await logStageCompleted(auditId, 'quality_gates', 'Quality gates passed')
    })

    // ──────────────────────────────────────────────────────────
    // STEP 7b: Re-audit reconciliation
    // ──────────────────────────────────────────────────────────
    let reconciliationData: ReconciliationResult | null = null
    if (siteContext.previousRawFindings.length > 0) {
      reconciliationData = await step.run('reconcile-findings', async () => {
        await logStageStarted(auditId, 'reconciliation', 'Deduplicating and reconciling findings...')
        const db = getDb()

        // Fetch current findings from DB
        const { data: currentFindings } = await db
          .from('audit_findings')
          .select('*')
          .eq('audit_id', auditId)
          .order('sort_order', { ascending: true })

        const current = (currentFindings || []) as AuditFinding[]

        // Build crawled URLs set from crawl result
        const crawledUrls = new Set<string>()
        if (crawlResult.firstPageUrl) crawledUrls.add(crawlResult.firstPageUrl)
        if (crawlResult.pageUrls) {
          for (const u of crawlResult.pageUrls) crawledUrls.add(u)
        }

        // Cast previous raw findings to AuditFinding shape for reconciliation
        const previousAsFindings = siteContext.previousRawFindings.map((f: any) => ({
          ...f,
          audit_id: '',
          evidence: null,
          screenshot_url: null,
        })) as unknown as AuditFinding[]

        const result = reconcileFindings(current, previousAsFindings, crawledUrls)

        // Apply reconciliation to DB:
        // 1. Mark verified_fixed findings on current audit with verification_status
        // 2. Mark regressed findings
        const updates: Array<Promise<any>> = []

        // Mark regressed findings
        for (const id of result.regressedFindingIds) {
          updates.push(
            Promise.resolve(
              db.from('audit_findings')
                .update({ verification_status: 'regressed', verification_note: 'Previously fixed but issue reappeared in this audit' } as any)
                .eq('id', id)
            )
          )
        }

        // For findings verified as likely_fixed by AI verification, transition them to fixed
        if (verificationData?.results) {
          for (const vr of verificationData.results) {
            if (vr.status === 'likely_fixed') {
              updates.push(
                Promise.resolve(
                  db.from('audit_findings')
                    .update({
                      status: 'fixed',
                      verification_status: 'verified_fixed',
                      verification_note: vr.note,
                      status_updated_at: new Date().toISOString(),
                    } as any)
                    .eq('id', vr.findingId)
                )
              )
            }
          }
        }

        if (updates.length > 0) {
          await Promise.all(updates)
        }

        await logStageCompleted(auditId, 'reconciliation', 'Findings reconciled', result.summary as any)
        await auditLog(auditId, 'reconciliation_completed', 'success',
          `Reconciliation: ${result.summary.verifiedFixed} fixed, ${result.summary.stillOpen} open, ${result.summary.newFindings} new, ${result.summary.regressed} regressed`, {
            ...result.summary,
          })

        return result
      })
    }

    // ──────────────────────────────────────────────────────────
    // STEP 7c: Canonical Issue Reconciliation
    // Creates/updates issue families, writes lifecycle events,
    // computes and persists score snapshots via the canonical
    // issue system. Runs for ALL audits (first + re-audit).
    // Non-fatal — if it fails, the audit continues with legacy
    // scoring from the report generation step.
    // ──────────────────────────────────────────────────────────
    let canonicalScoring: {
      overallScore: number
      categoryScores: Record<string, number>
      summary: {
        matched_count: number
        new_count: number
        fixed_count: number
        regressed_count: number
        still_present_count: number
        improved_count: number
        score_delta: number | null
      }
    } | null = null

    canonicalScoring = await step.run('canonical-reconciliation', async () => {
      try {
        const db = getDb()

        // Fetch workspace_id from audit
        const { data: auditRow } = await db
          .from('audits')
          .select('workspace_id')
          .eq('id', auditId)
          .single()

        const workspaceId = (auditRow as any)?.workspace_id
        if (!workspaceId) {
          console.warn(`[inngest] No workspace_id on audit ${auditId} — skipping canonical reconciliation`)
          await auditLog(auditId, 'canonical_recon_skipped', 'warning',
            'No workspace_id — canonical issue tracking requires workspace-based audits')
          return null
        }

        // Fetch current findings (post quality gates)
        const { data: currentFindings } = await db
          .from('audit_findings')
          .select('*')
          .eq('audit_id', auditId)
          .order('sort_order', { ascending: true })

        const findings = (currentFindings || []) as AuditFinding[]
        if (findings.length === 0) {
          await auditLog(auditId, 'canonical_recon_skipped', 'info',
            'No findings — skipping canonical reconciliation')
          return null
        }

        // Dynamic import to avoid circular deps and reduce cold start size
        const { runFullReconciliation } = await import(
          '@/lib/audit-engine/pipeline/reconciliation-persist'
        )

        // Build crawled URL set
        const crawledUrlSet = new Set<string>()
        if (crawlResult.firstPageUrl) crawledUrlSet.add(crawlResult.firstPageUrl)
        for (const u of (crawlResult.crawledUrls || [])) crawledUrlSet.add(u)

        const ctx = {
          currentAuditId: auditId,
          workspaceId,
          previousAuditId: siteContext.previousAuditId,
          siteUrl: auditDetails.productUrl,
          isDeepAudit: effectiveDepthMode === 'deep',
          crawledUrls: crawledUrlSet,
        }

        const reconciliationResult = await withTimeout(
          runFullReconciliation(findings, ctx),
          60_000,
          'canonical-reconciliation',
        )
        if (!reconciliationResult) {
          await auditLog(auditId, 'canonical_recon_timeout', 'warning',
            'Canonical reconciliation timed out after 60s — skipping')
          return null
        }
        const { result, scoring } = reconciliationResult

        await auditLog(auditId, 'canonical_reconciliation_completed', 'success',
          `Canonical: ${result.summary.matched_count} matched, ${result.summary.new_count} new, ` +
          `${result.summary.fixed_count} fixed. Score: ${scoring.overallScore}/100`, {
            matched_count: result.summary.matched_count,
            new_count: result.summary.new_count,
            fixed_count: result.summary.fixed_count,
            regressed_count: result.summary.regressed_count,
            improved_count: result.summary.improved_count,
            canonical_score: scoring.overallScore,
          })

        return {
          overallScore: scoring.overallScore,
          categoryScores: scoring.categoryScores,
          summary: {
            matched_count: result.summary.matched_count,
            new_count: result.summary.new_count,
            fixed_count: result.summary.fixed_count,
            regressed_count: result.summary.regressed_count,
            still_present_count: result.summary.still_present_count,
            improved_count: result.summary.improved_count,
            score_delta: result.summary.score_delta,
          },
        }
      } catch (err) {
        console.error('[inngest] Canonical reconciliation failed (non-fatal):', err)
        await auditLog(auditId, 'canonical_recon_error', 'warning',
          `Canonical reconciliation failed: ${err instanceof Error ? err.message : String(err)}. Audit continues with legacy scoring.`)
        return null
      }
    })

    // ──────────────────────────────────────────────────────────
    // STEP 8: Generate report (screenshots moved to enrichment)
    // ──────────────────────────────────────────────────────────
    await step.run('generate-report', async () => {
      await logStageStarted(auditId, 'reporting', 'Generating report...')
      await logActivity(auditId, 'Writing executive summary and calculating scores...')
      await setStatus(auditId, 'generating_report', stageProgress('reporting', 0))
      await setProgress(auditId, stageProgress('reporting', 0), 'reporting')

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
      // Include both user-confirmed fixes AND AI-verified likely fixes
      const userConfirmedFixed = siteContext.previousRawFindings.filter((f: any) => f.status === 'fixed').length
      const aiVerifiedFixed = (verificationData?.likelyFixed || 0)
      const droppedFixed = userConfirmedFixed + aiVerifiedFixed
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
        siteProfile,
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

      // Generate PDF (with 30s timeout — PDF is non-fatal, report still available in dashboard)
      let pdfUrl: string | null = null
      try {
        pdfUrl = await withTimeout(
          generatePdfReport(auditId, audit as any, reportData, findings, []),
          30_000,
          'pdf-generation',
        ) || null
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
        reconciliationSummary: reconciliationData?.summary || null,
        canonicalScoring: canonicalScoring || null,
        canonicalReconciliation: canonicalScoring?.summary || null,
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

      await logStageCompleted(auditId, 'reporting', 'Report generated', {
        total_issues: findings.length,
        ...severityCount,
        has_pdf: !!pdfUrl,
      })
      await auditLog(auditId, 'report_generated', 'success', 'Report generated', {
        total_issues: findings.length,
        ...severityCount,
        has_pdf: !!pdfUrl,
      })
    })

    // ──────────────────────────────────────────────────────────
    // STEP 10: COMPLETE AUDIT — runs BEFORE enrichment
    // The audit reaches a terminal state regardless of whether
    // enrichment succeeds, stalls, or gets killed by Vercel.
    // This is the ROOT FIX for audits stalling at 90%.
    // ──────────────────────────────────────────────────────────
    await step.run('complete', async () => {
      const db = getDb()

      await setStatus(auditId, 'completed', 100)
      await setProgress(auditId, stageProgress('complete', 1), 'complete')
      await logPipelineCompleted(auditId, Date.now() - pipelineStartTime)
      await db
        .from('audits')
        .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
        .eq('id', auditId)

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

    // ──────────────────────────────────────────────────────────
    // STEP 11: BEST-EFFORT ENRICHMENT (post-completion)
    // Audit is already complete. Adds benchmarks, screenshots,
    // brand intel, etc. Failures are non-fatal — wrapped in
    // try/catch so errors never propagate to the outer handler.
    // ──────────────────────────────────────────────────────────
    try {
    await step.run('post-report-enrichment', async () => {
      await logActivity(auditId, 'Running best-effort enrichment (benchmarks, screenshots)...')

      // Master deadline for the entire enrichment step.
      // If all enrichments together exceed this, we bail and complete the audit.
      const ENRICHMENT_DEADLINE_MS = 60_000 // 60s hard limit (leaves 240s headroom in 300s Vercel timeout)
      const enrichmentBody = async () => {

      // ── 1. Snapshot industry benchmark ──
      const benchmarkFn = async () => {
        try {
          const db = getDb()
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
      }

      // ── 2. Brand Intelligence (LAZY — started in Wave 2 only) ──
      // CRITICAL: Do NOT use IIFE here. These must be lazy functions, not
      // immediately-invoked promises. If they start at t=0 with the fast
      // Wave 1 tasks, they run in the background consuming Vercel time,
      // and withTimeout can only abandon the await — not stop the work.
      const brandIntelFn = async () => {
        try {
          const db = getDb()
          const { data: probes } = await db
            .from('multi_model_probes')
            .select('model_id, model_label, accuracy_score, results_json, status')
            .eq('audit_id', auditId)

          if (!probes || probes.length === 0) return
          const measured = probes.filter((p: any) => p.status === 'measured' && p.results_json)
          if (measured.length === 0) return

          const { data: audit } = await db
            .from('audits')
            .select('product_url, brand_name')
            .eq('id', auditId)
            .single()

          const brandName = (audit as any)?.brand_name ||
            ((audit as any)?.product_url ? new URL((audit as any).product_url).hostname.replace(/^www\./, '') : 'Unknown')

          const biSummary = await runBrandIntelligenceAnalysis(
            brandName,
            measured.map((p: any) => ({
              modelId: p.model_id,
              modelLabel: p.model_label,
              accuracyScore: p.accuracy_score || 0,
              responses: (p.results_json || []).map((r: any) => ({
                question: r.question || '',
                answer: r.answer || '',
              })),
            })),
            null,
          )

          for (const model of biSummary.perModel) {
            await db.from('multi_model_probes')
              .update({
                sentiment_score: model.sentimentScore,
                sentiment_themes: model.themes,
                placement_score: model.placement,
                share_of_voice: (model as any).shareOfVoice ?? null,
              } as any)
              .eq('audit_id', auditId)
              .eq('model_id', model.modelId)
          }

          await db.from('reports')
            .update({ brand_intelligence: biSummary } as any)
            .eq('audit_id', auditId)

          await db.from('audits')
            .update({ sentiment_data: biSummary } as any)
            .eq('id', auditId)

          await auditLog(auditId, 'brand_intelligence_computed', 'info',
            `Brand Intelligence Score: ${biSummary.score}/100. AI Visibility: ${biSummary.aiVisibility}%. Sentiment: ${biSummary.overallSentiment}/100.`)
        } catch (err) {
          console.error('[inngest] Brand intelligence analysis failed (non-fatal):', err)
          await auditLog(auditId, 'brand_intelligence_failed', 'warning',
            `Brand intelligence failed: ${err instanceof Error ? err.message : 'unknown'}`)
        }
      }

      // ── 3. Human Perception (LAZY — started in Wave 2 only) ──
      const humanPerceptionFn = async () => {
        try {
          const { runHumanPerceptionPipeline } = await import('@/lib/human-perception')
          const db = getDb()

          const { data: audit } = await db
            .from('audits')
            .select('user_id, product_url, brand_name, detected_industry, sentiment_data')
            .eq('id', auditId)
            .single()

          if (!audit) return

          const brandDomain = (audit as any).product_url
            ? new URL((audit as any).product_url).hostname.replace(/^www\./, '')
            : null
          if (!brandDomain) return

          const brandName = (audit as any).brand_name || brandDomain.replace(/\.(com|io|co|org|net)$/, '')

          const summary = await runHumanPerceptionPipeline({
            auditId,
            userId: (audit as any).user_id,
            brandDomain,
            brandName,
            detectedIndustry: (audit as any).detected_industry,
            biSummary: (audit as any).sentiment_data,
          })

          await db.from('audits')
            .update({ human_perception_data: summary } as any)
            .eq('id', auditId)

          await auditLog(auditId, 'human_perception_computed', 'info',
            `Human Perception: ${summary.reviewCount} reviews, ${summary.webMentionCount} web mentions, ${summary.redditMentionCount} Reddit mentions. Sentiment: ${summary.socialSentiment}/100.`)
        } catch (err) {
          console.error('[inngest] Human perception analysis failed (non-fatal):', err)
          await auditLog(auditId, 'human_perception_failed', 'warning',
            `Human perception failed: ${err instanceof Error ? err.message : 'unknown'}`)
        }
      }

      // ── 4. Minimum findings enforcement ──
      const minimumFindingsFn = async () => {
        try {
          const db = getDb()
          const { data: report } = await db
            .from('reports')
            .select('raw_json')
            .eq('audit_id', auditId)
            .single()

          if (!report?.raw_json?.categoryScores) return

          const categoryScores = (report.raw_json as any).categoryScores as Array<{
            name: string; score: number; summary?: string
          }>

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

          const starved = identifyStarvedCategories(categoryScores, findingsPerCategory)
          if (starved.length === 0) {
            await auditLog(auditId, 'minimum_findings_ok', 'info',
              'All low-scoring categories have findings — no gap to fill')
            return
          }

          const generated = await generateFindingsForStarvedCategories(
            starved, auditDetails.productUrl, auditDetails.language,
          )

          const { data: existingFindings } = await db
            .from('audit_findings')
            .select('sort_order')
            .eq('audit_id', auditId)
            .order('sort_order', { ascending: false })
            .limit(1)

          let sortOrder = ((existingFindings?.[0] as any)?.sort_order ?? -1) + 1
          let totalInserted = 0

          // Batch insert all minimum findings at once
          const minFindingInserts: any[] = []
          for (const [categoryIndex, findings] of generated) {
            for (const finding of findings) {
              const classification = classifyFinding({
                title: finding.title, description: finding.description,
                recommendation: finding.recommendation, severity: finding.severity, categoryIndex,
              })
              const validated = validateFixableRecommendation({
                title: finding.title, description: finding.description,
                recommendation: finding.recommendation, severity: finding.severity, ...classification,
              })
              minFindingInserts.push({
                audit_id: auditId, checklist_item_id: null, category_index: categoryIndex,
                severity: finding.severity, title: finding.title, description: finding.description,
                evidence: null, page_url: finding.pageUrl || auditDetails.productUrl,
                recommendation: finding.recommendation, estimated_impact: finding.estimatedImpact || null,
                target_element: finding.targetElement || null, screenshot_url: null,
                sort_order: sortOrder++, finding_type: validated.findingType, fix_type: validated.fixType,
                confidence_level: 'interpretive', detection_source: 'analyzer',
                communication: buildCommunicationForGenericFinding({ title: finding.title, description: finding.description, recommendation: finding.recommendation, estimatedImpact: finding.estimatedImpact || null, severity: finding.severity }, siteProfile),
              })
              totalInserted++
            }
          }
          if (minFindingInserts.length > 0) {
            await db.from('audit_findings').insert(minFindingInserts as any)
          }

          if (totalInserted > 0) {
            const { data: currentReport } = await db
              .from('reports').select('total_issues').eq('audit_id', auditId).single()
            const currentTotal = (currentReport as any)?.total_issues ?? 0
            await db.from('reports')
              .update({ total_issues: currentTotal + totalInserted } as any)
              .eq('audit_id', auditId)

            auditLimitations.push({
              id: 'minimum_findings_generated',
              title: 'Additional findings generated',
              description: `${starved.length} categor${starved.length > 1 ? 'ies' : 'y'} scored below 70 but had no specific findings after quality filtering. We generated ${totalInserted} finding${totalInserted > 1 ? 's' : ''} from the category analysis to help you understand what needs improvement.`,
            })
          }

          await auditLog(auditId, 'minimum_findings_enforced', 'success',
            `Generated ${totalInserted} findings for ${starved.length} starved categories`)

          // Update limitations in report
          if (auditLimitations.length > 0) {
            const { data: currentReport } = await db
              .from('reports').select('raw_json').eq('audit_id', auditId).single()
            if (currentReport?.raw_json) {
              await db.from('reports')
                .update({ raw_json: { ...(currentReport.raw_json as any), auditLimitations } } as any)
                .eq('audit_id', auditId)
            }
          }
        } catch (err) {
          console.error('[inngest] Minimum findings enforcement error (non-fatal):', err)
          await auditLog(auditId, 'minimum_findings_error', 'warning',
            `Minimum findings enforcement failed: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      // ── 5. Pipeline learn ──
      const pipelineLearnFn = async () => {
        try {
          const db = getDb()
          const { data: finalFindings } = await db
            .from('audit_findings')
            .select('title, description, severity, sort_order')
            .eq('audit_id', auditId)
            .order('sort_order', { ascending: true })

          if (!finalFindings || finalFindings.length === 0) return

          // Record finding patterns in batches to avoid saturating DB connections
          const allFindings = finalFindings as any[]
          const BATCH_SIZE = 10
          for (let i = 0; i < allFindings.length; i += BATCH_SIZE) {
            const batch = allFindings.slice(i, i + BATCH_SIZE)
            await Promise.all(batch.map((f: any) => recordFindingShown(db, f.title, f.severity)))
          }
          await recordAuditStats(db, auditId)
          const titles = (finalFindings as any[]).map((f: any) => f.title)
          const learningResult = await postAuditLearn(db, titles)

          await auditLog(auditId, 'pipeline_learn', 'success',
            `Recorded ${finalFindings.length} finding patterns | New insights: ${learningResult.newInsights}`)
        } catch (learnErr) {
          console.error('[inngest] Pipeline learn error (non-fatal):', learnErr)
          await auditLog(auditId, 'pipeline_learn_error', 'warning',
            `Learning step failed: ${learnErr instanceof Error ? learnErr.message : String(learnErr)}`)
        }
      }

      // ── 6. Predictive recommendations ──
      const predictiveFn = async () => {
        try {
          const db = getDb()
          const { data: report } = await db
            .from('reports')
            .select('overall_score, ai_visibility_breakdown')
            .eq('audit_id', auditId)
            .single()

          if (!report) return

          const aiVis = (report as any).ai_visibility_breakdown as { overall?: number } | null
          const currentScore = aiVis?.overall || (report as any).overall_score || 50

          const predictiveReport = await generatePredictiveRecommendations(db, auditId, currentScore)

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
      }

      // ── 7. Screenshots (LAZY — started in Wave 2 only) ──
      const screenshotFn = async () => {
        try {
          const db = getDb()
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
            5,
          )

          // Batch update page screenshots in parallel
          const pageScreenshotPromises = [...pageScreenshots.entries()].map(async ([url, screenshotUrl]) => {
            const { data: pages } = await db
              .from('audit_pages')
              .select('id')
              .eq('audit_id', auditId)
              .eq('url', url)
              .limit(1)
            if (pages && pages.length > 0) {
              await db.from('audit_pages')
                .update({ screenshot_url: screenshotUrl } as any)
                .eq('id', (pages[0] as any).id)
            }
          })
          await Promise.all(pageScreenshotPromises)

          // Batch update finding screenshots in parallel
          const findingScreenshotPromises = [...findingScreenshots.entries()].map(([findingId, screenshotUrl]) =>
            db.from('audit_findings')
              .update({ screenshot_url: screenshotUrl } as any)
              .eq('id', findingId)
          )
          await Promise.all(findingScreenshotPromises)
          const uploadedCount = findingScreenshots.size

          await auditLog(auditId, 'screenshots_completed', 'success',
            `Captured ${pageScreenshots.size} page + ${uploadedCount} finding screenshots`)
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          console.error('[inngest] Screenshot capture error (non-fatal):', errMsg)
          await auditLog(auditId, 'screenshots_error', 'warning', `Screenshot capture failed: ${errMsg.slice(0, 300)}`)
        }
      }

      // Run enrichment in two waves so progress updates mid-step.
      // Wave 1 (fast, data-only): benchmark, minimum findings, pipeline learn, predictive recs
      // Wave 2 (slower, external calls): brand intel, human perception, screenshots
      const FAST_TIMEOUT  = 20_000  // 20s for fast tasks
      const SLOW_TIMEOUT  = 25_000  // 25s for external API tasks
      const SCREENSHOT_TIMEOUT = 25_000 // 25s — must be > individual captureScreenshot timeout (20s internal)

      // Wave 1 — fast enrichments (use allSettled so one failure doesn't block the rest)
      await Promise.allSettled([
        withTimeout(benchmarkFn(), FAST_TIMEOUT, 'benchmark'),
        withTimeout(minimumFindingsFn(), FAST_TIMEOUT, 'minimum-findings'),
        withTimeout(pipelineLearnFn(), FAST_TIMEOUT, 'pipeline-learn'),
        withTimeout(predictiveFn(), FAST_TIMEOUT, 'predictive-recs'),
      ])
      await logActivity(auditId, 'Running brand intelligence and capturing screenshots...')

      // Wave 2 — external API calls (brand intel, human perception, screenshots)
      // CRITICAL: Functions are called here (not at t=0) so their full runtime
      // falls within the withTimeout window. Previously they were IIFEs that
      // started immediately, ran through Wave 1, and the timeouts couldn't
      // actually stop the already-running work.
      await Promise.allSettled([
        withTimeout(brandIntelFn(), SLOW_TIMEOUT, 'brand-intelligence'),
        withTimeout(humanPerceptionFn(), SLOW_TIMEOUT, 'human-perception'),
        withTimeout(screenshotFn(), SCREENSHOT_TIMEOUT, 'screenshots'),
      ])
      await auditLog(auditId, 'enrichment_completed', 'success', 'Post-completion enrichment finished')

      } // end enrichmentBody

      // Run under master deadline — if enrichment takes too long, skip it entirely
      await withTimeout(enrichmentBody(), ENRICHMENT_DEADLINE_MS, 'enrichment-all')
    })
    } catch (enrichErr) {
      // Enrichment is best-effort — audit is already marked complete above.
      // Swallow ALL errors so they never reach the outer catch (which would refund credits).
      console.warn(`[inngest] Enrichment step failed (non-fatal, audit already complete):`, enrichErr)
    }

    return { success: true, auditId }

    } catch (err) {
      // Top-level failure handler: refund credit and mark audit as failed.
      // But skip if the audit was already completed (error came from enrichment).
      console.error(`[inngest] Audit ${auditId} FAILED:`, err)
      try {
        const db = getDb()
        const { data: auditCheck } = await db
          .from('audits')
          .select('status')
          .eq('id', auditId)
          .single()
        const currentStatus = (auditCheck as any)?.status as string
        if (currentStatus === 'completed' || currentStatus === 'completed_with_warnings') {
          // Audit already completed — this error is from post-completion enrichment, non-fatal
          console.warn(`[inngest] Audit ${auditId} already ${currentStatus} — ignoring post-completion error`)
        } else {
          await refundCredit(auditId)
          const errorMsg = err instanceof Error ? err.message : String(err)
          await db
            .from('audits')
            .update({
              status: 'failed',
              crawl_error: errorMsg.length > 500 ? errorMsg.slice(0, 500) : errorMsg,
              updated_at: new Date().toISOString(),
            } as any)
            .eq('id', auditId)
          await logPipelineFailed(auditId, errorMsg.slice(0, 300))
          await auditLog(auditId, 'audit_failed', 'error', `Audit failed: ${errorMsg.slice(0, 200)}. Credit refunded.`)
        }
      } catch (failErr) {
        console.error(`[inngest] Failed to handle audit failure for ${auditId}:`, failErr)
      }
      throw err // Re-throw so Inngest marks the run as failed
    } finally {
      // ── GUARANTEED COMPLETION SAFETY NET ──
      // If the audit is still in a non-terminal state after the pipeline
      // finishes (success or failure), force it to a terminal state.
      // This prevents audits from being stuck at 90-94% forever.
      try {
        const db = getDb()
        const { data: finalCheck } = await db
          .from('audits')
          .select('status, progress_percent')
          .eq('id', auditId)
          .single()

        if (finalCheck) {
          const status = (finalCheck as any).status as string
          const progress = (finalCheck as any).progress_percent as number
          const terminalStatuses = ['completed', 'failed', 'completed_with_warnings', 'stalled']

          if (!terminalStatuses.includes(status)) {
            // Audit is stuck in a non-terminal state — force complete
            // If we got past the report step (progress >= 82%), mark as completed_with_warnings
            // Otherwise mark as failed
            const hasReport = progress >= 82
            const forcedStatus = hasReport ? 'completed_with_warnings' : 'failed'
            const forcedProgress = hasReport ? 100 : progress

            console.warn(`[inngest] Safety net: audit ${auditId} stuck at status=${status} progress=${progress}%. Forcing to ${forcedStatus}.`)

            await db.from('audits').update({
              status: forcedStatus,
              progress_percent: forcedProgress,
              audit_stage: hasReport ? 'complete' : undefined,
              completed_at: hasReport ? new Date().toISOString() : undefined,
              updated_at: new Date().toISOString(),
            } as any).eq('id', auditId)

            if (hasReport) {
              await logPipelineCompleted(auditId, Date.now() - pipelineStartTime)
              await logActivity(auditId, 'Audit completed with some enrichment steps skipped.')
            } else {
              await logPipelineFailed(auditId, `Pipeline exited with non-terminal status: ${status}`)
            }
          }
        }
      } catch (safetyErr) {
        console.error(`[inngest] Safety net error for ${auditId}:`, safetyErr)
      }
    }
  },
)
