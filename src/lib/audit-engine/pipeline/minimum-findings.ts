// ============================================================
// ClearUX Proprietary Pipeline — Post-Report Minimum Findings Enforcement
// ============================================================
//
// PURPOSE:
// After all filtering (dedup, speculative, relevance) and report
// generation, some categories may have low scores but 0 findings.
// This creates a trust-destroying disconnect: a user sees a 45/100
// category score but no findings explaining what's wrong.
//
// This module:
// 1. Detects "starved" categories (low score, 0 findings)
// 2. Generates targeted synthetic findings using AI, based on the
//    category summary from the report (which explains WHY the score
//    is low) — so findings are grounded in actual analysis, not invented.
//
// RULE:
// - Category score < 70 with 0 findings → generate 1-2 findings
// - Category score < 50 with 0 findings → generate 2-3 findings
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import type { AnalysisFinding } from '../analyzer'

let _anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.')
    _anthropic = new Anthropic({ apiKey, timeout: 45_000 })
  }
  return _anthropic
}

export interface CategoryFindingCount {
  categoryName: string
  categoryIndex: number
  score: number
  findingCount: number
  summary?: string
}

/**
 * Module index ranges (must match analyzer.ts MODULE_RANGES)
 */
const MODULE_RANGES: Record<string, [number, number]> = {
  foundation: [0, 4],
  human_experience: [4, 8],
  inclusive_design: [8, 12],
  future_readiness: [12, 16],
  seo_structure: [16, 20],
  brand_consistency: [20, 24],
}

/**
 * Check for categories where score < threshold but findings are scarce.
 * Returns categories that are "starved" — low score, few/no findings.
 */
export function identifyStarvedCategories(
  categoryScores: Array<{ name: string; score: number; summary?: string }>,
  findingsPerCategory: Record<string, number>,
  scoreThreshold = 70,
): CategoryFindingCount[] {
  const starved: CategoryFindingCount[] = []

  for (let i = 0; i < categoryScores.length; i++) {
    const cat = categoryScores[i]
    const count = findingsPerCategory[cat.name] ?? 0

    if (cat.score < scoreThreshold && count === 0) {
      starved.push({
        categoryName: cat.name,
        categoryIndex: i,
        score: cat.score,
        findingCount: count,
        summary: cat.summary,
      })
    }
  }

  return starved
}

/**
 * Get the module name for a category index.
 */
export function getModuleForCategory(categoryIndex: number): string {
  for (const [mod, [start, end]] of Object.entries(MODULE_RANGES)) {
    if (categoryIndex >= start && categoryIndex < end) return mod
  }
  return 'unknown'
}

/**
 * Generate findings for starved categories using AI.
 * Uses the category summary from generateReport() as grounding context —
 * so findings are based on what the AI already identified as problems,
 * not invented from nothing.
 */
export async function generateFindingsForStarvedCategories(
  starvedCategories: CategoryFindingCount[],
  siteUrl: string,
  language: string = 'en',
): Promise<Map<number, AnalysisFinding[]>> {
  if (starvedCategories.length === 0) return new Map()

  const anthropic = getAnthropicClient()
  const results = new Map<number, AnalysisFinding[]>()

  for (const cat of starvedCategories) {
    const targetCount = cat.score < 50 ? 3 : 2
    const summaryContext = cat.summary
      ? `The AI report summary for this category states: "${cat.summary}"`
      : `This category scored ${cat.score}/100 but no specific summary was provided.`

    const prompt = `You are a UX auditor. A website audit scored the category "${cat.categoryName}" at ${cat.score}/100, but all specific findings were filtered out during quality checks.

${summaryContext}

Website: ${siteUrl}

Based ONLY on what the category summary tells you (do not invent issues not mentioned in the summary), generate ${targetCount} specific, actionable findings that explain why this category scored low.

Rules:
- Each finding must be grounded in the summary — do NOT invent problems not mentioned
- Each finding must have a clear, specific recommendation
- Severity should match the score: below 50 → at least one "high", below 70 → at least one "medium"
- Keep descriptions concise (2-3 sentences max)
- Do NOT use speculative language like "may", "might", "could potentially"
- State issues as facts based on the audit analysis
${language !== 'en' ? `- Write ALL text in the language matching this code: ${language}` : ''}

Return ONLY a valid JSON array:
[{
  "severity": "critical" | "high" | "medium" | "low",
  "title": "Short descriptive title",
  "description": "What the issue is and why it matters",
  "recommendation": "Specific action to fix it",
  "estimatedImpact": "Business impact of fixing this"
}]`

    try {
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      })

      const responseText = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')

      const jsonMatch = responseText.match(/\[[\s\S]*\]/m)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as AnalysisFinding[]
        const findings: AnalysisFinding[] = parsed.slice(0, targetCount).map((f) => ({
          severity: f.severity,
          title: f.title,
          description: f.description,
          recommendation: f.recommendation,
          estimatedImpact: f.estimatedImpact || undefined,
          targetElement: null,
          pageUrl: siteUrl,
          categoryIndex: cat.categoryIndex,
        }))
        results.set(cat.categoryIndex, findings)
      }
    } catch (err) {
      console.warn(`[minimum-findings] Failed to generate findings for "${cat.categoryName}":`, err)
      // Non-fatal — continue with other categories
    }
  }

  return results
}
