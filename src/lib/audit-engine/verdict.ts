// ============================================================
// The Verdict — the honest, industry-aware, plain-language judgment
// ============================================================
// This is the product. Not a list of findings — the 5-second judgment a
// blunt senior consultant gives a business owner: how your site stacks up in
// your industry, whether your value proposition is clear, whether a visitor
// can find your core service, and the 2-4 things actually costing you
// customers — each pointing at the EXACT place on the site. Plain words a
// non-technical owner understands. The technical findings become the receipts
// underneath; THIS is the headline.
//
// Design: the intelligence lives in the prompt (buildVerdictPrompt) and the
// parser (parseVerdict) — both pure and unit-tested. generateVerdict wires
// them to the model and is fully non-fatal: a missing key or a bad response
// yields null, never a broken audit.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'

// The Verdict is the headline of the whole report, so it gets the best
// judgment model available — not the cheap/fast one used for bulk findings.
export const VERDICT_MODEL = 'claude-sonnet-4-6'
// Known-good string already used across this repo. If the primary model isn't
// available in the account, we fall back to this so a verdict ALWAYS generates
// (a working weaker verdict beats a silent null we'd spend an hour debugging).
export const VERDICT_FALLBACK_MODEL = 'claude-haiku-4-5-20251001'

/* ── Types ─────────────────────────────────────────────────── */

export interface VerdictSignals {
  /** Count of measured mobile/phone usability problems. */
  mobileIssues?: number
  /** True if the site has a measured page-speed concern. */
  slowOnMobile?: boolean
  /** Count of measured problems for people on phones / using screen readers. */
  accessibilityIssues?: number
  /** Count of issues with how the site shows up on Google. */
  searchVisibilityIssues?: number
  /** The value proposition we detected on the page, if any. */
  detectedValueProp?: string | null
}

export interface VerdictInput {
  url: string
  /** Detected industry/vertical (e.g. "Online education", "Law firm"). */
  industry: string
  /** Who the site is for, if known. */
  audience?: string | null
  /** Homepage content block: "URL:/Title:/H1:/Meta Description:/Content:". */
  homepageContent: string
  /** Plain, measured signals the verdict may cite (already de-jargoned). */
  signals: VerdictSignals
}

export interface VerdictPoint {
  /** The problem in plain words. */
  what: string
  /** The EXACT location on the site (e.g. "the footer menu", "the hero headline"). */
  where: string
  /** What it concretely costs them. */
  impact: string
}

export interface Verdict {
  /** One blunt sentence — the verdict a consultant opens with. */
  headline: string
  /** 3-5 plain, honest sentences: industry standing, clarity, findability. */
  summary: string
  /** The 2-4 things actually costing customers, each pinned to a location. */
  points: VerdictPoint[]
  /** The single most important thing to do first. */
  bottomLine: string
  /** Model's confidence given what it could see. */
  confidence: 'high' | 'medium' | 'low'
}

/* ── Prompt (pure, testable) ───────────────────────────────── */

export function buildVerdictPrompt(input: VerdictInput): string {
  const s = input.signals || {}
  const measured: string[] = []
  if (s.mobileIssues && s.mobileIssues > 0) measured.push(`${s.mobileIssues} measured problem(s) using the site on a phone`)
  if (s.slowOnMobile) measured.push(`the page is measurably slow to load`)
  if (s.accessibilityIssues && s.accessibilityIssues > 0) measured.push(`${s.accessibilityIssues} problem(s) for people using screen readers or on phones`)
  if (s.searchVisibilityIssues && s.searchVisibilityIssues > 0) measured.push(`${s.searchVisibilityIssues} issue(s) with how the site shows up on Google`)
  const measuredBlock = measured.length
    ? `Measured facts you may cite (translate each into plain impact, never list raw):\n- ${measured.join('\n- ')}`
    : `No blocking technical problems were measured — judge the site on clarity, positioning, and industry standard.`

  return `You are a blunt, senior website consultant with 15 years of experience in the ${input.industry} industry. A business owner is paying for the honest truth a friend in the business would tell them over coffee — the exact judgment that wins or loses real contracts. You are NOT a checklist tool and you do NOT pad.

NON-NEGOTIABLE RULES:
1. BE SPECIFIC. Always name the exact place on the site: "the footer menu", "the headline at the top", "the pricing page", "the contact form". NEVER vague: never "the navigation", "some elements", "the layout", "various pages". If you cannot point to the exact spot, do not say it.
   - Bad: "Navigation could be improved."
   - Good: "Your services are only linked from the footer menu at the very bottom, so visitors scroll past without ever seeing them."
2. HARD TRUTH FIRST. Lead with the single most damaging problem. No flattery, no "overall it's good but". Owner gets the gut-punch, then the fix.
3. PLAIN LANGUAGE. A smart 12-year-old must understand every sentence. BANNED words: WCAG, viewport, CTA, DOM, semantic, responsive, accessibility, meta, schema, SEO, optimize. Say "on phones", "the button", "showing up on Google", "people using screen readers".
4. GROUNDED. Base every statement on the actual page content below. Reference the real headline and the real services. Do NOT invent features or pages you cannot see.
5. INDUSTRY STANDARD. Judge against what a strong ${input.industry} site does, and name the gap concretely.
6. PRIORITIZE. Maximum 4 points — only what actually costs customers or trust. If the site is genuinely strong, say so plainly and name what's working, then give the single biggest opportunity.

THE SITE
URL: ${input.url}
Industry: ${input.industry}${input.audience ? `\nAudience: ${input.audience}` : ''}${s.detectedValueProp ? `\nValue proposition we detected: ${s.detectedValueProp}` : ''}

HOMEPAGE CONTENT
${input.homepageContent}

${measuredBlock}

Return ONLY this JSON, nothing else:
{
  "headline": "one blunt sentence — the verdict you'd open the meeting with",
  "summary": "3 to 5 plain, honest sentences covering: how this site measures up to others in its industry, whether a first-time visitor understands what you do and why you in 5 seconds, and whether they can immediately find your main service",
  "points": [
    { "what": "the problem in plain words", "where": "the EXACT spot on the site", "impact": "what it concretely costs them" }
  ],
  "bottomLine": "the single most important thing to fix first, in one sentence",
  "confidence": "high | medium | low"
}`
}

/* ── Parser (pure, testable) ───────────────────────────────── */

export function parseVerdict(raw: string): Verdict | null {
  if (!raw) return null
  // Tolerate ```json fences and surrounding prose — grab the first {...} block.
  const fenced = raw.replace(/```json\s*/gi, '').replace(/```/g, '')
  const match = fenced.match(/\{[\s\S]*\}/m)
  if (!match) return null
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(match[0])
  } catch {
    return null
  }

  const headline = typeof obj.headline === 'string' ? obj.headline.trim() : ''
  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : ''
  if (!headline || !summary) return null // without the verdict itself, there's nothing to show

  const rawPoints = Array.isArray(obj.points) ? obj.points : []
  const points: VerdictPoint[] = rawPoints
    .map((p): VerdictPoint | null => {
      if (!p || typeof p !== 'object') return null
      const r = p as Record<string, unknown>
      const what = typeof r.what === 'string' ? r.what.trim() : ''
      const where = typeof r.where === 'string' ? r.where.trim() : ''
      const impact = typeof r.impact === 'string' ? r.impact.trim() : ''
      if (!what) return null
      return { what, where, impact }
    })
    .filter((p): p is VerdictPoint => p !== null)
    .slice(0, 4)

  const conf = typeof obj.confidence === 'string' ? obj.confidence.toLowerCase() : ''
  const confidence: Verdict['confidence'] = conf === 'high' || conf === 'low' ? conf : 'medium'

  return {
    headline,
    summary,
    points,
    bottomLine: typeof obj.bottomLine === 'string' ? obj.bottomLine.trim() : '',
    confidence,
  }
}

/* ── Orchestrator (non-fatal) ──────────────────────────────── */

/** Injectable completer so the orchestrator is testable without the SDK. */
export type VerdictCompleter = (args: { model: string; prompt: string }) => Promise<string>

let _client: Anthropic | null = null
const defaultCompleter: VerdictCompleter = async ({ model, prompt }) => {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')
    _client = new Anthropic({ apiKey, timeout: 45_000 })
  }
  const msg = await _client.messages.create({
    model,
    max_tokens: 1000,
    temperature: 0.3, // a touch of voice — this is judgment, not extraction
    messages: [{ role: 'user', content: prompt }],
  })
  return msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('')
}

/**
 * Generate the Verdict for an audit. Fully non-fatal: returns null on any
 * failure (no key, model error, unparseable response) so it can never break
 * the audit. The caller renders the verdict when present and falls back to the
 * findings otherwise.
 */
export async function generateVerdict(
  input: VerdictInput,
  opts?: { model?: string; complete?: VerdictCompleter },
): Promise<Verdict | null> {
  try {
    if (!input.homepageContent || !input.industry) return null
    const complete = opts?.complete || defaultCompleter
    const model = opts?.model || VERDICT_MODEL
    const prompt = buildVerdictPrompt(input)
    let raw: string
    try {
      raw = await complete({ model, prompt })
    } catch (primaryErr) {
      // If the strong model isn't available, don't fail silently — retry once
      // with the known-good model so a verdict still gets produced.
      if (model === VERDICT_FALLBACK_MODEL) throw primaryErr
      console.warn('[verdict] primary model failed, retrying with fallback:', primaryErr instanceof Error ? primaryErr.message : primaryErr)
      raw = await complete({ model: VERDICT_FALLBACK_MODEL, prompt })
    }
    return parseVerdict(raw)
  } catch (err) {
    console.error('[verdict] generation failed (non-fatal):', err instanceof Error ? err.message : err)
    return null
  }
}
