/**
 * Content Gap Generator — Tier 2
 *
 * For each prompt where the brand is invisible in AI responses,
 * generates a specific content brief telling the user exactly what
 * to publish to become visible for that query.
 *
 * This turns "you're not mentioned" into "publish THIS to fix it."
 */

import Anthropic from '@anthropic-ai/sdk'
import { createServiceSupabase } from '@/lib/supabase-server'

/* ── Types ───────────────────────────────────────────── */

export interface ContentBrief {
  promptText: string
  promptCategory: string | null
  recommendedTopic: string
  recommendedFormat: 'blog_post' | 'case_study' | 'comparison_page' | 'faq' | 'data_report' | 'landing_page' | 'guide'
  recommendedAngle: string
  targetWordCount: number
  keyPoints: string[]
  targetKeywords: string[]
  estimatedImpact: 'high' | 'medium' | 'low'
}

export interface ContentGapAnalysis {
  gaps: ContentBrief[]
  totalGapsFound: number
  highImpactCount: number
  generatedAt: string
}

/* ── Brief generation ────────────────────────────────── */

const CONTENT_BRIEF_PROMPT = `You are a content strategist. A brand is invisible in AI responses for the following prompts.
For each prompt, generate a specific content brief that, if published, would make the brand appear in AI responses for similar queries.

Rules:
- Be extremely specific — not "write about X" but "publish a 1500-word comparison of [specific tools] with a table showing [specific metrics]"
- Recommend the format most likely to be cited by AI models (data reports, comprehensive guides, comparison pages)
- Include specific keywords that AI models associate with this query space
- Consider what content AI models actually reference when answering these prompts

Return JSON only:
[
  {
    "promptText": "the original prompt",
    "recommendedTopic": "specific article/page title",
    "recommendedFormat": "blog_post"|"case_study"|"comparison_page"|"faq"|"data_report"|"landing_page"|"guide",
    "recommendedAngle": "specific angle/hook that differentiates from existing content",
    "targetWordCount": number,
    "keyPoints": ["specific point to cover", "another point"],
    "targetKeywords": ["keyword1", "keyword2"],
    "estimatedImpact": "high"|"medium"|"low"
  }
]`

export async function generateContentBriefs(
  brandName: string,
  brandDomain: string,
  invisiblePrompts: Array<{ promptText: string; category: string | null; competitorsMentioned?: string[] }>,
): Promise<ContentBrief[]> {
  if (invisiblePrompts.length === 0) return []

  try {
    const client = new Anthropic()

    const promptsText = invisiblePrompts
      .map((p, i) => {
        let line = `${i + 1}. "${p.promptText}"`
        if (p.competitorsMentioned && p.competitorsMentioned.length > 0) {
          line += ` (competitors mentioned: ${p.competitorsMentioned.join(', ')})`
        }
        return line
      })
      .join('\n')

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `${CONTENT_BRIEF_PROMPT}

Brand: "${brandName}" (${brandDomain})

Prompts where this brand is NOT mentioned by AI:
${promptsText}

Generate a content brief for each prompt that would make "${brandName}" appear in AI responses.`,
      }],
    })

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    const parsed = JSON.parse(text)

    return (parsed || []).map((b: any, i: number) => ({
      promptText: b.promptText || invisiblePrompts[i]?.promptText || '',
      promptCategory: invisiblePrompts[i]?.category || null,
      recommendedTopic: b.recommendedTopic || '',
      recommendedFormat: b.recommendedFormat || 'blog_post',
      recommendedAngle: b.recommendedAngle || '',
      targetWordCount: b.targetWordCount || 1500,
      keyPoints: b.keyPoints || [],
      targetKeywords: b.targetKeywords || [],
      estimatedImpact: b.estimatedImpact || 'medium',
    }))
  } catch {
    return []
  }
}

/* ── Public API ──────────────────────────────────────── */

/**
 * Analyze prompt results to find gaps and generate content briefs.
 * Stores briefs in the content_gaps table for the user to action.
 */
export async function analyzeContentGaps(params: {
  auditId: string
  userId: string
  brandDomain: string
  brandName: string
  promptResults: Array<{
    promptText: string
    category: string | null
    brandMentioned: boolean
    competitorsMentioned: Array<{ name: string }>
  }>
}): Promise<ContentGapAnalysis> {
  const { auditId, userId, brandDomain, brandName, promptResults } = params

  // Find prompts where brand is NOT mentioned
  const invisiblePrompts = promptResults
    .filter(r => !r.brandMentioned)
    .map(r => ({
      promptText: r.promptText,
      category: r.category,
      competitorsMentioned: r.competitorsMentioned.map(c => c.name),
    }))

  if (invisiblePrompts.length === 0) {
    return {
      gaps: [],
      totalGapsFound: 0,
      highImpactCount: 0,
      generatedAt: new Date().toISOString(),
    }
  }

  // Generate briefs (batch in groups of 5 for quality)
  const allBriefs: ContentBrief[] = []
  const batchSize = 5
  for (let i = 0; i < invisiblePrompts.length; i += batchSize) {
    const batch = invisiblePrompts.slice(i, i + batchSize)
    const briefs = await generateContentBriefs(brandName, brandDomain, batch)
    allBriefs.push(...briefs)
  }

  // Store in DB
  const db = createServiceSupabase()
  for (const brief of allBriefs) {
    await db.from('content_gaps').insert({
      audit_id: auditId,
      user_id: userId,
      brand_domain: brandDomain,
      prompt_text: brief.promptText,
      prompt_category: brief.promptCategory,
      recommended_topic: brief.recommendedTopic,
      recommended_format: brief.recommendedFormat,
      recommended_angle: brief.recommendedAngle,
      target_word_count: brief.targetWordCount,
      key_points: brief.keyPoints,
      target_keywords: brief.targetKeywords,
      estimated_impact: brief.estimatedImpact,
      status: 'open',
    } as any)
  }

  const highImpactCount = allBriefs.filter(b => b.estimatedImpact === 'high').length

  return {
    gaps: allBriefs,
    totalGapsFound: allBriefs.length,
    highImpactCount,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Get existing content gaps for a brand from the database.
 */
export async function getContentGaps(
  auditId: string,
  status?: 'open' | 'in_progress' | 'published' | 'dismissed',
): Promise<ContentBrief[]> {
  const db = createServiceSupabase()

  let query = db
    .from('content_gaps')
    .select('*')
    .eq('audit_id', auditId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data } = await query

  return (data || []).map((d: any) => ({
    promptText: d.prompt_text,
    promptCategory: d.prompt_category,
    recommendedTopic: d.recommended_topic,
    recommendedFormat: d.recommended_format,
    recommendedAngle: d.recommended_angle,
    targetWordCount: d.target_word_count,
    keyPoints: d.key_points || [],
    targetKeywords: d.target_keywords || [],
    estimatedImpact: d.estimated_impact,
  }))
}
