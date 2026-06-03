// ============================================================
// Fixpath AI Interrogation — Shortlist Generator
// ============================================================
// Generates a workspace-specific ranked shortlist of questions
// by filtering and scoring the canonical question library using
// workspace context signals (category, region, language,
// competitors, recent finding themes).
//
// The shortlist is cached in the workspace_ai_question_sets
// table and refreshed every 7 days or on demand.
// ============================================================

import { SupabaseClient } from '@supabase/supabase-js'
import {
  CANONICAL_QUESTIONS,
  QuestionDef,
  QuestionFamily,
  Category,
} from './question-library'

/* ── Interfaces ─────────────────────────────────────────────── */

export interface WorkspaceContext {
  workspaceId: string
  domain: string
  brandName: string
  category: Category | null
  subcategory: string | null
  region: string | null
  country: string | null
  city: string | null
  language: string
  audienceType: string | null
  detectedIndustry: string | null
  competitorDomains: string[]
  recentFindingThemes: string[]
}

export interface RankedQuestion {
  questionId: string
  questionText: string
  family: QuestionFamily
  relevanceScore: number
  rankReason: string
}

/* ── Shortlist validity ─────────────────────────────────────── */

const SHORTLIST_VALIDITY_DAYS = 7
const SHORTLIST_SIZE = 10

/* ── Scoring helpers ────────────────────────────────────────── */

/**
 * Check whether a question's category matches the workspace.
 * null-category questions are always included (they're general).
 */
function categoryMatches(
  questionCategory: Category | null,
  workspaceCategory: Category | null,
  detectedIndustry: string | null,
): boolean {
  // General questions always match
  if (questionCategory === null) return true
  // If the workspace has an explicit category, compare directly
  if (workspaceCategory !== null) return questionCategory === workspaceCategory
  // Fall back to detected industry from the latest audit
  if (detectedIndustry !== null) return questionCategory === detectedIndustry
  // No category context — only include general questions
  return false
}

/**
 * Check whether a question's region matches the workspace.
 * null-region questions are global and always included.
 */
function regionMatches(
  questionRegion: string | null,
  workspaceRegion: string | null,
): boolean {
  if (questionRegion === null) return true
  if (workspaceRegion === null) return true
  return questionRegion === workspaceRegion
}

/**
 * Check whether a question's language matches the workspace.
 */
function languageMatches(
  questionLanguage: string,
  workspaceLanguage: string,
): boolean {
  return questionLanguage === workspaceLanguage
}

/**
 * Check if any of the question's intent tags overlap with competitor-related signals.
 * Competitor relevance is determined by the presence of competitor domains
 * plus intent tags like 'comparison', 'competitive', 'alternatives'.
 */
function hasCompetitorRelevance(
  question: QuestionDef,
  competitorDomains: string[],
): boolean {
  if (competitorDomains.length === 0) return false
  const competitiveIntents = ['comparison', 'competitive', 'alternatives', 'pros_cons']
  return question.intentTags.some((tag) => competitiveIntents.includes(tag))
}

/**
 * Check if any of the question's intent tags overlap with recent finding themes.
 * Finding themes are normalized strings from the latest audit findings.
 */
function hasFindingThemeRelevance(
  question: QuestionDef,
  recentFindingThemes: string[],
): boolean {
  if (recentFindingThemes.length === 0) return false
  const normalizedThemes = recentFindingThemes.map((t) => t.toLowerCase())
  return question.intentTags.some((tag) =>
    normalizedThemes.some(
      (theme) => theme.includes(tag) || tag.includes(theme),
    ),
  )
}

/**
 * Score a single question against the workspace context.
 * Returns a numeric relevance score (0-100+) and a human-readable reason.
 */
function scoreQuestion(
  question: QuestionDef,
  ctx: WorkspaceContext,
): { score: number; reason: string } {
  let score = question.priorityScore
  const reasons: string[] = []

  // Category match bonus: exact category match gets +20
  const effectiveCategory = ctx.category ?? (ctx.detectedIndustry as Category | null)
  if (question.category !== null && question.category === effectiveCategory) {
    score += 20
    reasons.push(`category match (${question.category})`)
  }

  // Region match bonus: exact region match gets +15
  if (
    question.region !== null &&
    ctx.region !== null &&
    question.region === ctx.region
  ) {
    score += 15
    reasons.push(`region match (${question.region})`)
  }

  // Competitor relevance bonus: +10
  if (hasCompetitorRelevance(question, ctx.competitorDomains)) {
    score += 10
    reasons.push('competitor relevance')
  }

  // Finding theme relevance bonus: +10
  if (hasFindingThemeRelevance(question, ctx.recentFindingThemes)) {
    score += 10
    reasons.push('finding theme relevance')
  }

  // Audience match bonus: +5 if audience types align
  if (
    question.audienceType !== null &&
    ctx.audienceType !== null &&
    question.audienceType === ctx.audienceType
  ) {
    score += 5
    reasons.push(`audience match (${question.audienceType})`)
  }

  const reason =
    reasons.length > 0
      ? `base(${question.priorityScore}) + ${reasons.join(', ')}`
      : `base score (${question.priorityScore})`

  return { score, reason }
}

/**
 * Interpolate the {business} placeholder in a question template.
 */
function interpolateQuestion(template: string, brandName: string): string {
  return template.replace(/\{business\}/g, brandName)
}

/* ── Main shortlist generation ──────────────────────────────── */

/**
 * Generate a ranked shortlist of the top questions for a workspace.
 *
 * Steps:
 *   1. Filter by category (exact match + general/null questions)
 *   2. Filter by region (exact match + global/null questions)
 *   3. Filter by language match
 *   4. Score remaining questions
 *   5. Take top N sorted by final score
 *   6. Interpolate {business} with brand name or domain
 *   7. Store in workspace_ai_question_sets table
 *   8. Return the ranked list
 */
export async function generateShortlist(
  ctx: WorkspaceContext,
  db: SupabaseClient,
): Promise<RankedQuestion[]> {
  const effectiveCategory =
    ctx.category ?? (ctx.detectedIndustry as Category | null)

  // 1-3. Filter questions
  const eligible = CANONICAL_QUESTIONS.filter((q) => {
    if (!categoryMatches(q.category, ctx.category, ctx.detectedIndustry))
      return false
    if (!regionMatches(q.region, ctx.region)) return false
    if (!languageMatches(q.language, ctx.language)) return false
    return true
  })

  // 4. Score each eligible question
  const scored = eligible.map((q) => {
    const { score, reason } = scoreQuestion(q, ctx)
    return { question: q, score, reason }
  })

  // 5. Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score)
  const topQuestions = scored.slice(0, SHORTLIST_SIZE)

  // 6. Build ranked results with interpolated text
  const displayName = ctx.brandName || ctx.domain
  const ranked: RankedQuestion[] = topQuestions.map((item) => ({
    questionId: item.question.id,
    questionText: interpolateQuestion(
      item.question.questionTemplate,
      displayName,
    ),
    family: item.question.family,
    relevanceScore: Math.min(item.score, 100),
    rankReason: item.reason,
  }))

  // 7. Store the shortlist in workspace_ai_question_sets
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + SHORTLIST_VALIDITY_DAYS)

  const rankingMetadata: Record<string, { score: number; reason: string }> = {}
  for (const item of topQuestions) {
    rankingMetadata[item.question.id] = {
      score: item.score,
      reason: item.reason,
    }
  }

  const { error: insertError } = await db
    .from('workspace_ai_question_sets')
    .insert({
      workspace_id: ctx.workspaceId,
      generated_at: new Date().toISOString(),
      valid_until: validUntil.toISOString(),
      category_snapshot: effectiveCategory,
      region_snapshot: ctx.region,
      language_snapshot: ctx.language,
      source_context: {
        domain: ctx.domain,
        brandName: ctx.brandName,
        category: ctx.category,
        subcategory: ctx.subcategory,
        detectedIndustry: ctx.detectedIndustry,
        audienceType: ctx.audienceType,
        competitorDomains: ctx.competitorDomains,
        recentFindingThemes: ctx.recentFindingThemes,
      },
      question_ids: ranked.map((r) => r.questionId),
      ranking_metadata: rankingMetadata,
    })

  if (insertError) {
    console.error(
      '[shortlist-generator] Failed to store question set:',
      insertError.message,
    )
  }

  return ranked
}

/* ── Get or refresh shortlist ───────────────────────────────── */

/**
 * Return the active shortlist for a workspace. If the existing
 * shortlist has expired (past valid_until) or none exists, fetch
 * the workspace context and regenerate.
 */
export async function getOrRefreshShortlist(
  workspaceId: string,
  db: SupabaseClient,
): Promise<RankedQuestion[]> {
  // 1. Check for existing valid shortlist
  const now = new Date().toISOString()

  const { data: existing, error: fetchError } = await db
    .from('workspace_ai_question_sets')
    .select('*')
    .eq('workspace_id', workspaceId)
    .gte('valid_until', now)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchError) {
    console.error(
      '[shortlist-generator] Error fetching existing shortlist:',
      fetchError.message,
    )
  }

  // 2. If valid shortlist exists, reconstruct RankedQuestion[] from stored data
  if (existing) {
    const questionIds: string[] = existing.question_ids ?? []
    const metadata: Record<string, { score: number; reason: string }> =
      existing.ranking_metadata ?? {}
    const sourceCtx = existing.source_context as Record<string, unknown> | null
    const displayName =
      (sourceCtx?.brandName as string) ||
      (sourceCtx?.domain as string) ||
      ''

    const ranked: RankedQuestion[] = questionIds
      .map((qid) => {
        const def = CANONICAL_QUESTIONS.find((q) => q.id === qid)
        if (!def) return null
        const meta = metadata[qid]
        return {
          questionId: qid,
          questionText: interpolateQuestion(
            def.questionTemplate,
            displayName,
          ),
          family: def.family,
          relevanceScore: Math.min(meta?.score ?? def.priorityScore, 100),
          rankReason: meta?.reason ?? 'cached',
        } satisfies RankedQuestion
      })
      .filter((r): r is RankedQuestion => r !== null)

    return ranked
  }

  // 3. Expired or missing — regenerate
  const ctx = await getWorkspaceContext(workspaceId, db)
  return generateShortlist(ctx, db)
}

/* ── Workspace context assembly ─────────────────────────────── */

/**
 * Assemble the full WorkspaceContext from multiple database sources:
 *   1. Core workspace fields (category, region, language, etc.)
 *   2. Latest audit's detected_industry as fallback for category
 *   3. Competitor domains from competitor_benchmarks
 *   4. Recent finding themes from latest audit findings
 */
export async function getWorkspaceContext(
  workspaceId: string,
  db: SupabaseClient,
): Promise<WorkspaceContext> {
  // 1. Fetch workspace core fields
  const { data: workspace, error: wsError } = await db
    .from('workspaces')
    .select(
      'id, primary_domain, brand_name, category, subcategory, region, country, city, language, audience_type',
    )
    .eq('id', workspaceId)
    .single()

  if (wsError || !workspace) {
    throw new Error(
      `[shortlist-generator] Workspace ${workspaceId} not found: ${wsError?.message ?? 'no data'}`,
    )
  }

  // 2. Fetch latest audit's detected_industry as category fallback
  let detectedIndustry: string | null = null
  const { data: latestAudit } = await db
    .from('audits')
    .select('id, detected_industry')
    .eq('workspace_id', workspaceId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestAudit?.detected_industry) {
    detectedIndustry = latestAudit.detected_industry
  }

  // 3. Fetch competitor domains from competitor_benchmarks
  //    The competitor_benchmarks table keys on user_id + domain,
  //    so we need the workspace's primary_domain to look up competitors.
  let competitorDomains: string[] = []

  if (workspace.primary_domain) {
    // Get the workspace owner's user_id for the competitor lookup
    const { data: wsOwner } = await db
      .from('workspaces')
      .select('user_id')
      .eq('id', workspaceId)
      .single()

    if (wsOwner?.user_id) {
      const normalizedDomain = workspace.primary_domain
        .replace(/^(https?:\/\/)?(www\.)?/, '')
        .replace(/\/$/, '')

      const { data: competitors } = await db
        .from('competitor_benchmarks')
        .select('competitor_domain')
        .eq('user_id', wsOwner.user_id)
        .eq('domain', normalizedDomain)

      if (competitors && competitors.length > 0) {
        competitorDomains = competitors
          .map((c) => c.competitor_domain)
          .filter(Boolean)
      }
    }
  }

  // 4. Fetch recent finding themes from latest audit findings
  let recentFindingThemes: string[] = []

  if (latestAudit?.id) {
    const { data: findings } = await db
      .from('audit_findings')
      .select('title, severity')
      .eq('audit_id', latestAudit.id)
      .in('severity', ['critical', 'high'])
      .order('sort_order', { ascending: true })
      .limit(20)

    if (findings && findings.length > 0) {
      // Extract broad theme keywords from finding titles
      const themes = new Set<string>()
      for (const f of findings) {
        const title = (f.title ?? '').toLowerCase()
        // Extract theme keywords from common UX/SEO patterns
        const themePatterns = [
          'trust',
          'credibility',
          'pricing',
          'navigation',
          'mobile',
          'accessibility',
          'performance',
          'seo',
          'content',
          'branding',
          'social_proof',
          'conversion',
          'clarity',
          'engagement',
          'security',
          'schema',
          'metadata',
          'speed',
          'usability',
          'readability',
        ]
        for (const theme of themePatterns) {
          if (title.includes(theme.replace('_', ' ')) || title.includes(theme)) {
            themes.add(theme)
          }
        }
      }
      recentFindingThemes = Array.from(themes)
    }
  }

  // 5. Assemble context
  return {
    workspaceId,
    domain: workspace.primary_domain ?? '',
    brandName: workspace.brand_name ?? '',
    category: (workspace.category as Category) ?? null,
    subcategory: workspace.subcategory ?? null,
    region: workspace.region ?? null,
    country: workspace.country ?? null,
    city: workspace.city ?? null,
    language: workspace.language ?? 'en',
    audienceType: workspace.audience_type ?? null,
    detectedIndustry,
    competitorDomains,
    recentFindingThemes,
  }
}
