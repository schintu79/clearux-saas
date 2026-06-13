// ============================================================
// axe-core → Fixpath findings mapper (Phase 1, item 1)
// ============================================================
// Turns axe-core's accessibility violations (run in the browser pass) into
// Fixpath finding shapes. Pure + dependency-free (no axe-core import, no
// puppeteer, no supabase) so it is fully unit-testable and the browser-side
// injection can evolve independently.
//
// Doctrine:
//   • These are DETERMINISTIC, instrument-measured findings → they land in
//     the 'verified' evidence tier (confidence_level 'deterministic'). This
//     is the Phase 1 lever that lifts the verified mix toward ≥40%.
//   • Severity follows the WCAG severity doctrine (critical reserved for true
//     blockers): axe 'critical'/'serious' impact → 'high', 'moderate' →
//     'medium', 'minor' → 'low'. We never mint a Fixpath 'critical' from an
//     axe impact label — that cap is reserved for genuine conversion blockers
//     decided elsewhere (enforceWcagSeverityDoctrine).
//   • Every finding carries a real element selector + the failing HTML as
//     evidence — "show your work".
// ============================================================

/* ── axe-core result shapes (minimal — only what we consume) ── */

export interface AxeNode {
  target?: string[]
  html?: string
  failureSummary?: string
}

export interface AxeViolation {
  id: string
  impact?: 'minor' | 'moderate' | 'serious' | 'critical' | null
  help: string
  description: string
  helpUrl?: string
  tags?: string[]
  nodes: AxeNode[]
}

/* ── Output shape (pipeline wraps this into a DB row) ── */

export interface AxeMappedFinding {
  title: string
  description: string
  recommendation: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  targetElement: string | null
  evidence: string
  wcagCriterion: string | null
  /** Accessibility Readiness (module 5) — categories 20-23. */
  categoryIndex: number
  pageUrl: string
  detectionSource: 'axe'
  confidenceLevel: 'deterministic'
}

const ACCESSIBILITY_CATEGORY_INDEX = 20

/** axe impact → Fixpath severity (doctrine: no axe-minted 'critical'). */
export function mapAxeImpact(impact: AxeViolation['impact']): 'high' | 'medium' | 'low' {
  switch (impact) {
    case 'critical':
    case 'serious':
      return 'high'
    case 'moderate':
      return 'medium'
    default:
      return 'low'
  }
}

/** Extract a "1.4.3"-style criterion from axe tags like "wcag143" / "wcag2aa". */
export function wcagCriterionFromTags(tags: string[] | undefined): string | null {
  if (!tags) return null
  for (const t of tags) {
    const m = t.match(/^wcag(\d)(\d)(\d+)$/) // wcag143 → 1.4.3
    if (m) return `${m[1]}.${m[2]}.${m[3]}`
  }
  return null
}

/**
 * Map axe-core violations from a single page into Fixpath findings.
 * One finding per violation rule (axe already groups affected nodes), with
 * up to `maxNodesInEvidence` selectors quoted as evidence. Returns at most
 * `maxFindings` findings, highest-severity first.
 */
export function mapAxeViolationsToFindings(
  violations: AxeViolation[],
  pageUrl: string,
  opts: { maxFindings?: number; maxNodesInEvidence?: number } = {},
): AxeMappedFinding[] {
  const maxFindings = opts.maxFindings ?? 15
  const maxNodes = opts.maxNodesInEvidence ?? 3
  const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

  const findings: AxeMappedFinding[] = (violations || [])
    .filter((v) => v && v.id && Array.isArray(v.nodes) && v.nodes.length > 0)
    .map((v) => {
      const severity = mapAxeImpact(v.impact)
      const criterion = wcagCriterionFromTags(v.tags)
      const selectors = v.nodes
        .map((n) => (Array.isArray(n.target) ? n.target.join(' ') : ''))
        .filter(Boolean)
      const primarySelector = selectors[0] || null
      const shownSelectors = selectors.slice(0, maxNodes)
      const extra = selectors.length - shownSelectors.length
      const evidenceParts = [
        `${v.nodes.length} element${v.nodes.length === 1 ? '' : 's'} affected`,
        shownSelectors.length ? `e.g. ${shownSelectors.join(', ')}${extra > 0 ? ` (+${extra} more)` : ''}` : '',
      ].filter(Boolean)

      const titlePrefix = criterion ? `[WCAG ${criterion}] ` : ''
      return {
        title: `${titlePrefix}${v.help}`,
        description: v.description || v.help,
        recommendation: v.helpUrl ? `${v.help}. Reference: ${v.helpUrl}` : v.help,
        severity,
        targetElement: primarySelector,
        evidence: evidenceParts.join(' — '),
        wcagCriterion: criterion,
        categoryIndex: ACCESSIBILITY_CATEGORY_INDEX,
        pageUrl,
        detectionSource: 'axe' as const,
        confidenceLevel: 'deterministic' as const,
      }
    })

  findings.sort((a, b) => (SEV_RANK[a.severity] - SEV_RANK[b.severity]))
  return findings.slice(0, maxFindings)
}
