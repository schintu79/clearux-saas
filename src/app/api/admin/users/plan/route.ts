// ============================================================
// Fixpath Admin API — /api/admin/users/plan
// PATCH → Override a user's plan, credits, and expiry
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { SUBSCRIPTION_PLANS } from '@/lib/pricing'

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
      free_membership,
      expiry_date,
    } = body as {
      user_id: string
      subscription_plan?: 'starter' | 'pro' | 'team' | null
      credits?: number
      free_membership?: boolean
      expiry_date?: string | null
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

      // Use pricing.ts as source of truth for re-audit allowance
      const planConfig = SUBSCRIPTION_PLANS.find((pl) => pl.id === subscription_plan)
      updates.audits_per_month = planConfig?.reAuditsPerMonth ?? 0
      updates.audits_remaining = updates.audits_per_month
    }

    if (credits !== undefined && typeof credits === 'number') {
      updates.credits = Math.max(0, credits)
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
          updates.audits_per_month = 10
          updates.audits_remaining = 10
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
