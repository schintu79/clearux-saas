/**
 * Canonical AI Interrogation Usage — Single Source of Truth
 *
 * All AI check usage counts are DERIVED from actual interrogation
 * records scoped to the current billing period.
 *
 * No decrement counters. No frontend state. Just queries.
 *
 * 1 AI check = 1 question run (regardless of how many models, up to 3).
 *
 * Plan limits:
 *   Starter = 10/month
 *   Pro     = 30/month
 *   Team    = 100/month
 *   Free    = 0 (no AI checks without a subscription)
 *
 * Every part of the product — interrogation API, intelligence page,
 * dashboard, admin panel — MUST use this module for usage data.
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ── Types ──────────────────────────────────────────────────────

export interface InterrogationUsage {
  checksUsed: number
  checksLimit: number
  checksRemaining: number
  canInterrogate: boolean
  billingPeriodStart: string | null
  billingPeriodEnd: string | null
}

// ── Plan configuration ─────────────────────────────────────────

/** AI checks per month by plan ID */
export const AI_CHECKS_PER_PLAN: Record<string, number> = {
  starter: 10,
  pro: 30,
  team: 100,
}

// ── Canonical usage query ──────────────────────────────────────

/**
 * Returns the AI interrogation usage picture for a workspace by
 * querying actual interrogation records in the current billing period.
 *
 * This is the ONLY function that should be used to determine
 * "how many AI checks has this workspace consumed?"
 */
export async function getInterrogationUsage(
  userId: string,
  workspaceId: string,
  db: SupabaseClient,
): Promise<InterrogationUsage> {
  // 1. Fetch profile for plan info, billing period, and per-profile override
  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  const p = (profile as any) ?? {}
  const plan = p.subscription_plan as string | null
  const hasActiveSub = p.subscription_status === 'active'
  const periodStart = (p.billing_period_start as string) ?? null
  const periodEnd = (p.billing_period_end as string) ?? null

  // Derive limit: plan config is the source of truth, with profile fallback
  const planLimit = plan ? (AI_CHECKS_PER_PLAN[plan] ?? 0) : 0
  const profileOverride = (p.ai_checks_per_month as number) ?? 0
  const checksLimit = planLimit > 0 ? planLimit : profileOverride

  // 2. Count completed/partial interrogations for this workspace in period
  let checksUsed = 0

  if (hasActiveSub || checksLimit > 0) {
    let query = db
      .from('workspace_ai_interrogations')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .in('status', ['completed', 'partial'])

    // Scope to billing period if available; otherwise fall back to
    // current calendar month so checks don't accumulate forever.
    if (periodStart) {
      query = query.gte('created_at', periodStart)
      if (periodEnd) {
        query = query.lte('created_at', periodEnd)
      }
    } else {
      // No billing period set — use start of current calendar month
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      query = query.gte('created_at', monthStart)
    }

    const { count } = await query
    checksUsed = count ?? 0
  }

  // 3. Derive remaining and permission flag
  const checksRemaining = Math.max(0, checksLimit - checksUsed)
  const canInterrogate = (hasActiveSub || checksLimit > 0) && checksUsed < checksLimit

  return {
    checksUsed,
    checksLimit,
    checksRemaining,
    canInterrogate,
    billingPeriodStart: periodStart,
    billingPeriodEnd: periodEnd,
  }
}

// ── Quota enforcement ──────────────────────────────────────────

/**
 * Check whether the user can run an AI interrogation.
 * Call this from the interrogation API BEFORE executing.
 *
 * Returns allowed/denied with a human-readable reason.
 */
export async function checkInterrogationQuota(
  userId: string,
  workspaceId: string,
  db: SupabaseClient,
): Promise<{ allowed: boolean; reason?: string }> {
  // 1. Get current usage
  const usage = await getInterrogationUsage(userId, workspaceId, db)

  // 2. Check subscription status
  const { data: profile } = await db
    .from('profiles')
    .select('subscription_status, subscription_plan')
    .eq('id', userId)
    .single()

  const p = (profile as any) ?? {}
  const subStatus = p.subscription_status as string | null
  const subPlan = p.subscription_plan as string | null

  // Free users (no subscription) get 0 AI checks
  if (!subStatus || subStatus !== 'active') {
    return {
      allowed: false,
      reason: 'AI interrogation requires an active subscription.',
    }
  }

  // No plan mapped or unknown plan with 0 limit
  if (usage.checksLimit === 0) {
    return {
      allowed: false,
      reason: `Your plan (${subPlan ?? 'unknown'}) does not include AI checks. Upgrade to access this feature.`,
    }
  }

  // Within limit check
  if (usage.checksUsed >= usage.checksLimit) {
    return {
      allowed: false,
      reason: `Monthly AI check allowance exhausted (${usage.checksUsed}/${usage.checksLimit}). Resets on your next billing cycle.`,
    }
  }

  return { allowed: true }
}
