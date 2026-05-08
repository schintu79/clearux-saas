// ============================================================
// ClearUX — Inngest Brand Identity Audit Processing Function
// Pipeline for analyzing uploaded brand materials.
//
// Steps:
//   1. fetch-audit        — Load audit + brand identity details
//   2. snapshot-files     — Record which files are being analyzed
//   3. extract-files      — Extract text/visual content from files
//   4. analyze-categories — AI analysis across 7 brand categories
//   5. generate-report    — Executive summary + scores
//   6. complete           — Mark done, send email
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
import { BRAND_AUDIT_CATEGORIES, calculateBrandScore } from '@/lib/brand-audit-modules'
import { sendAuditComplete } from '@/lib/audit-engine/email'

/* ── DB helpers ── */

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
        await setStatus(auditId, 'crawling') // Reusing crawling status = "processing files"
        await auditLog(auditId, 'extract_started', 'info',
          `Extracting content from ${auditDetails.files.length} file(s)`)

        const results = await extractAllBrandFiles(
          auditDetails.files.map((f: any) => ({
            file_name: f.file_name,
            file_url: f.file_url,
            file_type: f.file_type,
          })),
          3, // concurrency
        )

        const successCount = results.filter((r) => !r.error).length
        const failCount = results.filter((r) => r.error).length

        await auditLog(auditId, 'extract_complete', failCount > 0 ? 'warning' : 'success',
          `Extracted ${successCount}/${results.length} files` +
          (failCount > 0 ? ` (${failCount} failed)` : ''))

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
        await setStatus(auditId, 'analysing')
        await auditLog(auditId, 'analysis_started', 'info',
          `Analyzing ${BRAND_AUDIT_CATEGORIES.length} brand categories`)

        const results = await analyzeAllBrandCategories(
          extractedFiles as ExtractedContent[],
          auditDetails.brandName,
          auditDetails.language,
          3, // batch size
        )

        const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0)
        await auditLog(auditId, 'analysis_complete', 'success',
          `Analysis complete: ${totalFindings} findings across ${results.length} categories`)

        return results
      })

      // ────────────────────────────────────────────────────────
      // STEP 5: Generate executive summary + build report
      // ────────────────────────────────────────────────────────
      const report = await step.run('generate-report', async () => {
        await setStatus(auditId, 'generating_report')

        const { executiveSummary, topRecommendations } = await generateBrandExecutiveSummary(
          categoryResults as BrandCategoryResult[],
          auditDetails.brandName,
          auditDetails.files.length,
          auditDetails.language,
        )

        const reportData = buildBrandReport(
          categoryResults as BrandCategoryResult[],
          executiveSummary,
          topRecommendations,
        )

        // Store findings in DB
        const db = getDb()
        let sortOrder = 0

        for (const catResult of reportData.categoryResults) {
          for (const finding of catResult.findings) {
            await db.from('audit_findings').insert({
              audit_id: auditId,
              severity: finding.severity,
              title: finding.title,
              description: finding.description,
              recommendation: finding.recommendation,
              estimated_impact: finding.estimatedImpact || null,
              page_url: finding.sourceFile || null, // Reusing page_url field for source file
              sort_order: sortOrder++,
              status: 'open',
            } as any)
          }
        }

        // Store report
        const { error: reportErr } = await db.from('reports').insert({
          audit_id: auditId,
          executive_summary: reportData.executiveSummary,
          key_recommendation: reportData.keyRecommendation,
          total_issues: reportData.totalIssues,
          critical_count: reportData.criticalCount,
          high_count: reportData.highCount,
          medium_count: reportData.mediumCount,
          low_count: reportData.lowCount,
          overall_score: reportData.overallScore,
          // Store category scores in raw_json for the detail page
          raw_json: {
            type: 'brand_identity',
            categoryResults: reportData.categoryResults.map((c) => ({
              slug: c.slug,
              name: c.name,
              score: c.score,
              summary: c.summary,
            })),
            topRecommendations: reportData.topRecommendations,
            filesAnalyzed: auditDetails.files.length,
            brandName: auditDetails.brandName,
          },
        } as any)

        if (reportErr) throw new Error(`Failed to store report: ${reportErr.message}`)

        await auditLog(auditId, 'report_generated', 'success',
          `Brand report generated: score ${reportData.overallScore}/100, ${reportData.totalIssues} findings`)

        return {
          overallScore: reportData.overallScore,
          totalIssues: reportData.totalIssues,
        }
      })

      // ────────────────────────────────────────────────────────
      // STEP 6: Mark complete + notify user
      // ────────────────────────────────────────────────────────
      await step.run('complete', async () => {
        const db = getDb()

        await db.from('audits').update({
          status: 'completed',
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
