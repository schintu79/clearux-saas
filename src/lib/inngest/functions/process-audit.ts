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
import { analyzeCategory, runFullAnalysis, generateReport, verifyFindings, UX_CATEGORIES } from '@/lib/audit-engine/analyzer'
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
        depthMode: ((audit as any).depth_mode as string) || 'standard',
      }
    })

    // ──────────────────────────────────────────────────────────
    // STEP 2: Crawl pages
    // ──────────────────────────────────────────────────────────
    const crawlResult = await step.run('crawl-pages', async () => {
      await setStatus(auditId, 'crawling')
      await auditLog(auditId, 'crawl_started', 'info', `Crawling ${auditDetails.productUrl}`)

      const maxPages = auditDetails.plan === 'free_preview' ? 5 : auditDetails.plan === 'starter' ? 8 : 25
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
        crawledUrls: crawledPages.map((p) => p.url).filter(Boolean) as string[],
      }
    })

    // ──────────────────────────────────────────────────────────
    // STEP 3: Build site context map + set status to analysing
    // Creates a summary of what exists across ALL pages so the
    // analyzer has cross-page awareness (e.g., "founder bio exists
    // on /about" prevents false positive on homepage)
    // ──────────────────────────────────────────────────────────
    const siteContext = await step.run('build-site-context', async () => {
      await setStatus(auditId, 'analysing')

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
              .select('title, severity, description, recommendation, estimated_impact, target_element, page_url, sort_order, status, dismissed, dismissal_reason')
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
      // - 'deep' explicitly requested → always deep (find new issues)
      // - 'standard' + has previous audit → baseline (only verify previous findings)
      // - 'standard' + no previous audit → deep (first audit, must find issues)
      const hasPreviousFindings = userContext.includes('PREVIOUS FINDINGS')
      let effectiveDepthMode: 'deep' | 'baseline' = 'deep'
      if (auditDetails.depthMode === 'standard' && hasPreviousFindings) {
        effectiveDepthMode = 'baseline'
      }

      const fullContext = siteMap + userContext

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
          await db.from('audit_findings').insert({
            audit_id: auditId,
            checklist_item_id: null,
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

    } else {
      // ════════════════════════════════════════════════════════════
      // DEEP MODE (first audit or explicit Dig Deeper) — FULL AI ANALYSIS
      // ════════════════════════════════════════════════════════════
      const BATCH_SIZE = 4
      const batches = []
      for (let i = 0; i < UX_CATEGORY_NAMES.length; i += BATCH_SIZE) {
        batches.push(UX_CATEGORY_NAMES.slice(i, i + BATCH_SIZE))
      }

      const contentWithContext = `${siteContext.context}\n\n${crawlResult.pageContent}`
      let totalFindingsCount = 0

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx]

        const batchResult = await step.run(`analyze-batch-${batchIdx + 1}`, async () => {
          const db = getDb()
          let sortOrder = totalFindingsCount
          let findingsInBatch = 0

          console.log(`[inngest] Batch ${batchIdx + 1}: ${batch.join(', ')}`)
          const batchResults = await Promise.all(
            batch.map((categoryName) =>
              analyzeCategory(
                contentWithContext,
                categoryName,
                [],
                auditDetails.userFocus,
                auditDetails.language,
                'deep', // Always 'deep' here — baseline path doesn't call analyzeCategory
              )
            ),
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

              await db.from('audit_findings').insert({
                audit_id: auditId,
                checklist_item_id: null,
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
    }

    // ──────────────────────────────────────────────────────────
    // Deduplicate findings — remove near-duplicate findings
    // that were flagged across multiple categories
    // ──────────────────────────────────────────────────────────
    await step.run('deduplicate-findings', async () => {
      const db = getDb()
      const { data: allFindings } = await db
        .from('audit_findings')
        .select('id, title, severity, page_url, sort_order')
        .eq('audit_id', auditId)
        .order('sort_order', { ascending: true })

      if (!allFindings || allFindings.length < 2) return

      // Severity priority — when merging, keep the higher severity
      const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

      // Normalize title for comparison: lowercase, strip punctuation, collapse whitespace
      function normalizeTitle(title: string): string {
        return title.toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }

      // Extract significant words (4+ chars) for fuzzy matching
      function extractWords(text: string): Set<string> {
        return new Set(
          normalizeTitle(text)
            .split(' ')
            .filter(w => w.length >= 4)
        )
      }

      // Calculate word overlap ratio between two titles
      function titleSimilarity(a: string, b: string): number {
        const wordsA = extractWords(a)
        const wordsB = extractWords(b)
        if (wordsA.size === 0 || wordsB.size === 0) return 0
        let overlap = 0
        for (const w of wordsA) {
          if (wordsB.has(w)) overlap++
        }
        // Jaccard-like: overlap / smaller set size (more aggressive matching)
        return overlap / Math.min(wordsA.size, wordsB.size)
      }

      // Group duplicates: findings with >= 70% word overlap are considered duplicates
      const SIMILARITY_THRESHOLD = 0.7
      const duplicateIds: string[] = []
      const seen = new Set<number>()

      for (let i = 0; i < allFindings.length; i++) {
        if (seen.has(i)) continue
        const group: number[] = [i]

        for (let j = i + 1; j < allFindings.length; j++) {
          if (seen.has(j)) continue
          const sim = titleSimilarity((allFindings[i] as any).title, (allFindings[j] as any).title)
          if (sim >= SIMILARITY_THRESHOLD) {
            group.push(j)
            seen.add(j)
          }
        }

        if (group.length > 1) {
          // Keep the one with highest severity (lowest rank), then earliest sort_order
          group.sort((a, b) => {
            const sevA = severityRank[(allFindings[a] as any).severity] ?? 2
            const sevB = severityRank[(allFindings[b] as any).severity] ?? 2
            if (sevA !== sevB) return sevA - sevB
            return ((allFindings[a] as any).sort_order ?? 0) - ((allFindings[b] as any).sort_order ?? 0)
          })

          // Mark all but the first (best) as duplicates
          for (let k = 1; k < group.length; k++) {
            duplicateIds.push((allFindings[group[k]] as any).id)
          }
        }
      }

      if (duplicateIds.length > 0) {
        // Delete duplicate findings
        for (const id of duplicateIds) {
          await db.from('audit_findings').delete().eq('id', id)
        }
        await auditLog(auditId, 'findings_deduped', 'info',
          `Removed ${duplicateIds.length} duplicate finding${duplicateIds.length > 1 ? 's' : ''}`)
        console.log(`[inngest] Dedup: removed ${duplicateIds.length} duplicates from ${allFindings.length} findings`)
      }
    })

    // ──────────────────────────────────────────────────────────
    // Verify findings count (post-dedup)
    // ──────────────────────────────────────────────────────────
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

      // Preserve original category scores as baseline for future recalculations
      // (when user marks findings as fixed/dismissed, scores recalculate from this baseline)
      const reportJsonWithBaseline = {
        ...reportData,
        _baselineCategoryScores: reportData.categoryScores,
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
        raw_json: reportJsonWithBaseline,
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
