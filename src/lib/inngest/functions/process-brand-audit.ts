// ============================================================
// ClearUX — Inngest Brand Identity Audit Processing Function
// Pipeline for analyzing uploaded brand materials.
//
// Steps:
//   1. fetch-audit             — Load audit + brand identity details
//   2. snapshot-files          — Record which files are being analyzed
//   3. extract-files           — Extract text/visual content from files
//   4. analyze-categories      — AI analysis across 7 brand categories
//   5. deduplicate-findings    — PROPRIETARY: merge near-duplicate findings
//   6. filter-speculative      — PROPRIETARY: remove unverifiable findings
//   7. score-relevance         — PROPRIETARY: score by historical dismiss rate
//   8. generate-report         — Executive summary + scores
//   9. pipeline-learn          — PROPRIETARY: record patterns + run learning
//  10. complete                — Mark done, send email
//
// NOTE: Steps 5-7 and 9 use the same proprietary pipeline as
// regular UX audits (src/lib/audit-engine/pipeline/). Each audit
// type calls these functions independently — no shared runtime
// state. They write to the same learning tables (finding_patterns,
// global_quality_stats) which is additive by design.
// ============================================================

import { inngest } from '../client'
import { createServiceSupabase } from '@/lib/supabase-server'
import { extractAllBrandFiles, type ExtractedContent } from '@/lib/audit-engine/brand-file-extractor'
import {
  analyzeAllBrandCategories,
  generateBrandExecutiveSummary,
  buildBrandReport,
  type BrandCategoryResult,
} from '@/lib/audit-engine/brand-analyzer'
import { BRAND_AUDIT_CATEGORIES } from '@/lib/brand-audit-modules'
import { sendAuditComplete } from '@/lib/audit-engine/email'
import {
  identifyDuplicates,
  identifySpeculativeFindings,
  scoreFindings,
  recordFindingShown,
  recordAuditStats,
  postAuditLearn,
  classifyFinding,
  validateFixableRecommendation,
} from '@/lib/audit-engine/pipeline'
import { buildCommunicationForGenericFinding } from '@/lib/audit-engine/pipeline/communication-layer'

/* ── DB helpers ── */

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

async function setProgress(auditId: string, progressPercent: number) {
  const db = getDb()
  const { error } = await db
    .from('audits')
    .update({ progress_percent: progressPercent, updated_at: new Date().toISOString() } as any)
    .eq('id', auditId)
  if (error) console.error(`[inngest:brand] progress update error:`, error.message)
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
    console.error('[inngest:brand] log error:', err)
  }
}

/* ── Refund credit helper ── */
async function refundCredit(auditId: string) {
  try {
    const db = getDb()
    const { data: payment } = await db
      .from('payments')
      .select('user_id, stripe_payment_intent_id')
      .eq('audit_id', auditId)
      .single()

    if (!payment) return

    const paymentId = (payment as any).stripe_payment_intent_id as string
    const userId = (payment as any).user_id as string

    if (paymentId.startsWith('credit_') || paymentId.startsWith('free_first_')) {
      if (paymentId.startsWith('credit_')) {
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
    console.error('[inngest:brand] Refund error (non-fatal):', err)
  }
}

/* ── Stall protection helper ── */

/** How long any single step can run before we consider it stalled (15 minutes) */
const STEP_TIMEOUT_MS = 15 * 60 * 1000

/** Wrap an async operation with a timeout. Throws if the operation takes too long. */
async function withTimeout<T>(label: string, ms: number, fn: () => Promise<T>): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Step "${label}" timed out after ${Math.round(ms / 1000)}s`)), ms),
    ),
  ])
}

/* ── The Inngest function ── */

export const processBrandAuditFn = inngest.createFunction(
  {
    id: 'process-brand-audit',
    retries: 0,
    concurrency: { limit: 3 },
    triggers: [{ event: 'brand-audit/process' as const }],
  },
  async ({ event, step }: { event: { data: { auditId: string } }; step: any }) => {
    const auditId = event.data.auditId

    try {
      // ────────────────────────────────────────────────────────
      // STEP 1: Fetch audit + brand identity details
      // ────────────────────────────────────────────────────────
      const auditDetails = await step.run('fetch-audit', async () => {
        const db = getDb()

        const { data: audit, error } = await db
          .from('audits')
          .select('*, profiles(email, full_name)')
          .eq('id', auditId)
          .single()

        if (error || !audit) throw new Error(`Audit not found: ${error?.message}`)

        const a = audit as any
        if (!a.brand_identity_id) {
          throw new Error('Brand identity audit requires a brand_identity_id')
        }

        // Fetch brand identity
        const { data: brand } = await db
          .from('brand_identities')
          .select('id, name, description')
          .eq('id', a.brand_identity_id)
          .single()

        if (!brand) throw new Error('Brand identity not found')

        // Fetch brand files
        const { data: files } = await db
          .from('brand_identity_files')
          .select('id, file_name, file_url, file_type, file_size_bytes')
          .eq('brand_identity_id', a.brand_identity_id)
          .order('created_at', { ascending: true })

        if (!files || files.length === 0) {
          throw new Error('No brand files found — upload at least one file before running an audit')
        }

        return {
          userEmail: a.profiles?.email || '',
          userName: a.profiles?.full_name || '',
          brandIdentityId: a.brand_identity_id as string,
          brandName: (brand as any).name as string,
          brandDescription: (brand as any).description as string | null,
          language: (a.language as string) || 'en',
          depthMode: (a.depth_mode as string) || 'standard',
          files: (files as any[]).map((f) => ({
            id: f.id as string,
            file_name: f.file_name as string,
            file_url: f.file_url as string,
            file_type: f.file_type as string | null,
            file_size_bytes: f.file_size_bytes as number | null,
          })),
        }
      })

      // ────────────────────────────────────────────────────────
      // STEP 2: Create file snapshots (record what we're analyzing)
      // ────────────────────────────────────────────────────────
      await step.run('snapshot-files', async () => {
        const db = getDb()
        await auditLog(auditId, 'snapshot_files', 'info',
          `Recording ${auditDetails.files.length} file(s) for analysis`)

        const snapshots = auditDetails.files.map((f: any) => ({
          audit_id: auditId,
          brand_file_id: f.id,
          file_name: f.file_name,
          file_url: f.file_url,
        }))

        const { error } = await db
          .from('brand_audit_file_snapshots')
          .insert(snapshots as any)

        if (error) {
          console.error('[inngest:brand] Snapshot insert error:', error)
          // Non-fatal — continue processing
        }

        return { snapshotCount: snapshots.length }
      })

      // ────────────────────────────────────────────────────────
      // STEP 3: Extract content from all files
      // ────────────────────────────────────────────────────────
      const extractedFiles = await step.run('extract-files', async () => {
        await setStatus(auditId, 'crawling', 10) // Reusing crawling status = "processing files"
        await auditLog(auditId, 'extract_started', 'info',
          `Extracting content from ${auditDetails.files.length} file(s)`)

        // Wrap extraction with step-level timeout to prevent infinite hangs
        const results = await withTimeout('extract-files', STEP_TIMEOUT_MS, () =>
          extractAllBrandFiles(
            auditDetails.files.map((f: any) => ({
              file_name: f.file_name,
              file_url: f.file_url,
              file_type: f.file_type,
            })),
            3, // concurrency
          ),
        )

        const successCount = results.filter((r) => !r.error).length
        const failCount = results.filter((r) => r.error).length

        await auditLog(auditId, 'extract_complete', failCount > 0 ? 'warning' : 'success',
          `Extracted ${successCount}/${results.length} files` +
          (failCount > 0 ? ` (${failCount} failed)` : ''))

        // If ALL files failed, this is a hard failure — don't proceed with empty data
        if (successCount === 0 && results.length > 0) {
          const errors = results.map(r => r.error).filter(Boolean).join('; ')
          throw new Error(`All ${results.length} file(s) failed extraction: ${errors}`)
        }

        // Serialize for step data
        return results.map((r) => ({
          fileName: r.fileName,
          fileType: r.fileType,
          textContent: r.textContent.slice(0, 20_000), // Cap per file for step data limits
          visualDescription: r.visualDescription?.slice(0, 5_000) || null,
          pageCount: r.pageCount,
          extractionMethod: r.extractionMethod,
          error: r.error,
        }))
      })

      // ────────────────────────────────────────────────────────
      // STEP 4: AI analysis across all 7 brand categories
      // ────────────────────────────────────────────────────────
      const categoryResults = await step.run('analyze-categories', async () => {
        await setStatus(auditId, 'analysing', 25)
        await auditLog(auditId, 'analysis_started', 'info',
          `Analyzing ${BRAND_AUDIT_CATEGORIES.length} brand categories`)

        const results = await withTimeout('analyze-categories', STEP_TIMEOUT_MS, () =>
          analyzeAllBrandCategories(
            extractedFiles as ExtractedContent[],
            auditDetails.brandName,
            auditDetails.language,
            3, // batch size
          ),
        )

        const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0)
        await auditLog(auditId, 'analysis_complete', 'success',
          `Analysis complete: ${totalFindings} findings across ${results.length} categories`)

        return results
      })

      // ────────────────────────────────────────────────────────
      // STEP 5: Store raw findings in DB
      // (Separated from report generation so pipeline can clean them first)
      // ────────────────────────────────────────────────────────
      await step.run('store-findings', async () => {
        const db = getDb()
        let sortOrder = 0

        const reportData = buildBrandReport(
          categoryResults as BrandCategoryResult[],
          '', // placeholder — real summary generated after pipeline
          [],
        )

        for (const catResult of reportData.categoryResults) {
          for (const finding of catResult.findings) {
            const classification = classifyFinding({
              title: finding.title,
              description: finding.description,
              recommendation: finding.recommendation,
              severity: finding.severity,
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
              severity: finding.severity,
              title: finding.title,
              description: finding.description,
              recommendation: finding.recommendation,
              estimated_impact: finding.estimatedImpact || null,
              page_url: finding.sourceFile || null,
              sort_order: sortOrder++,
              status: 'open',
              finding_type: validated.findingType,
              fix_type: validated.fixType,
              confidence_level: 'interpretive',
              detection_source: 'brand_analyzer',
              communication: buildCommunicationForGenericFinding({ title: finding.title, description: finding.description, recommendation: finding.recommendation, estimatedImpact: finding.estimatedImpact || null, severity: finding.severity }, null),
            } as any)
          }
        }

        await auditLog(auditId, 'findings_stored', 'info',
          `Stored ${sortOrder} raw brand findings for pipeline processing`)
      })

      // Update progress after analysis + store
      await step.run('progress-after-analysis', async () => { await setProgress(auditId, 55) })

      // ────────────────────────────────────────────────────────
      // PROPRIETARY PIPELINE: Deduplicate findings
      // Same engine as UX audits — independent execution
      // Logic: src/lib/audit-engine/pipeline/dedup.ts
      // ────────────────────────────────────────────────────────
      await step.run('deduplicate-findings', async () => {
        try {
          const db = getDb()
          const { data: allFindings } = await db
            .from('audit_findings')
            .select('id, title, description, severity, page_url, sort_order')
            .eq('audit_id', auditId)
            .order('sort_order', { ascending: true })

          if (!allFindings || allFindings.length < 2) return

          const duplicateIds = identifyDuplicates(
            allFindings.map((f: any) => ({
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
              `Removed ${duplicateIds.length} duplicate brand finding${duplicateIds.length > 1 ? 's' : ''}`)
            console.log(`[inngest:brand] Dedup: removed ${duplicateIds.length} duplicates`)
          }
        } catch (err) {
          console.error('[inngest:brand] Dedup error (non-fatal):', err)
          await auditLog(auditId, 'dedup_error', 'warning',
            `Dedup failed: ${err instanceof Error ? err.message : String(err)}`)
        }
      })

      // ────────────────────────────────────────────────────────
      // PROPRIETARY PIPELINE: Filter speculative findings
      // Logic: src/lib/audit-engine/pipeline/speculative-filter.ts
      // ────────────────────────────────────────────────────────
      await step.run('filter-speculative-findings', async () => {
        try {
          const db = getDb()
          const { data: allFindings } = await db
            .from('audit_findings')
            .select('id, title, description')
            .eq('audit_id', auditId)

          if (!allFindings || allFindings.length === 0) return

          const speculativeIds = identifySpeculativeFindings(
            allFindings.map((f: any) => ({
              id: f.id,
              title: f.title || '',
              description: f.description || '',
            }))
          )

          if (speculativeIds.length > 0) {
            for (const id of speculativeIds) {
              await db.from('audit_findings').delete().eq('id', id)
            }
            await auditLog(auditId, 'speculative_filtered', 'info',
              `Removed ${speculativeIds.length} speculative brand finding${speculativeIds.length > 1 ? 's' : ''}`)
            console.log(`[inngest:brand] Speculative filter: removed ${speculativeIds.length} findings`)
          }
        } catch (err) {
          console.error('[inngest:brand] Speculative filter error (non-fatal):', err)
          await auditLog(auditId, 'speculative_error', 'warning',
            `Speculative filter failed: ${err instanceof Error ? err.message : String(err)}`)
        }
      })

      // ────────────────────────────────────────────────────────
      // PROPRIETARY PIPELINE: Score findings by historical relevance
      // Logic: src/lib/audit-engine/pipeline/relevance-scorer.ts
      // ────────────────────────────────────────────────────────
      await step.run('score-relevance', async () => {
        try {
          const db = getDb()
          const { data: allFindings } = await db
            .from('audit_findings')
            .select('id, title, description, severity')
            .eq('audit_id', auditId)

          if (!allFindings || allFindings.length === 0) return

          const { removedIds } = await scoreFindings(
            allFindings.map((f: any) => ({
              id: f.id,
              title: f.title || '',
              description: f.description || '',
              severity: f.severity || 'medium',
            })),
            db,
          )

          if (removedIds.length > 0) {
            for (const id of removedIds) {
              await db.from('audit_findings').delete().eq('id', id)
            }
            await auditLog(auditId, 'relevance_filtered', 'info',
              `Removed ${removedIds.length} low-relevance brand finding${removedIds.length > 1 ? 's' : ''}`)
            console.log(`[inngest:brand] Relevance scorer: removed ${removedIds.length} findings`)
          }
        } catch (err) {
          console.error('[inngest:brand] Relevance scorer error (non-fatal):', err)
          await auditLog(auditId, 'relevance_error', 'warning',
            `Relevance scoring failed: ${err instanceof Error ? err.message : String(err)}`)
        }
      })

      // ────────────────────────────────────────────────────────
      // STEP 8: Generate executive summary + store report
      // (Uses cleaned findings after pipeline processing)
      // ────────────────────────────────────────────────────────
      const report = await step.run('generate-report', async () => {
        await setStatus(auditId, 'generating_report', 75)

        const { executiveSummary, topRecommendations } = await generateBrandExecutiveSummary(
          categoryResults as BrandCategoryResult[],
          auditDetails.brandName,
          auditDetails.files.length,
          auditDetails.language,
        )

        // Fetch the cleaned findings count (post-pipeline)
        const db = getDb()
        const { data: cleanFindings } = await db
          .from('audit_findings')
          .select('severity')
          .eq('audit_id', auditId)

        const findings = (cleanFindings || []) as any[]
        const severityCount = {
          critical: findings.filter(f => f.severity === 'critical').length,
          high: findings.filter(f => f.severity === 'high').length,
          medium: findings.filter(f => f.severity === 'medium').length,
          low: findings.filter(f => f.severity === 'low').length,
        }
        const totalIssues = findings.length

        // Build report from original category results (scores are category-level, not finding-level)
        const reportData = buildBrandReport(
          categoryResults as BrandCategoryResult[],
          executiveSummary,
          topRecommendations,
        )

        const { error: reportErr } = await db.from('reports').insert({
          audit_id: auditId,
          executive_summary: executiveSummary,
          key_recommendation: topRecommendations[0] || reportData.keyRecommendation,
          total_issues: totalIssues,
          critical_count: severityCount.critical,
          high_count: severityCount.high,
          medium_count: severityCount.medium,
          low_count: severityCount.low,
          overall_score: reportData.overallScore,
          raw_json: {
            type: 'brand_identity',
            categoryResults: reportData.categoryResults.map((c) => ({
              slug: c.slug,
              name: c.name,
              score: c.score,
              summary: c.summary,
            })),
            topRecommendations,
            filesAnalyzed: auditDetails.files.length,
            brandName: auditDetails.brandName,
            _baselineCategoryScores: reportData.categoryResults.map((c) => ({
              name: c.name,
              score: c.score,
              summary: c.summary,
            })),
          },
        } as any)

        if (reportErr) throw new Error(`Failed to store report: ${reportErr.message}`)

        await auditLog(auditId, 'report_generated', 'success',
          `Brand report generated: score ${reportData.overallScore}/100, ${totalIssues} findings (post-pipeline)`)

        return {
          overallScore: reportData.overallScore,
          totalIssues,
        }
      })

      // ────────────────────────────────────────────────────────
      // PROPRIETARY PIPELINE: Record patterns + run learning
      // Same learning tables as UX audits — additive, no conflicts
      // ────────────────────────────────────────────────────────
      await step.run('pipeline-learn', async () => {
        const db = getDb()

        try {
          const { data: finalFindings } = await db
            .from('audit_findings')
            .select('title, severity')
            .eq('audit_id', auditId)
            .order('sort_order', { ascending: true })

          if (!finalFindings || finalFindings.length === 0) return

          for (const f of finalFindings as any[]) {
            await recordFindingShown(db, f.title, f.severity)
          }

          await recordAuditStats(db, auditId)

          const titles = (finalFindings as any[]).map((f: any) => f.title)
          const learningResult = await postAuditLearn(db, titles)

          await auditLog(auditId, 'pipeline_learn', 'success',
            `Recorded ${finalFindings.length} brand finding patterns | New insights: ${learningResult.newInsights}`)
        } catch (learnErr) {
          console.error('[inngest:brand] Pipeline learn error (non-fatal):', learnErr)
          await auditLog(auditId, 'pipeline_learn_error', 'warning',
            `Learning step failed: ${learnErr instanceof Error ? learnErr.message : String(learnErr)}`)
        }
      })

      // ────────────────────────────────────────────────────────
      // STEP 10: Mark complete + notify user
      // ────────────────────────────────────────────────────────
      await step.run('complete', async () => {
        const db = getDb()

        await db.from('audits').update({
          status: 'completed',
          progress_percent: 100,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any).eq('id', auditId)

        await auditLog(auditId, 'audit_completed', 'success',
          `Brand identity audit completed: score ${report.overallScore}/100`)

        // Send notification email
        if (auditDetails.userEmail) {
          try {
            await sendAuditComplete(
              auditDetails.userEmail,
              auditId,
              auditDetails.brandName, // Use brand name instead of URL
              'brand_identity',
            )
          } catch (emailErr) {
            console.error('[inngest:brand] Email send error (non-fatal):', emailErr)
            await auditLog(auditId, 'email_failed', 'warning',
              `Failed to send completion email: ${(emailErr as Error).message}`)
          }
        }
      })

      return { success: true, auditId, score: report.overallScore }

    } catch (err) {
      // ── Global error handler ──
      console.error(`[inngest:brand] Audit ${auditId} failed:`, err)

      try {
        await setStatus(auditId, 'failed')
        await auditLog(auditId, 'audit_failed', 'error',
          `Brand audit failed: ${(err as Error).message}`)
        await refundCredit(auditId)
      } catch (cleanupErr) {
        console.error('[inngest:brand] Cleanup error:', cleanupErr)
      }

      throw err // Re-throw so Inngest marks the function as failed
    }
  },
)
