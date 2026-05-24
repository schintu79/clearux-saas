/**
 * Scheduled Re-runs & Snapshot Storage — Tier 2
 *
 * Manages weekly intelligence re-runs and stores point-in-time snapshots
 * for trend tracking. Designed to run via Inngest cron.
 *
 * Features:
 * - Stores full intelligence snapshots at regular intervals
 * - Computes deltas between snapshots for trend visualization
 * - Provides trend data for the dashboard (last 12 weeks)
 */

import { createServiceSupabase } from '@/lib/supabase-server'
import type { BrandIntelligenceSummary } from '@/lib/audit-engine/brand-intelligence'

/* ── Types ───────────────────────────────────────────── */

export interface IntelligenceSnapshot {
  id: string
  brandDomain: string
  auditId: string | null
  biScore: number | null
  aiVisibility: number | null
  placementScore: number | null
  overallSentiment: number | null
  shareOfVoice: number | null
  reviewScore: number | null
  webMentionCount: number | null
  redditMentionCount: number | null
  positiveThemeCount: number | null
  negativeThemeCount: number | null
  snapshotAt: string
}

export interface TrendData {
  snapshots: IntelligenceSnapshot[]
  deltas: {
    biScore: number | null
    aiVisibility: number | null
    sentiment: number | null
    shareOfVoice: number | null
  }
  periodWeeks: number
}

/* ── Snapshot storage ────────────────────────────────── */

/**
 * Save a point-in-time snapshot of brand intelligence metrics.
 * Called after each audit completes or on scheduled re-run.
 */
export async function saveSnapshot(params: {
  userId: string
  brandDomain: string
  auditId: string | null
  biSummary: BrandIntelligenceSummary | null
  reviewScore?: number | null
  webMentionCount?: number | null
  redditMentionCount?: number | null
}): Promise<void> {
  const db = createServiceSupabase()

  const { userId, brandDomain, auditId, biSummary, reviewScore, webMentionCount, redditMentionCount } = params

  await db.from('intelligence_snapshots').insert({
    user_id: userId,
    brand_domain: brandDomain,
    audit_id: auditId,
    bi_score: biSummary?.score ?? null,
    ai_visibility: biSummary?.aiVisibility ?? null,
    placement_score: biSummary?.placementScore ?? null,
    overall_sentiment: biSummary?.overallSentiment ?? null,
    share_of_voice: biSummary?.shareOfVoice ?? null,
    review_score: reviewScore ?? null,
    web_mention_count: webMentionCount ?? null,
    reddit_mention_count: redditMentionCount ?? null,
    positive_theme_count: biSummary?.positiveThemes?.length ?? null,
    negative_theme_count: biSummary?.negativeThemes?.length ?? null,
    full_data: biSummary ?? null,
  } as any)
}

/* ── Trend retrieval ─────────────────────────────────── */

/**
 * Get trend data for a brand over the last N weeks.
 */
export async function getTrendData(
  userId: string,
  brandDomain: string,
  weeks = 12,
): Promise<TrendData> {
  const db = createServiceSupabase()
  const since = new Date()
  since.setDate(since.getDate() - weeks * 7)

  const { data: snapshots } = await db
    .from('intelligence_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('brand_domain', brandDomain)
    .gte('snapshot_at', since.toISOString())
    .order('snapshot_at', { ascending: true })

  const mapped: IntelligenceSnapshot[] = (snapshots || []).map((s: any) => ({
    id: s.id,
    brandDomain: s.brand_domain,
    auditId: s.audit_id,
    biScore: s.bi_score,
    aiVisibility: s.ai_visibility,
    placementScore: s.placement_score,
    overallSentiment: s.overall_sentiment,
    shareOfVoice: s.share_of_voice,
    reviewScore: s.review_score,
    webMentionCount: s.web_mention_count,
    redditMentionCount: s.reddit_mention_count,
    positiveThemeCount: s.positive_theme_count,
    negativeThemeCount: s.negative_theme_count,
    snapshotAt: s.snapshot_at,
  }))

  // Compute deltas (latest vs earliest)
  let deltas: TrendData['deltas'] = { biScore: null, aiVisibility: null, sentiment: null, shareOfVoice: null }
  if (mapped.length >= 2) {
    const first = mapped[0]
    const last = mapped[mapped.length - 1]
    deltas = {
      biScore: first.biScore != null && last.biScore != null ? last.biScore - first.biScore : null,
      aiVisibility: first.aiVisibility != null && last.aiVisibility != null ? last.aiVisibility - first.aiVisibility : null,
      sentiment: first.overallSentiment != null && last.overallSentiment != null ? last.overallSentiment - first.overallSentiment : null,
      shareOfVoice: first.shareOfVoice != null && last.shareOfVoice != null ? (last.shareOfVoice as number) - (first.shareOfVoice as number) : null,
    }
  }

  return { snapshots: mapped, deltas, periodWeeks: weeks }
}

/* ── Inngest function for scheduled re-runs ──────────── */

/**
 * This function is designed to be called by an Inngest cron job.
 * It re-runs the human perception analysis for all active brands.
 *
 * Usage in Inngest:
 * ```
 * inngest.createFunction(
 *   { id: 'weekly-intelligence-rerun', name: 'Weekly Intelligence Re-run' },
 *   { cron: '0 6 * * 1' }, // Every Monday at 6 AM
 *   async ({ step }) => { await runWeeklyIntelligenceRerun() }
 * )
 * ```
 */
export async function runWeeklyIntelligenceRerun(): Promise<{ processed: number; errors: number }> {
  const db = createServiceSupabase()

  // Get all unique brand domains with recent audits (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: recentAudits } = await db
    .from('audits')
    .select('id, user_id, product_url, brand_name, sentiment_data')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .eq('status', 'completed')
    .not('product_url', 'is', null)

  if (!recentAudits || recentAudits.length === 0) {
    return { processed: 0, errors: 0 }
  }

  // Deduplicate by domain — take the most recent audit per domain
  const domainMap = new Map<string, any>()
  for (const audit of recentAudits) {
    const domain = new URL((audit as any).product_url).hostname.replace(/^www\./, '')
    if (!domainMap.has(domain)) {
      domainMap.set(domain, audit)
    }
  }

  let processed = 0
  let errors = 0

  for (const [domain, audit] of domainMap) {
    try {
      // Save a snapshot from the existing sentiment_data
      const biSummary = (audit as any).sentiment_data as BrandIntelligenceSummary | null
      await saveSnapshot({
        userId: (audit as any).user_id,
        brandDomain: domain,
        auditId: (audit as any).id,
        biSummary,
      })
      processed++
    } catch (err) {
      console.error(`[scheduled-rerun] Error processing ${domain}:`, err)
      errors++
    }
  }

  return { processed, errors }
}
