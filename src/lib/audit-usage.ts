/**
 * Canonical Audit & Quota Usage — Single Source of Truth
 *
 * All usage counts (re-audits, deep audits, workspace creations) are
 * DERIVED from actual records scoped to the current billing period.
 *
 * No decrement counters. No frontend state. Just queries.
 *
 * ── KEY INVARIANT: ANTI-ABUSE ──────────────────────────────────
 * Deleting an audit, workspace, or other metered object NEVER refunds
 * quota consumed during the current billing cycle. Usage counts
 * intentionally DO NOT filter by deleted_at or status='archived'.
 *
 * ── ACTIVE vs USAGE ────────────────────────────────────────────
 * Active inventory = how many items are live right now (can decrease on delete)
 * Monthly usage    = how many items were created this cycle (never decreases)
 * These are separate metrics with independent limits.
 *
 * Every part of the product — credits API, new-audit page, dashboard,
 * workspace creation, admin panel — MUST use this module for usage data.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { SUBSCRIPTION_PLANS } from '@/lib/pricing'

// ── Types ──────────────────────────────────────────────────────

export type AuditBillingClass =
  | 'initial_normal'   // First audit for workspace, standard depth → costs 1 credit
  | 'reaudit_normal'   // Subsequent audit for workspace, standard depth → costs 1 re-audit
  | 'deep'             // Any deep audit (first or subsequent) → costs 1 deep audit

export interface AuditUsage {
  // ── Active inventory (can decrease on delete) ────────────
  /** Number of active workspaces right now */
  active_workspaces: number
  /** Limit on simultaneous active workspaces */
  max_active_workspaces: number

  // ── Monthly usage (never decreases within a cycle) ───────
  /** Workspace creations consumed this billing period */
  workspace_creations_used: number
  workspace_creations_limit: number

  /** Normal re-audits consumed this billing period */
  re_audits_used: number
  re_audits_limit: number

  /** Deep audits consumed this billing period */
  deep_audits_used: number
  deep_audits_limit: number

  /** AI interrogation checks consumed this billing period */
  ai_checks_used: number
  ai_checks_limit: number

  /** Credit balance (for initial audits — not period-scoped) */
  credits: number
  /** Whether user qualifies for a free first audit */
  first_audit_free: boolean

  // ── Subscription info ────────────────────────────────────
  subscription_plan: string | null
  subscription_status: string | null
  subscription_interval: string | null

  // ── Billing period ───────────────────────────────────────
  billing_period_start: string | null
  billing_period_end: string | null
  /** Next usage counter reset date (= billing_period_end) */
  next_reset_date: string | null

  // ── Derived permission flags ─────────────────────────────
  can_initial_audit: boolean   // has credits or free first
  can_reaudit: boolean         // active sub + re_audits_used < re_audits_limit
  can_deep_audit: boolean      // active sub + deep_audits_used < deep_audits_limit
  can_create_workspace: boolean // active < max AND creations < cycle limit
  can_interrogate: boolean     // active sub + ai_checks_used < ai_checks_limit

  // ── Deprecated aliases (backward compat) ─────────────────
  /** @deprecated Use active_workspaces */
  workspaces_used: number
  /** @deprecated Use max_active_workspaces */
  workspaces_limit: number
}

// ── Limit resolution helpers ──────────────────────────────────

/**
 * Resolve effective limit: admin override → plan default → fallback.
 * null admin override = use plan default. null plan default = use fallback.
 */
function resolveLimit(
  adminOverride: number | null | undefined,
  planDefault: number | undefined,
  fallback: number,
): number {
  if (adminOverride !== null && adminOverride !== undefined) return adminOverride
  if (planDefault !== undefined) return planDefault
  return fallback
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
      // NOTE: intentionally NO deleted_at filter here — even deleted
      // prior audits count as "first audit already happened"
      // This prevents gaming: create audit → delete → create "first" again

    if ((count ?? 0) === 0) return 'initial_normal'
  }

  return 'reaudit_normal'
}

// ── Canonical usage query ──────────────────────────────────────

/**
 * Returns the full usage picture for a user by querying actual
 * records in the current billing period.
 *
 * This is the ONLY function that should be used to determine
 * quota consumption across the product.
 */
export async function getAuditUsage(
  userId: string,
  db: SupabaseClient,
): Promise<AuditUsage> {
  // 1. Fetch profile for plan info, billing period, credits, admin overrides
  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  const p = profile as any ?? {}
  const plan = SUBSCRIPTION_PLANS.find(pl => pl.id === p.subscription_plan)

  // ── Free membership check with expiry enforcement ────────
  // Precedence: explicit admin override → free membership → plan defaults → free tier fallback
  let isFreeMember = Boolean(p.free_membership)
  if (isFreeMember && p.free_membership_expiry) {
    const expiryDate = new Date(p.free_membership_expiry)
    if (expiryDate < new Date()) {
      // Free membership has expired — auto-revoke
      isFreeMember = false
      // Persist the revocation so we don't re-check every time
      await db
        .from('profiles')
        .update({
          free_membership: false,
          subscription_status: p.stripe_subscription_id ? 'active' : null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', userId)
      // Update local state for the rest of this function
      if (!p.stripe_subscription_id) {
        p.subscription_status = null
      }
    }
  }

  // Active subscription = Stripe sub active OR valid free membership
  const hasActiveSub = p.subscription_status === 'active' || isFreeMember
  let periodStart = p.billing_period_start as string | null
  let periodEnd = p.billing_period_end as string | null

  // Auto-roll expired billing periods forward so usage counts stay accurate.
  if (hasActiveSub && periodStart && periodEnd) {
    const endDate = new Date(periodEnd)
    const now = new Date()
    if (endDate < now) {
      const startDate = new Date(periodStart)
      while (endDate < now) {
        startDate.setMonth(startDate.getMonth() + 1)
        endDate.setMonth(endDate.getMonth() + 1)
      }
      periodStart = startDate.toISOString()
      periodEnd = endDate.toISOString()
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

  // ── Resolve effective limits ────────────────────────────────
  // Priority: admin override (profile column) → plan config → fallback
  const maxActiveWorkspaces = resolveLimit(
    p.max_active_workspaces,
    plan?.maxActiveWorkspaces ?? plan?.workspaces,
    1,
  )
  const workspaceCreationsLimit = resolveLimit(
    p.workspace_creations_per_cycle,
    plan?.workspaceCreationsPerCycle,
    2, // free users: 2 creations per cycle
  )
  const reAuditsLimit = resolveLimit(
    p.reaudits_per_cycle,
    plan?.reAuditsPerMonth,
    p.audits_per_month ?? 0,
  )
  const deepAuditsLimit = resolveLimit(
    p.deep_audits_per_cycle,
    plan?.deepAuditsPerMonth,
    p.deep_audits_per_month ?? 0,
  )
  const aiChecksLimit = resolveLimit(
    p.brand_ai_requests_per_cycle,
    plan?.aiChecksPerMonth,
    p.ai_checks_per_month ?? 0,
  )

  // ── 2. Active workspaces (inventory — can decrease on delete) ──
  const { count: activeWorkspaceCount } = await db
    .from('workspaces')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active')

  // ── 3. Workspace creations this cycle (usage — never decreases) ──
  // Count ALL workspaces created in billing period, regardless of
  // current status. Archiving/deleting does NOT refund the slot.
  let workspaceCreationsUsed = 0
  if (periodStart) {
    let wsCreationQ = db
      .from('workspaces')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', periodStart)
    if (periodEnd) wsCreationQ = wsCreationQ.lte('created_at', periodEnd)
    const { count: wsCreationCount } = await wsCreationQ
    workspaceCreationsUsed = wsCreationCount ?? 0
  }

  // ── 4. Free first audit eligibility ──
  // Check across ALL audits (including deleted) to prevent gaming
  const { count: totalAuditCount } = await db
    .from('audits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['completed', 'failed', 'analysing', 'crawling', 'generating_report', 'payment_received'])
    // NOTE: intentionally NO deleted_at filter — prevents gaming the free first audit

  const firstAuditFree = (totalAuditCount ?? 0) === 0

  // ── 5. Re-audits and deep audits this cycle ──
  // ANTI-ABUSE: Usage counts do NOT filter by deleted_at.
  // Soft-deleted audits still count toward the monthly quota.
  let reAuditsUsed = 0
  let deepAuditsUsed = 0

  if (hasActiveSub && periodStart) {
    const periodFilter = (q: any) => {
      q = q.gte('created_at', periodStart)
      if (periodEnd) q = q.lte('created_at', periodEnd)
      return q
    }

    // Deep audits in period (no deleted_at filter — anti-abuse)
    let deepQ = db
      .from('audits')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('depth_mode', 'deep')
      .neq('status', 'pending_payment')
      // INTENTIONALLY NO .is('deleted_at', null) — anti-abuse rule
    deepQ = periodFilter(deepQ)
    const { count: deepCount } = await deepQ
    deepAuditsUsed = deepCount ?? 0

    // Re-audits: non-deep audits that are NOT the first for their workspace
    let normalQ = db
      .from('audits')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('depth_mode', 'deep')
      .neq('status', 'pending_payment')
      // INTENTIONALLY NO .is('deleted_at', null) — anti-abuse rule
    normalQ = periodFilter(normalQ)
    const { count: normalInPeriod } = await normalQ

    // Find workspaces whose first-ever audit is in this period
    let periodAuditsQ = db
      .from('audits')
      .select('id, workspace_id, created_at')
      .eq('user_id', userId)
      .neq('depth_mode', 'deep')
      .neq('status', 'pending_payment')
      // No deleted_at filter — anti-abuse
      .order('created_at', { ascending: true })
    periodAuditsQ = periodFilter(periodAuditsQ)
    const { data: auditsInPeriod } = await periodAuditsQ

    let initialCount = 0
    if (auditsInPeriod && auditsInPeriod.length > 0) {
      const checkedWorkspaces = new Set<string>()
      for (const audit of auditsInPeriod as any[]) {
        const wsId = audit.workspace_id
        if (!wsId || checkedWorkspaces.has(wsId)) continue
        checkedWorkspaces.add(wsId)

        // Is there an earlier audit for this workspace (before the period)?
        // No deleted_at filter — anti-abuse
        const { count: priorCount } = await db
          .from('audits')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', wsId)
          .eq('user_id', userId)
          .neq('status', 'pending_payment')
          .lt('created_at', periodStart)

        if ((priorCount ?? 0) === 0) {
          initialCount++
        }
      }
    }

    reAuditsUsed = Math.max(0, (normalInPeriod ?? 0) - initialCount)
  }

  // ── 6. AI checks this cycle ──
  let aiChecksUsed = 0
  if ((hasActiveSub || aiChecksLimit > 0) && periodStart) {
    let aiQ = db
      .from('workspace_ai_interrogations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['completed', 'partial'])
      .gte('created_at', periodStart)
    if (periodEnd) aiQ = aiQ.lte('created_at', periodEnd)
    const { count: aiCount } = await aiQ
    aiChecksUsed = aiCount ?? 0
  }

  const credits = p.credits ?? 0

  // ── Derived permission flags ────────────────────────────────
  const canCreateWorkspace =
    (activeWorkspaceCount ?? 0) < maxActiveWorkspaces &&
    workspaceCreationsUsed < workspaceCreationsLimit

  return {
    // Active inventory
    active_workspaces: activeWorkspaceCount ?? 0,
    max_active_workspaces: maxActiveWorkspaces,

    // Monthly usage
    workspace_creations_used: workspaceCreationsUsed,
    workspace_creations_limit: workspaceCreationsLimit,
    re_audits_used: reAuditsUsed,
    re_audits_limit: reAuditsLimit,
    deep_audits_used: deepAuditsUsed,
    deep_audits_limit: deepAuditsLimit,
    ai_checks_used: aiChecksUsed,
    ai_checks_limit: aiChecksLimit,

    credits,
    first_audit_free: firstAuditFree,

    subscription_plan: p.subscription_plan ?? null,
    subscription_status: p.subscription_status ?? null,
    subscription_interval: p.subscription_interval ?? null,

    billing_period_start: periodStart,
    billing_period_end: periodEnd,
    next_reset_date: periodEnd,

    // Permission flags
    can_initial_audit: firstAuditFree || credits > 0,
    can_reaudit: hasActiveSub && reAuditsUsed < reAuditsLimit,
    can_deep_audit: hasActiveSub && deepAuditsUsed < deepAuditsLimit,
    can_create_workspace: canCreateWorkspace,
    can_interrogate: (hasActiveSub || aiChecksLimit > 0) && aiChecksUsed < aiChecksLimit,

    // Deprecated aliases
    workspaces_used: activeWorkspaceCount ?? 0,
    workspaces_limit: maxActiveWorkspaces,
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
          reason: `Monthly re-audit allowance exhausted (${usage.re_audits_used}/${usage.re_audits_limit}). Resets ${usage.next_reset_date ? `on ${new Date(usage.next_reset_date).toLocaleDateString()}` : 'on your next billing cycle'}.`,
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
          reason: `Monthly deep audit allowance exhausted (${usage.deep_audits_used}/${usage.deep_audits_limit}). Resets ${usage.next_reset_date ? `on ${new Date(usage.next_reset_date).toLocaleDateString()}` : 'on your next billing cycle'}.`,
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
