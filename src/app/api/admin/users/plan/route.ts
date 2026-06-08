// ============================================================
// Fixpath Admin API — /api/admin/users/plan
// PATCH → Override a user's plan, credits, and expiry
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { SUBSCRIPTION_PLANS } from '@/lib/pricing'

/** Safely advance a date by one month without JS setMonth overflow. */
function addOneMonth(date: Date): Date {
  const result = new Date(date)
  const day = result.getDate()
  result.setMonth(result.getMonth() + 1)
  if (result.getDate() !== day) result.setDate(0)
  return result
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error
    const { db, user: adminUser } = auth

    const body = await request.json()
    const {
      user_id,
      subscription_plan,
      credits,
      ai_checks_per_month,
      free_membership,
      expiry_date,
      // ── Quota overrides (null = use plan default, number = override) ──
      max_active_workspaces,
      workspace_creations_per_cycle,
      reaudits_per_cycle,
      deep_audits_per_cycle,
      brand_ai_requests_per_cycle,
    } = body as {
      user_id: string
      subscription_plan?: 'starter' | 'pro' | 'team' | null
      credits?: number
      ai_checks_per_month?: number
      free_membership?: boolean
      expiry_date?: string | null
      max_active_workspaces?: number | null
      workspace_creations_per_cycle?: number | null
      reaudits_per_cycle?: number | null
      deep_audits_per_cycle?: number | null
      brand_ai_requests_per_cycle?: number | null
    }

    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }

    // Fetch current profile
    const { data: profile, error: fetchErr } = await db
      .from('profiles')
      .select('*')
      .eq('id', user_id)
      .single()

    if (fetchErr || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const p = profile as any

    // Build update object
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (subscription_plan !== undefined) {
      updates.subscription_plan = subscription_plan
      updates.subscription_status = subscription_plan ? 'active' : null

      // Use pricing.ts as source of truth for plan entitlements
      const planConfig = SUBSCRIPTION_PLANS.find((pl) => pl.id === subscription_plan)
      updates.audits_per_month = planConfig?.reAuditsPerMonth ?? 0
      updates.audits_remaining = updates.audits_per_month
      updates.deep_audits_per_month = planConfig?.deepAuditsPerMonth ?? 0
      updates.ai_checks_per_month = planConfig?.aiChecksPerMonth ?? 0

      // Set billing period if activating a plan
      if (subscription_plan) {
        const now = new Date()
        updates.billing_period_start = now.toISOString()
        updates.billing_period_end = addOneMonth(now).toISOString()
      } else {
        updates.billing_period_start = null
        updates.billing_period_end = null
      }
    }

    if (credits !== undefined && typeof credits === 'number') {
      updates.credits = Math.max(0, credits)
    }

    if (ai_checks_per_month !== undefined && typeof ai_checks_per_month === 'number') {
      updates.ai_checks_per_month = Math.max(0, ai_checks_per_month)
    }

    // ── Quota overrides ────────────────────────────────────────
    // null = clear override (revert to plan default)
    // number = set explicit per-user limit
    // undefined = not sent in request body (leave unchanged)
    if (max_active_workspaces !== undefined) {
      updates.max_active_workspaces = max_active_workspaces
    }
    if (workspace_creations_per_cycle !== undefined) {
      updates.workspace_creations_per_cycle = workspace_creations_per_cycle
    }
    if (reaudits_per_cycle !== undefined) {
      updates.reaudits_per_cycle = reaudits_per_cycle
    }
    if (deep_audits_per_cycle !== undefined) {
      updates.deep_audits_per_cycle = deep_audits_per_cycle
    }
    if (brand_ai_requests_per_cycle !== undefined) {
      updates.brand_ai_requests_per_cycle = brand_ai_requests_per_cycle
    }

    if (free_membership !== undefined) {
      // free_membership is a virtual concept — grant pro plan with no Stripe sub
      if (free_membership) {
        updates.subscription_status = 'active'
        if (!updates.subscription_plan && !p.subscription_plan) {
          updates.subscription_plan = 'pro'
        }
        // Set generous audits for free members
        if (!updates.audits_per_month) {
          const freePlan = SUBSCRIPTION_PLANS.find((pl) => pl.id === 'pro')
          updates.audits_per_month = freePlan?.reAuditsPerMonth ?? 10
          updates.audits_remaining = updates.audits_per_month
          updates.deep_audits_per_month = freePlan?.deepAuditsPerMonth ?? 4
        }
        // Initialize billing period if not set
        if (!p.billing_period_start) {
          const now = new Date()
          updates.billing_period_start = now.toISOString()
          updates.billing_period_end = addOneMonth(now).toISOString()
        }
      }
    }

    const { error: updateErr } = await db
      .from('profiles')
      .update(updates)
      .eq('id', user_id)

    if (updateErr) {
      console.error('Admin plan override error:', updateErr)
      return NextResponse.json({ error: 'Failed to update user plan' }, { status: 500 })
    }

    // Log the action (non-critical — don't block the response if logging fails)
    try {
      await db.from('admin_logs').insert({
        admin_id: adminUser.id,
        event: 'plan_override',
        target_user_id: user_id,
        message: `Updated plan for ${p.email}`,
        metadata: {
          changes: updates,
          previous: {
            subscription_plan: p.subscription_plan,
            credits: p.credits,
          },
        },
      } as any)
    } catch (logErr) {
      console.warn('Non-critical: admin log insert failed:', logErr)
    }

    return NextResponse.json({ success: true, updates })
  } catch (err) {
    console.error('PATCH /api/admin/users/plan error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
