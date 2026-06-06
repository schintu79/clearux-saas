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
  category_index?: number | null
  confidence_level?: 'deterministic' | 'heuristic' | 'interpretive'
  detection_source?: string
}

// ── Confidence ranking (lower = more confident) ─────────────
export const CONFIDENCE_RANK: Record<string, number> = {
  deterministic: 0,
  heuristic: 1,
  interpretive: 2,
}

// ── Template grouping result ────────────────────────────────
export interface TemplateGroup {
  /** The primary finding ID to keep */
  primaryId: string
  /** IDs of findings absorbed into the group (to delete) */
  absorbedIds: string[]
  /** All page URLs across the group */
  pageUrls: string[]
  /** Count of distinct pages affected */
  pageCount: number
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
  // NARROWED (regression fix): "text" and "content" are too generic
  ['copy', 'messaging', 'message', 'wording'],
  ['language', 'lang', 'locale', 'localization', 'i18n', 'multilingual', 'hreflang'],
  ['error', 'failure', 'issue', 'problem'],
  // NARROWED (regression fix): "element" is too generic to be a synonym for "button"
  ['button', 'control'],
  ['headline', 'heading', 'title', 'hero', 'h1'],
  ['free', 'trial', 'freemium', 'offer'],
  ['trust', 'credibility', 'confidence', 'reassurance', 'proof'],
  ['consent', 'checkbox', 'opt-in', 'opt-out', 'subscribe', 'updates'],
  // SPLIT (regression fix): "pricing" and "credit" and "audit" are distinct business concepts.
  // Merging them caused findings about pricing transparency, credit systems, and audit quality
  // to be treated as duplicates of each other.
  ['pricing', 'price', 'cost'],
  ['credit', 'credits'],
  ['signup', 'register', 'registration', 'sign-up', 'onboarding'],
  ['login', 'sign-in', 'signin', 'authentication'],
  // NARROWED (regression fix): "label" is distinct from "form" — label issues vs form issues
  ['form', 'input', 'field', 'fields'],
  ['label', 'labels'],
  ['clarity', 'clear', 'explicit', 'transparent', 'transparency'],
  ['technical', 'non-technical', 'jargon', 'terminology'],
  ['cta', 'call-to-action', 'call to action', 'conversion', 'convert'],
  ['dark', 'patterns', 'manipulative', 'deceptive', 'confirmshaming'],
  ['seo', 'search', 'crawl', 'index', 'indexing', 'ranking'],
  ['sitemap', 'robots', 'crawlability', 'discoverability'],
  // NARROWED (regression fix): "section" is structurally different from "page"
  ['page', 'screen', 'view', 'route'],
  ['across', 'throughout', 'multiple', 'various', 'several', 'every'],
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
  { topic: 'heading_seo', keywords: ['h1', 'heading', 'headline', 'semantic', 'structure', 'hierarchy'] },
  { topic: 'canonical_url', keywords: ['canonical', 'mismatch', 'duplicate', 'domain', 'redirect', 'self-referenc'] },
  { topic: 'robots_sitemap', keywords: ['robots', 'sitemap', 'crawl', 'index', 'discoverability', 'xml'] },
  { topic: 'dark_patterns', keywords: ['dark', 'pattern', 'manipul', 'confirmshaming', 'deceptive', 'urgency'] },
  { topic: 'cta_clarity', keywords: ['cta', 'call', 'action', 'button', 'conversion', 'click'] },
  { topic: 'mobile_responsive', keywords: ['mobile', 'responsive', 'touch', 'viewport', 'breakpoint', 'adaptive'] },
  { topic: 'lang_i18n', keywords: ['lang', 'language', 'attribute', 'locali', 'internation', 'italian', 'english', 'mismatch', 'tagging', 'hreflang', 'multilingual'] },
  { topic: 'meta_description_i18n', keywords: ['meta', 'description', 'language', 'mismatch', 'italian', 'english', 'locali', 'translat'] },
]

// ── Similarity thresholds ────────────────────────────────────
// Adaptive: tighter context = lower threshold needed to merge.

export const THRESHOLDS = {
  BASE: 0.55,              // Cross-module findings (raised from 0.50 — less aggressive merging)
  SAME_MODULE: 0.50,       // Same module (raised from 0.42 — distinct issues within same module preserved)
  SAME_PAGE_MODULE: 0.45,  // Same page + same module (raised from 0.38 — only true dups merge)
  TOPIC_FLOOR: 0.35,       // Minimum similarity for same-topic findings (lowered from 0.40 — topic alone cannot drive merge)
  TOPIC_BOOST: 0.05,       // Additional boost for shared topic (halved from 0.10 — topic is a hint, not a verdict)
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

/**
 * Normalize a word to its stem-like form by stripping common suffixes.
 * Not a full stemmer — just handles the most common plural/verb forms
 * that cause false negatives in dedup.
 */
function normalizeSuffix(word: string): string {
  // Already short — don't strip
  if (word.length <= 5) return word
  // -ies → -y (e.g. "categories" → "category" — but only > 6 chars to avoid "dies" → "dy")
  if (word.length > 6 && word.endsWith('ies')) return word.slice(0, -3) + 'y'
  // -es → strip (e.g. "pages" → "page", "fixes" → "fix")
  if (word.length > 5 && word.endsWith('es')) return word.slice(0, -2)
  // -s → strip (e.g. "headlines" → "headline", "users" → "user")
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

function extractWords(text: string): Set<string> {
  return new Set(
    normalizeTitle(text)
      .split(' ')
      .filter((w) => w.length >= 4)
      .map((w) => {
        // Apply synonym map first, then normalize suffix for anything not in the map
        if (synonymMap[w]) return synonymMap[w]
        const stemmed = normalizeSuffix(w)
        return synonymMap[stemmed] || stemmed
      })
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
  // Use max denominator: prevents inflated similarity when one set is small.
  // Before: "pricing unclear" (2 words) vs "pricing page lacks breakdown of credit costs" (7 words)
  // shared 1 word → old: 1/2 = 0.50 (merged!) → new: 1/7 = 0.14 (preserved)
  return overlap / Math.max(wordsA.size, wordsB.size)
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
  // Fast path: if normalized titles are identical or nearly identical, always merge
  const normA = normalizeTitle(a.title)
  const normB = normalizeTitle(b.title)
  if (normA === normB) return 1.0
  // Near-identical: one title contains the other (e.g. same issue, one adds "on three pages")
  if (normA.length > 10 && normB.length > 10) {
    const shorter = normA.length <= normB.length ? normA : normB
    const longer = normA.length > normB.length ? normA : normB
    if (longer.includes(shorter)) return 0.95
  }

  const titleSim = textSimilarity(a.title, b.title)
  const descSim = textSimilarity(a.description, b.description)
  let score = titleSim * 0.7 + descSim * 0.3

  // High title similarity alone should be enough to merge (same issue, different pages)
  if (titleSim >= 0.75) {
    score = Math.max(score, titleSim)
  }

  if (sharedTopic(a, b)) {
    score = Math.max(score, THRESHOLDS.TOPIC_FLOOR)
    score += THRESHOLDS.TOPIC_BOOST
  }
  return Math.min(score, 1.0)
}

function sameModule(a: FindingForDedup, b: FindingForDedup): boolean {
  // Use category_index (reliable) instead of sort_order arithmetic (fragile)
  const aModule = a.category_index != null ? Math.floor(a.category_index / 4) : Math.floor((a.sort_order ?? 0) / 4)
  const bModule = b.category_index != null ? Math.floor(b.category_index / 4) : Math.floor((b.sort_order ?? 0) / 4)
  return aModule === bModule
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
      // Sort: highest confidence first, then highest severity, then earliest sort_order
      group.sort((a, b) => {
        const confA = CONFIDENCE_RANK[findings[a].confidence_level ?? 'heuristic'] ?? 1
        const confB = CONFIDENCE_RANK[findings[b].confidence_level ?? 'heuristic'] ?? 1
        if (confA !== confB) return confA - confB
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

// ── Template Grouping ───────────────────────────────────────
//
// Groups findings that describe the same issue across multiple pages
// (e.g. "Missing meta description" on /about, /pricing, /contact).
// Instead of showing 5 near-identical findings, keeps one and annotates
// it with "X pages affected" metadata.
//
// Only groups findings with very high title similarity (>= 0.85)
// across DIFFERENT page_urls. Same-page findings are handled by
// the standard dedup above.

/**
 * Identify groups of findings that represent the same template-level
 * issue repeated across multiple pages. Returns groups with a primary
 * finding and absorbed findings to remove.
 */
export function identifyTemplateGroups(findings: FindingForDedup[]): TemplateGroup[] {
  if (findings.length < 2) return []

  const groups: TemplateGroup[] = []
  const consumed = new Set<number>()

  for (let i = 0; i < findings.length; i++) {
    if (consumed.has(i)) continue

    const cluster: number[] = [i]

    for (let j = i + 1; j < findings.length; j++) {
      if (consumed.has(j)) continue
      // Only group cross-page findings (same page handled by dedup)
      if (findings[i].page_url && findings[j].page_url && findings[i].page_url === findings[j].page_url) continue
      // Require very high title similarity — these must be the same issue
      const titleSim = textSimilarity(findings[i].title, findings[j].title)
      if (titleSim >= 0.85) {
        cluster.push(j)
        consumed.add(j)
      }
    }

    if (cluster.length >= 3) {
      // Sort: highest confidence, then severity, then sort_order
      cluster.sort((a, b) => {
        const confA = CONFIDENCE_RANK[findings[a].confidence_level ?? 'heuristic'] ?? 1
        const confB = CONFIDENCE_RANK[findings[b].confidence_level ?? 'heuristic'] ?? 1
        if (confA !== confB) return confA - confB
        const sevA = SEVERITY_RANK[findings[a].severity] ?? 2
        const sevB = SEVERITY_RANK[findings[b].severity] ?? 2
        if (sevA !== sevB) return sevA - sevB
        return (findings[a].sort_order ?? 0) - (findings[b].sort_order ?? 0)
      })

      const primaryIdx = cluster[0]
      const pageUrls = cluster
        .map(idx => findings[idx].page_url)
        .filter((url): url is string => !!url)
      const uniquePages = [...new Set(pageUrls)]

      groups.push({
        primaryId: findings[primaryIdx].id,
        absorbedIds: cluster.slice(1).map(idx => findings[idx].id),
        pageUrls: uniquePages,
        pageCount: uniquePages.length,
      })

      // Consume ALL indices in the cluster — not just the inner-loop j's
      // (the seed i may not be the primary after sorting, so it must also be consumed)
      for (const idx of cluster) consumed.add(idx)
    }
  }

  return groups
}
