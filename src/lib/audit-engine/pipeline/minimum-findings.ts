// ============================================================
// ClearUX Proprietary Pipeline — Post-Filter Minimum Findings Check
// ============================================================
//
// PURPOSE:
// After dedup, speculative filter, and relevance scorer run,
// some categories may have lost all their findings despite having
// low scores. This module detects that gap and logs it so we
// can track pipeline over-filtering.
//
// RULE:
// If a category scores below 80 but has 0 findings after filtering,
// we log a warning. The prompt already instructs the AI to generate
// at least 2 findings for sub-80 categories — this module catches
// cases where filtering removed them anyway.
//
// FUTURE:
// Could trigger a targeted re-analysis for starved categories,
// or add synthetic "see related findings" cross-references.
// ============================================================

export interface CategoryFindingCount {
  categoryName: string
  categoryIndex: number
  score: number
  findingCount: number
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
  categoryScores: Array<{ name: string; score: number }>,
  findingsPerCategory: Record<string, number>,
  scoreThreshold = 80,
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
