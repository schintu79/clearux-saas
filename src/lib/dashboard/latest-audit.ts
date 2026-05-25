// ============================================================
// Fixpath — Latest audit fetcher for Find/Fix/Track dashboard
// Client-side helper. Pulls the user's most recent completed
// audit for the currently-selected brand or site, plus its
// report and findings. Used by Overview, Find, Fix, and Track
// so they share one source of truth.
//
// Selection-aware: a brand/site selection ALWAYS scopes the
// returned bundle. When a selection is supplied but no audit
// exists for it, every dashboard surface gets a clean empty
// bundle — never a stale audit from a different brand.
// ============================================================

import { createBrowserSupabase } from '@/lib/supabase-ssr'
import type { Audit, AuditFinding, Report } from '@/types/database'
import type { BrandSelection } from '@/lib/dashboard/brand-selection'

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
  /** Previous completed audit for the same brand/site, if any. */
  prior: { audit: Audit; report: Report | null } | null
  /** Completed audits matching the selection (newest first), used for trend. */
  history: Array<{ audit: Audit; report: Report | null }>
  /**
   * The most recent non-terminal audit for this selection, if any.
   * Lets Overview show an in-progress dashboard ("Auditing your
   * website…") instead of the no-audit form while a fresh audit is
   * still crawling/analysing. May coexist with `audit` (a prior
   * completed audit exists and a new one is currently running) — in
   * that case Overview can choose to show the running banner on top
   * of the populated dashboard.
   */
  inProgressAudit: Audit | null
  /**
   * The most recent failed audit for this selection, surfaced only
   * when there is no completed audit yet (so the user sees a clear
   * retry CTA instead of the no-audit form).
   */
  failedAudit: Audit | null
  /**
   * Echoed selection used for the query. When `selection` is set but
   * `audit` is null, the caller should render an empty state for that
   * specific brand/site (do NOT fall back to another brand's data).
   */
  selection: BrandSelection
}

function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return null }
}

export async function loadLatestAuditBundle(
  userId: string,
  selection: BrandSelection = null,
): Promise<LatestAuditBundle> {
  const supabase = createBrowserSupabase()

  // When a brand is selected, resolve its website host so we can include
  // legacy audits that were created before brand_identity_id linking. A
  // brand "owns" any of this user's audits whose product_url host matches
  // the brand's website_url host — keeping selected-brand scoping while
  // surfacing the full history.
  let brandHost: string | null = null
  if (selection?.kind === 'brand') {
    const { data: brandRow } = await supabase
      .from('brand_identities')
      .select('website_url')
      .eq('id', selection.brandId)
      .maybeSingle()
    brandHost = hostnameOf((brandRow as { website_url: string | null } | null)?.website_url)
  }

  let query = supabase
    .from('audits')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .is('deleted_at', null)
    .or('audit_type.is.null,audit_type.eq.website')
    .order('completed_at', { ascending: false })
    .limit(50)

  // Brand selection: when the brand has no website host, fall back to the
  // strict brand_identity_id filter. Otherwise we union brand_identity_id
  // matches with legacy audits matching the website host client-side
  // (Supabase can't compare a derived host server-side).
  if (selection?.kind === 'brand' && !brandHost) {
    query = query.eq('brand_identity_id', selection.brandId)
  }

  const { data: audits } = await query
  let auditRows = (audits || []) as Audit[]

  if (selection?.kind === 'brand' && brandHost) {
    auditRows = auditRows.filter(
      (a) => a.brand_identity_id === selection.brandId || hostnameOf(a.product_url) === brandHost,
    )
  }

  if (selection?.kind === 'site') {
    auditRows = auditRows.filter((a) => hostnameOf(a.product_url) === selection.host)
  }

  auditRows = auditRows.slice(0, 25)

  // Separately fetch the most recent non-terminal audit (in-progress)
  // and the most recent failed audit for this selection. Surfaced so
  // Overview can show a calm "Auditing your website…" or a clear
  // retry state instead of the no-audit form. We only need the
  // top-most row of each, so cap small.
  const [inProgressAudit, failedAudit] = await Promise.all([
    fetchLatestAuditByStatus(supabase, userId, selection, [...IN_PROGRESS_AUDIT_STATUSES], brandHost),
    fetchLatestAuditByStatus(supabase, userId, selection, ['failed'], brandHost),
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
      selection,
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
  // Prior must match the same scope. For a brand selection, history is
  // already brand-scoped server-side, so the next row is "prior". For a
  // site selection or no selection, match by hostname for backwards-
  // compatible "previous audit for this site" semantics.
  const prior = selection?.kind === 'brand'
    ? (history.slice(1).find((h) =>
        h.audit.brand_identity_id === selection.brandId ||
        (brandHost != null && hostnameOf(h.audit.product_url) === brandHost),
      ) || null)
    : (history.slice(1).find((h) => hostnameOf(h.audit.product_url) === hostnameOf(latest.audit.product_url)) || null)

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
    selection,
  }
}

/**
 * Fetch the most recent audit row for the given user + selection that
 * is in one of the supplied statuses. Returns null if none.
 *
 * Uses the same selection scoping rules as the main bundle query
 * (brand scoped server-side, site filtered client-side by hostname).
 */
async function fetchLatestAuditByStatus(
  supabase: ReturnType<typeof createBrowserSupabase>,
  userId: string,
  selection: BrandSelection,
  statuses: string[],
  brandHost: string | null,
): Promise<Audit | null> {
  let q = supabase
    .from('audits')
    .select('*')
    .eq('user_id', userId)
    .in('status', statuses)
    .is('deleted_at', null)
    .or('audit_type.is.null,audit_type.eq.website')
    .order('created_at', { ascending: false })
    .limit(25)

  // Fall back to strict brand_identity_id filter only when we can't widen
  // by host. With a known brandHost we filter client-side so legacy audits
  // linked only by URL still surface.
  if (selection?.kind === 'brand' && !brandHost) {
    q = q.eq('brand_identity_id', selection.brandId)
  }

  const { data } = await q
  const rows = (data || []) as Audit[]
  if (rows.length === 0) return null

  if (selection?.kind === 'brand' && brandHost) {
    const match = rows.find(
      (a) => a.brand_identity_id === selection.brandId || hostnameOf(a.product_url) === brandHost,
    )
    return match || null
  }

  if (selection?.kind === 'site') {
    const match = rows.find((a) => hostnameOf(a.product_url) === selection.host)
    return match || null
  }

  return rows[0]
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
  const names = ['Foundation', 'Human Experience', 'Inclusive Design', 'Future Readiness', 'SEO Structure', 'Brand Consistency']
  return names[moduleIdx] || 'General'
}

export function moduleIndexForFinding(f: AuditFinding): number {
  const idx = f.category_index
  if (idx == null) return -1
  return Math.max(0, Math.min(5, Math.floor(idx / 4)))
}

export const MODULE_TINTS = [
  { dot: '#3B82F6', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.18)' },  // Foundation
  { dot: '#EC4899', bg: 'rgba(236, 72, 153, 0.08)', border: 'rgba(236, 72, 153, 0.18)' },  // Human Experience
  { dot: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.18)' },  // Inclusive Design
  { dot: '#F59E0B', bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.18)' },  // Future Readiness
  { dot: '#10B981', bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.18)' },  // SEO Structure
  { dot: '#06B6D4', bg: 'rgba(6, 182, 212, 0.08)', border: 'rgba(6, 182, 212, 0.18)' },    // Brand Consistency
] as const

export const PHASE1_MODULES = [
  'Foundation',
  'Human Experience',
  'Inclusive Design',
  'Future Readiness',
  'SEO Structure',
  'Brand Consistency',
] as const

const SEVERITY_PENALTY: Record<string, number> = {
  critical: 8,
  high: 5,
  medium: 3,
  low: 1.5,
}

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
    { name: 'SEO Structure', score: report.conversion_score ?? null },
    { name: 'Brand Consistency', score: report.overall_score ?? null },
  ]

  if (!findings || findings.length === 0) return legacy()

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

  if (!anyCategorized) return legacy()

  const baseline = typeof report.overall_score === 'number' ? report.overall_score : 100
  return PHASE1_MODULES.map((name, i) => {
    const load = loadByModule[i]
    const raw = 100 - load
    const clamped = Math.max(0, Math.min(100, raw))
    const blended = Math.round(clamped * 0.7 + baseline * 0.3)
    return { name, score: Math.max(0, Math.min(100, blended)) }
  })
}
