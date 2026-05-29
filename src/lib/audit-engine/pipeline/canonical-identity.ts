// ============================================================
// Canonical Issue Identity Engine
// ============================================================
// Generates stable, deterministic issue keys for findings.
// Key pattern: {category}.{issue_family}.{scope_signature}
//
// The canonical key survives wording changes, model updates,
// and re-phrasing. It is the primary identity layer for
// matching across audits.
//
// PROPRIETARY — do not distribute outside the Fixpath codebase.
// ============================================================

import type { AuditFinding } from '@/types/database'
import type { NormalizedDetection, IssueCategoryKey, IssueFamilyType } from '@/types/canonical-issues'
import { CATEGORY_INDEX_TO_KEY, SEVERITY_WEIGHTS, CONFIDENCE_MULTIPLIERS, RECOMMENDATION_MULTIPLIER_CAP } from '@/types/canonical-issues'

/* ── Issue Family Extraction ─────────────────────────────────── */

/**
 * Known issue family patterns. These are canonical identifiers for
 * recurring UX/technical problems. The engine maps finding titles
 * and descriptions to these families using keyword matching.
 *
 * Add new families as the system learns from audits.
 */
const ISSUE_FAMILY_PATTERNS: Array<{
  family: string
  keywords: string[]
  category: IssueCategoryKey
}> = [
  // Brand
  { family: 'value_prop_unclear', keywords: ['value proposition', 'unclear value', 'value prop', 'what you do', 'what you offer'], category: 'brand' },
  { family: 'brand_inconsistency', keywords: ['brand inconsisten', 'brand mismatch', 'off-brand', 'brand guidelines'], category: 'brand' },
  { family: 'messaging_unclear', keywords: ['messaging', 'unclear message', 'confusing message', 'mixed messages'], category: 'brand' },
  { family: 'missing_tagline', keywords: ['tagline', 'slogan', 'brand statement'], category: 'brand' },
  { family: 'tone_inconsistency', keywords: ['tone inconsisten', 'voice inconsisten', 'tone of voice', 'writing style'], category: 'brand' },
  // Content
  { family: 'poor_readability', keywords: ['readability', 'hard to read', 'complex language', 'reading level', 'jargon'], category: 'content' },
  { family: 'thin_content', keywords: ['thin content', 'insufficient content', 'not enough content', 'short content', 'lacks depth'], category: 'content' },
  { family: 'missing_content', keywords: ['missing content', 'no content', 'empty section', 'placeholder'], category: 'content' },
  { family: 'outdated_content', keywords: ['outdated', 'stale content', 'old content', 'needs updating'], category: 'content' },
  { family: 'duplicate_content', keywords: ['duplicate content', 'repeated content', 'same content'], category: 'content' },
  // Trust
  { family: 'missing_social_proof', keywords: ['social proof', 'testimonial', 'review', 'case study', 'trust signal'], category: 'trust' },
  { family: 'missing_contact_info', keywords: ['contact info', 'phone number', 'email address', 'contact details', 'no contact'], category: 'trust' },
  { family: 'missing_privacy_policy', keywords: ['privacy policy', 'data policy', 'privacy notice'], category: 'trust' },
  { family: 'missing_security_signals', keywords: ['security', 'https', 'ssl', 'trust badge', 'secure'], category: 'trust' },
  { family: 'weak_credibility', keywords: ['credibilit', 'legitimacy', 'authority', 'expertise'], category: 'trust' },
  // UX
  { family: 'poor_navigation', keywords: ['navigation', 'menu', 'nav structure', 'hard to find', 'wayfinding'], category: 'ux' },
  { family: 'weak_cta', keywords: ['call to action', 'cta', 'button text', 'click here', 'submit button'], category: 'ux' },
  { family: 'confusing_layout', keywords: ['layout', 'confusing design', 'visual hierarchy', 'cluttered'], category: 'ux' },
  { family: 'poor_mobile_experience', keywords: ['mobile', 'responsive', 'small screen', 'touch target', 'viewport'], category: 'ux' },
  { family: 'slow_interaction', keywords: ['slow', 'loading', 'lag', 'performance', 'speed'], category: 'ux' },
  { family: 'dark_pattern', keywords: ['dark pattern', 'deceptive', 'manipulat', 'trick', 'misleading'], category: 'ux' },
  { family: 'poor_error_handling', keywords: ['error', 'error message', 'error handling', 'error state', '404', 'broken'], category: 'ux' },
  { family: 'poor_form_ux', keywords: ['form', 'input field', 'form validation', 'form label'], category: 'ux' },
  // Technical
  { family: 'missing_meta_description', keywords: ['meta description', 'missing meta', 'no meta description'], category: 'technical' },
  { family: 'missing_title_tag', keywords: ['title tag', 'page title', 'missing title', 'no title'], category: 'technical' },
  { family: 'missing_heading_structure', keywords: ['heading structure', 'h1', 'heading hierarchy', 'missing heading', 'multiple h1'], category: 'technical' },
  { family: 'missing_canonical', keywords: ['canonical', 'canonical url', 'canonical tag'], category: 'technical' },
  { family: 'missing_robots_txt', keywords: ['robots.txt', 'robots file', 'crawl directive'], category: 'technical' },
  { family: 'missing_sitemap', keywords: ['sitemap', 'sitemap.xml', 'xml sitemap'], category: 'technical' },
  { family: 'poor_page_speed', keywords: ['page speed', 'core web vitals', 'lcp', 'fcp', 'cls', 'inp', 'ttfb'], category: 'technical' },
  { family: 'broken_links', keywords: ['broken link', 'dead link', '404 link', 'link broken'], category: 'technical' },
  { family: 'missing_lang_attribute', keywords: ['lang attribute', 'html lang', 'language attribute', 'missing lang'], category: 'technical' },
  { family: 'missing_viewport', keywords: ['viewport', 'viewport meta', 'meta viewport'], category: 'technical' },
  { family: 'missing_charset', keywords: ['charset', 'character encoding', 'utf-8', 'meta charset'], category: 'technical' },
  // Discoverability
  { family: 'missing_structured_data', keywords: ['structured data', 'json-ld', 'schema.org', 'rich snippet', 'schema markup'], category: 'discoverability' },
  { family: 'missing_og_tags', keywords: ['og tag', 'open graph', 'og:title', 'og:description', 'social sharing'], category: 'discoverability' },
  { family: 'missing_llms_txt', keywords: ['llms.txt', 'llms txt', 'ai discovery', 'ai-plugin'], category: 'discoverability' },
  { family: 'poor_ai_readability', keywords: ['ai readability', 'ai cannot', 'ai extraction', 'machine readable'], category: 'discoverability' },
  // Accessibility
  { family: 'missing_alt_text', keywords: ['alt text', 'alt attribute', 'image alt', 'missing alt'], category: 'accessibility' },
  { family: 'missing_form_labels', keywords: ['form label', 'input label', 'label element', 'missing label'], category: 'accessibility' },
  { family: 'poor_color_contrast', keywords: ['color contrast', 'contrast ratio', 'wcag contrast', 'insufficient contrast'], category: 'accessibility' },
  { family: 'missing_aria_landmarks', keywords: ['aria', 'landmark', 'aria-label', 'role attribute', 'accessibility tree'], category: 'accessibility' },
  { family: 'keyboard_navigation', keywords: ['keyboard', 'focus', 'tab order', 'focus indicator', 'keyboard navigation'], category: 'accessibility' },
  { family: 'missing_skip_links', keywords: ['skip link', 'skip navigation', 'skip to content'], category: 'accessibility' },
]

/**
 * Extract the issue family key from a finding's title and description.
 * Uses keyword matching against the pattern library.
 * Falls back to a normalized title slug when no pattern matches.
 */
export function extractIssueFamily(
  title: string,
  description: string,
  categoryKey: IssueCategoryKey,
): { family: string; matchedPattern: boolean } {
  const text = `${title} ${description}`.toLowerCase()

  // Try pattern matching (prefer same-category matches)
  let bestMatch: { family: string; score: number } | null = null

  for (const pattern of ISSUE_FAMILY_PATTERNS) {
    let score = 0
    for (const kw of pattern.keywords) {
      if (text.includes(kw)) score++
    }
    if (score > 0) {
      // Boost same-category matches
      if (pattern.category === categoryKey) score += 2
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { family: pattern.family, score }
      }
    }
  }

  if (bestMatch && bestMatch.score >= 1) {
    return { family: bestMatch.family, matchedPattern: true }
  }

  // Fallback: generate a slug from the title
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join('_')

  return { family: slug || 'unclassified', matchedPattern: false }
}

/* ── Scope Signature Generation ──────────────────────────────── */

/**
 * Generate a scope signature from a finding's page URL and context.
 * Scope should be stable and not too narrow or too broad.
 */
export function generateScopeSignature(
  pageUrl: string | null,
  pageCount: number,
  templateTypes: string[],
  siteUrl?: string,
): string {
  // Sitewide issues
  if (pageCount >= 5 || templateTypes.includes('sitewide')) {
    return 'sitewide'
  }

  // Template-level issues
  if (templateTypes.length > 0) {
    const primary = templateTypes[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
    return `${primary}-template`
  }

  // Page-specific issues
  if (pageUrl) {
    try {
      const u = new URL(pageUrl)
      const path = u.pathname.replace(/\/$/, '') || '/'

      // Homepage
      if (path === '/' || path === '') return 'homepage'

      // Known common pages
      const knownPages: Record<string, string> = {
        '/pricing': 'pricing',
        '/about': 'about',
        '/contact': 'contact',
        '/blog': 'blog',
        '/faq': 'faq',
        '/login': 'login',
        '/register': 'register',
        '/signup': 'signup',
        '/terms': 'terms',
        '/privacy': 'privacy',
      }

      for (const [prefix, scope] of Object.entries(knownPages)) {
        if (path === prefix || path.startsWith(prefix + '/')) {
          return scope
        }
      }

      // Generic page scope
      return `page:${path}`
    } catch {
      return 'unknown'
    }
  }

  // No page info — sitewide by default for multi-page
  if (pageCount > 1) return 'sitewide'
  return 'unknown'
}

/* ── Canonical Key Assembly ──────────────────────────────────── */

/**
 * Build the canonical issue key: {category}.{issue_family}.{scope_signature}
 */
export function buildCanonicalKey(
  categoryKey: IssueCategoryKey,
  issueFamily: string,
  scopeSignature: string,
): string {
  return `${categoryKey}.${issueFamily}.${scopeSignature}`
}

/* ── Issue Type Classification ───────────────────────────────── */

/**
 * Classify a finding into an issue type based on its characteristics.
 * Recommendations get near-zero score impact.
 */
export function classifyIssueType(
  findingType: string | null,
  severity: string,
  confidence: number,
  title: string,
  description: string,
): IssueFamilyType {
  const text = `${title} ${description}`.toLowerCase()

  // Strategic findings are typically recommendations
  if (findingType === 'strategic') {
    if (severity === 'critical' || severity === 'high') {
      return 'meaningful_weakness'
    }
    return 'recommendation'
  }

  // Low confidence = recommendation regardless of severity
  if (confidence < 0.4) return 'nice_to_have'
  if (confidence < 0.6) return 'recommendation'

  // Recommendation language signals
  const recSignals = ['consider', 'could', 'might want', 'nice to have', 'optional', 'suggestion', 'recommended']
  const hasRecLanguage = recSignals.some(s => text.includes(s))

  if (hasRecLanguage && severity !== 'critical' && severity !== 'high') {
    return 'recommendation'
  }

  // High confidence, concrete findings
  if (severity === 'critical' || severity === 'high') {
    return 'verified_issue'
  }

  return confidence >= 0.8 ? 'verified_issue' : 'meaningful_weakness'
}

/* ── Business Relevance Estimation ───────────────────────────── */

/**
 * Estimate the business relevance multiplier (0.75 to 1.5).
 * High-traffic pages, conversion pages, and homepage get higher multipliers.
 */
export function estimateBusinessRelevance(
  scopeSignature: string,
  severity: string,
  categoryKey: IssueCategoryKey,
): number {
  let multiplier = 1.0

  // Homepage and conversion pages are most business-relevant
  if (scopeSignature === 'homepage') multiplier = 1.3
  else if (scopeSignature === 'pricing') multiplier = 1.5
  else if (scopeSignature === 'sitewide') multiplier = 1.4
  else if (scopeSignature.includes('template')) multiplier = 1.25
  else if (scopeSignature === 'contact') multiplier = 1.2
  else if (scopeSignature === 'about') multiplier = 1.1

  // Trust and brand issues have outsized business impact
  if (categoryKey === 'trust') multiplier *= 1.1
  if (categoryKey === 'brand') multiplier *= 1.05

  // Clamp to spec range
  return Math.max(0.75, Math.min(1.5, multiplier))
}

/* ── Scope Multiplier ────────────────────────────────────────── */

/**
 * Determine the scope multiplier based on how broadly the issue affects the site.
 */
export function getScopeMultiplier(
  scopeSignature: string,
  pageCount: number,
): number {
  if (scopeSignature === 'sitewide' || pageCount >= 5) return 1.5
  if (scopeSignature.includes('template') || pageCount >= 2) return 1.25
  return 1.0
}

/* ── Confidence Multiplier ───────────────────────────────────── */

/**
 * Map a confidence score (0-1) to a multiplier bucket.
 */
export function getConfidenceMultiplier(confidence: number): number {
  if (confidence >= 0.8) return CONFIDENCE_MULTIPLIERS.high
  if (confidence >= 0.5) return CONFIDENCE_MULTIPLIERS.medium
  return CONFIDENCE_MULTIPLIERS.low
}

/* ── Score Impact Calculation ────────────────────────────────── */

/**
 * Calculate the score penalty for a single finding.
 *
 * Formula: severityWeight * businessRelevance * scopeMultiplier * confidenceMultiplier
 *
 * Recommendations are capped at RECOMMENDATION_MULTIPLIER_CAP of the base penalty.
 */
export function calculateScoreImpact(
  severity: string,
  businessRelevance: number,
  scopeMultiplier: number,
  confidenceMultiplier: number,
  issueType: IssueFamilyType,
): number {
  const severityWeight = SEVERITY_WEIGHTS[severity] ?? 4 // default medium

  let penalty = severityWeight * businessRelevance * scopeMultiplier * confidenceMultiplier

  // Recommendations get severely capped
  if (issueType === 'recommendation' || issueType === 'nice_to_have') {
    penalty *= RECOMMENDATION_MULTIPLIER_CAP
  }

  return Math.round(penalty * 1000) / 1000
}

/* ── Finding → Normalized Detection ──────────────────────────── */

/**
 * Map a confidence_level string to a numeric score (0-1).
 */
function confidenceLevelToScore(level: string | null): number {
  switch (level) {
    case 'deterministic': return 1.0
    case 'heuristic': return 0.75
    case 'interpretive': return 0.5
    default: return 0.7
  }
}

/**
 * Normalize a raw AuditFinding into a NormalizedDetection with
 * canonical key, issue type, and score impact.
 */
export function normalizeDetection(
  finding: AuditFinding,
  siteUrl?: string,
): NormalizedDetection {
  // Determine category key
  const categoryKey = finding.category_index != null
    ? (CATEGORY_INDEX_TO_KEY[finding.category_index] ?? 'ux')
    : 'ux'

  // Extract issue family
  const { family: issueFamily } = extractIssueFamily(
    finding.title,
    finding.description,
    categoryKey,
  )

  // Determine scope
  const templateTypes: string[] = []
  const pagesAffected: string[] = finding.page_url ? [finding.page_url] : []

  const scopeSignature = generateScopeSignature(
    finding.page_url,
    pagesAffected.length,
    templateTypes,
    siteUrl,
  )

  // Build canonical key
  const canonicalKey = buildCanonicalKey(categoryKey, issueFamily, scopeSignature)

  // Determine confidence
  const confidence = confidenceLevelToScore(finding.confidence_level)

  // Classify issue type
  const issueType = classifyIssueType(
    finding.finding_type,
    finding.severity,
    confidence,
    finding.title,
    finding.description,
  )

  // Business relevance
  const businessRelevance = estimateBusinessRelevance(scopeSignature, finding.severity, categoryKey)

  // Scope multiplier
  const scopeMultiplier = getScopeMultiplier(scopeSignature, pagesAffected.length)

  // Confidence multiplier
  const confidenceMultiplier = getConfidenceMultiplier(confidence)

  // Score impact
  const scoreImpact = calculateScoreImpact(
    finding.severity,
    businessRelevance,
    scopeMultiplier,
    confidenceMultiplier,
    issueType,
  )

  return {
    canonical_key: canonicalKey,
    category_key: categoryKey,
    issue_family_key: issueFamily,
    scope_signature: scopeSignature,
    issue_type: issueType,
    severity: finding.severity as 'critical' | 'high' | 'medium' | 'low',
    confidence,
    business_relevance: businessRelevance,
    title: finding.title,
    finding_text: finding.description,
    why_it_matters: finding.estimated_impact || '',
    evidence: finding.page_url
      ? [{ type: 'page' as const, page_url: finding.page_url, selector: finding.affected_selector || undefined }]
      : [],
    fix_recommendation: finding.recommendation,
    impact_summary: finding.estimated_impact || '',
    pages_affected: pagesAffected,
    page_count: pagesAffected.length || 1,
    template_types: templateTypes,
    score_impact: scoreImpact,
    source_finding_id: finding.id,
  }
}
