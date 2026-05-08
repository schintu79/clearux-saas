// ============================================================
// ClearUX — Direct Brand Audit Processor
// Fallback for when Inngest is unavailable. Mirrors the steps
// in process-brand-audit.ts but runs inline without step fns.
// ============================================================

import { createServiceSupabase } from '@/lib/supabase-server'
import { extractAllBrandFiles, type ExtractedContent } from './brand-file-extractor'
import {
  analyzeAllBrandCategories,
  generateBrandExecutiveSummary,
  buildBrandReport,
  type BrandCategoryResult,
} from './brand-analyzer'
import { BRAND_AUDIT_CATEGORIES } from '@/lib/brand-audit-modules'
import { sendAuditComplete } from './email'

type Supabase = ReturnType<typeof createServiceSupabase>

/* ── Helpers ── */

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
    console.error('[brand-processor] log error:', err)
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
    console.error('[brand-processor] Refund error (non-fatal):', err)
  }
}

/* ── Timeout helper ── */

const BRAND_AUDIT_TIMEOUT_MS = 8 * 60 * 1000 // 8 minutes max

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Brand audit timed out after ${ms / 1000}s (${label})`)), ms),
    ),
  ])
}

/* ── Main processor ── */

export async function processBrandAudit(auditId: string): Promise<void> {
  return withTimeout(_processBrandAuditInner(auditId), BRAND_AUDIT_TIMEOUT_MS, 'processBrandAudit')
}

async function _processBrandAuditInner(auditId: string): Promise<void> {
  const db = getDb()

  try {
    console.log(`[brand-processor] Starting brand audit ${auditId}`)

    // 1. Fetch audit + brand identity details
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

    const { data: brand } = await db
      .from('brand_identities')
      .select('id, name, description')
      .eq('id', a.brand_identity_id)
      .single()

    if (!brand) throw new Error('Brand identity not found')

    const { data: files } = await db
      .from('brand_identity_files')
      .select('id, file_name, file_url, file_type, file_size_bytes')
      .eq('brand_identity_id', a.brand_identity_id)
      .order('created_at', { ascending: true })

    if (!files || files.length === 0) {
      throw new Error('No brand files found — upload at least one file before running an audit')
    }

    const auditDetails = {
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

    // 2. Snapshot files
    await auditLog(auditId, 'snapshot_files', 'info',
      `Recording ${auditDetails.files.length} file(s) for analysis`)

    try {
      const snapshots = auditDetails.files.map((f) => ({
        audit_id: auditId,
        brand_file_id: f.id,
        file_name: f.file_name,
        file_url: f.file_url,
      }))
      await db.from('brand_audit_file_snapshots').insert(snapshots as any)
    } catch (snapErr) {
      console.error('[brand-processor] Snapshot insert error (non-fatal):', snapErr)
    }

    // 3. Extract content from files
    await setStatus(auditId, 'crawling')
    await auditLog(auditId, 'extract_started', 'info',
      `Extracting content from ${auditDetails.files.length} file(s)`)

    const extractedFiles = await extractAllBrandFiles(
      auditDetails.files.map((f) => ({
        file_name: f.file_name,
        file_url: f.file_url,
        file_type: f.file_type,
      })),
    )

    const successCount = extractedFiles.filter((r) => !r.error).length
    const failCount = extractedFiles.filter((r) => r.error).length

    await auditLog(auditId, 'extract_complete', failCount > 0 ? 'warning' : 'success',
      `Extracted ${successCount}/${extractedFiles.length} files` +
      (failCount > 0 ? ` (${failCount} failed)` : ''))

    // 4. AI analysis
    await setStatus(auditId, 'analysing')
    await auditLog(auditId, 'analysis_started', 'info',
      `Analyzing ${BRAND_AUDIT_CATEGORIES.length} brand categories`)

    const categoryResults = await analyzeAllBrandCategories(
      extractedFiles as ExtractedContent[],
      auditDetails.brandName,
      auditDetails.language,
    )

    const totalFindings = categoryResults.reduce((sum, r) => sum + r.findings.length, 0)
    await auditLog(auditId, 'analysis_complete', 'success',
      `Analysis complete: ${totalFindings} findings across ${categoryResults.length} categories`)

    // 5. Generate report
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

    // Store findings (batch insert for speed)
    const findingsToInsert: any[] = []
    let sortOrder = 0
    for (const catResult of reportData.categoryResults) {
      for (const finding of catResult.findings) {
        findingsToInsert.push({
          audit_id: auditId,
          severity: finding.severity,
          title: finding.title,
          description: finding.description,
          recommendation: finding.recommendation,
          estimated_impact: finding.estimatedImpact || null,
          page_url: finding.sourceFile || null,
          sort_order: sortOrder++,
          status: 'open',
        })
      }
    }
    if (findingsToInsert.length > 0) {
      await db.from('audit_findings').insert(findingsToInsert as any)
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

    // 6. Complete
    await db.from('audits').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any).eq('id', auditId)

    await auditLog(auditId, 'audit_completed', 'success',
      `Brand identity audit completed: score ${reportData.overallScore}/100`)

    if (auditDetails.userEmail) {
      try {
        await sendAuditComplete(auditDetails.userEmail, auditId, auditDetails.brandName)
      } catch (emailErr) {
        console.error('[brand-processor] Email error (non-fatal):', emailErr)
      }
    }

    console.log(`[brand-processor] Brand audit ${auditId} completed — ${reportData.totalIssues} findings`)

  } catch (err) {
    console.error(`[brand-processor] Audit ${auditId} failed:`, err)

    try {
      await setStatus(auditId, 'failed')
      await db.from('audits').update({
        crawl_error: (err as Error).message,
        updated_at: new Date().toISOString(),
      } as any).eq('id', auditId)
      await auditLog(auditId, 'audit_failed', 'error',
        `Brand audit failed: ${(err as Error).message}`)
      await refundCredit(auditId)
    } catch (cleanupErr) {
      console.error('[brand-processor] Cleanup error:', cleanupErr)
    }

    throw err
  }
}
