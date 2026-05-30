// ============================================================
// Fixpath — Latest audit fetcher for Find/Fix/Track dashboard
// Client-side helper. Pulls the user's most recent completed
// audit for the current workspace, plus its report and findings.
// Used by Overview, Find, Fix, and Track so they share one
// source of truth.
//
// WORKSPACE-SCOPED: queries audits by workspace_id column.
// When a workspace_id is supplied but no audit exists for it,
// every dashboard surface gets a clean empty bundle — never a
// stale audit from a different workspace.
// ============================================================

import { createBrowserSupabase } from '@/lib/supabase-ssr'
import type { Audit, AuditFinding, Report } from '@/types/database'

/**
 * Non-terminal audit statuses — an audit in any of these states is
 * actively being processed. Surfaced separately on Overview so the
 * "no audit yet" form is NEVER shown while an audit is running.
 */
export const IN_PROGRESS_AUDIT_STATUSES = [
  'pending_payment',
  'payment_received',
  'crawling',
  'analysing',
  'generating_report',
] as const

export type InProgressAuditStatus = (typeof IN_PROGRESS_AUDIT_STATUSES)[number]

export function isInProgressAuditStatus(s: string | null | undefined): boolean {
  if (!s) return false
  return (IN_PROGRESS_AUDIT_STATUSES as readonly string[]).includes(s)
}

export interface LatestAuditBundle {
  audit: Audit | null
  report: Report | null
  findings: AuditFinding[]
  /** Previous completed audit for the same workspace, if any. */
  prior: { audit: Audit; report: Report | null } | null
  /** Completed audits matching the workspace (newest first), used for trend. */
  history: Array<{ audit: Audit; report: Report | null }>
  /**
   * The most recent non-terminal audit for this workspace, if any.
   * Lets Overview show an in-progress dashboard ("Auditing your
   * website…") instead of the no-audit form while a fresh audit is
   * still crawling/analysing. May coexist with `audit` (a prior
   * completed audit exists and a new one is currently running) — in
   * that case Overview can choose to show the running banner on top
   * of the populated dashboard.
   */
  inProgressAudit: Audit | null
  /**
   * The most recent failed audit for this workspace, surfaced only
   * when there is no completed audit yet (so the user sees a clear
   * retry CTA instead of the no-audit form).
   */
  failedAudit: Audit | null
  /**
   * Echoed workspace ID used for the query. When set but `audit` is
   * null, the caller should render an empty state (do NOT fall back
   * to another workspace's data).
   */
  workspaceId: string | null
}

export async function loadLatestAuditBundle(
  userId: string,
  workspaceId: string | null = null,
): Promise<LatestAuditBundle> {
  const supabase = createBrowserSupabase()

  if (!workspaceId) {
    return {
      audit: null,
      report: null,
      findings: [],
      prior: null,
      history: [],
      inProgressAudit: null,
      failedAudit: null,
      workspaceId,
    }
  }

  // All queries scope by workspace_id — simple, no hostname tricks needed.
  const { data: audits } = await supabase
    .from('audits')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .eq('status', 'completed')
    .is('deleted_at', null)
    .or('audit_type.is.null,audit_type.eq.website')
    .order('completed_at', { ascending: false })
    .limit(25)

  const auditRows = (audits || []) as Audit[]

  // Fetch in-progress and failed audits in parallel.
  const [inProgressAudit, failedAudit] = await Promise.all([
    fetchLatestAuditByStatus(supabase, userId, workspaceId, [...IN_PROGRESS_AUDIT_STATUSES]),
    fetchLatestAuditByStatus(supabase, userId, workspaceId, ['failed']),
  ])

  if (auditRows.length === 0) {
    return {
      audit: null,
      report: null,
      findings: [],
      prior: null,
      history: [],
      inProgressAudit,
      failedAudit,
      workspaceId,
    }
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
  const prior = history.length > 1 ? history[1] : null

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
    inProgressAudit,
    failedAudit,
    workspaceId,
  }
}

/**
 * Fetch the most recent audit row for the given user + workspace that
 * is in one of the supplied statuses. Returns null if none.
 */
async function fetchLatestAuditByStatus(
  supabase: ReturnType<typeof createBrowserSupabase>,
  userId: string,
  workspaceId: string,
  statuses: string[],
): Promise<Audit | null> {
  const { data } = await supabase
    .from('audits')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .in('status', statuses)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)

  const rows = (data || []) as Audit[]
  return rows.length > 0 ? rows[0] : null
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
  const inline = recommendation.match(/`([^`]{15,})`/)
  if (inline) return inline[1].trim()
  return null
}

export function moduleNameForFinding(f: AuditFinding): string {
  const idx = f.category_index
  if (idx == null) return 'General'
  const moduleIdx = Math.floor(idx / 4)
  const names = ['Foundation', 'Human Experience', 'Inclusive Design', 'Future Readiness', 'SEO Structure & Rules', 'Accessibility Readiness', 'Brand Consistency']
  return names[moduleIdx] || 'General'
}

export function moduleIndexForFinding(f: AuditFinding): number {
  const idx = f.category_index
  if (idx == null) return -1
  return Math.max(0, Math.min(6, Math.floor(idx / 4)))
}

export const MODULE_TINTS = [
  { dot: '#3B82F6', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.18)' },  // Foundation
  { dot: '#EC4899', bg: 'rgba(236, 72, 153, 0.08)', border: 'rgba(236, 72, 153, 0.18)' },  // Human Experience
  { dot: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.18)' },  // Inclusive Design
  { dot: '#F59E0B', bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.18)' },  // Future Readiness
  { dot: '#10B981', bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.18)' },  // SEO Structure & Rules
  { dot: '#14B8A6', bg: 'rgba(20, 184, 166, 0.08)', border: 'rgba(20, 184, 166, 0.18)' },  // Accessibility Readiness
  { dot: '#06B6D4', bg: 'rgba(6, 182, 212, 0.08)', border: 'rgba(6, 182, 212, 0.18)' },    // Brand Consistency
] as const

export const PHASE1_MODULES = [
  'Foundation',
  'Human Experience',
  'Inclusive Design',
  'Future Readiness',
  'SEO Structure & Rules',
  'Accessibility Readiness',
  'Brand Consistency',
] as const

/**
 * Severity deductions — MUST match analyzer.ts generateReport() exactly.
 * Using different penalties here was the root cause of score mismatches
 * between the overview gauge and the module cards.
 *
 * OLD (broken): { critical: 8, high: 5, medium: 3, low: 1.5 } with base 100
 * NEW (unified): { critical: 18, high: 12, medium: 6, low: 2 } with base 92
 */
const SEVERITY_DEDUCTION: Record<string, number> = {
  critical: 18,
  high: 12,
  medium: 6,
  low: 2,
}
const BASE_SCORE = 92

export function moduleScoresFromReport(
  report: Report | null,
  findings?: AuditFinding[],
): Array<{ name: string; score: number | null }> {
  if (!report) return PHASE1_MODULES.map((n) => ({ name: n, score: null }))

  const legacy = (): Array<{ name: string; score: number | null }> => [
    { name: 'Foundation', score: report.content_score ?? null },
    { name: 'Human Experience', score: report.ux_score ?? null },
    { name: 'Inclusive Design', score: report.mobile_score ?? null },
    { name: 'Future Readiness', score: report.ai_discoverability_score ?? null },
    { name: 'SEO Structure & Rules', score: report.conversion_score ?? null },
    { name: 'Accessibility Readiness', score: null },
    { name: 'Brand Consistency', score: null },
  ]

  if (!findings || findings.length === 0) return legacy()

  // Group findings by category (0-27) mirroring analyzer.ts exactly
  const categoryDeductions = new Array(28).fill(0) as number[]
  const categoryHasFindings = new Array(28).fill(false) as boolean[]
  let anyCategorized = false

  for (const f of findings) {
    if (f.dismissed) continue
    if (f.status === 'fixed') continue
    if (f.category_index == null) continue
    if (f.category_index < 0 || f.category_index >= 28) continue
    anyCategorized = true
    categoryDeductions[f.category_index] += SEVERITY_DEDUCTION[f.severity] ?? 6
    categoryHasFindings[f.category_index] = true
  }

  if (!anyCategorized) return legacy()

  // Per-module score = average of its 4 category scores (same as analyzer.ts)
  // NO blending with overall_score — each category stands on its own
  return PHASE1_MODULES.map((name, i) => {
    const start = i * 4
    const end = start + 4
    let sum = 0
    let count = 0
    for (let ci = start; ci < end; ci++) {
      if (!categoryHasFindings[ci]) continue
      const score = Math.max(0, Math.min(100, BASE_SCORE - categoryDeductions[ci]))
      sum += score
      count++
    }
    if (count === 0) return { name, score: null }
    return { name, score: Math.round(sum / count) }
  })
}
