// ============================================================
// ClearUX Proprietary Pipeline — Deduplication Engine
// ============================================================
//
// PURPOSE:
// Raw AI findings often contain duplicates — the same issue phrased
// differently, the same root cause surfaced from multiple angles,
// or near-identical findings on related pages. This module catches
// and merges them so the user sees clean, non-redundant results.
//
// HOW IT WORKS:
// 1. Normalize all text → lowercase, strip punctuation
// 2. Replace synonyms with canonical forms (26 synonym groups)
// 3. Calculate word-overlap similarity (Jaccard-like ratio)
// 4. Boost similarity when findings share a topic fingerprint
// 5. Apply adaptive thresholds based on context:
//    - Same page + same module → tightest (0.38)
//    - Same module only → medium (0.42)
//    - Cross-module → loosest (0.50)
// 6. Group duplicates, keep highest severity, delete the rest
//
// WHEN TO IMPROVE THIS FILE:
// - If audits still show duplicate findings → add synonym groups or topic patterns
// - If unrelated findings are being merged → raise thresholds or refine topic keywords
// - If a new audit category produces unique jargon → add a synonym group for it
// ============================================================

export interface FindingForDedup {
  id: string
  title: string
  description: string
  severity: string
  page_url: string | null
  sort_order: number
}

// ── Severity ranking (lower = more severe) ───────────────────

export const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

// ── Synonym groups ───────────────────────────────────────────
// Words in the same group are treated as identical during comparison.
// Add new groups when a recurring near-duplicate escapes detection.

export const SYNONYM_GROUPS: string[][] = [
  ['unclear', 'ambiguous', 'vague', 'confusing', 'obscure', 'misleading'],
  ['users', 'audiences', 'visitors', 'people', 'customers', 'prospects'],
  ['lacks', 'missing', 'absent', 'without', 'none', 'gaps'],
  ['inconsistent', 'uneven', 'irregular', 'varied', 'mixed', 'asymmetric'],
  ['navigation', 'menu', 'navbar', 'links', 'linking', 'cross-links'],
  ['accessibility', 'a11y', 'accessible', 'wcag', 'inclusive'],
  ['responsive', 'mobile', 'adaptive', 'touch'],
  ['performance', 'speed', 'loading', 'slow', 'fast'],
  ['visual', 'design', 'aesthetic', 'appearance', 'look'],
  ['hierarchy', 'structure', 'organization', 'layout'],
  ['feedback', 'response', 'indication', 'notification', 'confirmation', 'success'],
  ['contrast', 'readability', 'legibility', 'readable'],
  ['value', 'proposition', 'benefit', 'offering'],
  ['content', 'copy', 'text', 'messaging', 'message', 'wording', 'language'],
  ['error', 'failure', 'issue', 'problem'],
  ['button', 'action', 'control', 'element'],
  ['headline', 'heading', 'title', 'hero'],
  ['free', 'trial', 'freemium', 'offer'],
  ['trust', 'credibility', 'confidence', 'reassurance', 'proof'],
  ['consent', 'checkbox', 'opt-in', 'opt-out', 'subscribe', 'updates'],
  ['pricing', 'price', 'cost', 'credit', 'credits', 'audit', 'audits'],
  ['signup', 'register', 'registration', 'sign-up', 'onboarding'],
  ['login', 'sign-in', 'signin', 'authentication'],
  ['form', 'input', 'field', 'fields', 'label', 'labels'],
  ['clarity', 'clear', 'explicit', 'transparent', 'transparency'],
  ['technical', 'non-technical', 'jargon', 'terminology'],
]

// ── Topic fingerprints ───────────────────────────────────────
// Detect findings about the same concept regardless of wording.
// If both findings match 2+ keywords in the same topic, they get
// a similarity boost. Add new topics for recurring false negatives.

export const TOPIC_PATTERNS: { topic: string; keywords: string[] }[] = [
  { topic: 'hero_headline', keywords: ['hero', 'headline', 'h1', 'homepage', 'value', 'proposition', 'audience'] },
  { topic: 'free_offer', keywords: ['free', 'first', 'audit', 'trial', 'expir', 'ambig', 'urgency'] },
  { topic: 'auth_trust', keywords: ['login', 'register', 'signup', 'trust', 'privacy', 'credential', 'password'] },
  { topic: 'consent_optin', keywords: ['consent', 'checkbox', 'opt', 'update', 'marketing', 'subscribe'] },
  { topic: 'pricing_clarity', keywords: ['pricing', 'price', 'credit', 'cost', 'audit', 'pack', 'breakdown'] },
  { topic: 'contact_form', keywords: ['contact', 'form', 'submit', 'success', 'feedback', 'confirm'] },
  { topic: 'nav_crosslinks', keywords: ['navigation', 'cross-link', 'internal', 'linking', 'demo', 'report'] },
  { topic: 'structured_data', keywords: ['schema', 'json-ld', 'structured', 'breadcrumb', 'rich', 'snippet'] },
  { topic: 'meta_tags', keywords: ['meta', 'open graph', 'twitter', 'card', 'og:'] },
  { topic: 'focus_a11y', keywords: ['focus', 'indicator', 'keyboard', 'wcag', 'screen reader'] },
]

// ── Similarity thresholds ────────────────────────────────────
// Adaptive: tighter context = lower threshold needed to merge.

export const THRESHOLDS = {
  BASE: 0.50,              // Cross-module findings
  SAME_MODULE: 0.42,       // Same module (4 categories share context)
  SAME_PAGE_MODULE: 0.38,  // Same page + same module (very likely dups)
  TOPIC_FLOOR: 0.40,       // Minimum similarity for same-topic findings
  TOPIC_BOOST: 0.10,       // Additional boost for shared topic
}

// ── Internal helpers ─────────────────────────────────────────

function buildSynonymMap(groups: string[][]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const group of groups) {
    const canonical = group[0]
    for (const word of group) {
      map[word] = canonical
    }
  }
  return map
}

const synonymMap = buildSynonymMap(SYNONYM_GROUPS)

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractWords(text: string): Set<string> {
  return new Set(
    normalizeTitle(text)
      .split(' ')
      .filter((w) => w.length >= 4)
      .map((w) => synonymMap[w] || w)
  )
}

function textSimilarity(a: string, b: string): number {
  const wordsA = extractWords(a)
  const wordsB = extractWords(b)
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let overlap = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++
  }
  return overlap / Math.min(wordsA.size, wordsB.size)
}

function sharedTopic(findingA: FindingForDedup, findingB: FindingForDedup): boolean {
  const textA = normalizeTitle(`${findingA.title} ${findingA.description}`)
  const textB = normalizeTitle(`${findingB.title} ${findingB.description}`)
  for (const { keywords } of TOPIC_PATTERNS) {
    const aHits = keywords.filter((k) => textA.includes(k)).length
    const bHits = keywords.filter((k) => textB.includes(k)).length
    if (aHits >= 2 && bHits >= 2) return true
  }
  return false
}

function combinedSimilarity(a: FindingForDedup, b: FindingForDedup): number {
  const titleSim = textSimilarity(a.title, b.title)
  const descSim = textSimilarity(a.description, b.description)
  let score = titleSim * 0.7 + descSim * 0.3
  if (sharedTopic(a, b)) {
    score = Math.max(score, THRESHOLDS.TOPIC_FLOOR)
    score += THRESHOLDS.TOPIC_BOOST
  }
  return Math.min(score, 1.0)
}

function sameModule(a: FindingForDedup, b: FindingForDedup): boolean {
  return Math.floor((a.sort_order ?? 0) / 4) === Math.floor((b.sort_order ?? 0) / 4)
}

function samePage(a: FindingForDedup, b: FindingForDedup): boolean {
  return !!(a.page_url && b.page_url && a.page_url === b.page_url)
}

// ── Public API ───────────────────────────────────────────────

/**
 * Identify duplicate findings and return the IDs to remove.
 * Keeps the finding with highest severity (and earliest sort_order as tiebreaker).
 */
export function identifyDuplicates(findings: FindingForDedup[]): string[] {
  if (findings.length < 2) return []

  const duplicateIds: string[] = []
  const seen = new Set<number>()

  for (let i = 0; i < findings.length; i++) {
    if (seen.has(i)) continue
    const group: number[] = [i]

    for (let j = i + 1; j < findings.length; j++) {
      if (seen.has(j)) continue
      const sim = combinedSimilarity(findings[i], findings[j])
      let threshold = THRESHOLDS.BASE
      if (sameModule(findings[i], findings[j]) && samePage(findings[i], findings[j])) {
        threshold = THRESHOLDS.SAME_PAGE_MODULE
      } else if (sameModule(findings[i], findings[j])) {
        threshold = THRESHOLDS.SAME_MODULE
      }
      if (sim >= threshold) {
        group.push(j)
        seen.add(j)
      }
    }

    if (group.length > 1) {
      // Sort: highest severity first, then earliest sort_order
      group.sort((a, b) => {
        const sevA = SEVERITY_RANK[findings[a].severity] ?? 2
        const sevB = SEVERITY_RANK[findings[b].severity] ?? 2
        if (sevA !== sevB) return sevA - sevB
        return (findings[a].sort_order ?? 0) - (findings[b].sort_order ?? 0)
      })
      // All except the best are duplicates
      for (let k = 1; k < group.length; k++) {
        duplicateIds.push(findings[group[k]].id)
      }
    }
  }

  return duplicateIds
}
