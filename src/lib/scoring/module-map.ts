// ============================================================
// Module mapping — THE single categorizer for findings (2026-06-12)
// ============================================================
// Root cause of "report issues but not showing": Overview keyword-matched
// NULL-category_index findings into real modules (counts said 6), while
// Find & Fix mapped them strictly by index to a 'General' bucket the
// module filter never shows (click said 0). Two categorizers, two truths.
// Every surface now routes through this module. Client- and server-safe:
// no supabase, no react.

export const PHASE1_MODULES = [
  'Foundation',
  'Human Experience',
  'Inclusive Design',
  'Future Readiness',
  'SEO Structure & Rules',
  'Accessibility Readiness',
  'Design Consistency',
] as const

/**
 * Keyword fallback for findings with NULL category_index (legacy rows
 * carried forward from before the carry-forward fidelity fix — NULL
 * propagates through every baseline re-audit, it never self-heals).
 * Returns the matched module index, or null when nothing matches.
 */
export function keywordModuleIndexFor(title?: string | null, description?: string | null): number | null {
  const text = `${title || ''} ${description || ''}`.toLowerCase()
  if (!text.trim()) return null
  for (let i = 0; i < PHASE1_MODULES.length; i++) {
    const words = PHASE1_MODULES[i].toLowerCase().split(/[&,\s]+/).filter((w) => w.length > 3)
    if (words.some((w) => text.includes(w))) return i
  }
  return null
}

/**
 * Topical miscategorization corrections (2026-06-12).
 *
 * The analyzer stamps every finding with the category it was generated
 * UNDER — when the LLM drifts off-topic mid-category, the finding inherits
 * a category it doesn't belong to. First confirmed case: a security/
 * data-handling-transparency finding born during 'On-Page SEO Fundamentals'
 * (category 16) rendered under the SEO module. Findings carry forward
 * verbatim on baseline re-audits, so the correction must run at the
 * quality gate (sees every finding every run), not only at generation.
 *
 * Rules are deliberately NARROW: strong topical signal for the target
 * category AND zero signal for the current one. Returns the corrected
 * category_index, or null when no correction applies.
 */
const SECURITY_TRUST_SIGNAL = /\b(security|privacy|data\s+(handling|protection|processing|retention)|gdpr|ccpa|personal\s+data|pii|confidentialit)/i
const SEO_SIGNAL = /\b(seo|meta\s+(title|description|tag)|title\s+tag|serp|search\s+engine|ranking|keyword|sitemap|crawlab|canonical|robots\.txt|index(ing|abilit)|hreflang|backlink|rich\s+(result|snippet)|structured\s+data)/i

export function correctedCategoryIndexFor(
  categoryIndex: number | null | undefined,
  title?: string | null,
  description?: string | null,
): number | null {
  if (typeof categoryIndex !== 'number') return null
  const text = `${title || ''} ${description || ''}`
  // Security/privacy/data-handling finding sitting in an SEO category
  // (16-19) → Trust, Credibility & Social Proof (category 5, module 1).
  if (categoryIndex >= 16 && categoryIndex <= 19 && SECURITY_TRUST_SIGNAL.test(text) && !SEO_SIGNAL.test(text)) {
    return 5
  }
  return null
}

/**
 * Module index for a finding: explicit category_index wins; NULL falls
 * back to keywords; unmatched lands in Foundation (index 0) — the same
 * catch-all Overview always used, so counts and lists agree everywhere.
 */
export function moduleIndexFor(
  categoryIndex: number | null | undefined,
  title?: string | null,
  description?: string | null,
): number {
  if (typeof categoryIndex === 'number' && categoryIndex >= 0) {
    return Math.max(0, Math.min(PHASE1_MODULES.length - 1, Math.floor(categoryIndex / 4)))
  }
  return keywordModuleIndexFor(title, description) ?? 0
}
