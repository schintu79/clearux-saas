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
import * as Sentry from '@sentry/nextjs'
import { filterRowsToContract } from '@/lib/db/insert-contracts'
import { keywordModuleIndexFor, correctedCategoryIndexFor } from '@/lib/scoring/module-map'
import { compareBrandConsistency, type BrandConsistencyResult, type VoiceContradiction } from '@/lib/scoring/brand-consistency'
import { applyScoringSeverityCap, capSummarySentence } from '@/lib/scoring/severity-cap'
import { createServiceSupabase } from '@/lib/supabase-server'
import { crawlPages, formatHeadTagsForAnalysis, type HeadTagData } from '@/lib/audit-engine/crawler'
import { prioritizePagesForChecks } from '@/lib/audit-engine/page-relevance'
import { composeFindings } from '@/lib/audit-engine/compose/compose'
import { pageContentChanged, type PageContentFacts } from '@/lib/audit-engine/content-change'
import { buildPageCaptureRows, writePageCaptures, CAPTURE_SCHEMA_VERSION } from '@/lib/audit-engine/capture/page-capture'
import { captureInputParity, captureToPageContent } from '@/lib/audit-engine/capture/capture-bucket'
import { detectReauditResolvedFixes } from '@/lib/audit-engine/fix-verification/reaudit-fix-detection'
import { insertChecked } from '@/lib/db/checked-write'
import { generateVerdict } from '@/lib/audit-engine/verdict'
import { runCrawlPreflight } from '@/lib/audit-engine/crawl-preflight'
import { probeAIDiscovery, formatAIDiscoveryForAnalysis } from '@/lib/audit-engine/ai-discovery-probe'
import { validateStructuredData, formatValidationForAnalysis } from '@/lib/audit-engine/structured-data-validator'
import { analyzeCategory, generateReport, verifyFindings, UX_CATEGORIES, detectSiteProfile, calculateScoresFromFindings, contradictsContent } from '@/lib/audit-engine/analyzer'
import type { SiteProfile } from '@/lib/audit-engine/analyzer'
import { generatePdfReport } from '@/lib/audit-engine/pdf'
import { sendAuditComplete, sendFreeAuditReady, sendRegressionAlertEmail } from '@/lib/audit-engine/email'
import { captureAuditScreenshots } from '@/lib/audit-engine/screenshots'
import {
  identifyDuplicates,
  identifyTemplateGroups,
  identifySpeculativeFindings,
  classifySpeculativeFindings,
  checkContradictions,
  applyFixHistoryGate,
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
  classifyStructuralOwnership,
  enforceSeverityEvidenceInvariant,
  verifyFindingsAgainstDomByUrl,
  formatDomFactsForPrompt,
  identifyUngroundedFindings,
  UNGROUNDED_CONFIDENCE,
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
import { getOrRefreshShortlist } from '@/lib/ai/shortlist-generator'
import { detectIndustry, getUserBenchmarkPosition } from '@/lib/audit-engine/industry-benchmark'
import { generatePredictiveRecommendations } from '@/lib/audit-engine/predictive-recommendations'
import { runBrandIntelligenceAnalysis } from '@/lib/audit-engine/brand-intelligence'
import { runFullSpeedTest, generateSpeedFindings } from '@/lib/pagespeed'
import { checkWcagAutomated, buildWcagResults, parseHeuristicResponse, formatWcagForPrompt, type WcagCheckResult, type WcagAuditResult } from '@/lib/audit-engine/pipeline/wcag-checker'
import { principleImpact } from '@/lib/audit-engine/pipeline/axe-knowledge'
import type { DomFacts } from '@/lib/audit-engine/pipeline/dom-verification'
import { validateFindingsInPageContext, type ValidatorModelCaller } from '@/lib/audit-engine/pipeline/finding-context-validator'
import { persistRegressionAlerts } from '@/lib/alerts/persist-regression-alerts'
import type { AuditFinding } from '@/types/database'
import { resolveCapability, inferDeployableType } from '@/lib/fix-action-model'
import { reconcileFindings, type ReconciliationResult } from '@/lib/audit-engine/pipeline/reconciliation'
import { PIPELINE_VERSION, stageProgress, getStage } from '@/lib/audit-engine/pipeline-spec'
import { refundCredit } from '@/lib/audit-engine/refund-credit'
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

/**
 * Brand Consistency §10 — detect voice/tone contradictions in live copy.
 * Quote-grounded ONLY: the model must return verbatim quotes, and we KEEP a
 * contradiction only if its quote literally appears in the crawled copy
 * (anti-fabrication guard — a hallucinated quote can never surface).
 * Fully non-fatal: any failure returns []. The deterministic colour check
 * does not depend on this.
 */
async function detectVoiceContradictions(
  declared: { voice: string | null; toneKeywords: string[] },
  pageContent: string,
): Promise<VoiceContradiction[]> {
  try {
    const declaredDesc = [declared.voice, (declared.toneKeywords || []).join(', ')].filter(Boolean).join(' | ').trim()
    const sample = (pageContent || '').slice(0, 6000)
    if (!declaredDesc || sample.length < 100) return []
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const anthropic = new Anthropic({ timeout: 20_000 })
    const prompt = `A brand's declared voice/tone is: "${declaredDesc}".\n\nBelow is copy from the live website. Identify up to 3 passages whose tone CLEARLY contradicts that declared voice (e.g. flippant or casual where the brand is authoritative). For each, return the EXACT verbatim quote copied character-for-character from the text — never paraphrase. If nothing clearly contradicts, return an empty array.\n\nReturn ONLY JSON: {"contradictions":[{"quote":"..."}]}\n\nWEBSITE COPY:\n${sample}`
    const msg = await Promise.race([
      anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 700, messages: [{ role: 'user', content: prompt }] }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('voice check timed out')), 22_000)),
    ])
    const text = (msg as any).content?.find((b: any) => b.type === 'text')?.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return []
    const parsed = JSON.parse(jsonMatch[0])
    const out: VoiceContradiction[] = []
    for (const c of (parsed?.contradictions || [])) {
      const quote = String(c?.quote || '').trim()
      // TRUST GUARD: only surface a quote that is genuinely on the site.
      if (quote.length >= 8 && pageContent.includes(quote)) {
        out.push({ quote, conflictsWith: `brand voice (${declaredDesc})`, severity: 'medium' })
      }
    }
    return out.slice(0, 3)
  } catch (e) {
    console.warn('[brand-consistency] voice check failed (non-fatal):', (e as Error)?.message)
    return []
  }
}

async function setStatus(auditId: string, status: string, progressPercent?: number) {
  const db = getDb()
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (typeof progressPercent === 'number') update.progress_percent = progressPercent
  // 10s timeout — prevent Supabase connection pool stalls from hanging the pipeline
  const result = await Promise.race([
    db.from('audits').update(update as any).eq('id', auditId),
    new Promise<{ error: { message: string } }>((resolve) =>
      setTimeout(() => resolve({ error: { message: 'setStatus timed out after 10s' } }), 10_000)
    ),
  ])
  if (result.error) throw new Error(`Failed to update status: ${result.error.message}`)
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
  // 10s timeout — prevent Supabase connection pool stalls from hanging the pipeline
  const result = await Promise.race([
    db.from('audits').update(update as any).eq('id', auditId),
    new Promise<{ error: { message: string } }>((resolve) =>
      setTimeout(() => resolve({ error: { message: 'setProgress timed out after 10s' } }), 10_000)
    ),
  ])
  if (result.error) console.error(`[inngest] progress update error:`, result.error.message)
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
    // 10s timeout — audit logging is non-critical, must never block the pipeline.
    // But the PostgREST error must be visible (supabase-js never throws).
    await Promise.race([
      db.from('audit_logs').insert({
        audit_id: auditId,
        event,
        status,
        message: message || null,
        metadata: metadata || {},
      } as any).then(({ error }: { error: { message: string } | null }) => {
        if (error) console.error(`[inngest] audit_logs insert failed (${event}): ${error.message}`)
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
    ])
  } catch (err) {
    console.error('[inngest] log error:', err)
  }
}

/* ── Refund credit — imported from shared module ── */
// refundCredit() is imported from '@/lib/audit-engine/refund-credit'
// Used by: onFailure handler, outer catch, finally safety net

/**
 * Insert findings and CHECK THE ERROR. supabase-js never throws on insert
 * failure — it returns { error }. Ignoring it caused the June 7-10 incident:
 * a missing `viewport` column rejected every batch insert silently and all
 * website audits shipped with zero findings and jitter-fabricated scores.
 * Every audit_findings insert MUST go through this helper.
 * Returns the number of rows inserted (0 on failure).
 */
/** Strip characters Postgres TEXT rejects (null bytes kill entire batch inserts). */
function pgSafeText<T extends string | null | undefined>(s: T): T {
  if (!s) return s
  return s.replace(/\u0000/g, '') as T
}

/**
 * Insert crawled pages and CHECK THE ERROR (same disease as the findings
 * insert: supabase-js never throws, and an unchecked batch insert that
 * fails — e.g. a null byte in Jina-rendered content_text — silently
 * leaves the Pages tab empty for that site forever).
 */
async function insertPagesChecked(
  db: ReturnType<typeof getDb>,
  auditId: string,
  rows: any[],
  label: string,
): Promise<number> {
  if (!rows || rows.length === 0) return 0
  // Sanitize text fields — one bad character must not cost all pages
  const sanitized = rows.map((r) => ({
    ...r,
    url: pgSafeText(r.url),
    title: pgSafeText(r.title),
    h1: pgSafeText(r.h1),
    meta_description: pgSafeText(r.meta_description),
    content_text: pgSafeText(r.content_text),
  }))
  // Contract net (Plan §0.3): a payload key outside the insert contract
  // must cost ONE field, never the whole batch (the viewport disease).
  const { rows: safe, unknownKeys } = filterRowsToContract('audit_pages', sanitized)
  if (unknownKeys.length > 0) {
    console.error(`[inngest] SCHEMA DRIFT (audit_pages, ${label}): stripped unknown key(s) ${unknownKeys.join(', ')} — add migration + snapshot + contract in one commit`)
    await auditLog(auditId, 'schema_drift_detected', 'warning',
      `audit_pages insert (${label}) carried unknown column(s): ${unknownKeys.join(', ')}. Keys stripped so the batch survives — fix the contract chain.`,
      { table: 'audit_pages', label, unknown_keys: unknownKeys })
  }
  // 2026-06-12: upsert with ignoreDuplicates — acquisition pipeline and
  // legacy crawl can both insert the same audit_id+url; the duplicate-key
  // violation was killing the whole batch (24/25 saved only via per-row
  // recovery on audit 3b69d832).
  const { error } = await db.from('audit_pages').upsert(safe as any, { onConflict: 'audit_id,url', ignoreDuplicates: true })
  if (error) {
    console.error(`[inngest] PAGES INSERT FAILED (${label}): ${error.message}`, {
      auditId, rowCount: rows.length, code: (error as any).code, details: (error as any).details,
    })
    await auditLog(auditId, 'pages_insert_failed', 'error',
      `${label}: failed to save ${rows.length} crawled page(s) — ${error.message}. The Pages tab and per-page AI readability will be empty for this audit.`,
      { label, row_count: rows.length, db_error: error.message })
    // Last resort: insert one-by-one so a single poison row doesn't cost all pages
    let saved = 0
    for (const row of safe) {
      const { error: rowErr } = await db.from('audit_pages').upsert(row as any, { onConflict: 'audit_id,url', ignoreDuplicates: true })
      if (!rowErr) saved++
    }
    if (saved > 0) {
      console.warn(`[inngest] PAGES INSERT recovered ${saved}/${rows.length} rows individually (${label})`)
    }
    return saved
  }
  return rows.length
}

async function insertFindingsChecked(
  db: ReturnType<typeof getDb>,
  auditId: string,
  rows: any[],
  label: string,
): Promise<number> {
  if (!rows || rows.length === 0) return 0
  // Contract net (Plan §0.3): the viewport incident cost 3 days of
  // fabricated scores because ONE unknown key killed every batch.
  // Unknown keys are stripped and reported; the findings still land.
  const { rows: safeRows, unknownKeys } = filterRowsToContract('audit_findings', rows)
  if (unknownKeys.length > 0) {
    console.error(`[inngest] SCHEMA DRIFT (audit_findings, ${label}): stripped unknown key(s) ${unknownKeys.join(', ')} — add migration + snapshot + contract in one commit`)
    await auditLog(auditId, 'schema_drift_detected', 'warning',
      `audit_findings insert (${label}) carried unknown column(s): ${unknownKeys.join(', ')}. Keys stripped so the batch survives — fix the contract chain.`,
      { table: 'audit_findings', label, unknown_keys: unknownKeys })
  }
  const { error } = await db.from('audit_findings').insert(safeRows as any)
  if (error) {
    console.error(`[inngest] FINDINGS INSERT FAILED (${label}): ${error.message}`, {
      auditId,
      rowCount: rows.length,
      code: (error as any).code,
      details: (error as any).details,
      hint: (error as any).hint,
    })
    await auditLog(auditId, 'findings_insert_failed', 'error',
      `${label}: failed to save ${rows.length} finding(s) — ${error.message}. ` +
      `Likely schema drift: check that every column in the insert payload exists in audit_findings.`,
      { label, row_count: rows.length, db_error: error.message })
    return 0
  }
  return rows.length
}

/* ── UX Categories — sourced from analyzer.ts (single source of truth) ── */

const UX_CATEGORY_NAMES = UX_CATEGORIES.map((c) => c.name)

/* ── The Inngest function ── */

export const processAuditFn = inngest.createFunction(
  {
    id: 'process-audit',
    // retries: 1 (was 0) — added 2026-06-10 after a run was killed abruptly
    // mid report-step with 39 verified findings already in the DB. Inngest
    // memoizes completed steps, so a retry skips all finished analysis (no
    // duplicate AI cost) and only re-executes the step that died. One retry
    // turns transient infra kills into completed audits instead of refunds.
    retries: 1,
    concurrency: {
      limit: 3, // Lower concurrency to avoid API rate limits across parallel audits
    },
    onFailure: async ({ event }: { event: { data: { event: { data: { auditId: string } } } } }) => {
      // CRITICAL: This handler fires even when the serverless process is killed.
      // It runs as a SEPARATE invocation, so it isn't affected by the 300s timeout
      // that killed the main function.
      try {
        const auditId = event.data.event.data.auditId
        // Capture the REAL failure reason for diagnostics — until 2026-06-10
        // this handler only wrote a generic "pipeline timed out" message,
        // which made root-causing run failures needlessly hard.
        const failureError = (event as any)?.data?.error
        const failureReason = (failureError?.message || failureError?.name || 'unknown error') as string
        console.error(`[inngest/onFailure] Audit ${auditId} run failed with: ${failureReason}`)
        // Sentry (Plan §0.5): a dead pipeline run is the highest-severity
        // event this product has — it must page, not scroll away in logs.
        Sentry.captureMessage(`Audit pipeline run FAILED: ${failureReason.slice(0, 200)}`, {
          level: 'error',
          tags: { area: 'inngest-pipeline', handler: 'onFailure' },
          extra: { auditId, failureReason },
        })
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

        // Check if a report row actually exists in the DB — don't rely on progress %
        // (progress=82 means reporting STARTED, not that the report was written)
        const { data: reportCheck } = await db
          .from('reports')
          .select('id')
          .eq('audit_id', auditId)
          .maybeSingle()
        const hasReport = !!reportCheck
        const forcedStatus = hasReport ? 'completed_with_warnings' : 'failed'

        console.warn(`[inngest/onFailure] Audit ${auditId} stuck at status=${status} progress=${progress}%. Forcing to ${forcedStatus}.`)

        await db.from('audits').update({
          status: forcedStatus,
          progress_percent: hasReport ? 100 : progress,
          // Leave audit_stage as-is for failed audits so we can see WHERE it stalled;
          // only set to 'complete' when the audit resolved with a report.
          audit_stage: hasReport ? 'complete' : undefined,
          completed_at: new Date().toISOString(),
          crawl_error: hasReport ? undefined : `Pipeline failed during processing (${failureReason.slice(0, 200)}). Your credit has been refunded.`,
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
    // MASTER PIPELINE DEADLINE — 12 minutes absolute maximum.
    // If the pipeline exceeds this, remaining steps are skipped.
    // This catches the scenario where Vercel kills the process at 300s,
    // Inngest retries (ignoring retries:0 for infra failures), and
    // individual step timeouts never fire because the event loop is starved.
    const PIPELINE_DEADLINE_MS = 12 * 60 * 1000
    function isPastDeadline(): boolean {
      return (Date.now() - pipelineStartTime) > PIPELINE_DEADLINE_MS
    }

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
      return withStepTimeout(async () => {
      const db = getDb()

      const { data: audit, error } = await db
        .from('audits')
        .select('*, profiles(email, full_name)')
        .eq('id', auditId)
        .is('deleted_at', null)
        .single()

      if (error || !audit) throw new Error(`Audit not found or deleted: ${error?.message}`)

      // ── Workspace coherence gate ────────────────────────────
      // Abort early if the workspace has been archived/deleted since
      // the audit was queued, preventing stale processing.
      const wsId = (audit as any).workspace_id
      if (wsId) {
        const { data: ws } = await db
          .from('workspaces')
          .select('status')
          .eq('id', wsId)
          .single()
        if (!ws || ws.status !== 'active') {
          throw new Error(`Workspace ${wsId} is archived or deleted — aborting audit processing`)
        }
      }

      // If linked brand identity is soft-deleted, abort
      const biId = (audit as any).brand_identity_id
      if (biId) {
        const { data: bi } = await db
          .from('brand_identities')
          .select('id, deleted_at')
          .eq('id', biId)
          .single()
        if (bi && (bi as any).deleted_at) {
          throw new Error(`Brand identity ${biId} is deleted — aborting audit processing`)
        }
      }

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
        userId: (audit as any).user_id as string,
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
        workspaceId: ((audit as any).workspace_id as string) || null,
        createdAt: (audit as any).created_at as string,
      }
      }, 30_000, 'fetch-audit')
    })

    // ── Pipeline v1: stamp audit row and log start ──
    await step.run('pipeline-init', async () => {
      return withStepTimeout(async () => {
      const db = getDb()
      await db.from('audits').update({
        pipeline_version: PIPELINE_VERSION,
        audit_stage: 'preflight',
        progress_percent: 1,
        // Processing-start marker (2026-06-10): the stall sweeper's hard
        // ceiling measures from crawl_started_at, NOT created_at, so audits
        // that waited in the Inngest queue (concurrency limit) are never
        // killed for queue time. Stamped here — the moment work begins —
        // and overwritten with the precise crawl time by the crawl step.
        // Also covers restarts (old created_at) and brand audits (no crawl).
        crawl_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any).eq('id', auditId)
      await logPipelineStarted(auditId, PIPELINE_VERSION)
      await logActivity(auditId, `Audit pipeline ${PIPELINE_VERSION} started for ${auditDetails.productUrl}`)
      }, 15_000, 'pipeline-init')
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
        // AGE GUARD REMOVED — withStepTimeout on every step + stall sweeper
        // provides the same protection without false-killing queued/replayed audits.

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
                  null,
                ),
                45_000,
                `brand-analyze-${cat.name}`,
              )
              return { cat, findings: findings || [], timedOut: !findings || findings.length === 0 }
            } catch (catErr) {
              console.error(`[inngest] Brand category "${cat.name}" timed out/failed:`, (catErr as Error)?.message)
              return { cat, findings: [], timedOut: true }
            }
          }),
        )

        // Detect silent brand analysis failures
        const brandEmptyCount = analysisResults.filter(r => r.timedOut).length
        if (brandEmptyCount > 0) {
          console.warn(`[inngest] Brand audit ${auditId}: ${brandEmptyCount}/${analysisResults.length} brand categories returned 0 findings`)
          if (brandEmptyCount === analysisResults.length) {
            auditLimitations.push({
              id: 'brand_analysis_all_failed',
              title: 'Brand analysis produced no findings',
              description: 'All brand audit categories returned zero findings, likely due to analysis timeouts. Brand scores are not reliable. We recommend re-running the audit.',
            })
          } else if (brandEmptyCount >= 2) {
            auditLimitations.push({
              id: 'brand_analysis_partial_failure',
              title: 'Some brand categories could not be analyzed',
              description: `${brandEmptyCount} of ${analysisResults.length} brand categories did not return findings. A re-audit may provide more complete brand analysis.`,
            })
          }
        }

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
          await insertFindingsChecked(db, auditId, batchInserts, 'brand-analysis')
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
      // Hard 180s timeout — prevents the step from consuming the
      // full 300s Vercel budget and leaving no time for recovery.
      await step.run('brand-fast-report', async () => {
        await withStepTimeout(async () => {

        // AGE GUARD REMOVED — withStepTimeout on every step + stall sweeper
        // provides the same protection without false-killing queued/replayed audits.

        await setStatus(auditId, 'generating_report', 80)
        await setProgress(auditId, 80, 'reporting')
        const db = getDb()

        try {
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
          null, // siteProfile not available in brand-fast path (declared later in website path)
        )

        // ── Heartbeat: brand report narrative complete → 85% ──
        await setProgress(auditId, 85)

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

        // ── Heartbeat: PDF done → 87% ──
        await setProgress(auditId, 87)

        const reportJsonData = {
          ...reportData,
          _baselineCategoryScores: reportData.categoryScores,
          selectedModules: auditDetails.selectedModules,
        }

        const { error: baselineReportInsertError } = await db.from('reports').insert({
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
        if (baselineReportInsertError) {
          throw new Error(`Baseline report insert FAILED — audit must not complete without a report: ${baselineReportInsertError.message}`)
        }

        // ── Heartbeat: report row inserted → 89% ──
        await setProgress(auditId, 89)

        await auditLog(auditId, 'brand_report_generated', 'success',
          `Brand report: score ${reportData.overallScore}/100, ${findings.length} findings`)

        } catch (reportErr) {
          // Same pattern as website audit: log and re-throw so outer catch handles refund + status
          const errMsg = reportErr instanceof Error ? reportErr.message : String(reportErr)
          console.error(`[inngest] Brand report generation failed for audit ${auditId}:`, reportErr)
          await auditLog(auditId, 'brand_report_failed', 'error', `Brand report generation failed: ${errMsg.slice(0, 200)}`)
          throw reportErr
        }
        }, 180_000, 'brand-fast-report')
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
      return withStepTimeout(async () => {
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
      }, 30_000, 'crawl-preflight')
    })

    // Declared HERE (before every step that references it) and assigned by
    // the detect-site-profile step further down. See the comment at that
    // step: as a `const` declared mid-function it put four earlier steps'
    // closures in the temporal dead zone — the real cause of the
    // "Cannot access before initialization" crashes in pagespeed/wcag.
    let siteProfile: SiteProfile | null = null

    // STEP 2: Crawl pages
    // ──────────────────────────────────────────────────────────
    const crawlResult = await step.run('crawl-pages', async () => {
      return withStepTimeout(async () => {
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
          await insertPagesChecked(db, auditId, pageInserts, 'acquisition-pipeline')
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
        await insertPagesChecked(db, auditId, pageInserts, 'legacy-crawl')
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
      }, 180_000, 'crawl-pages')
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
      return withStepTimeout(async () => {
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
              const cls = classifyFinding({ title: finding.title, description: finding.description, recommendation: finding.recommendation, severity: finding.severity, categoryIndex: finding.categoryIndex ?? 11 })
              return {
                audit_id: auditId,
                checklist_item_id: null,
                category_index: finding.categoryIndex ?? 11,
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
                viewport: finding.viewport || null,
                communication: buildCommunicationForGenericFinding({ title: finding.title, description: finding.description, recommendation: finding.recommendation, estimatedImpact: finding.estimatedImpact || null, severity: finding.severity }, siteProfile),
                ...computeActionModelFields({ title: finding.title, description: finding.description, recommendation: finding.recommendation, fix_type: cls.fixType, finding_type: cls.findingType }),
              }
            })
            await insertFindingsChecked(db, auditId, responsiveInserts, 'responsive-check')
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

          // Return raw viewport data for contradiction checker
          const allViewportIssues = result.results.flatMap(r => r.viewportIssues.map((vi: any) => ({
            viewport: vi.viewport as string,
            width: vi.width as number,
            type: vi.type as string,
            title: (vi.title || '') as string,
            description: (vi.description || '') as string,
          })))
          const hasMobileViewport = result.results.some((r: any) => r.hasMobileViewport)
          return { summary: result.summary, findingsCount: result.findings.length, viewportIssues: allViewportIssues, hasMobileViewport, ran: true }
        } catch (err) {
          console.error('[inngest] Responsive check failed (non-fatal):', err)
          await auditLog(auditId, 'responsive_check_failed', 'warning',
            `Responsive check failed: ${err instanceof Error ? err.message : String(err)}. Continuing with text-based analysis.`)
          return { summary: '', findingsCount: 0, viewportIssues: [] as any[], hasMobileViewport: false, ran: false }
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
            // 2026-06-12: `category` and `position` are NOT audit_findings
            // columns — this payload silently killed EVERY pagespeed batch
            // since it shipped (PostgREST rejects the whole insert). Pinned
            // by schema-contract.test.ts. Use category_index / sort_order.
            const findingRows = speedFindings.map((f, i) => ({
              audit_id: auditId,
              category_index: 12, // Module 3 (future_readiness), cat 0 = Performance & Technical Health
              title: f.title,
              description: f.description,
              recommendation: f.recommendation,
              severity: f.severity,
              detection_source: 'pagespeed_api',
              // 2026-06-13: CWV from Google PageSpeed is instrument-measured —
              // tag it deterministic so it lands in the Verified evidence tier
              // (it was defaulting to heuristic/AI-assessed, suppressing the
              // verified mix).
              confidence_level: 'deterministic' as const,
              performance_metric_type: f.metricType || null,
              estimated_impact: f.whyItMatters,
              status: 'open' as const,
              sort_order: 900 + i,
              communication: buildCommunicationForGenericFinding({ title: f.title, description: f.description, recommendation: f.recommendation, estimatedImpact: f.whyItMatters, severity: f.severity }, siteProfile),
            }))
            await insertFindingsChecked(db, auditId, findingRows, 'pagespeed')
          }

          await auditLog(auditId, 'pagespeed_completed', 'success',
            `PageSpeed: score ${speedSummary.mobile?.score ?? '?'}(m) / ${speedSummary.desktop?.score ?? '?'}(d), ${speedFindings.length} finding(s)`)
          return speedSummary
        } catch (err) {
          console.error('[process-audit] PageSpeed test error (non-fatal):', err)
          // 2026-06-12 (D8): include the REAL error — this log line said
          // 'call failed' for weeks while hiding whether it was a key,
          // quota, timeout, or HTTP failure.
          const psReason = err instanceof Error ? err.message : String(err)
          await auditLog(auditId, 'pagespeed_error', 'warning',
            `PageSpeed API call failed — continuing without real CWV data. Reason: ${psReason.slice(0, 300)}`,
            { error: psReason.slice(0, 500), has_api_key: Boolean(process.env.PAGESPEED_API_KEY || process.env.GOOGLE_PAGESPEED_API_KEY) })
          return null
        }
      })()

      // ── WCAG 2.1 AA Compliance Check ──
      const wcagPromise = (async () => {
        try {
          const maxUrls = auditDetails.plan === 'free_preview' ? 1 : 3
          // Prioritize the budget-limited browser/WCAG/domFacts pass so genuine
          // input pages (signup, login, contact…) are ALWAYS snapshotted — not
          // just the first N by crawl order. Without this, /signup was never
          // DOM-captured, so the gates could not verify label/form findings
          // against the page they're about (2026-06-15).
          const wcagTargetUrls = prioritizePagesForChecks(crawlResult.crawledUrls, maxUrls)
          const { automatedResults, heuristicPrompts, siteColors, axeFindings, axeDiagnostic, domFactsByUrl } = await checkWcagAutomated(wcagTargetUrls, maxUrls)
          // Visibility into axe (it silently produced nothing on first runs):
          // source length, pages run, raw violations, and any run error.
          await auditLog(auditId, 'axe_debug', axeDiagnostic.error ? 'warning' : 'info',
            `axe: sourceLen=${axeDiagnostic.sourceLen} pagesRun=${axeDiagnostic.pagesRun} violations=${axeDiagnostic.violations} mapped=${axeFindings.length}${axeDiagnostic.error ? ` error=${axeDiagnostic.error}` : ''}`,
            axeDiagnostic as any)

          const heuristicResults = new Map<string, WcagCheckResult[]>()
          // LEAN PIPELINE: Skip WCAG heuristic AI calls — automated checks still run.
          // When enabled: uses Haiku instead of Sonnet (5× cheaper, same quality for checklist tasks).
          const leanFlags = getFeatureFlags()
          if (!leanFlags.leanPipeline) {
            const Anthropic = (await import('@anthropic-ai/sdk')).default
            const anthropic = new Anthropic({ timeout: 25_000 })
            const WCAG_PER_URL_TIMEOUT = 20_000
            await Promise.allSettled(Array.from(heuristicPrompts.entries()).map(async ([url, prompt]) => {
              try {
                const msg = await Promise.race([
                  anthropic.messages.create({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: 2000,
                    messages: [{ role: 'user', content: prompt }],
                  }),
                  new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error(`WCAG heuristic for ${url} timed out`)), WCAG_PER_URL_TIMEOUT),
                  ),
                ])
                const text = msg.content.find(b => b.type === 'text')?.text || ''
                if (text) heuristicResults.set(url, parseHeuristicResponse(text))
              } catch (wcagErr) {
                console.warn(`[inngest] WCAG heuristic for ${url} failed:`, (wcagErr as Error)?.message)
                // Heuristic analysis failed — automated results still valid
              }
            }))
          } else {
            console.log('[inngest] LEAN PIPELINE: Skipping WCAG heuristic AI calls (automated checks still active)')
          }

          const wcagResult = buildWcagResults(automatedResults, heuristicResults)

          // axe-core (deterministic) wins over the custom checker for any WCAG
          // criterion it already covers — drop the custom finding for that
          // criterion so the same issue isn't reported twice (Phase 1).
          const axeCriteria = new Set(
            (axeFindings || []).map((f) => f.wcagCriterion).filter((c): c is string => !!c),
          )

          if (wcagResult.totalFindings > 0 || (axeFindings && axeFindings.length > 0)) {
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
                // Dedup: axe owns this criterion, skip the custom version.
                if (finding.wcagCriterion && axeCriteria.has(finding.wcagCriterion)) continue
                const cls = classifyFinding({
                  title: finding.title,
                  description: finding.description,
                  recommendation: finding.recommendation,
                  severity: finding.severity,
                  categoryIndex: 20, // Accessibility Readiness (module 5) — matches the insert below
                })
                const wcagDesc = `[WCAG ${finding.wcagCriterion}] ${finding.description}`
                const wcagImpact = principleImpact(finding.wcagCriterion)
                wcagInserts.push({
                  audit_id: auditId,
                  checklist_item_id: null,
                  // 2026-06-12: was 8 (→ module 2, Inclusive Design). WCAG
                  // findings belong to Accessibility Readiness (module 5,
                  // categories 20-23) — the module card the user sees them
                  // scored under. floor(20/4) = 5.
                  category_index: 20,
                  finding_type: cls.findingType,
                  fix_type: cls.fixType,
                  severity: finding.severity,
                  title: finding.title,
                  description: wcagDesc,
                  evidence: finding.evidence || null,
                  page_url: finding.pageUrl || crawlResult.firstPageUrl,
                  recommendation: finding.recommendation,
                  estimated_impact: wcagImpact,
                  target_element: finding.element || null,
                  screenshot_url: null,
                  sort_order: sortOrder++,
                  confidence_level: 'deterministic',
                  detection_source: 'wcag_checker',
                  communication: buildCommunicationForGenericFinding({ title: finding.title, description: wcagDesc, recommendation: finding.recommendation, estimatedImpact: wcagImpact, severity: finding.severity }, siteProfile),
                  ...computeActionModelFields({ title: finding.title, description: wcagDesc, recommendation: finding.recommendation, fix_type: cls.fixType, finding_type: cls.findingType }),
                })
              }
            }
            if (wcagInserts.length > 0) {
              await insertFindingsChecked(db, auditId, wcagInserts, 'wcag')
            }

            // ── axe-core deterministic findings (Phase 1, item 1) ──
            if (axeFindings && axeFindings.length > 0) {
              const axeInserts = axeFindings.map((f) => {
                const cls = classifyFinding({
                  title: f.title, description: f.description,
                  recommendation: f.recommendation, severity: f.severity,
                  categoryIndex: f.categoryIndex,
                })
                return {
                  audit_id: auditId,
                  checklist_item_id: null,
                  category_index: f.categoryIndex,
                  finding_type: cls.findingType,
                  fix_type: cls.fixType,
                  severity: f.severity,
                  title: f.title,
                  description: f.description,
                  evidence: f.evidence || null,
                  page_url: f.pageUrl || crawlResult.firstPageUrl,
                  recommendation: f.recommendation,
                  estimated_impact: f.whyItMatters,
                  target_element: f.targetElement,
                  screenshot_url: null,
                  sort_order: sortOrder++,
                  confidence_level: 'deterministic',
                  detection_source: 'axe',
                  // Controlled communication so the fields are DISTINCT: real
                  // principle-based why, and a technical note that is only the
                  // Deque reference (not a repeat of the fix directive).
                  communication: {
                    title_plain: f.title.replace(/^\[WCAG [^\]]+\]\s*/, ''),
                    what_found: f.description,
                    why_matters: f.whyItMatters,
                    fix_plain: f.recommendation,
                    technical_note: f.helpUrl ? `Technical reference (Deque University): ${f.helpUrl}` : null,
                    fix_technical: null,
                  },
                  ...computeActionModelFields({ title: f.title, description: f.description, recommendation: f.recommendation, fix_type: cls.fixType, finding_type: cls.findingType }),
                }
              })
              await insertFindingsChecked(db, auditId, axeInserts, 'axe')
              await auditLog(auditId, 'axe_findings_inserted', 'success',
                `axe-core: ${axeInserts.length} deterministic accessibility finding(s) inserted`, { count: axeInserts.length })
            }
          }

          if (wcagResult.pages.length > 0) {
            const db = getDb()
            // 2026-06-12: this update wrote wcag_checklist/wcag_score for
            // months while the columns DID NOT EXIST — unchecked, so it
            // failed silently on every accessibility audit and the WCAG
            // per-page UI never had data. Columns added by migration
            // 20260612_audit_pages_wcag_code_quality; error now checked.
            const wcagUpdateErrors: string[] = []
            await Promise.all(wcagResult.pages.map(async (page) => {
              const { error } = await db
                .from('audit_pages')
                .update({
                  wcag_checklist: JSON.stringify(page.checklist),
                  wcag_score: page.score,
                } as any)
                .eq('audit_id', auditId)
                .eq('url', page.url)
              if (error) wcagUpdateErrors.push(`${page.url}: ${error.message}`)
            }))
            if (wcagUpdateErrors.length > 0) {
              console.error(`[inngest] WCAG page-score update failed for ${wcagUpdateErrors.length}/${wcagResult.pages.length} pages`, wcagUpdateErrors.slice(0, 3))
              await auditLog(auditId, 'wcag_page_update_failed', 'warning',
                `Failed to save per-page WCAG scores for ${wcagUpdateErrors.length} of ${wcagResult.pages.length} pages — ${wcagUpdateErrors[0]}`,
                { failed_count: wcagUpdateErrors.length, page_count: wcagResult.pages.length })
            }
          }

          await auditLog(auditId, 'wcag_check_completed', 'success',
            `WCAG 2.1 AA check: ${wcagResult.totalFindings} findings, score ${wcagResult.overallScore}/100, DOM facts on ${domFactsByUrl.size}/${wcagTargetUrls.slice(0, maxUrls).length} page(s)`, {
              findings_count: wcagResult.totalFindings,
              pages_checked: wcagResult.pages.length,
              overall_score: wcagResult.overallScore,
              dom_facts_pages: domFactsByUrl.size,
            })

          return {
            summary: formatWcagForPrompt(wcagResult),
            findingsCount: wcagResult.totalFindings,
            overallScore: wcagResult.overallScore,
            ran: true,
            siteColors,
            // Plain object (Map → JSON-safe across the step boundary) — ground
            // truth for the P1 DOM-verification gate.
            domFacts: Object.fromEntries(domFactsByUrl) as Record<string, DomFacts>,
          }
        } catch (err) {
          console.error('[inngest] WCAG check failed (non-fatal):', err)
          await auditLog(auditId, 'wcag_check_failed', 'warning',
            `WCAG check failed: ${err instanceof Error ? err.message : String(err)}. Continuing with text-based analysis.`)
          return { summary: '', findingsCount: 0, overallScore: 0, ran: false, siteColors: [] as string[], domFacts: {} as Record<string, DomFacts> }
        }
      })()

      // 2026-06-13 — INDEPENDENT PER-CHECK CAPTURE.
      // The previous design wrapped Promise.all([responsive, pagespeed,
      // wcag]) in ONE 120s race. When the browser checks ran long (fixpath
      // deep run: responsive 183s, WCAG 193s), the race rejected and the
      // .catch returned safe defaults for ALL THREE — discarding PageSpeed's
      // already-completed result AND, worse, starving the deep analyzer of
      // the responsive/WCAG summaries (their findings still landed in the DB
      // via the abandoned promises, but the empty summaries reached the
      // analysis step → accessibility/responsive graded blind). It also made
      // checks_executed under-report ('SEO, Schema' when all five ran).
      //
      // Now: each check is time-boxed on its OWN with withTimeout (returns
      // null on its own timeout) and collected with Promise.all — a slow
      // check can no longer discard a fast one, and whatever completes feeds
      // both findings and analyzer context. Budget raised to fit real
      // browser-check latency, well inside the 12-min pipeline deadline.
      const RESPONSIVE_FALLBACK = { summary: '', findingsCount: 0, viewportIssues: [] as any[], hasMobileViewport: false, ran: false }
      const WCAG_FALLBACK = { summary: '', findingsCount: 0, overallScore: 0, ran: false, siteColors: [] as string[], domFacts: {} as Record<string, DomFacts> }
      // 2026-06-13: raised 210s→250s to absorb axe-core latency on the WCAG
      // pass (axe injection + run on up to 2 pages) without risking the
      // fallback-on-timeout that would drop findings. Still well inside the
      // 12-min pipeline deadline.
      const PER_CHECK_TIMEOUT_MS = 250_000
      const [responsiveRaw, pagespeedResult, wcagRaw] = await Promise.all([
        withTimeout(responsivePromise, PER_CHECK_TIMEOUT_MS, 'responsive-check'),
        withTimeout(pagespeedPromise, PER_CHECK_TIMEOUT_MS, 'pagespeed-check'),
        withTimeout(wcagPromise, PER_CHECK_TIMEOUT_MS, 'wcag-check'),
      ])
      const responsive = responsiveRaw ?? RESPONSIVE_FALLBACK
      const wcag = wcagRaw ?? WCAG_FALLBACK

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
      // pagespeedRan retained for logging only — checks_executed is now
      // computed at report time from audit_logs completion events (ground
      // truth that survives timeouts/memoization), not from these flags.
      return { responsive, wcag, pagespeedRan: Boolean(pagespeedResult) }
      }, 270_000, 'parallel-site-checks', { responsive: null as any, wcag: null as any, pagespeedRan: false })
    })

    const responsiveCheck = parallelChecks.responsive
    const wcagCheck = parallelChecks.wcag

    // ──────────────────────────────────────────────────────────
    // CAPTURE (Capture→Analyze→Compose, Phase 1) — universal
    // Persist the immutable per-page PageCapture for EVERY audit. It is the
    // foundation Compose + coverage-limitations read from. Reads already-
    // persisted audit_pages + this run's DOM facts — adds NO new crawl/render
    // cost. Fully non-fatal: any failure is logged loudly via the checked write
    // but can NEVER affect the audit. See docs/AUDIT_PIPELINE_ARCHITECTURE.md.
    // ──────────────────────────────────────────────────────────
    // #27 — when FEATURE_ANALYZE_FROM_CAPTURE is on AND capture parity is full,
    // the shadow-capture step returns analyzer input reconstructed from the
    // immutable PageCapture. We point the LLM analyzer at it below so Stage 2 is
    // re-runnable without re-crawling. OFF by default → stays null → no change.
    let analysisContentOverride: string | null = null
    try {
      {
        const shadowCaptureRes = await step.run('shadow-capture', async () => {
          return withStepTimeout(async () => {
            const db = getDb()
            const { data: capturePages, error: captureReadErr } = await db.from('audit_pages')
              .select('url, title, h1, meta_description, content_text, status_code, crawl_status, fetch_strategy, screenshot_url, canonical_url, viewport_meta, has_structured_data, crawled_at')
              .eq('audit_id', auditId)
            if (captureReadErr) {
              await auditLog(auditId, 'shadow_capture_skipped', 'warning',
                `Shadow capture: could not read audit_pages — ${captureReadErr.message}`)
              return { ok: false, saved: 0 }
            }
            const domFactsObj = (wcagCheck as any)?.domFacts as Record<string, any> | undefined
            const rows = buildPageCaptureRows({
              auditId,
              workspaceId: auditDetails.workspaceId ?? null,
              userId: auditDetails.userId ?? null,
              pages: (capturePages as any[]) || [],
              domFactsByUrl: domFactsObj || {},
            })
            const res = await writePageCaptures(db, rows, auditId)
            await auditLog(auditId, 'shadow_capture_written', res.ok ? 'info' : 'warning',
              `Shadow capture: ${res.saved}/${rows.length} page capture(s) stored${res.ok ? '' : ` — ${res.errorMessage || 'write failed'}`}`,
              { saved: res.saved, attempted: rows.length, schema_version: CAPTURE_SCHEMA_VERSION })

            // ── Phase 2c shadow-compare (deterministic, read-only) ──
            // Prove the capture is a FAITHFUL, SUFFICIENT source for analysis:
            // reconstruct the analyzer input from the captures and compare page
            // coverage to the live crawl input. No analyzer is run, no LLM call,
            // no behavior change — this just records parity so we know the
            // capture can feed Stage 2 before we point an analyzer at it.
            let captureContent: string | null = null
            try {
              const parity = captureInputParity(crawlResult?.pageContent || '', rows as unknown as Parameters<typeof captureInputParity>[1])
              await auditLog(auditId, 'shadow_capture_parity', parity.coversAllLivePages ? 'info' : 'warning',
                `Capture input parity: covers ${parity.captureUrls}/${parity.liveUrls} live page(s)${parity.coversAllLivePages ? ' (full)' : ` — missing ${parity.missingFromCapture.length}`}`,
                { live_urls: parity.liveUrls, capture_urls: parity.captureUrls, covers_all: parity.coversAllLivePages, missing: parity.missingFromCapture.slice(0, 20), capture_chars: parity.captureChars })
              // #27 — only when the flag is on AND the capture faithfully covers
              // every live page do we reconstruct the analyzer input from the
              // capture. captureToPageContent reproduces the live pageContent
              // format byte-for-byte (URL/Title/H1/Meta/Content blocks).
              if (getFeatureFlags().analyzeFromCapture && parity.coversAllLivePages && parity.captureChars > 0) {
                captureContent = captureToPageContent(rows as unknown as Parameters<typeof captureToPageContent>[0])
              }
            } catch { /* parity logging is best-effort, never affects the audit */ }

            return { ...res, captureContent }
          }, 30_000, 'shadow-capture', { ok: false, saved: 0, captureContent: null })
        })
        // #27 — adopt the capture-derived analyzer input when the step produced it
        // (flag on + full parity). Instruments/SEO checks still read crawlResult.
        analysisContentOverride = (shadowCaptureRes as { captureContent?: string | null } | undefined)?.captureContent ?? null
        if (analysisContentOverride) {
          await auditLog(auditId, 'analysis_source_capture', 'info',
            'Analyzer input sourced from the immutable PageCapture (re-runnable, no re-crawl) — capture parity full')
        }
      }
    } catch (captureErr) {
      // Shadow capture must never affect the audit — swallow after logging.
      console.warn('[process-audit] shadow capture failed (non-fatal):', (captureErr as Error)?.message)
    }

    // ──────────────────────────────────────────────────────────
    // STEP 2c-2i COMBINED: Run all probe steps in parallel
    // These are independent: AI discovery, structured data,
    // page readability, LLM probe, citation audit, fix playbooks,
    // and multi-model benchmark. Running them in parallel saves
    // ~40-60s vs sequential execution.
    // ──────────────────────────────────────────────────────────
    const probeResults = await step.run('parallel-probes', async () => {
      // Master 120s timeout — individual probes have 30-60s timeouts, but this
      // catches any setup/teardown hangs and guarantees the step doesn't consume
      // the full Vercel 300s budget. Falls back to safe defaults on timeout.
      return await withStepTimeout(async () => {
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
            return { summary: '', findingsCount: 0, typesFound: [] as string[], ran: false }
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
                categoryIndex: finding.categoryIndex ?? 18,
              })
              const validated = validateFixableRecommendation({
                ...finding, ...classification,
                title: finding.title, description: finding.description,
                recommendation: finding.recommendation, severity: finding.severity,
              })
              return {
                audit_id: auditId, checklist_item_id: null,
                category_index: finding.categoryIndex ?? 18, severity: finding.severity,
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
            await insertFindingsChecked(db, auditId, sdInserts, 'structured-data')
          }
          return { summary, findingsCount: result.findings.length, typesFound: result.typesFound, ran: true }
        } catch (err) {
          console.error('[inngest] Structured data validation failed (non-fatal):', err)
          return { summary: '', findingsCount: 0, typesFound: [] as string[], ran: false }
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
            const { error: uncheckedInsertErr1 } = await db.from('llm_probe_results').insert(probeInserts as any)
            if (uncheckedInsertErr1) console.error(`[db] insert failed (llm_probe_results): ${uncheckedInsertErr1.message}`)
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
            const { error: uncheckedInsertErr2 } = await db.from('ai_citations').insert(inserts as any)
            if (uncheckedInsertErr2) console.error(`[db] insert failed (ai_citations): ${uncheckedInsertErr2.message}`)
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
      // LEAN PIPELINE: Skip entirely — saves 4–11 Haiku + 18–60 OpenRouter calls
      const runMultiModelStep = async () => {
        const leanFlags = getFeatureFlags()
        if (leanFlags.leanPipeline) {
          console.log('[inngest] LEAN PIPELINE: Skipping multi-model benchmark')
          return { comparison: null, industry: null }
        }
        try {
          const db = getDb()
          // Interrogation runs on NEW audits and DEEP re-audits only. A standard
          // re-audit carries findings forward and must NOT re-interrogate the AI
          // models (rule 2026-06-18) — the saved results persist and display.
          if (auditDetails.depthMode !== 'deep') {
            try {
              const { count } = await db.from('audits')
                .select('id', { count: 'exact', head: true })
                .eq('workspace_id', auditDetails.workspaceId ?? '')
                .in('status', ['completed', 'completed_with_warnings'])
                .neq('id', auditId)
              if ((count ?? 0) > 0) {
                console.log('[inngest] Standard re-audit — skipping multi-model interrogation (runs on new/deep only)')
                return { comparison: null, industry: null }
              }
            } catch { /* if the re-audit check fails, fall through and run */ }
          }
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
          // The audit always benchmarks the 3 DEFAULT (free) models only.
          // Premium models (Gemini/Grok/Meta) are NEVER auto-probed by the audit
          // — the user interrogates them on demand on the Intelligence page (rule
          // 2026-06-18). This stops the page surfacing premium results the user
          // never asked for, and keeps the AI Accuracy comparable across audits.
          const DEFAULT_BENCHMARK_SLUGS = ['perplexity/sonar', 'deepseek/deepseek-chat-v3-0324', 'openai/gpt-4o-mini']
          const enabledModelSlugs: string[] = DEFAULT_BENCHMARK_SLUGS.filter((slug) => findModelBySlug(slug) != null)
          // Fetch workspace's category-specific Top 10 questions from the
          // shortlist generator. These replace the generic fallback questions
          // and become the benchmark scoring basis.
          let shortlistQuestions: string[] | undefined
          if (auditDetails.workspaceId) {
            try {
              const shortlist = await getOrRefreshShortlist(auditDetails.workspaceId, db)
              if (shortlist.length > 0) {
                shortlistQuestions = shortlist.map(q => q.questionText)
                console.log(`[inngest] Using ${shortlistQuestions.length} category-specific benchmark questions from workspace shortlist`)
              }
            } catch (err) {
              console.warn('[inngest] Shortlist fetch failed, falling back to default questions:', err)
            }
          }
          const comparison = await runMultiModelBenchmark(domain, groundTruth, enabledModelSlugs, shortlistQuestions)
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
            const { error: uncheckedInsertErr3 } = await db.from('multi_model_probes').insert(benchInserts as any)
            if (uncheckedInsertErr3) console.error(`[db] insert failed (multi_model_probes): ${uncheckedInsertErr3.message}`)
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

      // ── Run ALL probes in parallel with INDIVIDUAL timeouts ──
      // Each probe is wrapped in its own withTimeout() so one hanging probe
      // doesn't kill ALL results. Lightweight probes get 30s; heavy API
      // probes get 60s. Promise.allSettled() ensures we collect every result
      // that finishes in time, even if others fail.
      const LIGHT_PROBE_TIMEOUT = 30_000
      const HEAVY_PROBE_TIMEOUT = 60_000

      const probeSettled = await Promise.allSettled([
        withTimeout(aiDiscoveryPromise, LIGHT_PROBE_TIMEOUT, 'ai-discovery-probe'),
        withTimeout(structuredDataPromise, LIGHT_PROBE_TIMEOUT, 'structured-data-probe'),
        withTimeout(readabilityPromise, LIGHT_PROBE_TIMEOUT, 'readability-probe'),
        withTimeout(runLlmProbeStep(), HEAVY_PROBE_TIMEOUT, 'llm-probe'),
        withTimeout(runCitationStep(), HEAVY_PROBE_TIMEOUT, 'citation-probe'),
        withTimeout(runMultiModelStep(), HEAVY_PROBE_TIMEOUT, 'multi-model-probe'),
      ])

      // Extract results — fulfilled probes return their value, rejected return safe defaults
      const aiDisc = probeSettled[0].status === 'fulfilled' && probeSettled[0].value
        ? probeSettled[0].value
        : { summary: '', result: null }
      const sdResult = probeSettled[1].status === 'fulfilled' && probeSettled[1].value
        ? probeSettled[1].value
        : { summary: '', findingsCount: 0, typesFound: [] as string[] }
      // readability (index 2) — no return value needed
      const llmProbe = probeSettled[3].status === 'fulfilled' ? probeSettled[3].value : null
      const citation = probeSettled[4].status === 'fulfilled' ? probeSettled[4].value : null
      const multiModel = probeSettled[5].status === 'fulfilled' && probeSettled[5].value
        ? probeSettled[5].value
        : { comparison: null, industry: null }

      // Log which probes timed out/failed and emit per-probe heartbeats
      // NOTE: withTimeout() catches all errors and returns null, so Promise.allSettled
      // always sees 'fulfilled'. We detect failures by checking for null values instead.
      const probeLabels = ['ai-discovery', 'structured-data', 'readability', 'llm-probe', 'citation', 'multi-model']
      const probeValues = [aiDisc, sdResult, null /* readability has no return */, llmProbe, citation, multiModel]
      let timedOutCount = 0
      const totalProbes = probeSettled.length
      probeValues.forEach((val, i) => {
        if (i === 2) return // readability has no return value — skip
        if (val === null) {
          console.warn(`[inngest] Probe "${probeLabels[i]}" failed/timed out (returned null)`)
          timedOutCount++
        }
      })
      // Heartbeat: show probe completion progress (interpolate between probing start and end)
      const completedCount = totalProbes
      const probeProgress = stageProgress('probing', 0) + Math.round(
        (stageProgress('probing', 1) - stageProgress('probing', 0)) * (completedCount / totalProbes) * 0.8
      )
      await setProgress(auditId, probeProgress)
      await logActivity(auditId, `${completedCount}/${totalProbes} AI probes completed${
        timedOutCount > 0
          ? ` (${timedOutCount} timed out)`
          : ''
      }`)

      await setProgress(auditId, stageProgress('probing', 1))
      await logStageCompleted(auditId, 'probing', 'AI visibility probes complete')

      return {
        aiDiscovery: aiDisc,
        structuredData: sdResult,
        llmProbe: llmProbe,
        citation: citation,
        multiModel: multiModel,
      }
      }, 120_000, 'parallel-probes', {
        aiDiscovery: { summary: '', result: null },
        structuredData: { summary: '', findingsCount: 0, typesFound: [] as string[] },
        llmProbe: null,
        citation: null,
        multiModel: { comparison: null, industry: null },
      })
    })

    // Unpack parallel probe results for downstream use
    const aiDiscovery = probeResults.aiDiscovery
    const structuredDataResult = probeResults.structuredData
    const llmProbeResult = probeResults.llmProbe
    const citationResult = probeResults.citation
    const multiModelResult = probeResults.multiModel

    // NOTE: checks_executed is persisted at PIPELINE END (see the 'complete'
    // step) — NOT here. Computing it now read the in-step `ran` flags, which
    // are unreliable: when a browser check exceeds the site-checks budget,
    // the step returns a fallback (ran:false) even though the check completed
    // and inserted findings moments later. The end-of-pipeline computation
    // uses ground-truth signals (audit_logs *_check_completed events +
    // persisted detection_source) that survive timeouts and memoization.

    // ──────────────────────────────────────────────────────────
    // STEP 2j: Fix Playbooks (fast, depends on probe results)
    // ──────────────────────────────────────────────────────────
    const playbooks = await step.run('fix-playbooks', async () => {
      return withStepTimeout(async () => {
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
          const { error: uncheckedInsertErr4 } = await db.from('fix_playbooks').insert(inserts as any)
          if (uncheckedInsertErr4) console.error(`[db] insert failed (fix_playbooks): ${uncheckedInsertErr4.message}`)
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
      }, 30_000, 'fix-playbooks', [] as any)
    })

    // ──────────────────────────────────────────────────────────
    // STEP 3: Build site context map + set status to analysing
    // Creates a summary of what exists across ALL pages so the
    // analyzer has cross-page awareness (e.g., "founder bio exists
    // on /about" prevents false positive on homepage)
    // ──────────────────────────────────────────────────────────
    const siteContext = await step.run('build-site-context', async () => {
      return withStepTimeout(async () => {
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
        // CRITICAL: Scope by workspace_id and exclude soft-deleted records to prevent
        // data leaking from deleted workspaces into new workspace audits.
        const wsId = auditDetails.workspaceId
        const contextResult = await withTimeout(Promise.all([
          (() => {
            let q = noteDb.from('site_notes')
              .select('note_type, title, content, category, finding_ref')
              .eq('user_id', userId).eq('domain', domain).eq('is_active', true)
            if (wsId) q = q.eq('workspace_id', wsId)
            return q.order('created_at', { ascending: false }).limit(20)
          })(),
          (() => {
            let q = noteDb.from('audits')
              .select('id, product_url').eq('user_id', userId).neq('id', auditId)
              .in('status', ['completed', 'completed_with_warnings']).ilike('product_url', `%${domain}%`)
              .is('deleted_at', null)
            if (wsId) q = q.eq('workspace_id', wsId)
            return q.order('completed_at', { ascending: false }).limit(1)
          })(),
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
              .select('id, title, severity, description, recommendation, estimated_impact, target_element, page_url, sort_order, status, dismissed, dismissal_reason, category_index, fix_status, finding_type, fix_type, confidence_level, detection_source, checklist_item_id')
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
              // CARRY-FORWARD FIDELITY (2026-06-11): this mapper silently
              // dropped category_index (and never fetched fix_type), so every
              // baseline re-audit inserted carried findings with NULL module
              // assignment — the Find page's per-module filters matched
              // nothing ('View findings' showed empty for every category) and
              // module scores/counts drifted.
              category_index: f.category_index ?? null,
              fix_type: f.fix_type ?? null,
              confidence_level: f.confidence_level || 'heuristic',
              // 2026-06-12: detection_source was never fetched/carried — the
              // baseline insert then hardcoded 'gap_fill', stripping
              // instrument provenance from every carried finding (WCAG/
              // schema/responsive findings displayed as 'AI review').
              detection_source: f.detection_source || null,
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
      const llmProbeContext = llmProbeResult?.summary
        ? `\n\n${llmProbeResult.summary}`
        : ''

      // Append WCAG check results so the AI analyzer has real compliance data
      const wcagContext = wcagCheck.summary || ''

      // P3 — feed the verified DOM structure to the analyzer as ground truth so
      // it never guesses the absence of landmarks/labels/links in the first
      // place. Prevention ahead of the P0/P1 detection gates.
      const domFactsContext = formatDomFactsForPrompt(
        (wcagCheck as any)?.domFacts as Record<string, DomFacts> | undefined,
        crawlResult.crawledUrls?.[0] || null,
      )

      const fullContext = siteMap + userContext + responsiveContext + llmProbeContext + wcagContext + domFactsContext

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
      }, 30_000, 'build-site-context')
    })

    const effectiveDepthMode = siteContext.effectiveDepthMode
    console.log(`[inngest] Audit ${auditId}: depth mode = ${effectiveDepthMode} (requested: ${auditDetails.depthMode})`)

    // ──────────────────────────────────────────────────────────
    // STEP 3b: Detect site profile (industry, audience, context)
    // Runs once before any analysis. Lightweight (~2s Haiku call).
    // Feeds into analyzeCategory() so findings are context-aware.
    //
    // 2026-06-12 THE REAL TDZ BUG: this was `const siteProfile = ...`
    // declared HERE, but the pagespeed/wcag/structured-data steps above
    // reference siteProfile in their insert payloads — invoking those
    // closures before this line = temporal dead zone crash. Minified
    // builds reported it as "Cannot access 'ew'/'e_' before
    // initialization", which we misread as a bundler bug; the webpack
    // unminified build named the variable. This single line is why
    // PageSpeed (D8) and WCAG silently produced nothing for weeks.
    // Now: nullable assignment — steps that run before detection get a
    // null profile (generic communication copy, same as the brand path).
    // ──────────────────────────────────────────────────────────
    siteProfile = await step.run('detect-site-profile', async () => {
      return withStepTimeout(async () => {
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
      }, 60_000, 'detect-site-profile', null)
    })

    let verificationData: { verified: number; likelyFixed: number; poorlyFixed: number; results: Array<{ findingId: string; status: string; note: string }> } | null = null
    // Titles of previous findings verified as fixed on the live site (for deep mode).
    // Hoisted here so quality gates (which run after both branches) can access it.
    let deepVerifiedFixedTitles: Set<string> = new Set()

    // Helper: check if a brand identity has meaningful content beyond auto-populated fields
    async function hasMeaningfulBrandDna(brandIdentityId: string): Promise<boolean> {
      const db = getDb()
      // Per-brand opt-out (Brand DNA page → "Include in audits"). When off,
      // Brand DNA is excluded from the audit even if files exist. Defaults on.
      const { data: flagRow } = await db
        .from('brand_identities')
        .select('include_in_audits')
        .eq('id', brandIdentityId)
        .single()
      if (flagRow && (flagRow as any).include_in_audits === false) return false
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

    // ── Analysis health tracking (zero-findings policy) — handler scope ──
    // Distinguishes "system failed" (insert errors, category timeouts/errors,
    // batch timeouts) from "genuinely clean" (all calls succeeded, zero issues).
    // Read by the zero-findings-policy step AFTER the deep/baseline branch:
    // zero findings + fault → fail + refund; zero + healthy → legit clean result.
    let totalFindingsCount = 0
    let totalEmptyCategories = 0
    let totalAnalyzedCategories = 0
    let totalInsertFailures = 0
    let totalLostFindings = 0
    let totalFailedCategories = 0
    let anyBatchTimedOut = false

    if (effectiveDepthMode === 'baseline') {
      // Honest disclosure (2026-06-11): baseline re-audits skip ALL deep AI
      // analysis — including Brand DNA comparison — by design (score
      // stability). If the workspace has a brand identity attached, say so
      // explicitly instead of silently ignoring the Brand DNA toggle, which
      // read as "Include Brand DNA is broken".
      if (auditDetails.brandIdentityId) {
        auditLimitations.push({
          id: 'brand_dna_baseline_skip',
          title: 'Brand DNA comparison not run',
          description: 'This was a standard re-audit, which reuses your previous findings for score stability and skips fresh AI analysis — including the Brand DNA comparison. Run a Deep audit to compare the site against your brand guidelines.',
        })
        await auditLog(auditId, 'brand_dna_skipped_baseline', 'info',
          'Baseline re-audit — Brand DNA comparison skipped (deep analysis not run). Use a Deep audit for brand guideline comparison.')
      }
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
        return withStepTimeout(async () => {
        const db = getDb()
        const prevFindings = siteContext.previousRawFindings
        let sortOrder = 0
        let droppedFixed = 0
        let droppedDismissed = 0
        let droppedStalePage = 0

        // ── Carry-forward content-change guard (2026-06-15) ──
        // Baseline re-audits copy previous findings VERBATIM. If a page's content
        // changed since the previous audit, a carried finding can quote text that
        // no longer exists (an old H1, a removed section). Build per-page content
        // maps (previous vs current) so we can SKIP carrying a finding whose page
        // materially changed — it must be re-derived, not recycled. Best-effort:
        // if either map is unavailable, we carry as before (safe degradation).
        const buildPageMap = async (aid: string | null): Promise<Map<string, PageContentFacts>> => {
          const map = new Map<string, PageContentFacts>()
          if (!aid) return map
          try {
            const { data } = await db.from('audit_pages')
              .select('url, h1, title, meta_description')
              .eq('audit_id', aid)
            for (const p of (data as any[]) || []) {
              if (p?.url) map.set(p.url, { h1: p.h1, title: p.title, metaDescription: p.meta_description })
            }
          } catch (e) {
            console.warn('[inngest] carry-forward page map fetch failed:', (e as Error)?.message)
          }
          return map
        }
        const [prevPageMap, currPageMap] = await Promise.all([
          buildPageMap(siteContext.previousAuditId),
          buildPageMap(auditId),
        ])
        const pageChangedForUrl = (rawUrl: string | null | undefined): boolean => {
          if (!rawUrl) return false
          const prev = prevPageMap.get(rawUrl)
          const curr = currPageMap.get(rawUrl)
          if (!prev || !curr) return false // can't compare → carry as before
          return pageContentChanged(prev, curr)
        }

        // Build batch insert array — was individual INSERT loop
        const batchInserts: any[] = []
        for (const pf of prevFindings) {
          if (pf.dismissed) { droppedDismissed++; continue }
          if (pf.status === 'fixed') { droppedFixed++; continue }
          // Page content changed since last audit → the verbatim copy may be
          // stale (quoting text that no longer exists). Drop it rather than
          // recycle a finding the page no longer supports.
          if (pageChangedForUrl(pf.page_url)) {
            droppedStalePage++
            console.log(`[inngest] Carry-forward: dropped stale finding "${String(pf.title).slice(0, 80)}" — page ${pf.page_url} changed since last audit`)
            continue
          }
          const pfFindingType = (pf as any).finding_type || 'fixable'
          const pfFixType = (pf as any).fix_type || null
          batchInserts.push({
            audit_id: auditId,
            checklist_item_id: null,
            // 2026-06-12: heal NULL category_index at carry time. Rows born
            // before the carry-forward fidelity fix carry NULL through every
            // baseline re-audit forever (verbatim copy = no self-healing).
            // Keyword inference persists the module's first category index;
            // unmatched stays NULL (UI catch-all handles display) — never
            // bake a guess into data.
            category_index: (pf as any).category_index
              ?? (() => { const km = keywordModuleIndexFor(pf.title, pf.description); return km !== null ? km * 4 : null })(),
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
            // 2026-06-12: was hardcoded 'gap_fill' — every carried finding
            // lost its instrument provenance on re-audit (a WCAG-checker
            // finding became 'AI review' in the trust layer and dropped out
            // of the verified evidence tier). Preserve the original source.
            detection_source: (pf as any).detection_source || 'gap_fill',
            communication: buildCommunicationForGenericFinding({ title: pf.title, description: pf.description, recommendation: pf.recommendation, estimatedImpact: pf.estimated_impact || null, severity: pf.severity }, siteProfile),
            ...computeActionModelFields({ title: pf.title, description: pf.description, recommendation: pf.recommendation, fix_type: pfFixType, finding_type: pfFindingType }),
          })
        }

        if (batchInserts.length > 0) {
          await insertFindingsChecked(db, auditId, batchInserts, 'baseline-carry-forward')
        }

        const copiedCount = batchInserts.length
        await auditLog(auditId, 'baseline_findings_copied', 'success',
          `Baseline: ${copiedCount} findings carried forward, ${droppedFixed} fixed, ${droppedDismissed} dismissed, ${droppedStalePage} dropped (page changed)`, {
            copied: copiedCount,
            dropped_fixed: droppedFixed,
            dropped_dismissed: droppedDismissed,
            dropped_stale_page: droppedStalePage,
            total_previous: prevFindings.length,
          })

        return { copiedCount, droppedFixed, droppedDismissed, droppedStalePage }
        }, 30_000, 'baseline-copy-findings')
      })

      // ════════════════════════════════════════════════════════════
      // VERIFICATION STEP — AI check against freshly crawled live site
      // Checks each copied finding to see if it's still present.
      // Does NOT affect scores — flags findings for user confirmation.
      // Results stored both in DB (if columns exist) and returned
      // directly so the report step doesn't depend on DB columns.
      // ════════════════════════════════════════════════════════════
      verificationData = await step.run('ai-verify-findings', async () => {
        return withStepTimeout(async () => {
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

        const verificationResults = await Promise.race([
          verifyFindings(
            copiedFindings as any[],
            freshContent,
            auditDetails.language,
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('verifyFindings exceeded 120s aggregate timeout')), 120_000)
          ),
        ]).catch((err) => {
          console.error('[inngest] ai-verify-findings timeout:', err?.message)
          return [] as Array<{ findingId: string; status: string; note: string }>
        })

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
        }, 150_000, 'ai-verify-findings')
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
      if ((activeSlugsBl.includes('brand_consistency') || activeSlugsBl.includes('design_consistency')) && auditDetails.brandIdentityId) {
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
        const llmProbeBlockBl = llmProbeResult?.summary ? `\n\n${llmProbeResult.summary}` : ''
        const contentWithContextBl = `${siteContext.context}\n\n${analysisContentOverride ?? crawlResult.pageContent}${aiDiscoveryBlockBl}${structuredDataBlockBl}${llmProbeBlockBl}`

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

          // Gap-fill has the same timeout structure as main analysis:
          // per-category 45s timeout + batch-level 90s timeout.
          const gapStartTs = Date.now()
          console.log(`[inngest] ── Gap-fill START ──`, { auditId, categories: gapCategories, count: gapCategories.length })
          const gapResultsRaw = await withStepTimeout(
            () => Promise.all(
              gapCategories.map(async (categoryName) => {
                const catStartTs = Date.now()
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
                  const dur = Date.now() - catStartTs
                  console.log(`[inngest]   ├─ gap-fill ${categoryName}: ${result === null ? 'timeout' : 'ok'} (${dur}ms, ${(result || []).length} findings)`)
                  return result || []
                } catch (gapErr) {
                  const dur = Date.now() - catStartTs
                  console.error(`[inngest]   ├─ gap-fill ${categoryName}: ERROR (${dur}ms)`, (gapErr as Error)?.message)
                  return []
                }
              }),
            ),
            60_000,
            'gap-fill-batch-timeout',
            null as any,
          )
          const gapResults = gapResultsRaw ?? gapCategories.map(() => [] as any[])
          console.log(`[inngest] ── Gap-fill END (${Date.now() - gapStartTs}ms${gapResultsRaw === null ? ' TIMED OUT' : ''}) ──`)

          const gapRows: any[] = []
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
              gapRows.push({
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
                viewport: finding.viewport || null,
                confidence_level: 'heuristic',
                detection_source: 'deep_analyzer',
                communication: buildCommunicationForGenericFinding({ title: finding.title, description: finding.description, recommendation: finding.recommendation, estimatedImpact: finding.estimatedImpact || null, severity: finding.severity }, siteProfile),
                ...computeActionModelFields({ title: finding.title, description: finding.description, recommendation: finding.recommendation, fix_type: validated.fixType, finding_type: validated.findingType }),
              })
              findingsInGap++
            }
          }
          if (gapRows.length > 0) {
            await insertFindingsChecked(db, auditId, gapRows, 'gap-fill')
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

          const verificationResults = await Promise.race([
            verifyFindings(
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
            ),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('deep-pre-verify exceeded 240s aggregate timeout')), 240_000)
            ),
          ]).catch((err) => {
            console.error('[inngest] deep-pre-verify timeout:', err?.message)
            return [] as Array<{ findingId: string; status: string; note: string }>
          })

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
      // CRITICAL: All expensive prep (brand file extraction, category selection,
      // content building) is wrapped in a step.run so it's memoized across
      // Inngest invocations. Without this, brand file extraction (up to 60s)
      // re-runs on EVERY invocation, eating into the 300s Vercel budget and
      // causing stalls at 56%.
      const analysisPrepResult = await step.run('analysis-prep', async () => {
        return withStepTimeout(async () => {
        await logActivity(auditId, 'Preparing analysis modules...')
        await setProgress(auditId, stageProgress('analysing', 0) + 1, 'analysing')

        // ── Determine which modules (and thus categories) to analyze ──
        const MODULE_SLUG_ORDER = ['foundation', 'human_experience', 'inclusive_design', 'future_readiness', 'seo_structure', 'accessibility_readiness', 'design_consistency']

        let activeSlugs: string[]
        if (auditDetails.selectedModules) {
          activeSlugs = auditDetails.selectedModules
        } else if (auditDetails.selectedPillars) {
          activeSlugs = auditDetails.selectedPillars
            .filter((idx: number) => idx >= 0 && idx < 4)
            .map((idx: number) => MODULE_SLUG_ORDER[idx])
          const legacyMappedSlugs = new Set(activeSlugs)
          for (const mod of AUDIT_MODULES) {
            if (mod.includedInComplete && mod.legacyPillarIndex == null && !legacyMappedSlugs.has(mod.slug)) {
              activeSlugs.push(mod.slug)
            }
          }
        } else {
          activeSlugs = [...COMPLETE_AUDIT_SLUGS]
        }

        // Design Consistency always runs (categories 24-27)
        let includeBrandDnaEnrichment = false
        if ((activeSlugs.includes('brand_consistency') || activeSlugs.includes('design_consistency')) && auditDetails.brandIdentityId) {
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
        activeSlugs = activeSlugs.map(s => s === 'brand_consistency' ? 'design_consistency' : s)
        if (!activeSlugs.includes('design_consistency')) {
          activeSlugs.push('design_consistency')
        }
        await withTimeout(
          auditLog(auditId, 'design_mode', 'info',
            `Design Consistency: always active. Brand DNA enrichment: ${includeBrandDnaEnrichment ? 'enabled (meaningful brand files found)' : 'disabled'}`),
          10_000,
          'auditLog-design-mode',
        )

        // Build category list
        const selectedIndices = new Set<number>()
        for (const slug of activeSlugs) {
          const moduleIdx = MODULE_SLUG_ORDER.indexOf(slug)
          if (moduleIdx === -1) continue
          for (let c = moduleIdx * 4; c < moduleIdx * 4 + 4; c++) {
            if (c < UX_CATEGORY_NAMES.length) selectedIndices.add(c)
          }
        }
        const categoriesToAnalyze = UX_CATEGORY_NAMES.filter((_, idx) => selectedIndices.has(idx))

        // ── Fetch brand content only when explicitly enabled ──
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

        // Build content strings
        const aiDiscoveryBlock = aiDiscovery.summary ? `\n\n${aiDiscovery.summary}` : ''
        const structuredDataBlock = structuredDataResult.summary ? `\n\n${structuredDataResult.summary}` : ''
        const llmProbeBlock = llmProbeResult?.summary ? `\n\n${llmProbeResult.summary}` : ''
        const contentWithContext = `${patchedContext}\n\n${analysisContentOverride ?? crawlResult.pageContent}${aiDiscoveryBlock}${structuredDataBlock}${llmProbeBlock}`
        const designConsistencyContent = brandContext
          ? `=== BRAND IDENTITY GUIDELINES (PRIMARY REFERENCE) ===\n${brandContext}\n\n=== MANDATORY COMPARISON INSTRUCTION ===\nYour PRIMARY task for this category is to compare the website's actual implementation against the brand guidelines above. For EACH aspect of the brand guidelines (colors, typography, voice, tone, visual style, messaging patterns), check whether the website follows or deviates from them.\n\nYou MUST flag:\n- Any mismatch between documented brand colors/fonts and what the site actually uses\n- Voice/tone deviations from the brand personality\n- Visual style inconsistencies with brand guidelines\n- Messaging that contradicts the brand positioning\n\nDo NOT smooth over discrepancies. If the brand says "professional and authoritative" but the site uses casual slang, that is a HIGH severity finding. If the brand specifies specific colors but the site uses different ones, flag it.\n\n=== WEBSITE CONTENT (TO COMPARE AGAINST BRAND) ===\n${contentWithContext}`
          : contentWithContext

        return { categoriesToAnalyze, contentWithContext, designConsistencyContent }
        }, 120_000, 'analysis-prep', null as any)
        // ↑ Increased from 60s→120s: brand file extraction alone can take 60s.
        // Added null fallback so timeout degrades gracefully instead of killing the audit.
      })

      // Destructure memoized prep result — these never re-execute on replay
      // If analysis-prep timed out, skip deep analysis entirely (audit still completes with empty findings)
      if (!analysisPrepResult) {
        console.warn('[inngest] analysis-prep timed out — skipping deep AI analysis')
        await auditLog(auditId, 'analysis_prep_timeout', 'warning',
          'Analysis prep timed out — deep AI analysis skipped. Audit will complete with limited findings.')
        auditLimitations.push({
          id: 'analysis_prep_timeout',
          title: 'Analysis prep timed out',
          description: 'The analysis preparation step timed out. This audit may have fewer findings than expected. Re-run to get full results.',
        })
      }
      const { categoriesToAnalyze, contentWithContext, designConsistencyContent } = analysisPrepResult || { categoriesToAnalyze: [] as string[], contentWithContext: '', designConsistencyContent: '' }

      const BATCH_SIZE = 8
      const batches: string[][] = []
      for (let i = 0; i < categoriesToAnalyze.length; i += BATCH_SIZE) {
        batches.push(categoriesToAnalyze.slice(i, i + BATCH_SIZE))
      }

      // Design Consistency category names (indices 24-27)
      const designConsistencyCategoryNames = new Set(
        UX_CATEGORY_NAMES.slice(24, 28)
      )

      // Health/total accumulators are declared at handler scope (above the
      // baseline/deep branch) so the zero-findings-policy step can read them.
      // NOTE: logActivity/setProgress calls are INSIDE each step.run below
      // so they don't re-execute on every Inngest invocation (which was
      // causing unnecessary DB writes and eating into the 300s Vercel budget).

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx]
        // NO coordination code here — DB writes moved inside step.run

        const batchResult = await step.run(`analyze-batch-${batchIdx + 1}`, async () => {
          const db = getDb()
          let sortOrder = totalFindingsCount
          let findingsInBatch = 0

          // Log batch start INSIDE step.run so it's memoized (won't re-run on replay)
          if (batchIdx === 0) {
            await logActivity(auditId, `Starting deep analysis: ${categoriesToAnalyze.length} categories across ${batches.length} batch${batches.length === 1 ? '' : 'es'}...`)
          }
          const batchStartProgress = Math.round(30 + (batchIdx / batches.length) * 35)
          await logActivity(auditId, `Analysing batch ${batchIdx + 1}/${batches.length}: ${batch.slice(0, 3).join(', ')}${batch.length > 3 ? '...' : ''}`)
          await setProgress(auditId, batchStartProgress, 'analysing')

          const batchStartTs = Date.now()
          console.log(`[inngest] ── Batch ${batchIdx + 1}/${batches.length} START ──`, {
            auditId,
            categories: batch,
            categoryCount: batch.length,
            hasDesignConsistency: batch.some(c => designConsistencyCategoryNames.has(c)),
            brandDnaEnriched: designConsistencyContent !== contentWithContext,
            contentSize: contentWithContext.length,
            designContentSize: designConsistencyContent.length,
          })
          const CATEGORY_TIMEOUT_MS = 50_000 // 50s safety net (SDK has its own 45s)
          const categoryTimings: Array<{ name: string; durationMs: number; status: 'ok' | 'timeout' | 'error' | 'empty'; findingCount: number }> = []

          // 60s batch ceiling — categories run in parallel so wall time ≈ slowest
          // single call (~50s max). Reduced from 90s to leave headroom for post-
          // analysis DB writes within Vercel's 300s step budget.
          let batchTimedOut = false
          const batchResults = await withStepTimeout(
            () => Promise.all(
              batch.map(async (categoryName) => {
                const catStartTs = Date.now()
                const isDesignConsistency = designConsistencyCategoryNames.has(categoryName)
                const content = isDesignConsistency
                  ? designConsistencyContent
                  : contentWithContext
                try {
                  const result = await withTimeout(
                    analyzeCategory(content, categoryName, [], auditDetails.userFocus, auditDetails.language, 'deep', siteProfile),
                    CATEGORY_TIMEOUT_MS,
                    `analyze-${categoryName}`,
                  )
                  const durationMs = Date.now() - catStartTs
                  const findings = result || []
                  const status = result === null ? 'timeout' : (findings.length === 0 ? 'empty' : 'ok')
                  categoryTimings.push({ name: categoryName, durationMs, status, findingCount: findings.length })
                  console.log(`[inngest]   ├─ ${categoryName}: ${status} (${durationMs}ms, ${findings.length} findings)${isDesignConsistency ? ' [Design Consistency]' : ''}`)
                  return findings
                } catch (err) {
                  const durationMs = Date.now() - catStartTs
                  categoryTimings.push({ name: categoryName, durationMs, status: 'error', findingCount: 0 })
                  console.error(`[inngest]   ├─ ${categoryName}: ERROR (${durationMs}ms)${isDesignConsistency ? ' [Design Consistency]' : ''}`, (err as Error)?.message)
                  return []
                }
              }),
            ),
            60_000,
            `analyze-batch-${batchIdx + 1}-timeout`,
            null as any, // null fallback so we can detect batch-level timeout
          )

          // Detect batch-level timeout: withStepTimeout returns null fallback
          let effectiveBatchResults: any[][]
          if (batchResults === null) {
            batchTimedOut = true
            effectiveBatchResults = []
            console.error(`[inngest] ── Batch ${batchIdx + 1} TIMED OUT after 90s ──`, {
              auditId,
              categoryTimings,
              batchDurationMs: Date.now() - batchStartTs,
            })
          } else {
            effectiveBatchResults = batchResults
          }

          const batchDurationMs = Date.now() - batchStartTs
          console.log(`[inngest] ── Batch ${batchIdx + 1}/${batches.length} END (${batchDurationMs}ms${batchTimedOut ? ' TIMED OUT' : ''}) ──`, {
            auditId,
            categoryTimings,
            totalFindings: effectiveBatchResults.reduce((sum, r) => sum + (r?.length || 0), 0),
          })

          // Batch all findings for this analysis batch into a single insert
          const batchInserts: any[] = []
          // When batch times out (effectiveBatchResults=[]), count ALL categories as empty
          let emptyCategoriesInBatch = batchTimedOut ? batch.length : 0

          for (let catIdx = 0; catIdx < effectiveBatchResults.length; catIdx++) {
            const findings = effectiveBatchResults[catIdx]
            const categoryName = batch[catIdx]
            const absoluteCatIdx = UX_CATEGORY_NAMES.indexOf(categoryName)

            if (!findings || findings.length === 0) {
              emptyCategoriesInBatch++
              console.warn(`[inngest] Category "${categoryName}" returned 0 findings — possible timeout or API failure`)
            }

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
                viewport: finding.viewport || null,
                confidence_level: 'heuristic',
                detection_source: 'analyzer',
                communication: comm,
                ...computeActionModelFields({ title: finding.title, description: finding.description, recommendation: finding.recommendation, fix_type: classification.fixType, finding_type: classification.findingType }),
              })
            }

            findingsInBatch += findings.length
          }

          // ── DB writes in try-catch — a failed insert must NOT kill the step,
          // but it MUST be visible. insertFindingsChecked reads the supabase
          // { error } response (supabase-js never throws on insert failure —
          // the June 7-10 viewport schema-drift incident was invisible because
          // this error went unread and 3 days of audits shipped 0 findings).
          let insertedInBatch = 0
          try {
            insertedInBatch = await insertFindingsChecked(db, auditId, batchInserts, `analysis-batch-${batchIdx + 1}`)
            // Granular progress: 30% → 65% spread across batches
            const batchProgress = Math.round(30 + ((batchIdx + 1) / batches.length) * 35)
            await setProgress(auditId, batchProgress)
            // Log per-category results (non-critical — fire and forget)
            for (let catIdx = 0; catIdx < effectiveBatchResults.length; catIdx++) {
              const findings = effectiveBatchResults[catIdx]
              await auditLog(auditId, 'category_analysed', 'success', `Analyzed: ${batch[catIdx]}`, {
                findings_count: (findings || []).length,
              })
            }
          } catch (dbErr) {
            console.error(`[inngest] Batch ${batchIdx + 1} DB write failed — continuing:`, (dbErr as Error)?.message)
            // Don't rethrow — we have findings in memory, the step should still return
          }
          const insertFailed = batchInserts.length > 0 && insertedInBatch === 0

          return { findingsInBatch, newSortOrder: sortOrder, emptyCategoriesInBatch, categoriesInBatch: batch.length, batchTimedOut, batchDurationMs, categoryTimings, insertFailed, attemptedInserts: batchInserts.length }
        })

        totalFindingsCount = batchResult.newSortOrder
        totalEmptyCategories += batchResult.emptyCategoriesInBatch
        totalAnalyzedCategories += batchResult.categoriesInBatch
        if ((batchResult as any).insertFailed) {
          totalInsertFailures++
          totalLostFindings += (batchResult as any).attemptedInserts || 0
          console.error(`[inngest] ALERT: Batch ${batchIdx + 1} findings insert FAILED for audit ${auditId} — ${(batchResult as any).attemptedInserts} findings lost`)
          auditLimitations.push({
            id: `batch_${batchIdx + 1}_insert_failed`,
            title: `Findings could not be saved (batch ${batchIdx + 1})`,
            description: `${(batchResult as any).attemptedInserts} finding(s) were produced by analysis but could not be written to the database. This is a system error (likely schema drift), not a clean result. Scores derived from missing findings are unreliable — do not trust a clean report for this batch.`,
          })
        }
        if (batchResult.batchTimedOut) {
          anyBatchTimedOut = true
          console.error(`[inngest] ALERT: Batch ${batchIdx + 1} fully timed out for audit ${auditId}`)
          // Contradiction check: batch-level timeout → flag degraded confidence
          const timedOutCategories = batch.join(', ')
          auditLimitations.push({
            id: `batch_${batchIdx + 1}_timeout`,
            title: `Analysis batch ${batchIdx + 1} timed out`,
            description: `Batch ${batchIdx + 1}/${batches.length} (${timedOutCategories}) exceeded the 90-second time budget and was terminated. Findings and scores for these categories are incomplete or missing. The overall audit score may not reflect the full state of the site.`,
          })
        }
        // Per-category timeout tracking: if individual categories in a completed batch timed out
        if (!batchResult.batchTimedOut && batchResult.categoryTimings) {
          const timedOutCats = batchResult.categoryTimings.filter((t: any) => t.status === 'timeout' || t.status === 'error')
          totalFailedCategories += timedOutCats.length
          if (timedOutCats.length > 0) {
            const catNames = timedOutCats.map((t: any) => t.name).join(', ')
            auditLimitations.push({
              id: `batch_${batchIdx + 1}_partial_timeout`,
              title: `${timedOutCats.length} categor${timedOutCats.length === 1 ? 'y' : 'ies'} timed out`,
              description: `The following categories in batch ${batchIdx + 1} could not complete analysis: ${catNames}. Scores for these categories are based on limited evidence.`,
            })
          }
        }
      }

      // ── Detect silent analysis failures ──────────────────────────────
      // If too many categories returned zero findings, the analyzers likely
      // timed out or the AI API was unresponsive. Flag this so the user
      // sees a clear limitation instead of a misleadingly clean report.
      if (totalAnalyzedCategories > 0 && totalEmptyCategories > 0) {
        const emptyRatio = totalEmptyCategories / totalAnalyzedCategories
        console.warn(`[inngest] Audit ${auditId}: ${totalEmptyCategories}/${totalAnalyzedCategories} categories returned 0 findings (${Math.round(emptyRatio * 100)}%)`)

        if (emptyRatio >= 0.5) {
          // More than half of categories failed — audit is severely evidence-limited
          auditLimitations.push({
            id: 'analysis_timeout_majority',
            title: 'Limited analysis coverage',
            description: `${totalEmptyCategories} of ${totalAnalyzedCategories} audit categories could not complete analysis within the time budget. This audit has limited evidence coverage — scores and findings may not reflect the full state of the site. We recommend re-running the audit when server load is lower.`,
          })
          await auditLog(auditId, 'analysis_coverage_warning', 'warning',
            `${totalEmptyCategories}/${totalAnalyzedCategories} categories returned zero findings — likely timeout/API failures`)
        } else if (totalEmptyCategories >= 3) {
          // Several categories failed — note it but audit is still partially useful
          auditLimitations.push({
            id: 'analysis_timeout_partial',
            title: 'Some categories could not be analyzed',
            description: `${totalEmptyCategories} of ${totalAnalyzedCategories} categories did not return findings, possibly due to analysis timeouts. The remaining categories were analyzed normally. A re-audit may provide more complete results.`,
          })
        }
      }
    }

    // ──────────────────────────────────────────────────────────
    // ZERO-FINDINGS POLICY (added 2026-06-10)
    // Zero findings is only a valid result when the pipeline is healthy.
    //  - Zero + system fault (insert failures, category timeouts/errors,
    //    batch timeouts) → the zero is OUR fault → fail the audit, refund
    //    the credit, tell the user clearly. Never ship fabricated scores.
    //  - Zero + healthy pipeline → legitimate clean site → ship the report,
    //    no refund. The customer is entitled to know their site is clean.
    // ──────────────────────────────────────────────────────────
    const zeroFindingsVerdict = await step.run('zero-findings-policy', async () => {
      const db = getDb()
      const { count, error: countError } = await db
        .from('audit_findings')
        .select('id', { count: 'exact', head: true })
        .eq('audit_id', auditId)

      if (countError) {
        // Can't verify — don't abort on a count failure, but log it
        console.error(`[inngest] zero-findings-policy: count query failed: ${countError.message}`)
        return { action: 'continue' as const, findingsCount: -1 }
      }

      const findingsCount = count ?? 0
      if (findingsCount > 0) {
        return { action: 'continue' as const, findingsCount }
      }

      const faultReasons: string[] = []
      if (totalInsertFailures > 0) faultReasons.push(`${totalInsertFailures} batch insert failure(s) — ${totalLostFindings} finding(s) produced but not saved`)
      if (totalFailedCategories > 0) faultReasons.push(`${totalFailedCategories} category analyzer(s) timed out or errored`)
      if (anyBatchTimedOut) faultReasons.push('at least one analysis batch fully timed out')
      const systemFault = faultReasons.length > 0

      if (!systemFault) {
        // Genuinely clean: every analyzer call succeeded, every insert succeeded,
        // the site simply has no findings worth reporting at this depth.
        await auditLog(auditId, 'clean_zero_verified', 'success',
          `Zero findings with a fully healthy pipeline (${totalAnalyzedCategories} categories analyzed, 0 timeouts, 0 insert failures). This is a verified clean result — shipping report, no refund.`)
        return { action: 'continue' as const, findingsCount: 0 }
      }

      // The zero is our fault — fail loudly, refund, do not fabricate a report.
      const reason = faultReasons.join('; ')
      console.error(`[inngest] Audit ${auditId}: zero findings caused by SYSTEM FAILURE (${reason}) — failing audit and refunding credit`)
      await refundCredit(auditId)
      await db.from('audits').update({
        status: 'failed',
        crawl_error: `AUDIT_SYSTEM_ERROR: The analysis ran but we could not produce reliable findings due to an internal error (${reason.slice(0, 250)}). This was our fault, not a problem with your site. Your credit has been refunded — please re-run the audit.`,
        updated_at: new Date().toISOString(),
      } as any).eq('id', auditId)
      await logPipelineFailed(auditId, `Zero findings due to system failure: ${reason.slice(0, 200)}`)
      await auditLog(auditId, 'audit_failed_zero_findings_system', 'error',
        `Audit failed: analysis produced zero findings because of a system error (${reason.slice(0, 200)}). Credit refunded. No report was generated — fabricated scores are never shipped.`)
      return { action: 'abort' as const, findingsCount: 0 }
    })

    if (zeroFindingsVerdict && (zeroFindingsVerdict as any).action === 'abort') {
      console.warn(`[inngest] Audit ${auditId} aborted by zero-findings policy — credit refunded, no report generated`)
      return { aborted: 'zero_findings_system_failure', auditId }
    }

    // ──────────────────────────────────────────────────────────
    // QUALITY GATES: Dedup + speculative filter + relevance scoring
    // Combined into one step to eliminate Inngest cold-start overhead
    // ──────────────────────────────────────────────────────────
    if (isPastDeadline()) {
      console.warn(`[inngest] PIPELINE DEADLINE: Skipping quality-gates (${Math.round((Date.now() - pipelineStartTime) / 1000)}s elapsed)`)
      await auditLog(auditId, 'deadline_skip', 'warning', 'Quality gates skipped — pipeline deadline reached. Findings used as-is from analysis.')
    } else {
    await step.run('quality-gates', async () => {
      return withStepTimeout(async () => {
      const qgStart = Date.now()
      await logStageStarted(auditId, 'quality_gates', 'Running quality checks on findings...')
      await setProgress(auditId, stageProgress('quality_gates', 0))
      const db = getDb()

      // ══════════════════════════════════════════════════════════
      // SINGLE FETCH: Load all findings once, operate in-memory
      // (Was 6 separate DB fetches — now 1 fetch + batch writes)
      // ══════════════════════════════════════════════════════════
      const { data: allQGFindings } = await db
        .from('audit_findings')
        .select('id, title, description, recommendation, severity, page_url, sort_order, category_index, confidence_level, confidence_score, detection_source, finding_type, fix_type, fix_payload, target_element, evidence, viewport')
        .eq('audit_id', auditId)
        .order('sort_order', { ascending: true })

      if (!allQGFindings || allQGFindings.length === 0) {
        // Zero findings here means the zero-findings-policy step already verified
        // the pipeline was healthy (faulty zeros abort before this point).
        // This is a legitimate clean result — no quality gates needed.
        console.log(`[inngest] Audit ${auditId}: zero findings (verified clean by policy step) — skipping quality gates`)
        await auditLog(auditId, 'quality_gates_skipped_clean', 'info',
          'No findings to quality-check — verified clean result.')
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
        category_index: (f.category_index ?? null) as number | null,
        confidence_level: (f.confidence_level || 'heuristic') as ConfidenceLevel,
        confidence_score: (f.confidence_score ?? 0.5) as number,
        detection_source: (f.detection_source || 'analyzer') as DetectionSource,
        finding_type: (f.finding_type || 'fixable') as string,
        fix_type: (f.fix_type || null) as string | null,
        fix_payload: f.fix_payload,
        target_element: (f.target_element || null) as string | null,
        evidence: (f.evidence ?? null) as string | null,
        viewport: (f.viewport ?? null) as string | null,
      }))

      const idsToDelete = new Set<string>()
      const batchUpdates: Array<{ id: string; updates: Record<string, any> }> = []

      // ── Fabrication net at the GATE (2026-06-11) ─────────────────────
      // The analyzer-level contradiction net only screens NEW findings.
      // Baseline re-audits CARRY findings forward verbatim, so a fabricated
      // finding born before the net deployed ('testimonials lack
      // attribution' on a site with zero testimonials) kept resurfacing on
      // every re-audit as a zombie. Quality gates see every finding on
      // every run — screen them all against the crawled content here.
      try {
        const gateContent = crawlResult?.pageContent || ''
        if (gateContent.length > 100) {
          for (const f of findings) {
            if (contradictsContent({ title: f.title, description: f.description }, gateContent)) {
              idsToDelete.add(f.id)
              console.warn(`[quality-gates] Fabrication net dropped carried finding: "${f.title.slice(0, 80)}"`)
            }
          }
          if (idsToDelete.size > 0) {
            await auditLog(auditId, 'fabrication_net_dropped', 'warning',
              `${idsToDelete.size} finding(s) removed — they claim or critique elements the crawled content shows no evidence of (e.g. testimonials on a site that has none).`)
            findings = findings.filter((f) => !idsToDelete.has(f.id))
          }
        }
      } catch (netErr) {
        console.error('[quality-gates] Fabrication net error (non-fatal):', netErr)
      }

      // ── Topical miscategorization correction (2026-06-12) ─────────────
      // The analyzer stamps findings with the category they were generated
      // UNDER — off-topic LLM drift inherits the wrong module (security-
      // transparency finding rendered under SEO). Runs at the gate because
      // baseline re-audits carry findings verbatim: generation-time-only
      // rules never heal existing rows.
      try {
        let corrected = 0
        for (const f of findings) {
          const newIdx = correctedCategoryIndexFor(f.category_index, f.title, f.description)
          if (newIdx !== null && newIdx !== f.category_index) {
            f.category_index = newIdx
            batchUpdates.push({ id: f.id, updates: { category_index: newIdx } })
            corrected++
            console.log(`[quality-gates] Category corrected → ${newIdx}: "${f.title.slice(0, 80)}"`)
          }
        }
        if (corrected > 0) {
          await auditLog(auditId, 'category_corrected', 'info',
            `${corrected} finding(s) moved to the module their content belongs to (topical correction).`)
        }
      } catch (catErr) {
        console.error('[quality-gates] Category correction error (non-fatal):', catErr)
      }

      // ── Pipeline instrumentation: snapshot raw findings before gates ───
      const rawCount = findings.length
      const rawBySeverity = { critical: 0, high: 0, medium: 0, low: 0 } as Record<string, number>
      const rawBySource = {} as Record<string, number>
      const rawByConfidence = {} as Record<string, number>
      for (const f of findings) {
        rawBySeverity[f.severity] = (rawBySeverity[f.severity] || 0) + 1
        rawBySource[f.detection_source] = (rawBySource[f.detection_source] || 0) + 1
        rawByConfidence[f.confidence_level] = (rawByConfidence[f.confidence_level] || 0) + 1
      }
      await auditLog(auditId, 'pipeline_snapshot_raw', 'info',
        `Raw findings: ${rawCount} | severity: ${JSON.stringify(rawBySeverity)} | source: ${JSON.stringify(rawBySource)} | confidence: ${JSON.stringify(rawByConfidence)}`,
      )

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

      // ── 2. Filter speculative findings (demote-not-delete) ───
      if (findings.length > 0) {
        const hasHeadTags = crawlResult.pageContent.includes('Head Tags:')
        const specResult = classifySpeculativeFindings(
          findings.map(f => ({
            id: f.id, title: f.title, description: f.description,
            page_url: f.page_url, target_element: f.target_element,
            confidence_level: f.confidence_level,
          })),
          hasHeadTags,
        )

        // Demote grounded findings: lower severity by one level, mark as heuristic
        if (specResult.demoteIds.length > 0) {
          const SEVERITY_DEMOTION: Record<string, string> = {
            critical: 'high', high: 'medium', medium: 'low', low: 'low',
          }
          for (const f of findings) {
            if (specResult.demoteIds.includes(f.id)) {
              const oldSeverity = f.severity
              f.severity = SEVERITY_DEMOTION[f.severity] || f.severity
              f.confidence_level = 'heuristic'
              // Persist demotion to DB
              batchUpdates.push({ id: f.id, updates: { severity: f.severity, confidence_level: 'heuristic' } })
              console.log(`[inngest] Speculative filter: demoted finding "${f.title}" from ${oldSeverity} to ${f.severity}`)
            }
          }
          await auditLog(auditId, 'speculative_demoted', 'info',
            `Demoted ${specResult.demoteIds.length} speculative finding${specResult.demoteIds.length > 1 ? 's' : ''} (had evidence grounding — kept with lower severity)`)
        }

        // Remove findings with no evidence grounding at all
        if (specResult.removeIds.length > 0) {
          for (const id of specResult.removeIds) idsToDelete.add(id)
          const totalBefore = findings.length
          findings = findings.filter(f => !idsToDelete.has(f.id))
          await auditLog(auditId, 'speculative_filtered', 'info',
            `Removed ${specResult.removeIds.length} speculative/unverifiable finding${specResult.removeIds.length > 1 ? 's' : ''}`)
          console.log(`[inngest] Speculative filter: removed ${specResult.removeIds.length} findings`)
          const removedRatio = totalBefore > 0 ? specResult.removeIds.length / totalBefore : 0
          if (specResult.removeIds.length >= 3 || removedRatio > 0.3) {
            auditLimitations.push({
              id: 'heavy_speculation_filtering',
              title: 'Quality filter applied',
              description: `Our quality filter removed ${specResult.removeIds.length} finding${specResult.removeIds.length > 1 ? 's' : ''} that could not be fully verified from the crawled content. We only report issues we can back with evidence from your site. If important areas seem under-reported, a re-audit with more pages may help.`,
            })
          }
        }
      }

      // ── 2b. Contradiction checker — cross-reference findings against hard evidence ───
      if (findings.length > 0) {
        try {
          // Build responsive evidence from parallel-site-checks step
          const responsiveEvidence = (responsiveCheck?.viewportIssues && responsiveCheck.viewportIssues.length > 0) ? {
            viewportIssues: responsiveCheck.viewportIssues as Array<{ viewport: string; width: number; type: string; title: string; description: string }>,
            hasMobileViewport: responsiveCheck.hasMobileViewport ?? false,
          } : null

          // Build page content evidence from crawl
          const headTagsRaw = crawlResult.headTags?.[0]?.headTags
          const pageContentEvidence = crawlResult.pageContent ? {
            textContent: crawlResult.pageContent,
            headTags: headTagsRaw ? JSON.stringify(headTagsRaw) : null,
          } : null

          const { contradictedIds, reasons } = checkContradictions(
            findings.map(f => ({ id: f.id, title: f.title, description: f.description, viewport: null, pageUrl: f.page_url })),
            responsiveEvidence,
            pageContentEvidence,
          )

          if (contradictedIds.length > 0) {
            for (const id of contradictedIds) idsToDelete.add(id)
            findings = findings.filter(f => !idsToDelete.has(f.id))
            await auditLog(auditId, 'contradiction_checked', 'info',
              `Removed ${contradictedIds.length} finding${contradictedIds.length > 1 ? 's' : ''} contradicted by hard evidence (responsive checker / DOM)`)
            console.log(`[inngest] Contradiction checker: removed ${contradictedIds.length} findings`)
            // Log individual reasons for debug
            for (const [id, reason] of Object.entries(reasons)) {
              console.log(`[inngest]   → ${id}: ${reason}`)
            }
          }
        } catch (err) {
          // Non-fatal — don't block pipeline if contradiction checker errors
          console.error('[inngest] Contradiction checker error (non-fatal):', err)
        }
      }

      // ── 2c. Fix history gate — suppress previously-fixed findings ───
      // Prevents trust-destroying inconsistency where audit says "open issue"
      // while Fix/Deploy says "was fixed before". Default: suppress matches.
      // Exception: deterministic evidence from automated checkers → reopened.
      if (findings.length > 0) {
        try {
          // Fetch workspace_id from audit
          const { data: auditForWs } = await db
            .from('audits')
            .select('workspace_id')
            .eq('id', auditId)
            .single()

          const workspaceId = (auditForWs as any)?.workspace_id
          if (workspaceId) {
            // Load issue families with fix_status indicating prior fix
            const { data: fixedFamilies } = await db
              .from('issue_families')
              .select('id, issue_key, title_canonical, category_key, fix_status, fix_updated_at, current_lifecycle_state, scope_signature')
              .eq('workspace_id', workspaceId)
              .in('fix_status', ['pending_verification', 'validated_fixed', 'implemented'])

            if (fixedFamilies && fixedFamilies.length > 0) {
              const gateResult = applyFixHistoryGate(
                findings.map(f => ({
                  id: f.id,
                  title: f.title,
                  description: f.description,
                  severity: f.severity,
                  page_url: f.page_url,
                  category_index: null, // not available in this context
                  confidence_level: f.confidence_level || null,
                  detection_source: f.detection_source || null,
                })),
                fixedFamilies as any,
              )

              // Remove suppressed findings
              if (gateResult.suppressedIds.length > 0) {
                for (const id of gateResult.suppressedIds) idsToDelete.add(id)
                findings = findings.filter(f => !idsToDelete.has(f.id))
                await auditLog(auditId, 'fix_history_gate', 'info',
                  `Suppressed ${gateResult.suppressedIds.length} finding${gateResult.suppressedIds.length > 1 ? 's' : ''} that match previously-fixed issues`)
                console.log(`[inngest] Fix history gate: suppressed ${gateResult.suppressedIds.length} findings`)
                // Log individual suppression reasons for debug
                for (const [id, reason] of Object.entries(gateResult.suppressionReasons)) {
                  console.log(`[inngest]   → ${id}: ${reason}`)
                }
              }

              // Mark reopened findings (genuine regression detected by automated checker)
              if (gateResult.reopenedIds.length > 0) {
                for (const id of gateResult.reopenedIds) {
                  batchUpdates.push({ id, updates: { finding_state: 'reopened' } })
                }
                await auditLog(auditId, 'fix_history_reopened', 'info',
                  `${gateResult.reopenedIds.length} finding${gateResult.reopenedIds.length > 1 ? 's' : ''} reopened — deterministic evidence of genuine regression`)
                console.log(`[inngest] Fix history gate: ${gateResult.reopenedIds.length} findings marked as reopened`)
              }
            }
          }
        } catch (err) {
          // Non-fatal — don't block pipeline if fix history gate errors
          console.error('[inngest] Fix history gate error (non-fatal):', err)
        }
      }

      // ── 2d. Structural ownership gate (P0 — LLM noise moat) ───
      // Deterministic instruments own structural truth (landmarks, form
      // labels, contrast, target size, headings, alt names, link/meta
      // presence). Drop LLM-sourced findings that trespass on those domains —
      // if the defect were real, axe/parser/responsive would have caught it.
      // Scoped to LLM sources ONLY, so instrument findings are never touched.
      // See docs/LLM_NOISE_ELIMINATION_PLAN.md.
      if (findings.length > 0) {
        const ownership = classifyStructuralOwnership(
          findings.map(f => ({
            id: f.id, title: f.title, description: f.description,
            detection_source: f.detection_source || null,
          })),
        )
        if (ownership.dropIds.length > 0) {
          for (const id of ownership.dropIds) idsToDelete.add(id)
          findings = findings.filter(f => !idsToDelete.has(f.id))
          await auditLog(auditId, 'structural_ownership_filtered', 'info',
            `Removed ${ownership.dropIds.length} LLM finding${ownership.dropIds.length > 1 ? 's' : ''} that claimed a structural issue owned by a deterministic check (landmark/label/contrast/target/heading/alt/link/meta)`)
          for (const [id, reason] of Object.entries(ownership.reasons)) {
            console.log(`[inngest] Structural ownership: dropped ${id} — ${reason}`)
          }
        }
      }

      // ── 2d-bis / 2d-ter. (Retired 2026-06-17) ────────────────
      // The per-symptom input-relevance and speculative-UX gates were removed
      // here. Compose (gate 2g) is permanently active and its general
      // definition-of-done judge — "drop interpretive findings not supported by
      // the page's evidence" — subsumes both: label/instruction findings on
      // non-input pages and speculative CTA-clarity claims are dropped by the
      // judge, without per-phrasing pattern-matching the LLM could rephrase past.

      // ── 2e. DOM verification gate (P1 — the durable moat) ───
      // Evidence-based version of 2d: any LLM finding asserting an element is
      // MISSING is checked against the rendered-DOM snapshot captured in the
      // browser pass. Drop it only if the DOM positively proves the element is
      // present (the LLM proposes, the DOM disposes). Per-page: a /contact
      // claim is checked against /contact's DOM. Never drops without positive
      // contradicting evidence. See docs/LLM_NOISE_ELIMINATION_PLAN.md.
      if (findings.length > 0) {
        const domFactsObj = (wcagCheck as any)?.domFacts as Record<string, DomFacts> | undefined
        const domByUrl = domFactsObj && Object.keys(domFactsObj).length > 0
          ? new Map<string, DomFacts>(Object.entries(domFactsObj))
          : null
        if (domByUrl) {
          const domVer = verifyFindingsAgainstDomByUrl(
            findings.map(f => ({
              id: f.id, title: f.title, description: f.description,
              detection_source: f.detection_source || null, page_url: f.page_url,
            })),
            domByUrl,
            crawlResult.crawledUrls?.[0] || null,
          )
          if (domVer.refutedIds.length > 0) {
            for (const id of domVer.refutedIds) idsToDelete.add(id)
            findings = findings.filter(f => !idsToDelete.has(f.id))
            await auditLog(auditId, 'dom_verification_filtered', 'info',
              `Removed ${domVer.refutedIds.length} LLM finding${domVer.refutedIds.length > 1 ? 's' : ''} whose "missing element" claim was refuted by the rendered DOM`)
            for (const [id, reason] of Object.entries(domVer.reasons)) {
              console.log(`[inngest] DOM verification: dropped ${id} — ${reason}`)
            }
          }
        }
      }

      // ── 2e-bis. Page-level contextual validation (Phase 1) ───
      // The deterministic moats above remove cheap false positives. This gate
      // catches the ones that need READING THE WHOLE PAGE: a finding that judged
      // a heading without reading the copy beneath it, a stale baseline headline
      // quoted as current, a "missing X" answered by a nearby section. Per page:
      // build full current-page context (body + DOM facts + industry/region) and
      // re-judge every finding. SUBTRACTIVE/SOFTENING ONLY — keep, lower, suppress,
      // or demote to needs-evidence; never invent, never raise. One model call per
      // page, prefiltered to skip all-verified-deterministic pages. Non-fatal:
      // on any error the findings pass through unchanged.
      if (findings.length > 0) {
        try {
          const cvDomFacts = (wcagCheck as any)?.domFacts as Record<string, DomFacts> | undefined
          const cvDomByUrl = cvDomFacts && Object.keys(cvDomFacts).length > 0
            ? new Map<string, DomFacts>(Object.entries(cvDomFacts))
            : null
          const contextValidatorCaller: ValidatorModelCaller = async ({ system, user }) => {
            const Anthropic = (await import('@anthropic-ai/sdk')).default
            const anthropic = new Anthropic({ timeout: 25_000 })
            const msg = await Promise.race([
              anthropic.beta.promptCaching.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1500,
                temperature: 0,
                system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
                messages: [{ role: 'user', content: user }],
              }),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error('context validation timed out')), 27_000)),
            ])
            return (msg as any).content
              ?.filter((b: any) => b.type === 'text')
              .map((b: any) => b.text)
              .join('') || ''
          }
          const cv = await validateFindingsInPageContext({
            findings: findings.map(f => ({
              id: f.id, title: f.title, description: f.description, severity: f.severity,
              page_url: f.page_url, confidence_level: f.confidence_level, detection_source: f.detection_source,
            })),
            pageContent: crawlResult?.pageContent || '',
            domByUrl: cvDomByUrl,
            profile: siteProfile,
            callModel: contextValidatorCaller,
          })

          // Suppress findings the model judged false in context.
          if (cv.idsToSuppress.length > 0) {
            for (const id of cv.idsToSuppress) idsToDelete.add(id)
            findings = findings.filter(f => !idsToDelete.has(f.id))
          }
          // Apply severity lowerings (already validated as strict downgrades).
          for (const { id, severity } of cv.severityUpdates) {
            const f = findings.find(ff => ff.id === id)
            if (f) {
              f.severity = severity
              batchUpdates.push({ id, updates: { severity } })
            }
          }
          // Demote unconfirmed findings to the "needs evidence" tier (never delete);
          // the severity≤evidence invariant below then caps them at LOW.
          for (const id of cv.confidenceDemotions) {
            const f = findings.find(ff => ff.id === id)
            if (f) {
              f.confidence_score = UNGROUNDED_CONFIDENCE
              f.confidence_level = 'heuristic'
              batchUpdates.push({ id, updates: { confidence_score: UNGROUNDED_CONFIDENCE, confidence_level: 'heuristic' } })
            }
          }
          if (cv.idsToSuppress.length > 0 || cv.severityUpdates.length > 0 || cv.confidenceDemotions.length > 0) {
            await auditLog(auditId, 'context_validation_applied', 'info',
              `Contextual validation across ${cv.pagesValidated} page(s): suppressed ${cv.idsToSuppress.length}, lowered ${cv.severityUpdates.length}, demoted ${cv.confidenceDemotions.length} (skipped ${cv.pagesSkipped} page(s) needing no judgment).`)
            for (const e of cv.auditTrail) {
              if (e.action !== 'kept') {
                console.log(`[context-validation] ${e.action} ${e.id}${e.fromSeverity ? ` ${e.fromSeverity}→${e.toSeverity}` : ''} — ${e.reason}`)
              }
            }
          }
        } catch (cvErr) {
          console.error('[quality-gates] Context validation error (non-fatal):', cvErr)
        }
      }

      // ── 2f. Evidence binding (P1 — grounding required) ───
      // Enforce the /methodology promise: an LLM finding with no verbatim quote
      // and no DOM selector is ungrounded. Demote it into the "Not enough
      // evidence" tier (lower confidence below the undetermined threshold); the
      // severity≤evidence invariant (4b, below) then caps it at LOW and off the
      // score cap. Visible but never inflated. See LLM_NOISE_ELIMINATION_PLAN.md.
      if (findings.length > 0) {
        const binding = identifyUngroundedFindings(
          findings.map(f => ({
            id: f.id, title: f.title, description: f.description,
            evidence: f.evidence ?? null, target_element: f.target_element ?? null,
            detection_source: f.detection_source || null,
          })),
        )
        if (binding.ungroundedIds.length > 0) {
          for (const f of findings) {
            if (binding.ungroundedIds.includes(f.id)) {
              f.confidence_score = UNGROUNDED_CONFIDENCE
              f.confidence_level = 'heuristic'
              batchUpdates.push({ id: f.id, updates: { confidence_score: UNGROUNDED_CONFIDENCE, confidence_level: 'heuristic' } })
            }
          }
          await auditLog(auditId, 'evidence_binding_demoted', 'info',
            `Demoted ${binding.ungroundedIds.length} ungrounded LLM finding${binding.ungroundedIds.length > 1 ? 's' : ''} to "Not enough evidence" (no verbatim quote or DOM selector)`)
        }
      }

      // ── 2g. COMPOSE (Stage 3) — general definition-of-done judge ───
      // Active only when COMPOSE_MODE=active (the symptom gates above are skipped
      // in that mode). Judges each interpretive finding against its page's
      // captured content: drops unevidenced speculation, re-grades wrong
      // severities. The general rule that replaces the per-symptom gates.
      // Fail-safe: any judge error keeps the finding (never silently deletes).
      if (findings.length > 0 && process.env.COMPOSE_MODE === 'active') {
        try {
          const pageContentByUrl: Record<string, string> = {}
          for (const block of (crawlResult.pageContent || '').split('\n---\n')) {
            const m = block.match(/URL:\s*(\S+)/)
            if (m && m[1]) pageContentByUrl[m[1]] = block
          }
          const Anthropic = (await import('@anthropic-ai/sdk')).default
          const anthropic = new Anthropic({ timeout: 25_000 })
          const judge = async (prompt: string): Promise<string> => {
            const msg = await anthropic.messages.create({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 200,
              messages: [{ role: 'user', content: prompt }],
            })
            return (msg.content.find((b: any) => b.type === 'text') as any)?.text || ''
          }
          const composeRes = await composeFindings(
            findings.map(f => ({
              id: f.id, title: f.title, description: f.description, recommendation: f.recommendation,
              estimated_impact: (f as any).estimated_impact ?? null, severity: f.severity,
              detection_source: f.detection_source || null, page_url: f.page_url,
              target_element: f.target_element ?? null, evidence: f.evidence ?? null,
            })),
            pageContentByUrl,
            judge,
          )
          const before = findings.length
          if (composeRes.droppedIds.length > 0) {
            for (const id of composeRes.droppedIds) idsToDelete.add(id)
            findings = findings.filter(f => !idsToDelete.has(f.id))
          }
          for (const f of findings) {
            const sev = composeRes.adjusted[f.id]
            if (sev) { f.severity = sev as any; batchUpdates.push({ id: f.id, updates: { severity: sev } }) }
          }
          await auditLog(auditId, 'compose_applied', 'info',
            `Compose: dropped ${composeRes.droppedIds.length}, re-graded ${Object.keys(composeRes.adjusted).length} of ${before} interpretive finding(s)`)
          for (const [id, reason] of Object.entries(composeRes.reasons)) {
            console.log(`[inngest] Compose: ${id} — ${reason}`)
          }
        } catch (composeErr) {
          console.warn('[quality-gates] Compose failed (non-fatal):', (composeErr as Error)?.message)
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

        // ── 4b. Severity ≤ evidence invariant (P0 — LLM noise moat) ───
        // Runs LAST, after every demotion, so it sees final severities. A
        // finding can never outrank its evidence tier — in particular a
        // "Not enough evidence" (undetermined) finding can never be HIGH/
        // critical or drive the score cap. Fixes the fixpath.ai case where a
        // low-confidence finding shipped as a score-capping HIGH.
        const sevClamps = enforceSeverityEvidenceInvariant(findings as any)
        if (sevClamps.length > 0) {
          for (const c of sevClamps) {
            const f = findings.find(ff => ff.id === c.id)
            if (f) f.severity = c.to
            batchUpdates.push({ id: c.id, updates: { severity: c.to } })
            console.log(`[inngest] Severity≤evidence: ${c.id} ${c.from}→${c.to} (evidence: ${c.evidence})`)
          }
          await auditLog(auditId, 'severity_evidence_clamped', 'info',
            `Clamped ${sevClamps.length} finding${sevClamps.length > 1 ? 's' : ''} whose severity exceeded its evidence tier (e.g. "Not enough evidence" can't be HIGH)`)
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
      // FILTER RATIO GUARD: Rescue highest-severity findings when
      // quality gates would remove an excessive proportion (≥80%).
      // This prevents the 0-findings → CLEAN_JITTER → 97/100 cascade
      // that makes every site look "Healthy — no issues found."
      // ══════════════════════════════════════════════════════════
      if (rawCount >= 5 && idsToDelete.size >= Math.ceil(rawCount * 0.8)) {
        // Sort deleted findings by severity (highest first) for rescue
        const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
        const SEVERITY_DEMOTION: Record<string, string> = { critical: 'high', high: 'medium', medium: 'low', low: 'low' }
        const deletedFindings = allQGFindings
          .filter((f: any) => idsToDelete.has(f.id))
          .sort((a: any, b: any) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0))

        const rescueCount = Math.max(3, Math.ceil(rawCount * 0.15))
        const rescued = deletedFindings.slice(0, rescueCount)

        for (const rf of rescued) {
          // Remove from delete set — this finding survives
          idsToDelete.delete(rf.id)

          // Demote severity by one level and mark as heuristic
          const demotedSeverity = SEVERITY_DEMOTION[rf.severity] || rf.severity
          batchUpdates.push({ id: rf.id, updates: { severity: demotedSeverity, confidence_level: 'heuristic' } })

          // Re-add to in-memory findings array with same shape
          findings.push({
            id: rf.id as string,
            title: (rf.title || '') as string,
            description: (rf.description || '') as string,
            recommendation: (rf.recommendation || '') as string,
            severity: demotedSeverity as string,
            page_url: (rf.page_url || null) as string | null,
            sort_order: (rf.sort_order ?? 0) as number,
            category_index: (rf.category_index ?? null) as number | null,
            confidence_level: 'heuristic' as ConfidenceLevel,
            detection_source: (rf.detection_source || 'analyzer') as DetectionSource,
            finding_type: (rf.finding_type || 'fixable') as string,
            fix_type: (rf.fix_type || null) as string | null,
            fix_payload: rf.fix_payload,
            target_element: (rf.target_element || null) as string | null,
            confidence_score: (rf.confidence_score ?? 0.5) as number,
            evidence: (rf.evidence ?? null) as string | null,
            viewport: (rf.viewport ?? null) as string | null,
          })
        }

        const rescuedSeverities = rescued.map((r: any) => r.severity).join(', ')
        console.warn(`[inngest] PIPELINE RESCUE: quality gates would delete ${idsToDelete.size + rescued.length}/${rawCount} findings (${Math.round((idsToDelete.size + rescued.length) / rawCount * 100)}%). Rescued ${rescued.length} highest-severity findings (${rescuedSeverities}), demoted by one level.`)
        await auditLog(auditId, 'pipeline_rescue', 'warning',
          `Quality gates would remove ${Math.round((idsToDelete.size + rescued.length) / rawCount * 100)}% of findings. Rescued ${rescued.length} findings (demoted severity) to preserve scoring accuracy.`)

        auditLimitations.push({
          id: 'excessive_quality_filtering',
          title: 'Quality filtering was aggressive',
          description: `Our quality pipeline flagged ${Math.round((idsToDelete.size + rescued.length) / rawCount * 100)}% of findings for removal. We rescued the ${rescued.length} most significant ones at reduced severity to ensure the score reflects real conditions. A re-audit with more pages may produce more confident results.`,
        })
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
      // Execute updates in CHUNKED batches — firing 100+ concurrent DB
      // requests exhausts the Supabase connection pool and can stall the
      // Node.js event loop, preventing setTimeout from firing (which breaks
      // withStepTimeout and causes the 45-minute stall bug).
      const updateEntries = [...mergedUpdates.entries()]
      const CHUNK_SIZE = 10
      for (let i = 0; i < updateEntries.length; i += CHUNK_SIZE) {
        const chunk = updateEntries.slice(i, i + CHUNK_SIZE)
        await Promise.all(
          chunk.map(([id, updates]) =>
            db.from('audit_findings').update(updates as any).eq('id', id)
          )
        )
      }

      // ── Pipeline instrumentation: snapshot findings after all gates ───
      const postCount = findings.length
      const postBySeverity = { critical: 0, high: 0, medium: 0, low: 0 } as Record<string, number>
      const postByConfidence = {} as Record<string, number>
      for (const f of findings) {
        postBySeverity[f.severity] = (postBySeverity[f.severity] || 0) + 1
        postByConfidence[f.confidence_level] = (postByConfidence[f.confidence_level] || 0) + 1
      }
      const removedCount = idsToDelete.size
      const updatedCount = batchUpdates.length
      await auditLog(auditId, 'pipeline_snapshot_post', 'info',
        `Post-gates: ${postCount} findings (${rawCount - removedCount - postCount} filtered inline, ${removedCount} deleted) | severity: ${JSON.stringify(postBySeverity)} | confidence: ${JSON.stringify(postByConfidence)} | ${updatedCount} updates applied`,
      )

      // ── 7. Verify findings count ───
      if (findings.length === 0) {
        console.warn(`[inngest] Audit ${auditId}: zero findings — continuing`)
        await auditLog(auditId, 'findings_warning', 'warning', 'Zero findings — site may be clean or all issues resolved')
      } else {
        await auditLog(auditId, 'findings_verified', 'success', `${findings.length} findings verified`)
      }
      await setProgress(auditId, stageProgress('quality_gates', 1))
      await logStageCompleted(auditId, 'quality_gates', `Quality gates passed in ${Math.round((Date.now() - qgStart) / 1000)}s`)
      }, 60_000, 'quality-gates', null as any)
      // FALLBACK = null → withStepTimeout returns null on timeout instead
      // of throwing. The pipeline continues without quality gates.
      // Findings remain as-is from the analysis step — no dedup, no scoring,
      // no speculative filter. This is safe: those are polish operations.
    })
    } // end isPastDeadline else

    // ──────────────────────────────────────────────────────────
    // STEP 7b: Re-audit reconciliation
    // ──────────────────────────────────────────────────────────
    let reconciliationData: ReconciliationResult | null = null
    if (siteContext.previousRawFindings.length > 0) {
      if (isPastDeadline()) {
        console.warn(`[inngest] PIPELINE DEADLINE: Skipping reconcile-findings (${Math.round((Date.now() - pipelineStartTime) / 1000)}s elapsed)`)
        await auditLog(auditId, 'deadline_skip', 'warning', 'Reconciliation skipped — pipeline deadline reached. Re-audit findings used as-is.')
      } else {
      reconciliationData = await step.run('reconcile-findings', async () => {
        return withStepTimeout(async () => {
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
        if (crawlResult.crawledUrls) {
          for (const u of crawlResult.crawledUrls) crawledUrls.add(u)
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
        }, 90_000, 'reconcile-findings', null as any)
        // ↑ Increased from 60s→90s: deep re-audits produce many findings to reconcile.
        // Added null fallback so timeout degrades gracefully instead of killing the audit.
      })
      } // end isPastDeadline else for reconcile-findings
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

    if (isPastDeadline()) {
      console.warn(`[inngest] PIPELINE DEADLINE: Skipping canonical-reconciliation (${Math.round((Date.now() - pipelineStartTime) / 1000)}s elapsed)`)
      await auditLog(auditId, 'deadline_skip', 'warning', 'Canonical reconciliation skipped — pipeline deadline reached.')
    } else {
    canonicalScoring = await step.run('canonical-reconciliation', async () => {
      return withStepTimeout(async () => {
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
      }, 30_000, 'canonical-reconciliation', null as any)
      // ↑ Added null fallback — canonical reconciliation is non-fatal.
    })
    } // end isPastDeadline else for canonical-reconciliation

    // ──────────────────────────────────────────────────────────
    // STEP 8: Generate report (screenshots moved to enrichment)
    // Hard 180s timeout — prevents the step from consuming the
    // full 300s Vercel budget and leaving no time for recovery.
    // ──────────────────────────────────────────────────────────
    await step.run('generate-report', async () => {
      await withStepTimeout(async () => {
      const db = getDb()

      // AGE GUARD REMOVED — withStepTimeout on every step + stall sweeper
      // provides the same protection without false-killing queued/replayed audits.

      try {
      await logStageStarted(auditId, 'reporting', 'Generating report...')
      await logActivity(auditId, 'Writing executive summary and calculating scores...')
      await setStatus(auditId, 'generating_report', stageProgress('reporting', 0))
      await setProgress(auditId, stageProgress('reporting', 0), 'reporting')
      const reportStepStart = Date.now()
      console.log(`[inngest] Audit ${auditId} entered generate-report step at ${new Date().toISOString()}`)
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

      // ── Narrative generation with deterministic fallback (2026-06-10) ──
      // The AI narrative is garnish — the findings are the product. If the
      // narrative call fails or hangs, fall back to calculateScoresFromFindings
      // (same deterministic scoring formula, template summary) and SHIP the
      // report. An audit with verified findings must never die because the
      // essay writer hiccuped. Refunds are reserved for "we have nothing".
      let reportData: ReturnType<typeof calculateScoresFromFindings> | null = null
      let narrativeDegraded = false
      try {
        // NOTE: local withTimeout swallows errors and resolves null — both the
        // null result and any thrown error route to the same fallback below.
        reportData = await withTimeout(
          generateReport(
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
          ),
          90_000,
          'generate-report-narrative',
        )
      } catch (narrativeErr) {
        console.error(`[inngest] Narrative generation threw for audit ${auditId}:`,
          narrativeErr instanceof Error ? narrativeErr.message : narrativeErr)
        reportData = null // fall through to deterministic fallback below
      }
      if (!reportData) {
        narrativeDegraded = true
        console.error(`[inngest] Narrative generation failed/timed out for audit ${auditId} — using deterministic fallback from ${findings.length} verified findings`)
        await auditLog(auditId, 'report_narrative_fallback', 'warning',
          `AI narrative failed or timed out — report built deterministically from ${findings.length} verified findings instead.`)
        const fallbackPages = (audit as any)?.crawl_summary?.pages_analyzed ?? (audit as any)?.pages_crawled ?? 0
        reportData = calculateScoresFromFindings(findings, auditDetails.language, fallbackPages)
        auditLimitations.push({
          id: 'narrative_degraded',
          title: 'Executive summary simplified',
          description: 'The AI-written executive summary could not be generated for this run. Scores and findings are complete and verified — only the narrative text uses a simplified format.',
        })
      }

      // ── Heartbeat: report narrative complete → 85% ──
      console.log(`[inngest] Audit ${auditId} generateReport() returned in ${Date.now() - reportStepStart}ms${narrativeDegraded ? ' (deterministic fallback — AI narrative failed)' : ''}`)
      await setProgress(auditId, stageProgress('reporting', 0.4))

      // ── SCORE FROM DB (2026-06-12) ────────────────────────────
      // Deterministic steps (wcag/responsive/pagespeed) insert findings
      // directly into the DB — the in-memory `findings` array never
      // contains them. The stored report under-counted severities and
      // scored 72 while every live surface recomputed 55 from the DB
      // (first exposed when WCAG findings landed for the first time).
      // The DB is the single source of truth for counts and the cap.
      const { data: dbFindingRows } = await db
        .from('audit_findings')
        .select('severity, confidence_level, confidence_score, finding_type')
        .eq('audit_id', auditId)
        .eq('dismissed', false)
        .in('status', ['open', 'in_progress'])
      const scoringFindings: Array<{ severity: string; confidence_level?: string | null; confidence_score?: number | null; finding_type?: string | null }> =
        (dbFindingRows as any[] | null) ?? findings
      // Nominal severity counts (what findings exist) — match the dashboard card.
      const severityCount = {
        critical: scoringFindings.filter((f) => f.severity === 'critical').length,
        high: scoringFindings.filter((f) => f.severity === 'high').length,
        medium: scoringFindings.filter((f) => f.severity === 'medium').length,
        low: scoringFindings.filter((f) => f.severity === 'low').length,
      }
      // Score cap uses the scoring-severity rule (Verified drives; AI-assessed
      // capped at medium; strategic excluded) — same source as the overview, so
      // the stored score agrees with the live dashboard. Can only lower the score.
      const dbCapResult = applyScoringSeverityCap(reportData.overallScore, scoringFindings)
      if (dbCapResult.overall < reportData.overallScore) {
        console.log(`[inngest] Score re-capped from DB findings: ${reportData.overallScore} → ${dbCapResult.overall} (${dbCapResult.capInfo.reason})`)
        reportData.overallScore = dbCapResult.overall
        // Replace any stale cap sentence written from the in-memory view
        reportData.executiveSummary = reportData.executiveSummary
          .replace(/ The overall score is currently capped at [^.]*\.?/g, '')
          .trimEnd() + capSummarySentence(dbCapResult.capInfo)
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

      // ── Heartbeat: PDF generation done → 87% ──
      await setProgress(auditId, stageProgress('reporting', 0.6))

      // Calculate AI Visibility Score from all Phase 1 + 2 data
      const aiVisibility = calculateAIVisibilityScore({
        structuredData: structuredDataResult.typesFound?.length > 0
          ? { typesFound: structuredDataResult.typesFound, findings: [], totalBlocks: structuredDataResult.typesFound.length, validBlocks: structuredDataResult.typesFound.length, invalidBlocks: 0 }
          : null,
        llmProbe: llmProbeResult?.session || null,
        aiDiscovery: aiDiscovery.result || null,
        headTags: crawlResult.headTags || [],
      })

      // Override the AI discoverability score with the real AI Visibility Score
      reportData.aiDiscoverabilityScore = aiVisibility.overall

      // ── Brand Consistency (§10) — declared Brand DNA vs observed site ──
      // Own score, stored in raw_json.brandConsistency (NO migration — JSONB).
      // Colours are deterministic (measured palette from the WCAG pass vs the
      // declared primary_colors); voice/tone is quote-grounded + verified.
      // It NEVER feeds the health score. (Double-surfacing trust-harming
      // mismatches into the health-affecting findings stream is a v1.1
      // follow-up — needs a detection_source migration + pre-scoring placement.)
      let brandConsistency: BrandConsistencyResult | null = null
      try {
        if (auditDetails.brandIdentityId) {
          const { data: bi, error: biErr } = await db
            .from('brand_identities')
            .select('primary_colors, brand_voice, tone_keywords, include_in_audits')
            .eq('id', auditDetails.brandIdentityId)
            .single()
          if (biErr) {
            console.warn('[brand-consistency] brand_identities fetch failed:', biErr.message)
          } else if (bi && (bi as any).include_in_audits === false) {
            // Per-brand opt-out — skip Brand Consistency entirely.
          } else if (bi) {
            const declared = {
              colors: Array.isArray((bi as any).primary_colors) ? (bi as any).primary_colors as string[] : [],
              voice: (bi as any).brand_voice || null,
              toneKeywords: Array.isArray((bi as any).tone_keywords) ? (bi as any).tone_keywords as string[] : [],
            }
            const hasVoiceDecl = !!(declared.voice && declared.voice.trim()) || declared.toneKeywords.length > 0
            const voiceContradictions = hasVoiceDecl
              ? await detectVoiceContradictions(declared, crawlResult.pageContent)
              : []
            brandConsistency = compareBrandConsistency(declared, {
              colors: wcagCheck?.siteColors || [],
              voiceContradictions,
            })
            await auditLog(auditId, 'brand_consistency_computed', 'info',
              `Brand Consistency: ${brandConsistency.score}/100 · ${brandConsistency.mismatches.length} mismatch(es) · checked: ${brandConsistency.attributesChecked.join(', ') || 'none'}`,
              { score: brandConsistency.score, mismatches: brandConsistency.mismatches.length, observed_colors: (wcagCheck?.siteColors || []).length })
          }
        }
      } catch (bcErr) {
        console.error('[inngest] Brand Consistency computation failed (non-fatal):', bcErr)
      }

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
        brandConsistency: brandConsistency || undefined,
        // P3 — persist the verified DOM snapshot (JSONB, no migration) for the
        // trend, debugging, and future model grounding.
        domFacts: (wcagCheck as any)?.domFacts || undefined,
      }

      // Insert report
      const { error: mainReportInsertError } = await db.from('reports').insert({
        audit_id: auditId,
        executive_summary: reportData.executiveSummary,
        key_recommendation: reportData.keyRecommendation,
        total_issues: scoringFindings.length,
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
      if (mainReportInsertError) {
        throw new Error(`Report insert FAILED — audit must not complete without a report: ${mainReportInsertError.message}`)
      }

      // ── Heartbeat: report inserted into DB → 89% ──
      console.log(`[inngest] Audit ${auditId} report DB insert complete in ${Date.now() - reportStepStart}ms`)
      await setProgress(auditId, stageProgress('reporting', 0.9))

      await logStageCompleted(auditId, 'reporting', 'Report generated', {
        total_issues: scoringFindings.length,
        ...severityCount,
        has_pdf: !!pdfUrl,
      })
      await auditLog(auditId, 'report_generated', 'success', 'Report generated', {
        total_issues: scoringFindings.length,
        ...severityCount,
        has_pdf: !!pdfUrl,
      })

      } catch (reportErr) {
        // CRITICAL: Report generation failed. Log the error and re-throw so the
        // outer catch handler can refund the credit and mark the audit as failed.
        // Do NOT swallow this error — without a report row in the DB, the audit
        // is unusable and should not be marked completed_with_warnings.
        const errMsg = reportErr instanceof Error ? reportErr.message : String(reportErr)
        console.error(`[inngest] Report generation failed for audit ${auditId}:`, reportErr)
        await logStageFailed(auditId, 'reporting', 'Report generation failed', errMsg.slice(0, 300))
        await auditLog(auditId, 'report_failed', 'error', `Report generation failed: ${errMsg.slice(0, 200)}`)
        throw reportErr // Let outer catch handle refund + status
      }
      }, 180_000, 'generate-report')
    })

    // ──────────────────────────────────────────────────────────
    // Phase 2 #2 — Regression alerts (MONITORING runs only).
    // A scheduled re-audit compares to the previous run and records what got
    // WORSE (score drop / new high+critical / AI answer flip) into audit_alerts
    // for the in-app feed + email. Gated on the monitoring marker so manual
    // audits the user is already watching don't generate alert noise.
    // ──────────────────────────────────────────────────────────
    if (auditDetails.userFocus === 'Scheduled monitoring re-audit') {
      await step.run('monitoring-alerts', async () => {
        return withStepTimeout(async () => {
          const db = getDb()
          const { data: curRows } = await db
            .from('audit_findings')
            .select('title, severity')
            .eq('audit_id', auditId)
            .eq('dismissed', false)
            .in('status', ['open', 'in_progress'])
          const { data: rep } = await db
            .from('reports')
            .select('overall_score')
            .eq('audit_id', auditId)
            .single()
          const res = await persistRegressionAlerts(db, {
            userId: auditDetails.userId,
            workspaceId: auditDetails.workspaceId,
            auditId,
            productUrl: auditDetails.productUrl,
            previousScore: siteContext.previousOverallScore || null,
            currentScore: (rep as any)?.overall_score ?? 0,
            previousFindings: siteContext.previousRawFindings.map((f: any) => ({ title: f.title, severity: f.severity })),
            currentFindings: ((curRows as any[]) || []).map((f) => ({ title: f.title, severity: f.severity })),
          })
          if (res.created > 0) {
            await auditLog(auditId, 'monitoring_alerts_created', 'info',
              `${res.created} regression alert${res.created > 1 ? 's' : ''}: ${res.alerts.map((a) => a.type).join(', ')}`)
            // Email the user (best-effort; non-fatal if Resend is unconfigured).
            if (auditDetails.userEmail) {
              try {
                await sendRegressionAlertEmail(
                  auditDetails.userEmail,
                  auditDetails.productUrl,
                  res.alerts.map((a) => ({ level: a.level, title: a.title, body: a.body })),
                )
              } catch (mailErr) {
                console.error('[monitoring-alerts] email send failed (non-fatal):', mailErr)
              }
            }
          }
          return res.created
        }, 20_000, 'monitoring-alerts')
      })
    }

    // ──────────────────────────────────────────────────────────
    // STEP 10: COMPLETE AUDIT — runs BEFORE enrichment
    // The audit reaches a terminal state regardless of whether
    // enrichment succeeds, stalls, or gets killed by Vercel.
    // This is the ROOT FIX for audits stalling at 90%.
    // ──────────────────────────────────────────────────────────
    await step.run('complete', async () => {
      return withStepTimeout(async () => {
      const db = getDb()

      // ── checks_executed (computed at pipeline end — ground truth) ──────
      // Drives the 'Checks run' trust strip. Computed HERE, not in the
      // site-checks step, because the in-step `ran` flags are unreliable
      // under timeout (a browser check that exceeds budget returns a
      // fallback even though it completed and inserted findings). These
      // signals survive timeouts and Inngest memoization:
      //   • audit_logs *_check_completed events — emitted by each check at
      //     real completion, regardless of what the step returned
      //   • distinct detection_source on persisted findings
      //   • SEO always (a successful crawl means head-tag/crawler ran)
      // computeChecksRun() in the trust layer prefers this list; the
      // findings-derived path stays as the fallback for older audits.
      try {
        const checks = new Set<string>(['SEO'])
        const { data: completionLogs } = await db
          .from('audit_logs')
          .select('event')
          .eq('audit_id', auditId)
          .in('event', ['responsive_check_completed', 'wcag_check_completed', 'pagespeed_completed'])
        for (const row of (completionLogs || []) as any[]) {
          if (row.event === 'responsive_check_completed') checks.add('Responsive')
          else if (row.event === 'wcag_check_completed') checks.add('WCAG')
          else if (row.event === 'pagespeed_completed') checks.add('Performance')
        }
        const { data: srcRows } = await db
          .from('audit_findings')
          .select('detection_source')
          .eq('audit_id', auditId)
        for (const row of (srcRows || []) as any[]) {
          switch (row.detection_source) {
            case 'responsive_checker': checks.add('Responsive'); break
            case 'wcag_checker': checks.add('WCAG'); break
            case 'axe': checks.add('WCAG'); break
            case 'pagespeed_api': checks.add('Performance'); break
            case 'structured_data': checks.add('Schema'); break
          }
        }
        // Structured-data probe returns reliably (not subject to the
        // site-checks race) — covers a clean schema run with no findings.
        if (structuredDataResult?.ran) checks.add('Schema')

        const ORDER = ['SEO', 'Responsive', 'Performance', 'WCAG', 'Schema']
        const checksExecuted = ORDER.filter((c) => checks.has(c))
        const { data: aRow } = await db.from('audits').select('crawl_summary').eq('id', auditId).single()
        const mergedSummary = { ...((aRow as any)?.crawl_summary || {}), checks_executed: checksExecuted }
        const { error: ceErr } = await db
          .from('audits')
          .update({ crawl_summary: mergedSummary } as any)
          .eq('id', auditId)
        if (ceErr) {
          await auditLog(auditId, 'checks_executed_persist_failed', 'warning',
            `Could not persist checks_executed: ${ceErr.message}`)
        }
      } catch (ceCatch) {
        console.error('[inngest] checks_executed computation failed (non-fatal):', ceCatch)
      }

      // ── The Verdict — honest, plain-language top-level judgment (dark launch) ──
      // The hero of the report: a senior-consultant verdict (industry standing,
      // value-prop clarity, service findability, the 2-4 things costing customers,
      // each pinned to an exact location). Stored on the report; non-fatal.
      try {
        if (getFeatureFlags().verdict && crawlResult?.pageContent) {
          const homepageBlock = crawlResult.pageContent.split('\n---\n')[0] || crawlResult.pageContent.slice(0, 4000)
          let industry = siteProfile?.industryVertical || ''
          let audience = siteProfile?.targetAudience || null
          if (!industry) {
            try {
              const sp = await detectSiteProfile(crawlResult.pageContent, auditDetails.productUrl)
              industry = sp?.industryVertical || 'General'
              audience = sp?.targetAudience || null
            } catch { industry = 'General' }
          }
          const { data: vfRows } = await db.from('audit_findings')
            .select('detection_source').eq('audit_id', auditId).neq('status', 'fixed')
          const vrows = (vfRows || []) as Array<{ detection_source: string | null }>
          const countSrc = (srcs: string[]) => vrows.filter((r) => srcs.includes(r.detection_source || '')).length
          const verdict = await generateVerdict({
            url: auditDetails.productUrl,
            industry,
            audience,
            homepageContent: homepageBlock,
            signals: {
              mobileIssues: countSrc(['responsive_checker']),
              slowOnMobile: countSrc(['pagespeed_api']) > 0,
              accessibilityIssues: countSrc(['wcag_checker', 'axe']),
              searchVisibilityIssues: countSrc(['structured_data']),
              detectedValueProp: null,
            },
          })
          if (verdict) {
            const { data: vRep } = await db.from('reports').select('raw_json').eq('audit_id', auditId).single()
            const merged = { ...((vRep as { raw_json?: Record<string, unknown> } | null)?.raw_json || {}), verdict }
            await db.from('reports').update({ raw_json: merged } as any).eq('audit_id', auditId)
            await auditLog(auditId, 'verdict_generated', 'info', `Verdict: ${verdict.headline}`,
              { confidence: verdict.confidence, points: verdict.points.length })
          }
        }
      } catch (verdictErr) {
        console.error('[process-audit] verdict generation failed (non-fatal):', verdictErr)
      }

      // ── Phase 3 — Re-audit fix detection (auto-verify on re-audit) ──
      // If the user fixed something and re-audited WITHOUT marking it, a
      // previously-open deterministic finding that's now gone — on a page we
      // actually re-analyzed (crawl_status='success') — is proven fixed, the
      // same standard as a manual single-page re-check. Flag-gated,
      // coverage-guarded (no false "fixed"), deduped against the manual path,
      // and fully non-fatal: it can never affect audit completion.
      try {
        if (getFeatureFlags().fixOutcomes) {
          const { data: auditRow } = await db.from('audits')
            .select('previous_audit_id, workspace_id, user_id')
            .eq('id', auditId).single()
          const priorAuditId = (auditRow as any)?.previous_audit_id as string | null
          if (priorAuditId) {
            const { data: priorRows } = await db.from('audit_findings')
              .select('id, audit_id, page_url, detection_source, confidence_level, status, dismissed, severity, title, target_element, performance_metric_type, evidence, issue_family_id, created_at')
              .eq('audit_id', priorAuditId)
              .eq('status', 'open')
              .eq('confidence_level', 'deterministic')
            if (priorRows && priorRows.length > 0) {
              const [freshRes, pageRes] = await Promise.all([
                db.from('audit_findings')
                  .select('page_url, detection_source, title, target_element, performance_metric_type')
                  .eq('audit_id', auditId),
                db.from('audit_pages').select('url').eq('audit_id', auditId).eq('crawl_status', 'success'),
              ])
              const priorIds = (priorRows as any[]).map((f) => f.id)
              const { data: existingOutcomes } = await db.from('fix_outcomes')
                .select('finding_id').in('finding_id', priorIds)
              const resolved = detectReauditResolvedFixes({
                priorFindings: priorRows as any,
                freshFindings: (freshRes.data || []) as any,
                coveredPageUrls: ((pageRes.data || []) as any[]).map((p) => p.url).filter(Boolean),
                workspaceId: (auditRow as any)?.workspace_id ?? null,
                userId: (auditRow as any)?.user_id ?? null,
                verifiedAt: new Date().toISOString(),
                alreadyRecordedFindingIds: ((existingOutcomes || []) as any[]).map((o) => o.finding_id),
                newAuditId: auditId,
              })
              let wrote = 0
              for (const r of resolved) {
                const w = await insertChecked(db, 'fix_outcomes', r.row as any, { label: 'reaudit-fix-detection', auditId })
                if (w.ok) {
                  wrote++
                  await db.from('audit_findings').update({ verified_fixed_at: r.row.verified_at } as any).eq('id', r.priorFindingId)
                  if (r.issueFamilyId) {
                    await db.from('issue_families').update({ fix_status: 'validated_fixed', fix_updated_at: r.row.verified_at } as any).eq('id', r.issueFamilyId)
                  }
                }
              }
              if (resolved.length > 0) {
                await auditLog(auditId, 'reaudit_fixes_verified', wrote > 0 ? 'success' : 'info',
                  `Re-audit auto-verified ${wrote} fix(es) resolved since the previous audit`,
                  { detected: resolved.length, wrote, prior_audit_id: priorAuditId })
              }
            }
          }
        }
      } catch (reauditFixErr) {
        console.error('[inngest] re-audit fix detection failed (non-fatal):', reauditFixErr)
      }

      // ATOMIC: Set status + completed_at in ONE call.
      // Previously these were two separate DB calls — if the second failed,
      // the audit had status='completed' but completed_at=NULL, which sorts
      // LAST in PostgREST DESC ordering, hiding re-audits behind the original.
      const now = new Date().toISOString()
      const { error: completeErr } = await Promise.race([
        db.from('audits').update({
          status: 'completed',
          progress_percent: 100,
          completed_at: now,
          updated_at: now,
        } as any).eq('id', auditId),
        new Promise<{ error: { message: string } }>((resolve) =>
          setTimeout(() => resolve({ error: { message: 'complete-update timed out after 10s' } }), 10_000)
        ),
      ])
      if (completeErr) throw new Error(`Failed to complete audit: ${completeErr.message}`)
      await setProgress(auditId, stageProgress('complete', 1), 'complete')
      await logPipelineCompleted(auditId, Date.now() - pipelineStartTime)

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
      }, 30_000, 'complete')
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
      // LEAN PIPELINE: Skip — saves 7 Haiku calls (1 per model for sentiment extraction)
      // CRITICAL: Do NOT use IIFE here. These must be lazy functions, not
      // immediately-invoked promises. If they start at t=0 with the fast
      // Wave 1 tasks, they run in the background consuming Vercel time,
      // and withTimeout can only abandon the await — not stop the work.
      const brandIntelFn = async () => {
        const leanFlags = getFeatureFlags()
        if (leanFlags.leanPipeline) {
          console.log('[inngest] LEAN PIPELINE: Skipping brand intelligence sentiment analysis')
          return
        }
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
      // LEAN PIPELINE: Skip — saves external API calls and fragile dependencies
      const humanPerceptionFn = async () => {
        const leanFlags = getFeatureFlags()
        if (leanFlags.leanPipeline) {
          console.log('[inngest] LEAN PIPELINE: Skipping human perception analysis')
          return
        }
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
                viewport: finding.viewport || null,
                confidence_level: 'interpretive', detection_source: 'analyzer',
                communication: buildCommunicationForGenericFinding({ title: finding.title, description: finding.description, recommendation: finding.recommendation, estimatedImpact: finding.estimatedImpact || null, severity: finding.severity }, siteProfile),
              })
              totalInserted++
            }
          }
          if (minFindingInserts.length > 0) {
            await insertFindingsChecked(db, auditId, minFindingInserts, 'minimum-findings')
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
            const { error: uncheckedInsertErr5 } = await db.from('predictive_recommendations').insert(inserts as any)
            if (uncheckedInsertErr5) console.error(`[db] insert failed (predictive_recommendations): ${uncheckedInsertErr5.message}`)
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
            .select('id, title, severity, target_element, page_url, confidence_level, detection_source')
            .eq('audit_id', auditId)
            .order('sort_order', { ascending: true })

          const findingsToCapture = (findingsWithTargets || []).map((f: any) => ({
            id: f.id as string,
            title: f.title as string,
            severity: f.severity as string,
            targetElement: f.target_element as string | null,
            pageUrl: f.page_url as string | null,
            confidenceLevel: f.confidence_level as string | null,
            detectionSource: f.detection_source as string | null,
          }))

          const mainUrl = crawlResult.firstPageUrl || auditDetails.productUrl

          const { pageScreenshots, findingScreenshots } = await captureAuditScreenshots(
            findingsToCapture,
            mainUrl,
            auditId,
            5, // 2026-06-13: reverted 8→5 — 8 pushed capture past the 25s SCREENSHOT_TIMEOUT in enrichment Wave 2, abandoning ALL screenshots. 5 fits the budget. Prioritisation (severity-first) keeps high-severity covered.
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
      // Top-level failure handler: decide between completed_with_warnings and failed.
      // CRITICAL: Check for report existence — not just status — because the
      // generate-report step may have inserted a report row before timing out.
      // Setting "failed" when a report exists loses the user's data and incorrectly
      // refunds credit. The finally block can't fix this because "failed" is terminal.
      console.error(`[inngest] Audit ${auditId} FAILED:`, err)
      try {
        const db = getDb()
        const { data: auditCheck } = await db
          .from('audits')
          .select('status, progress_percent')
          .eq('id', auditId)
          .single()
        const currentStatus = (auditCheck as any)?.status as string
        const currentProgress = (auditCheck as any)?.progress_percent as number ?? 0
        if (currentStatus === 'completed' || currentStatus === 'completed_with_warnings') {
          // Audit already completed — this error is from post-completion enrichment, non-fatal
          console.warn(`[inngest] Audit ${auditId} already ${currentStatus} — ignoring post-completion error`)
        } else {
          // Check if a report row exists — the generate-report step may have
          // inserted one before the timeout/error fired. If so, the audit has
          // usable data and should be completed_with_warnings, not failed.
          const { data: reportCheck } = await db
            .from('reports')
            .select('id')
            .eq('audit_id', auditId)
            .maybeSingle()
          const hasReport = !!reportCheck

          if (hasReport) {
            // Report exists — complete with warnings, don't refund
            console.warn(`[inngest] Audit ${auditId} failed at status=${currentStatus} progress=${currentProgress}% but report EXISTS — completing with warnings`)
            await db.from('audits').update({
              status: 'completed_with_warnings',
              progress_percent: 100,
              audit_stage: 'complete',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as any).eq('id', auditId)
            await logPipelineCompleted(auditId, Date.now() - pipelineStartTime)
            await auditLog(auditId, 'audit_completed_with_warnings', 'warning',
              'Audit completed with warnings — report was generated but pipeline failed during finalization.')
          } else {
            // No report — truly failed, refund credit
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
            // Check if a report row actually exists in the DB — don't rely on progress %
            // (progress=82 means reporting STARTED, not that the report was written)
            const { data: reportCheck } = await db
              .from('reports')
              .select('id')
              .eq('audit_id', auditId)
              .maybeSingle()
            const hasReport = !!reportCheck
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
              // CRITICAL: Refund credit when safety net forces audit to failed.
              // Without this, users lose their credit on pipeline exits that
              // bypass the outer catch (e.g., process killed between Inngest steps).
              await refundCredit(auditId)
              await logPipelineFailed(auditId, `Pipeline exited with non-terminal status: ${status}`)
              await logActivity(auditId, 'Audit failed — pipeline exited without producing a report. Credit refunded.')
            }
          }
        }
      } catch (safetyErr) {
        console.error(`[inngest] Safety net error for ${auditId}:`, safetyErr)
      }
    }
  },
)
