// ============================================================
// ClearUX Audit Engine — AI Visibility Score Calculator
// ============================================================
// Composite metric measuring how well AI systems can understand,
// represent, and cite a website. Combines:
//   1. Structured data coverage (JSON-LD completeness)
//   2. LLM probe accuracy (what AI actually knows)
//   3. Crawl infrastructure (robots.txt, llms.txt, ai-plugin)
//   4. Content extractability (head tags, meta, OG)
//
// Single number: "AI understands 62% of your site correctly."
//
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================

import type { AIVisibilityBreakdown } from '@/types/database'
import type { AIDiscoveryResult } from './ai-discovery-probe'
import type { StructuredDataValidationResult } from './structured-data-validator'
import type { LlmProbeSession } from './llm-probe'
import type { HeadTagData } from './crawler'

/** Inputs for calculating the AI Visibility Score */
export interface AIVisibilityInputs {
  /** Structured data validation result from Phase 1 */
  structuredData: StructuredDataValidationResult | null
  /** LLM probe session from Phase 2 */
  llmProbe: LlmProbeSession | null
  /** AI discovery result from Phase 1 */
  aiDiscovery: AIDiscoveryResult | null
  /** Head tags from all crawled pages */
  headTags: Array<{ url: string; headTags: HeadTagData }>
}

/**
 * Calculate the composite AI Visibility Score.
 * Returns a breakdown by component + overall 0-100 score.
 */
export function calculateAIVisibilityScore(inputs: AIVisibilityInputs): AIVisibilityBreakdown {
  const structuredData = scoreStructuredData(inputs.structuredData)
  const llmAccuracy = scoreLlmAccuracy(inputs.llmProbe)
  const crawlInfrastructure = scoreCrawlInfrastructure(inputs.aiDiscovery)
  const contentExtractability = scoreContentExtractability(inputs.headTags)

  // Weighted average — LLM accuracy is most important (it's what users actually experience)
  const overall = Math.round(
    llmAccuracy * 0.35 +          // What AI actually says about you (most important)
    structuredData * 0.25 +       // How well you tell AI what you are
    contentExtractability * 0.25 + // How well AI can read your pages
    crawlInfrastructure * 0.15    // Whether AI can even reach you
  )

  return {
    structuredData,
    llmAccuracy,
    crawlInfrastructure,
    contentExtractability,
    overall,
  }
}

/** Format AI Visibility Score for display */
export function formatAIVisibilityForReport(breakdown: AIVisibilityBreakdown): string {
  const lines = [
    `AI Visibility Score: ${breakdown.overall}/100`,
    '',
    `  Structured data coverage:  ${breakdown.structuredData}/100`,
    `  LLM knowledge accuracy:    ${breakdown.llmAccuracy}/100`,
    `  Crawl infrastructure:      ${breakdown.crawlInfrastructure}/100`,
    `  Content extractability:    ${breakdown.contentExtractability}/100`,
  ]
  return lines.join('\n')
}

// ── Component scorers ──────────────────────────────────────

function scoreStructuredData(result: StructuredDataValidationResult | null): number {
  if (!result) return 0
  if (result.totalBlocks === 0) return 10 // Some credit for having a site at all

  // Key types that matter for AI understanding
  const criticalTypes = ['Organization', 'LocalBusiness', 'WebSite']
  const valuableTypes = ['Product', 'FAQPage', 'Article', 'BreadcrumbList', 'SoftwareApplication']

  let score = 20 // Base: has some structured data

  // Critical types present
  const hasCritical = criticalTypes.some((t) => result.typesFound.includes(t))
  if (hasCritical) score += 30

  // Valuable types present
  const valuableCount = valuableTypes.filter((t) => result.typesFound.includes(t)).length
  score += Math.min(valuableCount * 10, 30)

  // Validity ratio
  const validRatio = result.totalBlocks > 0 ? result.validBlocks / result.totalBlocks : 0
  score += Math.round(validRatio * 20)

  // Penalty for issues
  if (result.findings.length > 0) {
    score -= Math.min(result.findings.length * 3, 15)
  }

  return Math.max(0, Math.min(100, score))
}

function scoreLlmAccuracy(session: LlmProbeSession | null): number {
  if (!session) return 0
  // Direct mapping from probe accuracy score
  return session.accuracySummary.scorePercent
}

function scoreCrawlInfrastructure(discovery: AIDiscoveryResult | null): number {
  if (!discovery) return 20 // Assume basic crawlability

  let score = 20 // Base

  // robots.txt exists and doesn't block AI
  if (discovery.robotsAI.hasRobotsTxt) {
    score += 15
    if (!discovery.robotsAI.blocksAIBots) score += 15
    if (discovery.robotsAI.allowsAIBots) score += 10
  }

  // llms.txt present — major signal
  if (discovery.llmsTxt.exists) score += 25

  // ai-plugin.json present
  if (discovery.aiPlugin.exists) score += 15

  return Math.max(0, Math.min(100, score))
}

function scoreContentExtractability(headTags: Array<{ url: string; headTags: HeadTagData }>): number {
  if (headTags.length === 0) return 20

  let totalScore = 0

  for (const { headTags: ht } of headTags) {
    let pageScore = 0

    // Title & meta basics
    if (ht.canonical) pageScore += 15
    if (ht.lang) pageScore += 10

    // OG tags (crucial for AI and social sharing)
    const ogKeys = Object.keys(ht.ogTags)
    if (ogKeys.includes('og:title')) pageScore += 10
    if (ogKeys.includes('og:description')) pageScore += 10
    if (ogKeys.includes('og:image')) pageScore += 10
    if (ogKeys.includes('og:type')) pageScore += 5

    // Twitter cards
    const twKeys = Object.keys(ht.twitterTags)
    if (twKeys.length > 0) pageScore += 10

    // Viewport (mobile-ready)
    if (ht.viewport) pageScore += 10

    // Hreflang (internationalization)
    if (ht.hreflang.length > 0) pageScore += 10

    // JSON-LD present on page
    if (ht.jsonLd.length > 0) pageScore += 10

    totalScore += Math.min(pageScore, 100)
  }

  return Math.round(totalScore / headTags.length)
}
