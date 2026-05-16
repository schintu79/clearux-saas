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

export function moduleScoresFromReport(report: Report | null): Array<{ name: string; score: number | null }> {
  if (!report) return PHASE1_MODULES.map((n) => ({ name: n, score: null }))
  // Map report fields to display modules. Report doesn't store per-module scores
  // by name yet, but exposes related sub-scores we can surface as a strip.
  // Order kept consistent with PHASE1_MODULES for the UI strip.
  const ux = report.ux_score
  const conv = report.conversion_score
  const mobile = report.mobile_score
  const ai = report.ai_discoverability_score
  const content = report.content_score
  return [
    { name: 'Foundation', score: content ?? null },
    { name: 'Human Experience', score: ux ?? null },
    { name: 'Inclusive Design', score: mobile ?? null },
    { name: 'Future Readiness', score: ai ?? null },
    { name: 'SEO Structure', score: conv ?? null },
    { name: 'Brand Consistency', score: report.overall_score ?? null },
  ]
}
