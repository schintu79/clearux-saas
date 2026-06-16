// ============================================================
// Capture→Analyze→Compose — Stage 3: Compose (the definition-of-done judge)
// ============================================================
// Compose reviews CANDIDATE findings against the captured evidence and keeps
// only those that meet the bar: REAL (supported by what's on the page), RELEVANT
// to the page's purpose, correctly SEVERE, and self-explanatory. Unevidenced
// speculation — "users might be confused", "the CTA is unclear" with no concrete
// defect — is dropped.
//
// This is the GENERAL rule that retires the per-symptom gates (CTA, input
// relevance, …): instead of pattern-matching each phrasing, every interpretive
// finding is re-judged against the page it describes.
//
// Design:
//   • Deterministic floor (cheap, no LLM): drop findings with no actionable
//     content; trust instrument (deterministic) findings — they carry measured
//     evidence and are never speculation.
//   • LLM judge (injected, so this module is fully unit-testable) re-evaluates
//     each interpretive (LLM-sourced) finding against its page's captured text.
//
// Pure orchestration — the only IO is the injected judge.
// ============================================================

import { isLlmSource } from '@/lib/audit-engine/pipeline/structural-ownership'

export interface FindingForCompose {
  id: string
  title: string
  description?: string | null
  recommendation?: string | null
  estimated_impact?: string | null
  severity?: string | null
  detection_source?: string | null
  page_url?: string | null
  target_element?: string | null
  evidence?: string | null
}

export type ComposeAction = 'keep' | 'drop' | 'adjust'

export interface ComposeVerdict {
  action: ComposeAction
  severity?: string | null
  reason: string
}

export interface ComposeResult {
  keptIds: string[]
  droppedIds: string[]
  /** id → new severity for findings the judge down/up-graded. */
  adjusted: Record<string, string>
  reasons: Record<string, string>
}

/** The injected LLM call: prompt in, raw model text out. */
export type ComposeJudge = (prompt: string) => Promise<string>

const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low'])

/**
 * Deterministic floor: a finding with no actionable content (no description AND
 * no recommendation) can never meet the definition of done. Returns the drop
 * reason, or null if it clears the floor.
 */
export function definitionOfDoneFloor(f: FindingForCompose): string | null {
  const hasTitle = !!(f.title && f.title.trim())
  const hasBody = !!(f.description && f.description.trim()) || !!(f.recommendation && f.recommendation.trim())
  if (!hasTitle) return 'no title'
  if (!hasBody) return 'no description and no recommendation — nothing actionable to show the user'
  return null
}

/** Build the judge prompt for one finding against its page's captured content. */
export function buildComposePrompt(f: FindingForCompose, pageContent: string): string {
  const ev = [
    f.target_element ? `Element selector: ${f.target_element}` : '',
    f.evidence ? `Stored evidence: ${f.evidence}` : '',
  ].filter(Boolean).join('\n')
  return `You are the QUALITY GATE for a website audit. Decide whether ONE finding should be shown to the client, judged ONLY against the page's actual captured content below.

RULES:
- KEEP only if the finding identifies a REAL, concrete defect that is supported by the page content, is RELEVANT to this page's purpose, and its severity is justified.
- DROP if it is speculation about how a hypothetical user "might feel" or "won't understand" with no concrete evidenced defect; if it claims something is missing that is actually present in the content; or if it is irrelevant to this page.
- ADJUST (and give a corrected severity) if the defect is real but the severity is wrong (e.g. a subjective copy nit-pick marked "high").
- A finding quoting that an element EXISTS is NOT evidence of a defect. Evidence of a defect is e.g. identical/duplicate labels, a measured failure, contradictory copy, a genuinely absent required element.

FINDING:
Title: ${f.title}
Description: ${f.description || '(none)'}
Recommendation: ${f.recommendation || '(none)'}
Severity: ${f.severity || '(none)'}
${ev}

PAGE CAPTURED CONTENT (${f.page_url || 'unknown page'}):
"""
${(pageContent || '(no content captured for this page)').slice(0, 6000)}
"""

Reply in EXACTLY this format:
VERDICT: KEEP | DROP | ADJUST
SEVERITY: critical | high | medium | low | (same)
REASON: <one sentence, concrete>`
}

/** Parse the judge's reply. Fail-safe: anything unparseable → KEEP (never drop on ambiguity). */
export function parseComposeVerdict(text: string): ComposeVerdict {
  const t = (text || '').trim()
  const verdictMatch = t.match(/VERDICT:\s*(KEEP|DROP|ADJUST)/i)
  const sevMatch = t.match(/SEVERITY:\s*(critical|high|medium|low)/i)
  const reasonMatch = t.match(/REASON:\s*(.+)/i)
  const action = (verdictMatch?.[1]?.toLowerCase() as ComposeAction) || 'keep'
  const severity = sevMatch ? sevMatch[1].toLowerCase() : null
  const reason = reasonMatch ? reasonMatch[1].trim() : 'no reason given'
  return { action, severity, reason }
}

/**
 * Compose a set of candidate findings against per-page captured content.
 *
 * - Deterministic instrument findings are trusted (kept) — they are measured,
 *   never speculation.
 * - Interpretive (LLM) findings clear the deterministic floor, then are judged
 *   by the injected LLM judge against their page's content.
 * - Fail-safe: a judge error or unparseable reply KEEPS the finding (Compose
 *   never silently deletes on ambiguity).
 */
export async function composeFindings(
  findings: ReadonlyArray<FindingForCompose>,
  pageContentByUrl: Record<string, string>,
  judge: ComposeJudge,
): Promise<ComposeResult> {
  const result: ComposeResult = { keptIds: [], droppedIds: [], adjusted: {}, reasons: {} }
  const contentByKey = new Map<string, string>()
  for (const [u, c] of Object.entries(pageContentByUrl || {})) contentByKey.set(u.replace(/\/+$/, ''), c)

  for (const f of findings) {
    // Floor.
    const floor = definitionOfDoneFloor(f)
    if (floor) { result.droppedIds.push(f.id); result.reasons[f.id] = `definition-of-done: ${floor}`; continue }

    // Trust instruments.
    if (!isLlmSource(f.detection_source)) { result.keptIds.push(f.id); continue }

    const content = contentByKey.get((f.page_url || '').replace(/\/+$/, '')) || ''
    let verdict: ComposeVerdict
    try {
      verdict = parseComposeVerdict(await judge(buildComposePrompt(f, content)))
    } catch {
      result.keptIds.push(f.id) // fail-safe: never drop on judge failure
      continue
    }

    if (verdict.action === 'drop') {
      result.droppedIds.push(f.id)
      result.reasons[f.id] = `compose: ${verdict.reason}`
    } else if (verdict.action === 'adjust' && verdict.severity && VALID_SEVERITIES.has(verdict.severity) && verdict.severity !== f.severity) {
      result.keptIds.push(f.id)
      result.adjusted[f.id] = verdict.severity
      result.reasons[f.id] = `compose adjusted severity → ${verdict.severity}: ${verdict.reason}`
    } else {
      result.keptIds.push(f.id)
    }
  }

  return result
}
