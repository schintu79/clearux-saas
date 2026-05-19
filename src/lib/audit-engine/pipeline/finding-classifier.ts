// ============================================================
// ClearUX Proprietary Pipeline — Finding Type Classifier
// ============================================================
//
// PURPOSE:
// Post-processing safety net that enforces the fixable/strategic
// classification on findings. The AI prompt asks for this classification
// but some findings slip through without it, or are misclassified.
//
// This module:
// 1. Assigns a finding_type if the AI didn't provide one
// 2. Validates that "fixable" findings actually have actionable recs
// 3. Downgrades abstract fixable findings to strategic
// 4. Filters out-of-scope findings for simple sites
//
// WHEN TO IMPROVE THIS FILE:
// - If fixable findings appear in the Fix Console that aren't deployable
// - If strategic findings are being wrongly classified as fixable
// - If a new fix type needs to be supported
// ============================================================

import type { FindingType, FixType } from '@/types/database'

export interface ClassifiableFinding {
  title: string
  description: string
  recommendation: string
  severity: string
  findingType?: FindingType
  fixType?: FixType
  categoryIndex?: number | null
}

// ── Keywords that strongly indicate a fixable finding ────────
const FIXABLE_SIGNALS: Array<{ pattern: RegExp; fixType: FixType }> = [
  // Meta/SEO
  { pattern: /\bmeta\s*(tag|description|title)\b/i, fixType: 'meta' },
  { pattern: /\b(og:|open\s*graph|twitter:card)\b/i, fixType: 'meta' },
  { pattern: /\bcanonical\s*(tag|url)\b/i, fixType: 'meta' },
  { pattern: /\btitle\s*tag\b/i, fixType: 'meta' },
  { pattern: /\bviewport\s*meta\b/i, fixType: 'meta' },
  // Schema / structured data
  { pattern: /\b(json-ld|schema\.org|structured\s*data|breadcrumb\s*schema)\b/i, fixType: 'schema' },
  { pattern: /\b(organization|faqpage|product|softwareapplication|website)\s*schema\b/i, fixType: 'schema' },
  // HTML structure
  { pattern: /\b(alt\s*text|alt\s*attr|aria-label|heading\s*hierarchy|h[1-6]\s*(tag|level|missing))\b/i, fixType: 'html' },
  { pattern: /\b(semantic\s*(html|markup|tag)|landmark|nav\s*element)\b/i, fixType: 'html' },
  { pattern: /\b(missing\s*h1|duplicate\s*h1|skipped\s*heading)\b/i, fixType: 'html' },
  // Copy / content
  { pattern: /\b(headline|tagline|cta\s*(text|copy|button)|button\s*label|call[- ]to[- ]action)\b/i, fixType: 'copy' },
  { pattern: /\b(meta\s*description\s*(text|copy|content))\b/i, fixType: 'meta' },
  { pattern: /\b(rewrite|rephrase|change\s*(the|this)\s*(text|copy|heading|title))\b/i, fixType: 'copy' },
  // Files
  { pattern: /\b(robots\.txt|sitemap\.xml|llms\.txt|ai-plugin\.json|\.well-known)\b/i, fixType: 'file' },
  // Config
  { pattern: /\b(redirect|301|302|hreflang|x-robots-tag|cache-control|content-security)\b/i, fixType: 'config' },
]

// ── Keywords that strongly indicate a strategic finding ──────
const STRATEGIC_SIGNALS: RegExp[] = [
  /\b(brand\s*(positioning|strategy|story|narrative|identity))\b/i,
  /\b(redesign|overhaul|rethink|reimagine|restructure)\b/i,
  /\b(overall\s*(design|aesthetic|look|feel|impression))\b/i,
  /\b(trust\s*(story|narrative|strategy)|social\s*proof\s*strategy)\b/i,
  /\b(content\s*strategy|messaging\s*strategy|communication\s*strategy)\b/i,
  /\b(user\s*journey|conversion\s*funnel|information\s*architecture)\b/i,
  /\b(emotional\s*(tone|connection|resonance)|brand\s*voice)\b/i,
  /\b(competitive\s*(positioning|differentiation)|market\s*positioning)\b/i,
  /\b(ux\s*(strategy|overhaul)|design\s*system)\b/i,
  /\b(requires\s*(a\s*)?(redesign|rethink|overhaul|strategic))\b/i,
]

/**
 * Classify a single finding — determines findingType and fixType.
 * Uses the AI-provided classification if available, but validates it.
 */
export function classifyFinding(f: ClassifiableFinding): { findingType: FindingType; fixType: FixType } {
  const text = `${f.title} ${f.description} ${f.recommendation}`.toLowerCase()

  // If AI already classified, validate it
  if (f.findingType === 'fixable' && f.fixType) {
    // Trust the AI classification if it provided both fields
    return { findingType: 'fixable', fixType: f.fixType }
  }

  if (f.findingType === 'strategic') {
    return { findingType: 'strategic', fixType: null }
  }

  // AI didn't classify — use heuristics

  // Check for fixable signals first (more specific)
  for (const { pattern, fixType } of FIXABLE_SIGNALS) {
    if (pattern.test(text)) {
      return { findingType: 'fixable', fixType }
    }
  }

  // Check for strategic signals
  for (const pattern of STRATEGIC_SIGNALS) {
    if (pattern.test(text)) {
      return { findingType: 'strategic', fixType: null }
    }
  }

  // Default heuristic: if the recommendation contains code-like content
  // (HTML tags, JSON, file paths), it's likely fixable
  const rec = f.recommendation
  if (/<[a-z][^>]*>/i.test(rec) || /\{[\s\S]*"@(type|context)"/.test(rec)) {
    // Contains HTML tags or JSON-LD — likely fixable
    const inferredType = /json-ld|schema|@type|@context/i.test(rec) ? 'schema' as FixType
      : /<meta\b/i.test(rec) ? 'meta' as FixType
      : /<(h[1-6]|img|a|nav|main|header|footer|section|article)\b/i.test(rec) ? 'html' as FixType
      : 'copy' as FixType
    return { findingType: 'fixable', fixType: inferredType }
  }

  // If recommendation is very short or vague, it's strategic
  if (rec.length < 80) {
    return { findingType: 'strategic', fixType: null }
  }

  // Default: classify by category
  // SEO categories (16-19) and AI categories (12-15) tend to be fixable
  if (f.categoryIndex != null) {
    if (f.categoryIndex >= 12 && f.categoryIndex <= 19) {
      return { findingType: 'fixable', fixType: 'html' }
    }
  }

  // Final fallback: if we can't tell, default to fixable with copy type
  // (the recommendation should contain the fix — if not, the quality gate catches it)
  return { findingType: 'fixable', fixType: 'copy' }
}

/**
 * Validate that a "fixable" finding actually has a deployable recommendation.
 * If the recommendation is too vague, downgrade to strategic.
 */
export function validateFixableRecommendation(f: ClassifiableFinding & { findingType: FindingType; fixType: FixType }): { findingType: FindingType; fixType: FixType } {
  if (f.findingType !== 'fixable') return { findingType: f.findingType, fixType: f.fixType }

  const rec = f.recommendation.toLowerCase()

  // Red flags that indicate a non-deployable recommendation
  const vaguePatterns = [
    /\bconsider\s+(redesigning|rethinking|overhauling)/i,
    /\brequires\s+(a\s+)?(full|complete|major)\s+(redesign|overhaul|rework)/i,
    /\bhire\s+(a\s+)?(designer|developer|consultant|agency)/i,
    /\bconduct\s+(a\s+)?(user|usability|ux)\s+(research|study|test)/i,
    /\bdevelop\s+(a\s+)?(strategy|roadmap|plan)\b/i,
  ]

  for (const pattern of vaguePatterns) {
    if (pattern.test(rec)) {
      return { findingType: 'strategic', fixType: null }
    }
  }

  return { findingType: f.findingType, fixType: f.fixType }
}

// ── Simple site detection ────────────────────────────────────

const SIMPLE_SITE_ONLY_TOPICS = [
  /\bpricing\s*(transparency|friction|hidden|unclear)\b/i,
  /\bforced\s*(selection|choice|opt-in)\b/i,
  /\bdark\s*pattern/i,
  /\bconfirmshaming\b/i,
  /\bpsychological\s*(friction|pressure|manipulation)\b/i,
  /\bsubscription\s*(management|cancel|friction)\b/i,
  /\b(checkout|cart|payment)\s*(friction|abandon|optimization)\b/i,
  /\bresponsible\s*design\s*pattern/i,
]

/**
 * Detect if a site is a simple "business-card" type with no interactive flows.
 * Returns true if the site has no signup, pricing, or subscription content.
 */
export function isSimpleSite(pageContent: string): boolean {
  const lower = pageContent.toLowerCase()
  const hasSignup = /\b(sign\s*up|register|create\s*account|get\s*started\s*free)\b/.test(lower)
  const hasPricing = /\b(pricing|plans?|subscription|per\s*month|\$\d+|€\d+|£\d+)\b/.test(lower)
  const hasCheckout = /\b(checkout|add\s*to\s*cart|buy\s*now|purchase|order\s*now)\b/.test(lower)
  const hasLogin = /\b(log\s*in|sign\s*in|my\s*account)\b/.test(lower)

  // If none of these interactive elements exist, it's a simple site
  return !hasSignup && !hasPricing && !hasCheckout && !hasLogin
}

/**
 * Filter findings that are out-of-scope for simple sites.
 * Returns findings with out-of-scope ones removed.
 */
export function filterSimpleSiteFindings<T extends { title: string; description: string }>(
  findings: T[],
  isSimple: boolean,
): T[] {
  if (!isSimple) return findings

  return findings.filter((f) => {
    const text = `${f.title} ${f.description}`.toLowerCase()
    for (const pattern of SIMPLE_SITE_ONLY_TOPICS) {
      if (pattern.test(text)) {
        console.log(`[classifier] Filtered out-of-scope finding for simple site: "${f.title}"`)
        return false
      }
    }
    return true
  })
}

/**
 * Full classification pipeline: classify, validate, and annotate findings.
 */
export function classifyFindings<T extends ClassifiableFinding>(
  findings: T[],
  pageContent?: string,
): Array<T & { findingType: FindingType; fixType: FixType }> {
  // Optionally filter simple site findings
  const isSimple = pageContent ? isSimpleSite(pageContent) : false
  const filtered = filterSimpleSiteFindings(findings, isSimple)

  return filtered.map((f) => {
    const classification = classifyFinding(f)
    const validated = validateFixableRecommendation({ ...f, ...classification })
    return { ...f, ...validated }
  })
}
