// ============================================================
// Phase 3 — Fix verification: the IO dispatcher
// ============================================================
// Re-runs the ONE deterministic instrument that produced a finding, on the ONE
// page it's about, maps the fresh output into MatchKey[], and asks the pure
// classifier whether the SAME defect is still there.
//
// V1 instruments: axe + wcag_checker (one browser pass via checkWcagAutomated)
// and pagespeed_api (one PSI run). structured_data / responsive_checker / any
// other source return `inconclusive` for now — they are left as the user set
// them and reconciled on the next full re-audit (never falsely "fixed").
//
// Bounded + non-fatal: any error → inconclusive (we never block or guess).
// ============================================================

import { checkWcagAutomated } from '@/lib/audit-engine/pipeline/wcag-checker'
import { runFullSpeedTest, generateSpeedFindings } from '@/lib/pagespeed'
import {
  classifyFixOutcome,
  originalMatchKey,
  normalizeTitle,
  type FixOutcome,
  type MatchKey,
} from './match-finding'

export interface FindingToVerify {
  detection_source?: string | null
  title?: string | null
  target_element?: string | null
  performance_metric_type?: string | null
  page_url?: string | null
  severity?: string | null
}

export interface VerifyResult {
  outcome: FixOutcome
  evidenceAfter: string | null
  recheckMeta: Record<string, unknown>
}

const WCAG_SOURCES = new Set(['axe', 'wcag_checker'])
const VERIFIABLE_SOURCES = new Set(['axe', 'wcag_checker', 'pagespeed_api'])

/** Re-verify one deterministic finding by re-running its instrument on its page. */
export async function verifyDeterministicFinding(finding: FindingToVerify): Promise<VerifyResult> {
  const source = finding.detection_source || ''
  const url = finding.page_url || ''

  if (!url) return inconclusive('no page_url on finding')
  if (!VERIFIABLE_SOURCES.has(source)) {
    return inconclusive(`source '${source || 'unknown'}' is not auto-verifiable in V1 (reconciled on next re-audit)`)
  }

  const original = originalMatchKey(finding)

  try {
    let fresh: MatchKey[]
    if (WCAG_SOURCES.has(source)) {
      fresh = await freshWcagKeys(url, source)
    } else {
      fresh = await freshPagespeedKeys(url)
    }

    const outcome = classifyFixOutcome(original, fresh, { instrumentRan: true })
    const matched = fresh.filter((f) => f.source === source).length
    return {
      outcome,
      evidenceAfter: describeAfter(outcome, source, url, matched),
      recheckMeta: { instrument: source, fresh_for_source: matched, instrument_ran: true },
    }
  } catch (err) {
    return inconclusive(`re-check failed: ${(err as Error)?.message || 'unknown error'}`)
  }
}

/* ── Instrument re-runs → MatchKey[] ──────────────────────── */

async function freshWcagKeys(url: string, source: string): Promise<MatchKey[]> {
  // One browser pass produces BOTH axe findings and the custom WCAG checker
  // results; we only return keys for the finding's own source.
  const res = await checkWcagAutomated([url], 1)
  const keys: MatchKey[] = []

  if (source === 'axe') {
    for (const af of res.axeFindings || []) {
      keys.push({ source: 'axe', key: af.wcagCriterion || null, selector: af.targetElement || null, metric: null })
    }
    return keys
  }

  // wcag_checker: failing criteria from the custom checker on this page.
  const results = collectWcagResults(res.automatedResults, url)
  for (const r of results) {
    if (r.status !== 'fail') continue
    if (r.issues && r.issues.length > 0) {
      for (const issue of r.issues) {
        keys.push({ source: 'wcag_checker', key: r.criterion.id, selector: issue.element || null, metric: null })
      }
    } else {
      keys.push({ source: 'wcag_checker', key: r.criterion.id, selector: null, metric: null })
    }
  }
  return keys
}

async function freshPagespeedKeys(url: string): Promise<MatchKey[]> {
  const speed = await runFullSpeedTest(url)
  return generateSpeedFindings(speed).map((sf) => ({
    source: 'pagespeed_api',
    key: normalizeTitle(sf.title),
    selector: null,
    metric: sf.metricType || null,
  }))
}

/** Flatten the WCAG automatedResults map for the target URL (trailing-slash tolerant). */
function collectWcagResults(
  automatedResults: Map<string, Array<{ criterion: { id: string }; status: string; issues?: Array<{ element?: string }> }>> | undefined,
  url: string,
): Array<{ criterion: { id: string }; status: string; issues?: Array<{ element?: string }> }> {
  if (!automatedResults) return []
  const strip = (u: string) => u.replace(/\/+$/, '')
  for (const [k, v] of automatedResults.entries()) {
    if (strip(k) === strip(url)) return v
  }
  // Single-URL pass: if exact key didn't match, fall back to the only entry.
  const all = [...automatedResults.values()]
  return all.length === 1 ? all[0] : []
}

/* ── Helpers ──────────────────────────────────────────────── */

function inconclusive(reason: string): VerifyResult {
  return { outcome: 'inconclusive', evidenceAfter: null, recheckMeta: { instrument_ran: false, reason } }
}

function describeAfter(outcome: FixOutcome, source: string, url: string, matched: number): string | null {
  if (outcome === 'verified_fixed') return `Re-ran ${source} on ${url} — the defect is no longer present.`
  if (outcome === 'not_fixed') return `Re-ran ${source} on ${url} — the defect is still present (${matched} match${matched === 1 ? '' : 'es'}).`
  return null
}
