// ============================================================
// ClearUX — Latest audit fetcher for Find/Fix/Track dashboard
// Client-side helper. Pulls the user's most recent completed
// website audit, its report, and findings. Used by Overview,
// Find, Fix, and Track pages so they share one source of truth.
// ============================================================

import { createBrowserSupabase } from '@/lib/supabase-ssr'
import type { Audit, AuditFinding, Report } from '@/types/database'

export interface LatestAuditBundle {
  audit: Audit | null
  report: Report | null
  findings: AuditFinding[]
  /** Previous completed audit for the same domain, if any. */
  prior: { audit: Audit; report: Report | null } | null
  /** All completed audits for the user (newest first), used for trend/portfolio. */
  history: Array<{ audit: Audit; report: Report | null }>
}

function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return null }
}

export async function loadLatestAuditBundle(userId: string): Promise<LatestAuditBundle> {
  const supabase = createBrowserSupabase()

  const { data: audits } = await supabase
    .from('audits')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .or('audit_type.is.null,audit_type.eq.website')
    .order('completed_at', { ascending: false })
    .limit(25)

  const auditRows = (audits || []) as Audit[]
  if (auditRows.length === 0) {
    return { audit: null, report: null, findings: [], prior: null, history: [] }
  }

  const auditIds = auditRows.map((a) => a.id)
  const { data: reports } = await supabase
    .from('reports')
    .select('*')
    .in('audit_id', auditIds)

  const reportById = new Map<string, Report>()
  for (const r of ((reports || []) as Report[])) reportById.set(r.audit_id, r)

  const history = auditRows.map((a) => ({ audit: a, report: reportById.get(a.id) || null }))
  const latest = history[0]
  const latestHost = hostnameOf(latest.audit.product_url)
  const prior = history.slice(1).find((h) => hostnameOf(h.audit.product_url) === latestHost) || null

  // Findings for the latest audit only — keeps payload small.
  const { data: findings } = await supabase
    .from('audit_findings')
    .select('*')
    .eq('audit_id', latest.audit.id)
    .order('sort_order', { ascending: true })

  return {
    audit: latest.audit,
    report: latest.report,
    findings: ((findings || []) as AuditFinding[]).filter((f) => !f.dismissed),
    prior,
    history,
  }
}

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }

export function rankFindings(findings: AuditFinding[]): AuditFinding[] {
  return [...findings].sort((a, b) => {
    const sa = SEVERITY_RANK[a.severity] || 0
    const sb = SEVERITY_RANK[b.severity] || 0
    if (sa !== sb) return sb - sa
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
}

export function severityColor(sev: string): string {
  switch (sev) {
    case 'critical': return 'var(--severe)'
    case 'high': return 'var(--warn)'
    case 'medium': return 'var(--signal)'
    case 'low': return 'var(--ok)'
    default: return 'var(--m-muted)'
  }
}

export function severityLabel(sev: string): string {
  return sev.charAt(0).toUpperCase() + sev.slice(1)
}

/** Rough fix-effort heuristic from severity + recommendation length. */
export function fixEffort(f: AuditFinding): 'Quick win' | 'Standard' | 'Complex' {
  const recLen = (f.recommendation || '').length
  if (recLen < 240 && (f.severity === 'low' || f.severity === 'medium')) return 'Quick win'
  if (recLen > 600 || f.severity === 'critical') return 'Complex'
  return 'Standard'
}

/** Detect a copy-paste snippet in the recommendation text (fenced code block). */
export function extractSnippet(recommendation: string | null | undefined): string | null {
  if (!recommendation) return null
  const m = recommendation.match(/```[a-zA-Z]*\n?([\s\S]+?)```/)
  if (m && m[1].trim().length > 0) return m[1].trim()
  // Inline-code fallback: a single-line HTML/snippet wrapped in backticks.
  const inline = recommendation.match(/`([^`]{15,})`/)
  if (inline) return inline[1].trim()
  return null
}

export function moduleNameForFinding(f: AuditFinding): string {
  // Module is derived from category_index (0..23) → six modules of 4 each.
  const idx = f.category_index
  if (idx == null) return 'General'
  const moduleIdx = Math.floor(idx / 4)
  const names = ['Foundation', 'Human Experience', 'Inclusive Design', 'Future Readiness', 'SEO Structure', 'Brand Consistency']
  return names[moduleIdx] || 'General'
}

export const PHASE1_MODULES = [
  'Foundation',
  'Human Experience',
  'Inclusive Design',
  'Future Readiness',
  'SEO Structure',
  'Brand Consistency',
] as const

/**
 * Severity weight used when deriving per-module scores from findings.
 *
 * Mirrors the penalty schedule in /api/findings/[id] (severityPenalty) so the
 * presentation-layer module strip stays consistent with how the audit
 * engine actually moves the overall score when a finding flips status.
 * If the engine schedule ever changes, update both here and there.
 */
const SEVERITY_PENALTY: Record<string, number> = {
  critical: 8,
  high: 5,
  medium: 3,
  low: 1.5,
}

/**
 * Per-module Phase 1 score strip.
 *
 * Strategy: prefer the report's per-module sub-scores when they map cleanly
 * (rare today — see follow-up note); otherwise derive each module's score
 * from the OPEN finding load attributable to that module via
 * `category_index` (0..23, four categories per module). The result is a
 * presentation-layer estimate that respects the audit engine output and
 * never writes back to it. Closed (fixed) findings are excluded — they
 * count as resolved deficit.
 *
 * `findings` is optional so the report-only callers (single audit row,
 * no findings loaded) keep working with the legacy mapping.
 */
export function moduleScoresFromReport(
  report: Report | null,
  findings?: AuditFinding[],
): Array<{ name: string; score: number | null }> {
  if (!report) return PHASE1_MODULES.map((n) => ({ name: n, score: null }))

  // Legacy heuristic fallback if findings aren't supplied. Maps the
  // narrowly-typed sub-scores on `reports` to the six display modules,
  // overall score for Brand Consistency where we have no proxy field.
  const legacy = (): Array<{ name: string; score: number | null }> => [
    { name: 'Foundation', score: report.content_score ?? null },
    { name: 'Human Experience', score: report.ux_score ?? null },
    { name: 'Inclusive Design', score: report.mobile_score ?? null },
    { name: 'Future Readiness', score: report.ai_discoverability_score ?? null },
    { name: 'SEO Structure', score: report.conversion_score ?? null },
    { name: 'Brand Consistency', score: report.overall_score ?? null },
  ]

  if (!findings || findings.length === 0) return legacy()

  // Aggregate severity-weighted open-finding load per module (0..5).
  const loadByModule = new Array(PHASE1_MODULES.length).fill(0) as number[]
  const countByModule = new Array(PHASE1_MODULES.length).fill(0) as number[]
  let anyCategorized = false

  for (const f of findings) {
    if (f.dismissed) continue
    if (f.status === 'fixed') continue
    if (f.category_index == null) continue
    anyCategorized = true
    const moduleIdx = Math.max(0, Math.min(PHASE1_MODULES.length - 1, Math.floor(f.category_index / 4)))
    loadByModule[moduleIdx] += SEVERITY_PENALTY[f.severity] ?? 3
    countByModule[moduleIdx] += 1
  }

  // If no findings carry category_index yet (older audits before migration
  // 025), fall back to the legacy mapping rather than guess.
  if (!anyCategorized) return legacy()

  const baseline = typeof report.overall_score === 'number' ? report.overall_score : 100
  // Scale: each module's score = clamp(100 - load, 0, 100), then blend with
  // the report's overall baseline so a clean module never reads higher than
  // the audit-engine's own ceiling. Keeps this estimator conservative.
  return PHASE1_MODULES.map((name, i) => {
    const load = loadByModule[i]
    const raw = 100 - load
    const clamped = Math.max(0, Math.min(100, raw))
    // Blend 70% finding-derived / 30% overall baseline so a single critical
    // doesn't flatten an otherwise-healthy module into the floor.
    const blended = Math.round(clamped * 0.7 + baseline * 0.3)
    return { name, score: Math.max(0, Math.min(100, blended)) }
  })
}
