/**
 * Human Perception Intelligence — Tier 2 Orchestrator
 *
 * Coordinates all human perception services:
 * - Review aggregation (G2, Capterra, Trustpilot, Google Places)
 * - Reddit mentions
 * - Web mentions (news, blogs, press)
 * - Prompt library execution
 * - Causal link engine
 * - Content gap generator
 * - Scheduled re-runs with snapshots
 *
 * This module is called after the AI probe step in the audit pipeline.
 */

export { fetchAllReviews } from './reviews'
export type { ReviewAggregation, PlatformReviewData, ReviewEntry } from './reviews'

export { fetchRedditMentions } from './reddit'
export type { RedditAnalysis, RedditMention } from './reddit'

export { fetchWebMentions } from './web-mentions'
export type { WebMentionsAnalysis, WebMention } from './web-mentions'

export { runPromptLibrary, getPromptsForCategory } from './prompt-library'
export type { PromptLibraryAnalysis, PromptExecutionResult } from './prompt-library'

export { saveSnapshot, getTrendData, runWeeklyIntelligenceRerun } from './scheduled-rerun'
export type { IntelligenceSnapshot, TrendData } from './scheduled-rerun'

export { buildCausalAnalysis, computeCausalLinks } from './causal-links'
export type { CausalAnalysis, CausalLink } from './causal-links'

export { analyzeContentGaps, getContentGaps } from './content-gaps'
export type { ContentGapAnalysis, ContentBrief } from './content-gaps'

/* ── Full human perception pipeline ──────���───────────── */

import { fetchAllReviews } from './reviews'
import { fetchRedditMentions } from './reddit'
import { fetchWebMentions } from './web-mentions'
import { runPromptLibrary } from './prompt-library'
import { buildCausalAnalysis } from './causal-links'
import { analyzeContentGaps } from './content-gaps'
import { saveSnapshot } from './scheduled-rerun'
import type { BrandIntelligenceSummary } from '@/lib/audit-engine/brand-intelligence'
import { createServiceSupabase } from '@/lib/supabase-server'

export interface HumanPerceptionSummary {
  reviewScore: number | null
  reviewCount: number
  webMentionCount: number
  redditMentionCount: number
  socialSentiment: number // 0-100 aggregate across all human sources
  topPositiveThemes: Array<{ theme: string; source: string; count: number }>
  topNegativeThemes: Array<{ theme: string; source: string; count: number }>
  promptLibraryVisibility: number | null // % visibility in category prompts
  contentGapsCount: number
  causalLinksCount: number
  fetchedAt: string
}

/**
 * Run the full human perception pipeline for a brand.
 * Called as part of the audit pipeline after AI probes complete.
 *
 * Gracefully handles missing API keys — only runs services that are configured.
 */
export async function runHumanPerceptionPipeline(params: {
  auditId: string
  userId: string
  brandDomain: string
  brandName: string
  detectedIndustry?: string | null
  biSummary?: BrandIntelligenceSummary | null
}): Promise<HumanPerceptionSummary> {
  const { auditId, userId, brandDomain, brandName, detectedIndustry, biSummary } = params
  const category = detectedIndustry || 'saas'

  // Run all human perception services in parallel
  const [reviewData, redditData, webMentionData, promptLibraryData] = await Promise.all([
    fetchAllReviews(brandDomain, brandName).catch((err) => {
      console.warn('[human-perception] Reviews failed:', err)
      return null
    }),
    fetchRedditMentions(brandDomain, brandName).catch((err) => {
      console.warn('[human-perception] Reddit failed:', err)
      return null
    }),
    fetchWebMentions(brandDomain, brandName).catch((err) => {
      console.warn('[human-perception] Web mentions failed:', err)
      return null
    }),
    runPromptLibrary(brandDomain, brandName, category, auditId).catch((err) => {
      console.warn('[human-perception] Prompt library failed:', err)
      return null
    }),
  ])

  // ── Persist Tier 2 data to DB tables ──────────────────────
  // The detail page reads from these tables, so we must persist
  // individual records — not just the aggregate summary.
  const db = createServiceSupabase()

  // Delete any existing Tier 2 data for this audit (idempotent on re-runs)
  await Promise.all([
    db.from('brand_reviews').delete().eq('audit_id', auditId),
    db.from('reddit_mentions').delete().eq('audit_id', auditId),
    db.from('web_mentions').delete().eq('audit_id', auditId),
  ]).catch(() => { /* non-fatal */ })

  // Persist brand reviews (one row per platform)
  if (reviewData && reviewData.platforms.length > 0) {
    const reviewRows = reviewData.platforms.map((p) => ({
      audit_id: auditId,
      user_id: userId,
      platform: p.platform,
      brand_domain: brandDomain,
      aggregate_score: p.aggregateScore,
      review_count: p.reviewCount,
      sentiment_positive: p.sentimentPositive,
      sentiment_neutral: p.sentimentNeutral,
      sentiment_negative: p.sentimentNegative,
      top_positive_themes: p.topPositiveThemes,
      top_negative_themes: p.topNegativeThemes,
      recent_reviews: p.recentReviews.slice(0, 10),
    }))
    await db.from('brand_reviews').insert(reviewRows).then(
      () => console.log(`[human-perception] Persisted ${reviewRows.length} review platform(s)`),
      (err: unknown) => console.warn('[human-perception] Failed to persist reviews:', err),
    )
  }

  // Persist Reddit mentions (one row per mention)
  if (redditData && redditData.mentions.length > 0) {
    const redditRows = redditData.mentions.map((m) => ({
      audit_id: auditId,
      user_id: userId,
      brand_domain: brandDomain,
      subreddit: m.subreddit,
      post_title: m.postTitle,
      post_url: m.postUrl,
      post_body: (m.postBody || '').slice(0, 5000),
      score: m.score,
      num_comments: m.numComments,
      sentiment: m.sentiment,
      sentiment_score: m.sentimentScore,
      themes: m.themes,
      author: m.author,
      posted_at: m.postedAt || null,
    }))
    await db.from('reddit_mentions').insert(redditRows).then(
      () => console.log(`[human-perception] Persisted ${redditRows.length} Reddit mention(s)`),
      (err: unknown) => console.warn('[human-perception] Failed to persist Reddit mentions:', err),
    )
  }

  // Persist web mentions (one row per mention)
  if (webMentionData && webMentionData.mentions.length > 0) {
    const webRows = webMentionData.mentions.map((m) => ({
      audit_id: auditId,
      user_id: userId,
      brand_domain: brandDomain,
      source_url: m.sourceUrl,
      source_domain: m.sourceDomain,
      title: m.title,
      snippet: (m.snippet || '').slice(0, 2000),
      sentiment: m.sentiment,
      sentiment_score: m.sentimentScore,
      themes: m.themes,
      domain_authority: m.domainAuthority,
      published_at: m.publishedAt || null,
    }))
    await db.from('web_mentions').insert(webRows).then(
      () => console.log(`[human-perception] Persisted ${webRows.length} web mention(s)`),
      (err: unknown) => console.warn('[human-perception] Failed to persist web mentions:', err),
    )
  }

  // Run content gap analysis based on prompt library results
  let contentGapData = null
  if (promptLibraryData && promptLibraryData.results.length > 0) {
    contentGapData = await analyzeContentGaps({
      auditId,
      userId,
      brandDomain,
      brandName,
      promptResults: promptLibraryData.results.map(r => ({
        promptText: r.promptText,
        category,
        brandMentioned: r.brandMentioned,
        competitorsMentioned: r.competitorsMentioned,
      })),
    }).catch(() => null)
  }

  // Build causal links (connects human signals to AI responses)
  const causalData = await buildCausalAnalysis({
    brandName,
    reviewThemes: reviewData?.topPositiveThemes.map(t => ({ theme: t.theme, count: t.count, isPositive: true }))
      .concat(reviewData?.topNegativeThemes.map(t => ({ theme: t.theme, count: t.count, isPositive: false })) || []),
    redditThemes: redditData?.topThemes,
    webMentionThemes: webMentionData?.topThemes,
    aiPositiveThemes: biSummary?.positiveThemes,
    aiNegativeThemes: biSummary?.negativeThemes,
    perModelSentiment: biSummary?.perModel?.map(m => ({
      modelLabel: m.modelLabel,
      sentimentScore: m.sentimentScore,
      themes: m.themes.map(t => ({ theme: t.theme, polarity: t.polarity })),
    })),
  }).catch(() => null)

  // Aggregate human sentiment across all sources
  const sentimentScores: number[] = []
  if (reviewData && reviewData.compositeScore > 0) {
    sentimentScores.push(Math.round((reviewData.compositeScore / 5) * 100))
  }
  if (redditData) sentimentScores.push(redditData.avgSentiment)
  if (webMentionData) sentimentScores.push(webMentionData.avgSentiment)
  const socialSentiment = sentimentScores.length > 0
    ? Math.round(sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length)
    : 50

  // Aggregate themes
  const topPositiveThemes: Array<{ theme: string; source: string; count: number }> = []
  const topNegativeThemes: Array<{ theme: string; source: string; count: number }> = []

  for (const t of (reviewData?.topPositiveThemes || [])) {
    topPositiveThemes.push({ theme: t.theme, source: 'reviews', count: t.count })
  }
  for (const t of (redditData?.topThemes || []).filter(t => t.polarity === 'positive')) {
    topPositiveThemes.push({ theme: t.theme, source: 'reddit', count: t.count })
  }
  for (const t of (webMentionData?.topThemes || []).filter(t => t.polarity === 'positive')) {
    topPositiveThemes.push({ theme: t.theme, source: 'web', count: t.count })
  }

  for (const t of (reviewData?.topNegativeThemes || [])) {
    topNegativeThemes.push({ theme: t.theme, source: 'reviews', count: t.count })
  }
  for (const t of (redditData?.topThemes || []).filter(t => t.polarity === 'negative')) {
    topNegativeThemes.push({ theme: t.theme, source: 'reddit', count: t.count })
  }
  for (const t of (webMentionData?.topThemes || []).filter(t => t.polarity === 'negative')) {
    topNegativeThemes.push({ theme: t.theme, source: 'web', count: t.count })
  }

  // Sort by count
  topPositiveThemes.sort((a, b) => b.count - a.count)
  topNegativeThemes.sort((a, b) => b.count - a.count)

  const summary: HumanPerceptionSummary = {
    reviewScore: reviewData?.compositeScore ?? null,
    reviewCount: reviewData?.totalReviewCount ?? 0,
    webMentionCount: webMentionData?.totalMentions ?? 0,
    redditMentionCount: redditData?.totalMentions ?? 0,
    socialSentiment,
    topPositiveThemes: topPositiveThemes.slice(0, 10),
    topNegativeThemes: topNegativeThemes.slice(0, 10),
    promptLibraryVisibility: promptLibraryData?.visibilityPercent ?? null,
    contentGapsCount: contentGapData?.totalGapsFound ?? 0,
    causalLinksCount: causalData?.links?.length ?? 0,
    fetchedAt: new Date().toISOString(),
  }

  // Save snapshot for trend tracking
  await saveSnapshot({
    userId,
    brandDomain,
    auditId,
    biSummary: biSummary ?? null,
    reviewScore: reviewData?.compositeScore,
    webMentionCount: webMentionData?.totalMentions,
    redditMentionCount: redditData?.totalMentions,
  }).catch(() => { /* non-fatal */ })

  return summary
}
