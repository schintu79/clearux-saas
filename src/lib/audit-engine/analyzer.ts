// ============================================================
// ClearUX Audit Engine — Claude AI Analyzer
// Produces comprehensive, professional UX audit analysis
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import type { Audit, FindingSeverity, AuditFinding } from '@/types/database'
import { getLanguagePromptInstruction, getLanguageLabel, getCategoryNames } from '@/lib/languages'

let _anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set. Cannot run AI analysis.')
    _anthropic = new Anthropic({ apiKey, timeout: 90_000 }) // 90s per request
  }
  return _anthropic
}

/** Race a promise against a timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms),
    ),
  ])
}

export interface AnalysisFinding {
  severity: FindingSeverity
  title: string
  description: string
  recommendation: string
  estimatedImpact?: string
  targetElement?: string | null
  pageUrl?: string | null
}

export interface CategoryScore {
  name: string
  score: number
  summary: string
}

export interface ReportData {
  executiveSummary: string
  keyRecommendation: string | null
  overallScore: number
  uxScore: number
  conversionScore: number
  mobileScore: number
  aiDiscoverabilityScore: number
  contentScore: number
  categoryScores: CategoryScore[]
}

// ── The 12 UX categories we evaluate ─────────────────────────
const UX_CATEGORIES = [
  {
    name: 'First Impression & Visual Design',
    items: [
      'Above-the-fold content clarity and impact',
      'Visual hierarchy — are the most important elements prominent?',
      'Consistent color palette and typography',
      'Professional look and feel — does it inspire trust?',
    ],
  },
  {
    name: 'Value Proposition & Messaging',
    items: [
      'Is the value proposition immediately clear?',
      'Does the headline communicate what the product does and for whom?',
      'Is there a clear differentiation from competitors?',
      'Does the copy speak to user pain points?',
    ],
  },
  {
    name: 'Navigation & Information Architecture',
    items: [
      'Primary navigation — is it intuitive and well-organized?',
      'Can users find key pages within 2 clicks?',
      'Is the footer useful with proper links?',
      'Breadcrumbs or clear page hierarchy on inner pages',
    ],
  },
  {
    name: 'Calls-to-Action & Conversion',
    items: [
      'Primary CTA — is it visible, compelling, and above the fold?',
      'CTA button copy — action-oriented vs generic ("Get Started" vs "Submit")',
      'Is there urgency or social proof near CTAs?',
      'Is the conversion path clear with minimal friction?',
    ],
  },
  {
    name: 'Performance & Page Speed',
    items: [
      'Does the page feel fast? (inferred from content weight)',
      'Are images optimized or do they appear heavy?',
      'Are there large scripts or heavy third-party embeds?',
      'Lazy loading for below-the-fold content',
    ],
  },
  {
    name: 'Mobile Experience',
    items: [
      'Is there a viewport meta tag?',
      'Does content appear mobile-friendly from markup?',
      'Touch targets — are buttons large enough for mobile?',
      'Does navigation work for mobile (hamburger, bottom nav)?',
    ],
  },
  {
    name: 'Trust & Credibility',
    items: [
      'Are there testimonials, reviews, or case studies?',
      'Social proof — user count, logos, ratings?',
      'Privacy policy, terms, and security indicators',
      'Contact information or support options visible',
    ],
  },
  {
    name: 'Content Quality & Readability',
    items: [
      'Is text scannable with proper headings and short paragraphs?',
      'Is the language clear, jargon-free, and user-focused?',
      'Are there grammar or spelling issues?',
      'Do images have alt text?',
    ],
  },
  {
    name: 'Technical SEO & Accessibility',
    items: [
      'Title tag present and descriptive (50-60 chars)?',
      'Meta description present (150-160 chars)?',
      'Heading structure (H1 present, logical H2-H6)?',
      'Structured data / schema markup?',
    ],
  },
  {
    name: 'AI Discoverability & LLM Readiness',
    items: [
      'Is content structured in a way LLMs can parse?',
      'Are key facts and features stated clearly (not only in images)?',
      'Is there FAQ or knowledge-base content that LLMs can index?',
      'Does the site provide enough textual context about what it does?',
    ],
  },
  {
    name: 'Visual Hierarchy & Layout',
    items: [
      'Is there a clear visual flow guiding the eye from top to bottom?',
      'Are spacing and whitespace used effectively to group related content?',
      'Do font sizes and weights create a clear content hierarchy?',
      'Are key elements (CTAs, headlines, images) given appropriate visual weight?',
    ],
  },
  {
    name: 'Accessibility & Inclusive Design',
    items: [
      'Sufficient colour contrast between text and background (WCAG AA)?',
      'Can all interactive elements be reached via keyboard navigation?',
      'Are form inputs properly labelled with associated labels?',
      'Are ARIA roles and landmarks used to aid screen readers?',
    ],
  },
]

/**
 * Analyze a single UX category — called once per category
 */
export async function analyzeCategory(
  pageContent: string,
  category: string,
  checklistItems: Array<{ title: string; description: string; whatToCheck: string }>,
  userFocus?: string | null,
  language: string = 'en',
): Promise<AnalysisFinding[]> {
  // If checklist is empty (DB not seeded), use our built-in category
  const builtIn = UX_CATEGORIES.find((c) => c.name.toLowerCase().includes(category.toLowerCase()))
  const itemsToCheck =
    checklistItems.length > 0
      ? checklistItems.map((i, idx) => `${idx + 1}. ${i.title}\n   What to check: ${i.whatToCheck}`).join('\n')
      : builtIn
        ? builtIn.items.map((item, idx) => `${idx + 1}. ${item}`).join('\n')
        : `Evaluate all aspects of the "${category}" category for UX quality.`

  const focusBlock = userFocus && userFocus.trim() && userFocus.trim().toLowerCase() !== 'general ux audit'
    ? `\nUSER PRIORITY — The client has specifically asked to focus on:\n"${userFocus.trim()}"\nPay EXTRA attention to anything related to this concern. If this category is relevant to their focus area, add more detailed findings about it. Increase severity for issues directly impacting their stated concern.\n`
    : ''

  const languageInstruction = getLanguagePromptInstruction(language)

  const prompt = `You are a world-class UX auditor at a top design consultancy. You are evaluating a real website as part of a professional paid UX audit.
${languageInstruction}
CATEGORY: ${category}
${focusBlock}
CHECKLIST:
${itemsToCheck}

WEBSITE CONTENT (text extracted from the live page):
---
${pageContent.substring(0, 15000)}
---

INSTRUCTIONS:
Carefully evaluate the website against EACH checklist item. Be specific, detailed, and actionable. Reference actual content from the website (quote specific text, mention specific elements). Do NOT be generic.

For each issue you find, assign a severity:
- "critical": Fundamentally broken or severely harming conversions/usability
- "high": Significant problem that most users would notice
- "medium": Improvement opportunity that would meaningfully help
- "low": Nice-to-have polish item

Return a JSON array. For each issue:
{
  "severity": "critical" | "high" | "medium" | "low",
  "title": "Clear, specific title",
  "description": "Detailed explanation referencing actual content from the site. Be specific — mention what you see (or don't see) on the page.",
  "recommendation": "Concrete, actionable fix with specific suggestions. Not vague advice.",
  "estimatedImpact": "Expected impact on UX, conversions, or engagement",
  "targetElement": "A CSS selector or descriptive text to locate the problematic element on the page (e.g. 'nav', 'h1', '.hero-section', 'button.cta', 'footer', 'form', or a short text string found in the element). Use the most specific selector you can infer from the content. If the issue is page-wide or not tied to a single element, set to null.",
  "pageUrl": "REQUIRED — The exact URL of the specific page where this issue was found. Copy it verbatim from the 'URL:' lines in the content above. Every finding MUST have a pageUrl — never set this to null. If the issue appears on multiple pages, use the most relevant one."
}

Rules:
- Be brutally honest. This is a paid audit — the user wants real insights, not flattery.
- Reference specific elements from the website content.
- Each finding must be actionable with a clear fix.
- CRITICAL: Every finding MUST include "pageUrl" with the exact URL from the content above where the issue was found. Do NOT set pageUrl to null. If the same issue appears across pages, pick the most illustrative page URL.
- Include 2-6 findings per category. More for categories with serious issues, fewer if the site does well.
- If the site does something well in this category, you can still find areas to improve.

Return ONLY a valid JSON array. No markdown, no explanation, no code fences.`

  try {
    const anthropic = getAnthropicClient()
    // Haiku 4.5 — excellent at structured analysis tasks (issue identification,
    // severity classification, actionable recommendations). Sonnet is reserved
    // for the final report generation where writing quality matters more.
    const message = await withTimeout(
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
      90_000,
      `analyzeCategory(${category})`,
    )

    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const jsonMatch = responseText.match(/\[[\s\S]*\]/m)
    if (!jsonMatch) {
      console.error(`[analyzeCategory] No JSON in response for "${category}":`, responseText.substring(0, 200))
      return []
    }

    const findings: AnalysisFinding[] = JSON.parse(jsonMatch[0])
    return findings
      .filter((f) => f.severity && f.title && f.description && f.recommendation)
      .map((f) => ({ ...f, targetElement: f.targetElement || null, pageUrl: f.pageUrl || null }))
  } catch (err) {
    console.error(`[analyzeCategory] Error for "${category}":`, err instanceof Error ? err.message : err)
    return []
  }
}

/**
 * Run full analysis across all 12 UX categories in parallel batches.
 * This is used when the checklist_categories table is empty (not seeded).
 * Runs 3 categories concurrently to balance speed vs rate limits.
 */
export async function runFullAnalysis(
  pageContent: string,
  audit: Audit,
  userFocus?: string | null,
  language: string = 'en',
): Promise<AnalysisFinding[]> {
  const allFindings: AnalysisFinding[] = []
  const CONCURRENCY = 3

  // Process categories in batches of CONCURRENCY
  for (let i = 0; i < UX_CATEGORIES.length; i += CONCURRENCY) {
    const batch = UX_CATEGORIES.slice(i, i + CONCURRENCY)
    console.log(`[runFullAnalysis] Batch ${Math.floor(i / CONCURRENCY) + 1}: ${batch.map((c) => c.name).join(', ')}`)

    const batchResults = await Promise.all(
      batch.map((category) =>
        analyzeCategory(
          pageContent,
          category.name,
          category.items.map((item) => ({
            title: item,
            description: item,
            whatToCheck: item,
          })),
          userFocus,
          language,
        ),
      ),
    )

    for (const findings of batchResults) {
      allFindings.push(...findings)
    }

    // Brief pause between batches to avoid rate limits
    if (i + CONCURRENCY < UX_CATEGORIES.length) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  return allFindings
}

/**
 * Generate comprehensive report with executive summary and scores
 */
export async function generateReport(
  findings: AuditFinding[],
  auditData: Audit,
  pageContent: string,
  userFocus?: string | null,
  language: string = 'en',
): Promise<ReportData> {
  const criticalCount = findings.filter((f) => f.severity === 'critical').length
  const highCount = findings.filter((f) => f.severity === 'high').length
  const mediumCount = findings.filter((f) => f.severity === 'medium').length
  const lowCount = findings.filter((f) => f.severity === 'low').length

  const findingsDetail = findings
    .slice(0, 20)
    .map((f) => `[${f.severity.toUpperCase()}] ${f.title}: ${f.description}`)
    .join('\n')

  const focusBlock = userFocus && userFocus.trim() && userFocus.trim().toLowerCase() !== 'general ux audit'
    ? `\nCLIENT PRIORITY — The client specifically asked us to focus on:\n"${userFocus.trim()}"\nMake sure the executive summary addresses this concern directly. Mention findings related to their focus area prominently.\n`
    : ''

  const reportLanguageInstruction = getLanguagePromptInstruction(language)
  const translatedNames = getCategoryNames(language)

  const categoryList = translatedNames.map((name, i) => `${i + 1}. ${name}`).join('\n')
  const categoryExamples = translatedNames.map((name, i) => {
    const scores = [75, 68, 72, 65, 80, 74, 60, 70, 55, 52, 70, 48]
    return `    { "name": "${name}", "score": ${scores[i]}, "summary": "..." }`
  }).join(',\n')

  const prompt = `You are a senior UX strategist writing the executive summary for a professional paid UX audit report.
${reportLanguageInstruction}
WEBSITE: ${auditData.product_url}
${focusBlock}
WEBSITE CONTENT PREVIEW:
${pageContent.substring(0, 8000)}

AUDIT FINDINGS (${findings.length} total):
- ${criticalCount} critical issues
- ${highCount} high priority issues
- ${mediumCount} medium priority issues
- ${lowCount} low priority improvements

DETAILED FINDINGS:
${findingsDetail}

INSTRUCTIONS:
Write a comprehensive, professional executive summary and score the website.

For the EXECUTIVE SUMMARY:
- Write 3-4 paragraphs (not bullet points)
- Start with what the website does and who it's for (infer from content)
- Describe the overall UX quality — what works well and what doesn't
- Highlight the most impactful issues discovered
- End with a prioritized action plan: what to fix first for maximum impact
- Be specific — reference actual content and issues from the findings
- Write like a consultant delivering a report to a client who paid good money for it

For SCORES (0-100, be precise — NOT all 50s):
- overallScore: Weighted average reflecting overall quality
- uxScore: Overall user experience (layout, interactions, flow)
- conversionScore: Ability to drive actions/signups/purchases
- mobileScore: Mobile experience quality
- aiDiscoverabilityScore: SEO, structured data, LLM readability
- contentScore: Writing quality, clarity, scannability

Score guidelines:
- 90-100: Exceptional, industry-leading
- 75-89: Good, minor improvements needed
- 60-74: Decent but with significant gaps
- 40-59: Below average, needs substantial work
- 20-39: Poor, major issues throughout
- 0-19: Severely broken

For CATEGORY SCORES:
Provide a score (0-100) and a one-sentence summary for each of these 12 categories.
IMPORTANT: Use EXACTLY these category names (they are already in the correct language):
${categoryList}

For KEY RECOMMENDATION:
- ONE sentence describing the single highest-impact change they should make

Return ONLY valid JSON:
{
  "executiveSummary": "...",
  "keyRecommendation": "...",
  "overallScore": 72,
  "uxScore": 68,
  "conversionScore": 65,
  "mobileScore": 74,
  "aiDiscoverabilityScore": 55,
  "contentScore": 70,
  "categoryScores": [
${categoryExamples}
  ]
}`

  try {
    const anthropic = getAnthropicClient()
    const message = await withTimeout(
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
      90_000,
      'generateReport',
    )

    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const jsonMatch = responseText.match(/\{[\s\S]*\}/m)
    if (!jsonMatch) {
      console.error('[generateReport] No JSON in response:', responseText.substring(0, 300))
      return getDefaultReport()
    }

    const report: ReportData = JSON.parse(jsonMatch[0])

    // Validate
    return {
      executiveSummary: report.executiveSummary || '',
      keyRecommendation: report.keyRecommendation || null,
      overallScore: clampScore(report.overallScore),
      uxScore: clampScore(report.uxScore),
      conversionScore: clampScore(report.conversionScore),
      mobileScore: clampScore(report.mobileScore),
      aiDiscoverabilityScore: clampScore(report.aiDiscoverabilityScore),
      contentScore: clampScore(report.contentScore),
      categoryScores: Array.isArray(report.categoryScores)
        ? report.categoryScores.map((c: any) => ({
            name: c.name || 'Unknown',
            score: clampScore(c.score),
            summary: c.summary || '',
          }))
        : getDefaultCategoryScores(),
    }
  } catch (err) {
    console.error('[generateReport] Error:', err instanceof Error ? err.message : err)
    return getDefaultReport()
  }
}

function clampScore(v: number | undefined): number {
  if (v == null || isNaN(v)) return 50
  return Math.min(100, Math.max(0, Math.round(v)))
}

function getDefaultCategoryScores(language: string = 'en'): CategoryScore[] {
  const names = getCategoryNames(language)
  return names.map((name) => ({ name, score: 50, summary: 'Needs evaluation' }))
}

function getDefaultReport(): ReportData {
  return {
    executiveSummary:
      'The audit identified areas for improvement in user experience, performance, and conversion optimization. Review the detailed findings for specific recommendations.',
    keyRecommendation: 'Prioritize critical issues first, then address high-impact improvements.',
    overallScore: 50,
    uxScore: 50,
    conversionScore: 50,
    mobileScore: 50,
    aiDiscoverabilityScore: 50,
    contentScore: 50,
    categoryScores: getDefaultCategoryScores(),
  }
}
