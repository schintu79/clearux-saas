// ============================================================
// ClearUX — Brand Identity Audit Analyzer
// Uses Claude AI to evaluate brand materials against 7 categories.
// Produces findings, scores, and an executive summary.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import type { FindingSeverity } from '@/types/database'
import {
  BRAND_AUDIT_CATEGORIES,
  type BrandAuditCategory,
  calculateBrandScore,
} from '@/lib/brand-audit-modules'
import type { ExtractedContent } from './brand-file-extractor'

let _anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.')
    _anthropic = new Anthropic({ apiKey, timeout: 60_000 })
  }
  return _anthropic
}

// ── Types ──────────────────────────────────────────────────────

export interface BrandFinding {
  severity: FindingSeverity
  title: string
  description: string
  recommendation: string
  estimatedImpact?: string
  /** Which file(s) this finding relates to */
  sourceFile?: string | null
}

export interface BrandCategoryResult {
  slug: string
  name: string
  score: number
  summary: string
  findings: BrandFinding[]
}

export interface BrandReportData {
  executiveSummary: string
  keyRecommendation: string | null
  topRecommendations: string[]
  overallScore: number
  categoryResults: BrandCategoryResult[]
  totalIssues: number
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
}

// ── Analysis ───────────────────────────────────────────────────

/** Build a context string from all extracted file contents */
function buildBrandContext(extractedFiles: ExtractedContent[]): string {
  const sections: string[] = []

  for (const file of extractedFiles) {
    if (file.error) {
      sections.push(`\n--- FILE: ${file.fileName} [ERROR] ---\nExtraction failed: ${file.error}\n`)
      continue
    }

    sections.push(`\n--- FILE: ${file.fileName} (${file.fileType}) ---`)

    if (file.textContent) {
      sections.push(`\n### Text Content:\n${file.textContent.slice(0, 15_000)}`)
    }
    if (file.visualDescription) {
      sections.push(`\n### Visual Description:\n${file.visualDescription.slice(0, 5_000)}`)
    }
  }

  return sections.join('\n')
}

/** Analyze a single brand audit category */
export async function analyzeBrandCategory(
  category: BrandAuditCategory,
  brandContext: string,
  brandName: string,
  language: string = 'en',
): Promise<BrandCategoryResult> {
  const client = getAnthropicClient()

  const languageInstruction = language !== 'en'
    ? `\n\nIMPORTANT: Write ALL output (summary, titles, descriptions, recommendations) in the language with code "${language}". Only the JSON keys must stay in English.`
    : ''

  const prompt = `You are an expert brand strategist conducting a professional brand identity audit for "${brandName}".

## Category: ${category.name}
${category.description}

## Analysis Instructions
${category.analysisPrompt}

## Brand Materials
${brandContext}

## Output Format
Respond with ONLY valid JSON (no markdown fences):
{
  "score": <number 0-100>,
  "summary": "<2-3 sentence summary of findings for this category>",
  "findings": [
    {
      "severity": "<critical|high|medium|low>",
      "title": "<concise finding title>",
      "description": "<detailed description of the issue found, referencing specific files/content>",
      "recommendation": "<actionable recommendation to fix this>",
      "estimatedImpact": "<what improves when this is fixed>",
      "sourceFile": "<filename where issue was found, or null>"
    }
  ]
}

## Scoring Guide
- 90-100: Exceptional — professional, consistent, strategically strong
- 75-89: Good — solid foundation with minor improvements needed
- 60-74: Fair — noticeable gaps that should be addressed
- 40-59: Needs Work — significant issues affecting brand perception
- 0-39: Critical — fundamental problems that undermine brand credibility

## Severity Guide
- critical: Fundamentally undermines brand credibility or causes confusion
- high: Significant inconsistency or gap that most audiences would notice
- medium: Noticeable issue that affects professional perception
- low: Minor polish item or best-practice suggestion

Find 2-6 findings per category. Be specific — reference actual content from the files. Don't invent issues that aren't evidenced in the materials.${languageInstruction}`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content.find((b) => b.type === 'text')?.text || '{}'

    // Parse JSON — handle cases where the model wraps in markdown
    const jsonStr = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    const parsed = JSON.parse(jsonStr)

    return {
      slug: category.slug,
      name: category.name,
      score: Math.max(0, Math.min(100, Math.round(parsed.score ?? 50))),
      summary: parsed.summary || 'Analysis completed.',
      findings: (parsed.findings || []).map((f: any) => ({
        severity: (['critical', 'high', 'medium', 'low'].includes(f.severity) ? f.severity : 'medium') as FindingSeverity,
        title: f.title || 'Untitled finding',
        description: f.description || '',
        recommendation: f.recommendation || '',
        estimatedImpact: f.estimatedImpact || null,
        sourceFile: f.sourceFile || null,
      })),
    }
  } catch (err) {
    console.error(`Brand analysis failed for category "${category.name}":`, err)
    return {
      slug: category.slug,
      name: category.name,
      score: 0,
      summary: `Analysis failed: ${(err as Error).message}`,
      findings: [],
    }
  }
}

/** Analyze all brand audit categories in batches */
export async function analyzeAllBrandCategories(
  extractedFiles: ExtractedContent[],
  brandName: string,
  language: string = 'en',
  batchSize: number = 3,
): Promise<BrandCategoryResult[]> {
  const brandContext = buildBrandContext(extractedFiles)
  const results: BrandCategoryResult[] = []
  const categories = [...BRAND_AUDIT_CATEGORIES]

  // Process in batches
  for (let i = 0; i < categories.length; i += batchSize) {
    const batch = categories.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map((cat) => analyzeBrandCategory(cat, brandContext, brandName, language)),
    )
    results.push(...batchResults)
  }

  // Sort by category sort order
  results.sort((a, b) => {
    const catA = BRAND_AUDIT_CATEGORIES.find((c) => c.slug === a.slug)
    const catB = BRAND_AUDIT_CATEGORIES.find((c) => c.slug === b.slug)
    return (catA?.sortOrder ?? 0) - (catB?.sortOrder ?? 0)
  })

  return results
}

/** Generate executive summary from category results */
export async function generateBrandExecutiveSummary(
  categoryResults: BrandCategoryResult[],
  brandName: string,
  totalFiles: number,
  language: string = 'en',
): Promise<{ executiveSummary: string; topRecommendations: string[] }> {
  const client = getAnthropicClient()

  const languageInstruction = language !== 'en'
    ? `\n\nIMPORTANT: Write ALL output in the language with code "${language}".`
    : ''

  const categoryOverview = categoryResults.map(
    (r) => `- ${r.name}: ${r.score}/100 — ${r.summary} (${r.findings.length} findings)`,
  ).join('\n')

  const allFindings = categoryResults.flatMap((r) => r.findings)
  const criticalFindings = allFindings.filter((f) => f.severity === 'critical' || f.severity === 'high')
  const criticalList = criticalFindings.slice(0, 5).map(
    (f) => `  - [${f.severity.toUpperCase()}] ${f.title}: ${f.description.slice(0, 100)}...`,
  ).join('\n')

  const scores: Record<string, number> = {}
  categoryResults.forEach((r) => { scores[r.slug] = r.score })
  const overallScore = calculateBrandScore(scores)

  const prompt = `You are writing the executive summary for a brand identity audit of "${brandName}".

## Audit Results
Overall Score: ${overallScore}/100
Files Analyzed: ${totalFiles}
Total Findings: ${allFindings.length} (${allFindings.filter(f => f.severity === 'critical').length} critical, ${allFindings.filter(f => f.severity === 'high').length} high, ${allFindings.filter(f => f.severity === 'medium').length} medium, ${allFindings.filter(f => f.severity === 'low').length} low)

## Category Scores
${categoryOverview}

## Top Issues
${criticalList || '  No critical or high-severity issues found.'}

## Output Format
Respond with ONLY valid JSON:
{
  "executiveSummary": "<3-4 paragraphs: overall assessment, key strengths, areas for improvement, strategic recommendations>",
  "topRecommendations": ["<recommendation 1>", "<recommendation 2>", "<recommendation 3>"]
}

Write as a professional brand consultant. Be direct, specific, and actionable. Reference actual scores and findings. The tone should be honest but constructive — highlight strengths before weaknesses.${languageInstruction}`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content.find((b) => b.type === 'text')?.text || '{}'
    const jsonStr = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    const parsed = JSON.parse(jsonStr)

    return {
      executiveSummary: parsed.executiveSummary || 'Brand identity audit completed.',
      topRecommendations: parsed.topRecommendations || [],
    }
  } catch (err) {
    console.error('Failed to generate executive summary:', err)
    return {
      executiveSummary: `Brand identity audit of "${brandName}" completed. Overall score: ${overallScore}/100 across ${totalFiles} files analyzed. ${allFindings.length} findings identified.`,
      topRecommendations: [],
    }
  }
}

/** Build a complete brand report from category results */
export function buildBrandReport(
  categoryResults: BrandCategoryResult[],
  executiveSummary: string,
  topRecommendations: string[],
): BrandReportData {
  const allFindings = categoryResults.flatMap((r) => r.findings)
  const scores: Record<string, number> = {}
  categoryResults.forEach((r) => { scores[r.slug] = r.score })

  return {
    executiveSummary,
    keyRecommendation: topRecommendations[0] || null,
    topRecommendations,
    overallScore: calculateBrandScore(scores),
    categoryResults,
    totalIssues: allFindings.length,
    criticalCount: allFindings.filter((f) => f.severity === 'critical').length,
    highCount: allFindings.filter((f) => f.severity === 'high').length,
    mediumCount: allFindings.filter((f) => f.severity === 'medium').length,
    lowCount: allFindings.filter((f) => f.severity === 'low').length,
  }
}
