// ============================================================
// ClearUX Admin API — /api/admin/users/plan
// PATCH → Override a user's plan, credits, and expiry
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'

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
      subscription_plan?: 'starter' | 'pro' | 'agency' | null
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

      // Set audits_per_month based on plan
      const planAudits: Record<string, number> = {
        starter: 3,
        pro: 10,
        agency: 30,
      }
      updates.audits_per_month = subscription_plan ? planAudits[subscription_plan] || 3 : 0
      updates.audits_remaining = updates.audits_per_month
    }

    if (credits !== undefined && typeof credits === 'number') {
      updates.credits = Math.max(0, credits)
    }

    if (free_membership !== undefined) {
      updates.free_membership = free_membership
      if (free_membership) {
        // Free members get active status and generous limits
        updates.subscription_status = 'active'
        if (!updates.subscription_plan && !p.subscription_plan) {
          updates.subscription_plan = 'pro' // default free tier
        }
      }
    }

    if (expiry_date !== undefined) {
      updates.free_membership_expiry = expiry_date || null
    }

    const { error: updateErr } = await db
      .from('profiles')
      .update(updates)
      .eq('id', user_id)

    if (updateErr) {
      console.error('Admin plan override error:', updateErr)
      return NextResponse.json({ error: 'Failed to update user plan' }, { status: 500 })
    }

    // Audit log
    await db.from('audit_logs').insert({
      audit_id: '00000000-0000-0000-0000-000000000000',
      event: 'admin_plan_override',
      status: 'info',
      message: `Admin ${adminUser.email} updated plan for ${p.email}`,
      metadata: {
        admin_id: adminUser.id,
        target_user_id: user_id,
        changes: updates,
        previous: {
          subscription_plan: p.subscription_plan,
          credits: p.credits,
          free_membership: p.free_membership,
          free_membership_expiry: p.free_membership_expiry,
        },
      },
    } as any)

    return NextResponse.json({ success: true, updates })
  } catch (err) {
    console.error('PATCH /api/admin/users/plan error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
