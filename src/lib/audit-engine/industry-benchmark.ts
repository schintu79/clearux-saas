// ============================================================
// ClearUX Audit Engine — Industry AI Visibility Index
// ============================================================
// Aggregates AI visibility scores across all audits to compute
// industry/vertical benchmarks.
//
// "SaaS avg: 58. You: 74. Top 15%."
//
// This is the data network effect — every audit makes the
// benchmark more accurate. No competitor can replicate this
// without the same audit volume.
//
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

/* ── Types ──────────────────────────────────────────────────── */

export interface IndustryBenchmark {
  /** Industry/vertical label */
  industry: string
  /** Number of audits in this cohort */
  sampleSize: number
  /** Average AI visibility score */
  avgScore: number
  /** Median AI visibility score */
  medianScore: number
  /** Top 10% threshold */
  p90Score: number
  /** Bottom 10% threshold */
  p10Score: number
  /** Score distribution buckets */
  distribution: {
    '0-20': number
    '21-40': number
    '41-60': number
    '61-80': number
    '81-100': number
  }
}

export interface UserBenchmarkPosition {
  /** User's AI visibility score */
  userScore: number
  /** User's percentile rank (0-100, higher = better) */
  percentile: number
  /** Label: "Top X%" */
  rankLabel: string
  /** How far above/below the average */
  deltaFromAvg: number
  /** The industry benchmark data */
  benchmark: IndustryBenchmark
  /** Actionable insight */
  insight: string
}

/* ── Industry detection ────────────────────────────────────── */

const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  SaaS: ['saas', 'software', 'platform', 'app', 'dashboard', 'api', 'tool', 'cloud', 'subscription'],
  'E-commerce': ['shop', 'store', 'buy', 'cart', 'product', 'price', 'shipping', 'ecommerce', 'marketplace'],
  Agency: ['agency', 'studio', 'consulting', 'services', 'marketing', 'creative', 'design agency'],
  'Media & Publishing': ['blog', 'news', 'magazine', 'publish', 'content', 'media', 'editorial', 'journal'],
  Education: ['learn', 'course', 'training', 'academy', 'education', 'university', 'school', 'tutorial'],
  Healthcare: ['health', 'medical', 'clinic', 'patient', 'care', 'wellness', 'therapy', 'doctor'],
  Finance: ['finance', 'banking', 'invest', 'insurance', 'fintech', 'payment', 'loan', 'credit'],
  'Real Estate': ['real estate', 'property', 'realty', 'listing', 'homes', 'apartment', 'rent'],
}

/**
 * Detect industry from site content.
 * Returns the best-matching industry label or 'General'.
 */
export function detectIndustry(
  productType: string | null,
  siteContent: string,
): string {
  const text = `${productType || ''} ${siteContent}`.toLowerCase()

  let bestMatch = 'General'
  let bestScore = 0

  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    let score = 0
    for (const kw of keywords) {
      if (text.includes(kw)) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestMatch = industry
    }
  }

  return bestScore >= 2 ? bestMatch : 'General'
}

/* ── Benchmark computation ─────────────────────────────────── */

/**
 * Compute industry benchmark from all completed audits.
 * Queries the reports table for AI visibility scores and
 * groups by detected industry.
 */
export async function computeIndustryBenchmark(
  db: SupabaseClient,
  industry: string,
): Promise<IndustryBenchmark> {
  // Fetch all completed audits with AI visibility scores
  const { data: reports } = await db
    .from('reports')
    .select('ai_visibility_breakdown, audit_id')
    .not('ai_visibility_breakdown', 'is', null)

  if (!reports || reports.length === 0) {
    return emptyBenchmark(industry)
  }

  // Extract scores
  const scores: number[] = []
  for (const r of reports) {
    const breakdown = (r as any).ai_visibility_breakdown as { overall?: number } | null
    if (breakdown?.overall != null) {
      scores.push(breakdown.overall)
    }
  }

  if (scores.length === 0) return emptyBenchmark(industry)

  // Sort for percentile calculations
  scores.sort((a, b) => a - b)

  const sum = scores.reduce((s, v) => s + v, 0)
  const avg = Math.round(sum / scores.length)
  const median = scores[Math.floor(scores.length / 2)]
  const p10 = scores[Math.floor(scores.length * 0.1)]
  const p90 = scores[Math.floor(scores.length * 0.9)]

  // Distribution buckets
  const dist = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 }
  for (const s of scores) {
    if (s <= 20) dist['0-20']++
    else if (s <= 40) dist['21-40']++
    else if (s <= 60) dist['41-60']++
    else if (s <= 80) dist['61-80']++
    else dist['81-100']++
  }

  return {
    industry,
    sampleSize: scores.length,
    avgScore: avg,
    medianScore: median,
    p90Score: p90,
    p10Score: p10,
    distribution: dist,
  }
}

/**
 * Get the user's position within the industry benchmark.
 */
export async function getUserBenchmarkPosition(
  db: SupabaseClient,
  userScore: number,
  industry: string,
): Promise<UserBenchmarkPosition> {
  const benchmark = await computeIndustryBenchmark(db, industry)

  if (benchmark.sampleSize === 0) {
    return {
      userScore,
      percentile: 50,
      rankLabel: 'No data yet',
      deltaFromAvg: 0,
      benchmark,
      insight: 'Not enough audits yet to compute industry benchmarks. Your score will be compared against other sites as the dataset grows.',
    }
  }

  // Calculate percentile — what % of scores is this user above?
  // Re-fetch scores for this calculation
  const { data: reports } = await db
    .from('reports')
    .select('ai_visibility_breakdown')
    .not('ai_visibility_breakdown', 'is', null)

  const allScores: number[] = []
  if (reports) {
    for (const r of reports) {
      const bd = (r as any).ai_visibility_breakdown as { overall?: number } | null
      if (bd?.overall != null) allScores.push(bd.overall)
    }
  }

  allScores.sort((a, b) => a - b)
  const below = allScores.filter((s) => s < userScore).length
  const percentile = allScores.length > 0
    ? Math.round((below / allScores.length) * 100)
    : 50

  const deltaFromAvg = userScore - benchmark.avgScore
  const rankLabel = percentile >= 90
    ? 'Top 10%'
    : percentile >= 75
      ? 'Top 25%'
      : percentile >= 50
        ? 'Top 50%'
        : `Bottom ${100 - percentile}%`

  // Generate insight
  let insight: string
  if (percentile >= 90) {
    insight = `Your AI visibility score of ${userScore} puts you in the top 10% of all audited sites. You're significantly ahead of the average (${benchmark.avgScore}).`
  } else if (percentile >= 75) {
    insight = `You're in the top 25% with a score of ${userScore} (avg: ${benchmark.avgScore}). A few targeted improvements could push you into the top 10%.`
  } else if (percentile >= 50) {
    insight = `Your score of ${userScore} is above average (${benchmark.avgScore}), but there's room to improve. Focus on structured data and content clarity.`
  } else if (percentile >= 25) {
    insight = `Your score of ${userScore} is below the average of ${benchmark.avgScore}. The fix playbooks in your audit report show exactly what to improve.`
  } else {
    insight = `Your score of ${userScore} is in the bottom quartile (avg: ${benchmark.avgScore}). Implementing the basic fix playbooks — especially JSON-LD and meta tags — could significantly improve your visibility.`
  }

  return {
    userScore,
    percentile,
    rankLabel,
    deltaFromAvg,
    benchmark,
    insight,
  }
}

function emptyBenchmark(industry: string): IndustryBenchmark {
  return {
    industry,
    sampleSize: 0,
    avgScore: 0,
    medianScore: 0,
    p90Score: 0,
    p10Score: 0,
    distribution: { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 },
  }
}
