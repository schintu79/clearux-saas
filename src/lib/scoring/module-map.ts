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
