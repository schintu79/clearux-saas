/**
 * Canonical Audit Usage — Single Source of Truth
 *
 * All audit usage counts (re-audits, deep audits) are DERIVED from
 * actual audit records scoped to the current billing period.
 *
 * No decrement counters. No frontend state. Just queries.
 *
 * Every part of the product — credits API, new-audit page, dashboard,
 * admin panel — MUST use this module for usage data.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { SUBSCRIPTION_PLANS } from '@/lib/pricing'

// ── Types ──────────────────────────────────────────────────────

export type AuditBillingClass =
  | 'initial_normal'   // First audit for workspace, standard depth → costs 1 credit
  | 'reaudit_normal'   // Subsequent audit for workspace, standard depth → costs 1 re-audit
  | 'deep'             // Any deep audit (first or subsequent) → costs 1 deep audit

export interface AuditUsage {
  /** Number of active workspaces */
  workspaces_used: number
  workspaces_limit: number
  /** Normal re-audits consumed this billing period */
  re_audits_used: number
  re_audits_limit: number
  /** Deep audits consumed this billing period */
  deep_audits_used: number
  deep_audits_limit: number
  /** Credit balance (for initial audits — not period-scoped) */
  credits: number
  /** Whether user qualifies for a free first audit */
  first_audit_free: boolean
  /** Subscription info */
  subscription_plan: string | null
  subscription_status: string | null
  subscription_interval: string | null
  /** Billing period boundaries */
  billing_period_start: string | null
  billing_period_end: string | null
  /** Derived permission flags */
  can_initial_audit: boolean   // has credits or free first
  can_reaudit: boolean         // active sub + re_audits_used < re_audits_limit
  can_deep_audit: boolean      // active sub + deep_audits_used < deep_audits_limit
}

// ── Classify an audit for billing ──────────────────────────────

/**
 * Determine the billing class of an audit from its record.
 *
 * Rules (mutually exclusive — never double-count):
 *   depth_mode = 'deep'  →  'deep'          (consumes deep_audits quota)
 *   first for workspace  →  'initial_normal' (consumes 1 credit)
 *   otherwise            →  'reaudit_normal' (consumes re_audits quota)
 */
export async function classifyAudit(
  auditId: string,
  db: SupabaseClient,
): Promise<AuditBillingClass> {
  // Fetch the audit record
  const { data: audit } = await db
    .from('audits')
    .select('id, depth_mode, workspace_id, user_id, created_at')
    .eq('id', auditId)
    .single()

  if (!audit) throw new Error(`Audit not found: ${auditId}`)
  const a = audit as any

  // Deep mode always takes priority — one bucket, no double-counting
  if (a.depth_mode === 'deep') return 'deep'

  // Check if this is the first audit for this workspace
  if (a.workspace_id) {
    const { count } = await db
      .from('audits')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', a.workspace_id)
      .eq('user_id', a.user_id)
      .neq('id', auditId)
      .neq('status', 'pending_payment')

    if ((count ?? 0) === 0) return 'initial_normal'
  }

  return 'reaudit_normal'
}

// ── Canonical usage query ──────────────────────────────────────

/**
 * Returns the full usage picture for a user by querying actual
 * audit records in the current billing period.
 *
 * This is the ONLY function that should be used to determine
 * "how many re-audits / deep audits has this user consumed?"
 */
export async function getAuditUsage(
  userId: string,
  db: SupabaseClient,
): Promise<AuditUsage> {
  // 1. Fetch profile for plan info, billing period, credits
  //    Use select('*') so the query never fails if newer columns
  //    (deep_audits_per_month, billing_period_start/end) haven't
  //    been migrated yet — all field access already has ?? fallbacks.
  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  const p = profile as any ?? {}
  const plan = SUBSCRIPTION_PLANS.find(pl => pl.id === p.subscription_plan)
  const hasActiveSub = p.subscription_status === 'active'
  let periodStart = p.billing_period_start as string | null
  let periodEnd = p.billing_period_end as string | null

  // Auto-roll expired billing periods forward so usage counts stay accurate.
  // Without this, manually assigned plans (or missed Stripe webhooks) would
  // show 0 usage once the original period lapses.
  if (hasActiveSub && periodStart && periodEnd) {
    const endDate = new Date(periodEnd)
    const now = new Date()
    if (endDate < now) {
      // Roll forward in 1-month increments until the period covers "now"
      const startDate = new Date(periodStart)
      while (endDate < now) {
        startDate.setMonth(startDate.getMonth() + 1)
        endDate.setMonth(endDate.getMonth() + 1)
      }
      periodStart = startDate.toISOString()
      periodEnd = endDate.toISOString()
      // Persist the rolled-forward period so we don't recompute every call
      await db
        .from('profiles')
        .update({
          billing_period_start: periodStart,
          billing_period_end: periodEnd,
          updated_at: now.toISOString(),
        } as any)
        .eq('id', userId)
    }
  }

  // If subscription is active but billing period was never set, initialize it now
  if (hasActiveSub && !periodStart) {
    const now = new Date()
    const end = new Date(now)
    end.setMonth(end.getMonth() + 1)
    periodStart = now.toISOString()
    periodEnd = end.toISOString()
    await db
      .from('profiles')
      .update({
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        updated_at: now.toISOString(),
      } as any)
      .eq('id', userId)
  }

  // Limits from plan config (source of truth) with profile fallback
  const reAuditsLimit = plan?.reAuditsPerMonth ?? (p.audits_per_month ?? 0)
  const deepAuditsLimit = plan?.deepAuditsPerMonth ?? (p.deep_audits_per_month ?? 0)
  const workspacesLimit = plan?.workspaces ?? 1

  // 2. Count workspaces
  const { count: workspaceCount } = await db
    .from('workspaces')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active')

  // 3. Check free first audit eligibility
  const { count: totalAuditCount } = await db
    .from('audits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['completed', 'failed', 'analysing', 'crawling', 'generating_report', 'payment_received'])

  const firstAuditFree = (totalAuditCount ?? 0) === 0

  // 4. Count re-audits and deep audits in current billing period
  let reAuditsUsed = 0
  let deepAuditsUsed = 0

  if (hasActiveSub && periodStart) {
    // Build period filter: [periodStart, periodEnd) — or unbounded if no end date
    const periodFilter = (q: any) => {
      q = q.gte('created_at', periodStart)
      if (periodEnd) q = q.lte('created_at', periodEnd)
      return q
    }

    // Deep audits in period: any audit with depth_mode='deep' started in period
    let deepQ = db
      .from('audits')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('depth_mode', 'deep')
      .neq('status', 'pending_payment')
    deepQ = periodFilter(deepQ)
    const { count: deepCount } = await deepQ

    deepAuditsUsed = deepCount ?? 0

    // Re-audits in period: non-deep audits that are NOT the first for their workspace.
    // Strategy: count all non-deep, non-pending audits in period, then subtract
    // the number of workspaces that had their FIRST-EVER audit in this period.
    let normalQ = db
      .from('audits')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('depth_mode', 'deep')
      .neq('status', 'pending_payment')
    normalQ = periodFilter(normalQ)
    const { count: normalInPeriod } = await normalQ

    // Find workspaces whose first-ever audit (non-pending) is in this period
    // Those audits are "initial" and don't count as re-audits
    let periodAuditsQ = db
      .from('audits')
      .select('id, workspace_id, created_at')
      .eq('user_id', userId)
      .neq('depth_mode', 'deep')
      .neq('status', 'pending_payment')
      .order('created_at', { ascending: true })
    periodAuditsQ = periodFilter(periodAuditsQ)
    const { data: auditsInPeriod } = await periodAuditsQ

    // For each audit in the period, check if it's the first for its workspace
    let initialCount = 0
    if (auditsInPeriod && auditsInPeriod.length > 0) {
      const checkedWorkspaces = new Set<string>()
      for (const audit of auditsInPeriod as any[]) {
        const wsId = audit.workspace_id
        if (!wsId || checkedWorkspaces.has(wsId)) continue
        checkedWorkspaces.add(wsId)

        // Is there an earlier audit for this workspace (before the period)?
        const { count: priorCount } = await db
          .from('audits')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', wsId)
          .eq('user_id', userId)
          .neq('status', 'pending_payment')
          .lt('created_at', periodStart)

        if ((priorCount ?? 0) === 0) {
          // This workspace's first audit is in this period — it's initial, not a re-audit
          initialCount++
        }
      }
    }

    reAuditsUsed = Math.max(0, (normalInPeriod ?? 0) - initialCount)
  }

  const credits = p.credits ?? 0

  return {
    workspaces_used: workspaceCount ?? 0,
    workspaces_limit: workspacesLimit,
    re_audits_used: reAuditsUsed,
    re_audits_limit: reAuditsLimit,
    deep_audits_used: deepAuditsUsed,
    deep_audits_limit: deepAuditsLimit,
    credits,
    first_audit_free: firstAuditFree,
    subscription_plan: p.subscription_plan ?? null,
    subscription_status: p.subscription_status ?? null,
    subscription_interval: p.subscription_interval ?? null,
    billing_period_start: periodStart,
    billing_period_end: periodEnd,
    can_initial_audit: firstAuditFree || credits > 0,
    can_reaudit: hasActiveSub && reAuditsUsed < reAuditsLimit,
    can_deep_audit: hasActiveSub && deepAuditsUsed < deepAuditsLimit,
  }
}

// ── Enforce quota before starting an audit ─────────────────────

export interface QuotaCheckResult {
  allowed: boolean
  billing_class: AuditBillingClass
  /** Human-readable reason if denied */
  reason?: string
}

/**
 * Check whether the user can start this audit. Returns the billing
 * class and whether the audit is within quota.
 *
 * Call this from POST /api/credits BEFORE starting the pipeline.
 */
export async function checkAuditQuota(
  auditId: string,
  userId: string,
  db: SupabaseClient,
): Promise<QuotaCheckResult> {
  const billingClass = await classifyAudit(auditId, db)
  const usage = await getAuditUsage(userId, db)

  switch (billingClass) {
    case 'initial_normal': {
      if (usage.first_audit_free) {
        return { allowed: true, billing_class: billingClass }
      }
      if (usage.credits > 0) {
        return { allowed: true, billing_class: billingClass }
      }
      // Subscribers can also run initial audits from their re-audit allowance
      if (usage.can_reaudit) {
        return { allowed: true, billing_class: billingClass }
      }
      return {
        allowed: false,
        billing_class: billingClass,
        reason: 'No credits available. Buy a credit pack to run an initial audit.',
      }
    }

    case 'reaudit_normal': {
      if (usage.can_reaudit) {
        return { allowed: true, billing_class: billingClass }
      }
      if (usage.subscription_status === 'active') {
        return {
          allowed: false,
          billing_class: billingClass,
          reason: `Monthly re-audit allowance exhausted (${usage.re_audits_used}/${usage.re_audits_limit}). Resets on your next billing cycle.`,
        }
      }
      return {
        allowed: false,
        billing_class: billingClass,
        reason: 'Re-audits require an active subscription.',
      }
    }

    case 'deep': {
      if (usage.can_deep_audit) {
        return { allowed: true, billing_class: billingClass }
      }
      if (usage.subscription_status === 'active') {
        return {
          allowed: false,
          billing_class: billingClass,
          reason: `Monthly deep audit allowance exhausted (${usage.deep_audits_used}/${usage.deep_audits_limit}). Resets on your next billing cycle.`,
        }
      }
      return {
        allowed: false,
        billing_class: billingClass,
        reason: 'Deep audits require an active subscription.',
      }
    }
  }
}
