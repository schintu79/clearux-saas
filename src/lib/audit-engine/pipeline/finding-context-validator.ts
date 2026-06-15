// ============================================================
// ClearUX Audit Engine — Page-level Contextual Finding Validator (Phase 1)
// ============================================================
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================
//
// THE CONTEXTUAL JUDGMENT LAYER.
//
// The deterministic moats (structural-ownership, DOM-verification) and the
// generation-time analyzer guards remove the *cheap* false positives. This
// layer catches the ones that require READING THE WHOLE PAGE: a finding that
// quotes a heading without reading the copy beneath it, a finding that quotes
// a stale baseline headline as if it were live, a "missing X" claim answered
// by a nearby section. For each page we build the full page context (current
// body + DOM facts + industry/region) and re-judge every candidate finding on
// that page IN CONTEXT.
//
// SAFETY DOCTRINE (Phase 1):
//  - SUBTRACTIVE / SOFTENING ONLY. A verdict may keep, lower severity, demote
//    confidence (needs_evidence), or suppress. It can NEVER invent a finding
//    and NEVER raise severity. `applyVerdicts` enforces this structurally.
//  - One model call PER PAGE, never per finding.
//  - A deterministic prefilter skips pages whose findings are all verified
//    deterministic instrument output with no conflict — those already passed
//    the cheaper moats, so spending tokens on them is waste.
//  - The model caller is INJECTED. With no caller (or on any error) the layer
//    is a pure pass-through: every finding is kept unchanged. Non-fatal by
//    construction.
//  - REFERENCE CONTEXT (site map, PREVIOUS FINDINGS baseline, instrument
//    summaries) is NEVER treated as current page evidence — only the freshly
//    crawled page body is.
//
// This module is PURE except for the injected async model caller. It is wired
// into the existing quality_gates step (between the DOM-verification gate and
// evidence-binding) and reuses that step's idsToDelete / batchUpdates / auditLog.

import { splitBudgetedContent, MAX_ANALYSIS_CHARS } from '../analyzer'
import type { SiteProfile } from '../analyzer'
import type { DomFacts } from './dom-verification'

/* ── Inputs ──────────────────────────────────────────────── */

/** The finding fields the validator reads. Matches the quality_gates working set. */
export interface ValidatorFinding {
  id: string
  title: string
  description: string
  severity: string
  page_url: string | null
  confidence_level: string
  detection_source: string
}

export type Verdict = 'keep' | 'lower' | 'suppress' | 'needs_evidence'

/** One model verdict for one finding. */
export interface ValidationVerdict {
  id: string
  verdict: Verdict
  reason: string
  /** Only honored for verdict==='lower'; ignored otherwise. */
  newSeverity?: string
}

/** Per-finding audit-trail entry explaining the disposition. */
export interface AuditTrailEntry {
  id: string
  action: 'kept' | 'lowered' | 'suppressed' | 'demoted'
  reason: string
  fromSeverity?: string
  toSeverity?: string
}

/** What `applyVerdicts` produces — folded into the existing gate mechanism. */
export interface ApplyResult {
  idsToSuppress: string[]
  severityUpdates: Array<{ id: string; severity: string }>
  /** Findings demoted to "needs evidence" — confidence lowered, never deleted. */
  confidenceDemotions: string[]
  auditTrail: AuditTrailEntry[]
}

/** Full page context the validator judges a page's findings against. */
export interface PageContext {
  url: string
  /** Freshly crawled CURRENT page body for this URL (headings + copy). */
  bodyText: string
  /** Heading-ish lines pulled from the body, for quick prompt framing. */
  headings: string[]
  /** Per-URL rendered-DOM ground truth, if captured. */
  dom: DomFacts | null
  /** Industry / audience / market context for relevance judgment. */
  profile: SiteProfile | null
  /** Region cues detected from the body text (e.g. "GCC", "UAE"). */
  regionCues: string[]
}

/** Injected model caller. Returns raw model text (expected to contain a JSON
 * array of verdicts). Kept minimal so production wiring and test stubs match. */
export type ValidatorModelCaller = (args: {
  system: string
  user: string
}) => Promise<string>

/* ── Severity ranking (lowering only) ────────────────────── */

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }

/** A severity is a valid LOWERING of `from` only if it ranks strictly below it
 * and is a known severity. Anything else (raise, unknown) is rejected. */
export function isValidLowering(from: string, to: string): boolean {
  const f = SEVERITY_RANK[from]
  const t = SEVERITY_RANK[to]
  if (!f || !t) return false
  return t < f
}

/* ── Region cue detection (cheap, deterministic) ─────────── */

const REGION_PATTERNS: Array<{ cue: string; re: RegExp }> = [
  { cue: 'GCC', re: /\bGCC\b/ },
  { cue: 'UAE', re: /\b(UAE|United Arab Emirates|Emirates ID|Dubai|Abu Dhabi)\b/i },
  { cue: 'KSA', re: /\b(Saudi|KSA|Riyadh)\b/i },
  { cue: 'EU', re: /\b(GDPR|European Union|EU\b)/ },
  { cue: 'US', re: /\b(US Stocks|United States|USD|SEC\b)/ },
  { cue: 'UK', re: /\b(United Kingdom|FCA\b|£)/ },
]

/** Detect coarse region cues from page text — context for relevance judgment. */
export function detectRegionCues(text: string): string[] {
  const out: string[] = []
  for (const { cue, re } of REGION_PATTERNS) {
    if (re.test(text) && !out.includes(cue)) out.push(cue)
  }
  return out
}

/* ── Page-body extraction (CURRENT evidence only) ────────── */

/** Pull the heading-ish lines out of a single page body block. */
function extractHeadings(body: string): string[] {
  const out: string[] = []
  for (const line of body.split('\n')) {
    const m = line.match(/^(Title|H1|H2|H3|Meta Description):\s*(.+)$/)
    if (m && m[2].trim()) out.push(m[2].trim())
  }
  return out
}

/**
 * Build a `Map<url, PageContext>` from the crawled `pageContent`, the per-URL
 * DOM facts, and the site profile. Only the CURRENT page bodies (the `URL:`
 * blocks) become evidence; the preamble (site map, PREVIOUS FINDINGS baseline,
 * instrument summaries) is reference-only and deliberately excluded so stale
 * baseline text can never be judged as current page evidence.
 */
export function buildPageContextIndex(
  pageContent: string,
  domByUrl: Map<string, DomFacts> | null,
  profile: SiteProfile | null,
  maxCharsPerPage: number = MAX_ANALYSIS_CHARS,
): Map<string, PageContext> {
  const index = new Map<string, PageContext>()
  // Reuse the analyzer split so REFERENCE preamble is dropped from evidence.
  const { pageBodies, hasPageBodies } = splitBudgetedContent(pageContent, MAX_ANALYSIS_CHARS)
  if (!hasPageBodies) return index

  // Page-body blocks are "\n---\n"-delimited; each starts with a "URL:" line.
  for (const rawBlock of pageBodies.split('\n---\n')) {
    const block = rawBlock.trim()
    const urlMatch = block.match(/^URL:\s*(\S+)/m)
    if (!urlMatch) continue
    const url = urlMatch[1].trim()
    const bodyText = block.slice(0, maxCharsPerPage)
    index.set(url, {
      url,
      bodyText,
      headings: extractHeadings(bodyText),
      dom: domByUrl?.get(url) ?? null,
      profile,
      regionCues: detectRegionCues(bodyText),
    })
  }
  return index
}

/* ── Grouping + prefilter ────────────────────────────────── */

/** Group findings by their `page_url`. Findings with no page_url are grouped
 * under the empty-string key (still validated as a single bucket). */
export function groupFindingsByPage(
  findings: ValidatorFinding[],
): Map<string, ValidatorFinding[]> {
  const groups = new Map<string, ValidatorFinding[]>()
  for (const f of findings) {
    const key = f.page_url || ''
    const arr = groups.get(key)
    if (arr) arr.push(f)
    else groups.set(key, [f])
  }
  return groups
}

/** Deterministic, verified instrument output that already passed the cheaper
 * moats. Such a finding alone does not justify a model call. */
function isVerifiedDeterministic(f: ValidatorFinding): boolean {
  const verifiedSources = new Set([
    'wcag', 'wcag_checker', 'responsive', 'responsive_checker',
    'structured_data', 'pagespeed', 'axe',
  ])
  return f.confidence_level === 'deterministic' && verifiedSources.has(f.detection_source)
}

/**
 * A page needs a model call only when its findings include something that
 * requires contextual judgment: at least one NON-verified-deterministic
 * finding. Pages whose findings are all verified instrument output are skipped
 * (zero cost) — they were already validated by structural-ownership + DOM.
 */
export function pageNeedsValidation(findingsForPage: ValidatorFinding[]): boolean {
  if (findingsForPage.length === 0) return false
  return findingsForPage.some((f) => !isVerifiedDeterministic(f))
}

/* ── Prompt construction (pure, deterministic) ───────────── */

export const VALIDATOR_SYSTEM_INSTRUCTIONS = [
  'You are a precision auditor validating draft UX/accessibility findings against the FULL current content of a single web page.',
  '',
  'You are given the freshly crawled CURRENT PAGE CONTENT (the only valid evidence of what is on the live page today), optional rendered-DOM facts, the site industry/audience profile, and a list of DRAFT FINDINGS for this page.',
  '',
  'For EACH finding, read the WHOLE page — not just the heading a finding quotes — and decide whether the finding genuinely holds in context:',
  '- A heading/title alone is never sufficient. If the body copy, subtitle, cards, table cells, list items, or FAQ answers beneath it already address the concern, the finding does NOT hold.',
  '- A finding that quotes a headline/title/copy NOT present verbatim in the CURRENT PAGE CONTENT is stale (it likely came from a prior audit) and does NOT hold.',
  '- Judge relevance for the stated industry/region; do not flag patterns that are normal/expected for this kind of site.',
  '',
  'You may only WEAKEN findings — never strengthen them. Allowed verdicts:',
  '- "keep": the finding holds in full context; leave it unchanged.',
  '- "lower": the finding has some merit but the page partially answers it; reduce its severity. Provide "newSeverity" strictly below the original (critical>high>medium>low).',
  '- "suppress": the finding is false in context (answered nearby, stale, or not relevant). Remove it.',
  '- "needs_evidence": you cannot confirm it from the page content; demote it to a low-confidence "needs evidence" state (do NOT delete).',
  '',
  'NEVER raise a severity. NEVER invent a new finding. When unsure between keep and suppress, prefer "needs_evidence".',
  '',
  'Return ONLY a JSON array, one object per finding id you were given:',
  '[{"id":"<id>","verdict":"keep|lower|suppress|needs_evidence","reason":"<short>","newSeverity":"<only for lower>"}]',
].join('\n')

/** Render the DOM facts compactly for the prompt. */
function renderDom(dom: DomFacts | null): string {
  if (!dom) return '(no rendered-DOM facts captured for this page)'
  return [
    `landmarks: main=${dom.landmarks.main} nav=${dom.landmarks.nav} header=${dom.landmarks.header} footer=${dom.landmarks.footer} skipLink=${dom.landmarks.skipLink}`,
    `headings: [${dom.headings.join(', ')}]`,
    `forms: totalControls=${dom.forms.totalControls} labeledControls=${dom.forms.labeledControls} requiredMarked=${dom.forms.requiredMarked}`,
    `langAttr: ${dom.langAttr ?? 'none'} viewportMeta: ${dom.viewportMeta}`,
  ].join('\n')
}

/** Build the per-page user prompt. Pure + deterministic for testability. */
export function buildValidationPrompt(
  ctx: PageContext,
  findingsForPage: ValidatorFinding[],
): string {
  const profileLine = ctx.profile
    ? `${ctx.profile.industryVertical} | audience: ${ctx.profile.targetAudience} (${ctx.profile.audienceSophistication}) | market: ${ctx.profile.marketPosition}`
    : '(unknown profile)'
  const draftFindings = findingsForPage
    .map(
      (f, i) =>
        `[${i + 1}] id=${f.id} severity=${f.severity} source=${f.detection_source} confidence=${f.confidence_level}\n` +
        `    title: ${f.title}\n` +
        `    description: ${f.description}`,
    )
    .join('\n')

  return [
    `PAGE: ${ctx.url}`,
    `SITE PROFILE: ${profileLine}`,
    `REGION CUES: ${ctx.regionCues.join(', ') || 'none detected'}`,
    '',
    'CURRENT PAGE CONTENT — THE ONLY VALID SOURCE OF EVIDENCE (freshly crawled this run):',
    '---',
    ctx.bodyText,
    '---',
    '',
    'RENDERED-DOM FACTS (ground truth for what exists):',
    renderDom(ctx.dom),
    '',
    `DRAFT FINDINGS FOR THIS PAGE (${findingsForPage.length}):`,
    draftFindings,
    '',
    'Return the JSON verdict array now.',
  ].join('\n')
}

/* ── Verdict parsing (pure) ──────────────────────────────── */

/**
 * Parse the model's raw text into verdicts, restricted to the ids we asked
 * about. Anything malformed, unknown, or for an unexpected id is dropped (the
 * finding then defaults to "keep" downstream — fail-safe, never fail-open to a
 * deletion). A verdict can never be coerced into raising severity.
 */
export function parseValidationVerdicts(
  raw: string,
  findingsForPage: ValidatorFinding[],
): ValidationVerdict[] {
  const allowedIds = new Set(findingsForPage.map((f) => f.id))
  const out: ValidationVerdict[] = []
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return out
  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    return out
  }
  if (!Array.isArray(parsed)) return out
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue
    const id = String((item as any).id ?? '')
    const verdict = String((item as any).verdict ?? '') as Verdict
    if (!allowedIds.has(id)) continue
    if (verdict !== 'keep' && verdict !== 'lower' && verdict !== 'suppress' && verdict !== 'needs_evidence') continue
    const reason = String((item as any).reason ?? '').slice(0, 500)
    const v: ValidationVerdict = { id, verdict, reason }
    if (verdict === 'lower') {
      const ns = (item as any).newSeverity
      if (ns != null) v.newSeverity = String(ns)
    }
    out.push(v)
  }
  return out
}

/* ── Verdict application (pure, structurally subtractive) ── */

/**
 * Fold verdicts into a structurally safe ApplyResult. Enforces the Phase 1
 * doctrine regardless of what the model returned:
 *  - "lower" is honored ONLY if newSeverity is a strict lowering; otherwise the
 *    finding is left as "kept" (never raised).
 *  - "suppress" → idsToSuppress.
 *  - "needs_evidence" → confidenceDemotions (lower confidence, never deleted).
 *  - "keep" / missing verdict → kept unchanged.
 */
export function applyVerdicts(
  findingsForPage: ValidatorFinding[],
  verdicts: ValidationVerdict[],
): ApplyResult {
  const byId = new Map(verdicts.map((v) => [v.id, v]))
  const result: ApplyResult = {
    idsToSuppress: [],
    severityUpdates: [],
    confidenceDemotions: [],
    auditTrail: [],
  }

  for (const f of findingsForPage) {
    const v = byId.get(f.id)
    if (!v || v.verdict === 'keep') {
      result.auditTrail.push({ id: f.id, action: 'kept', reason: v?.reason || 'no contextual objection' })
      continue
    }
    if (v.verdict === 'suppress') {
      result.idsToSuppress.push(f.id)
      result.auditTrail.push({ id: f.id, action: 'suppressed', reason: v.reason || 'false in page context' })
      continue
    }
    if (v.verdict === 'needs_evidence') {
      result.confidenceDemotions.push(f.id)
      result.auditTrail.push({ id: f.id, action: 'demoted', reason: v.reason || 'unconfirmed by page content' })
      continue
    }
    // verdict === 'lower'
    if (v.newSeverity && isValidLowering(f.severity, v.newSeverity)) {
      result.severityUpdates.push({ id: f.id, severity: v.newSeverity })
      result.auditTrail.push({
        id: f.id,
        action: 'lowered',
        reason: v.reason || 'partially answered in context',
        fromSeverity: f.severity,
        toSeverity: v.newSeverity,
      })
    } else {
      // Invalid/raised severity → refuse to change; keep as-is (never raise).
      result.auditTrail.push({
        id: f.id,
        action: 'kept',
        reason: v.reason || 'lower requested without a valid lower severity — kept unchanged',
      })
    }
  }
  return result
}

/* ── Orchestrator ────────────────────────────────────────── */

/** Merge of all per-page ApplyResults for the whole audit. */
export interface ValidationOutcome {
  idsToSuppress: string[]
  severityUpdates: Array<{ id: string; severity: string }>
  confidenceDemotions: string[]
  auditTrail: AuditTrailEntry[]
  /** Pages that actually triggered a model call (for cost telemetry). */
  pagesValidated: number
  /** Pages skipped by the prefilter. */
  pagesSkipped: number
}

const EMPTY_OUTCOME: ValidationOutcome = {
  idsToSuppress: [],
  severityUpdates: [],
  confidenceDemotions: [],
  auditTrail: [],
  pagesValidated: 0,
  pagesSkipped: 0,
}

/**
 * Validate every page's findings in context. Groups by page, prefilters pages
 * that need no judgment, makes ONE model call per remaining page, and folds the
 * verdicts into a single ValidationOutcome.
 *
 * If `callModel` is undefined, or any per-page call throws, that page's findings
 * pass through unchanged (kept) — the layer is non-fatal by construction.
 */
export async function validateFindingsInPageContext(args: {
  findings: ValidatorFinding[]
  pageContent: string
  domByUrl: Map<string, DomFacts> | null
  profile: SiteProfile | null
  callModel?: ValidatorModelCaller
  /** Safety cap on pages validated per audit (cost bound). */
  maxPages?: number
}): Promise<ValidationOutcome> {
  const { findings, pageContent, domByUrl, profile, callModel } = args
  if (!findings || findings.length === 0) return { ...EMPTY_OUTCOME }
  if (!callModel) return { ...EMPTY_OUTCOME } // no caller → pure pass-through

  const maxPages = args.maxPages ?? 12
  const contextIndex = buildPageContextIndex(pageContent, domByUrl, profile)
  const groups = groupFindingsByPage(findings)

  const outcome: ValidationOutcome = { ...EMPTY_OUTCOME, idsToSuppress: [], severityUpdates: [], confidenceDemotions: [], auditTrail: [] }
  let validated = 0

  for (const [url, group] of groups) {
    if (!pageNeedsValidation(group)) {
      outcome.pagesSkipped++
      continue
    }
    const ctx = contextIndex.get(url)
    // No current page body for this url → we have no CURRENT evidence to judge
    // against, so we must not suppress anything. Pass through unchanged.
    if (!ctx || !ctx.bodyText.trim()) {
      outcome.pagesSkipped++
      continue
    }
    if (validated >= maxPages) {
      outcome.pagesSkipped++
      continue
    }
    validated++
    try {
      const raw = await callModel({
        system: VALIDATOR_SYSTEM_INSTRUCTIONS,
        user: buildValidationPrompt(ctx, group),
      })
      const verdicts = parseValidationVerdicts(raw, group)
      const applied = applyVerdicts(group, verdicts)
      outcome.idsToSuppress.push(...applied.idsToSuppress)
      outcome.severityUpdates.push(...applied.severityUpdates)
      outcome.confidenceDemotions.push(...applied.confidenceDemotions)
      outcome.auditTrail.push(...applied.auditTrail)
    } catch (err) {
      // Non-fatal: this page's findings are kept unchanged.
      console.warn(`[finding-context-validator] page "${url}" validation failed (non-fatal):`, (err as Error)?.message)
    }
  }

  outcome.pagesValidated = validated
  return outcome
}
