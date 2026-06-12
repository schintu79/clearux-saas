// ============================================================
// ClearUX Admin API — /api/admin/credits
// POST → Add or remove credits from a user
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error
    const { db, user: adminUser } = auth

    const body = await request.json()
    const { user_id, amount, reason } = body as {
      user_id: string
      amount: number      // positive = add, negative = remove
      reason?: string
    }

    if (!user_id || typeof amount !== 'number' || amount === 0) {
      return NextResponse.json({ error: 'user_id and non-zero amount required' }, { status: 400 })
    }

    // Get current balance
    const { data: profile, error: fetchErr } = await db
      .from('profiles')
      .select('credits, email')
      .eq('id', user_id)
      .single()

    if (fetchErr || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const currentCredits = (profile as any).credits ?? 0
    const newCredits = Math.max(0, currentCredits + amount) // never go below 0

    const { error: updateErr } = await db
      .from('profiles')
      .update({
        credits: newCredits,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', user_id)

    if (updateErr) {
      console.error('Admin credit update error:', updateErr)
      return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 })
    }

    // Log the action (non-critical — don't block the response if logging fails)
    try {
      const { error: uncheckedInsertErr1 } = await db.from('admin_logs').insert({
        admin_id: adminUser.id,
        event: 'credit_adjustment',
        target_user_id: user_id,
        message: `${amount > 0 ? 'Added' : 'Removed'} ${Math.abs(amount)} credits ${amount > 0 ? 'to' : 'from'} ${(profile as any).email}. Reason: ${reason || 'No reason provided'}`,
        metadata: {
          amount,
          credits_before: currentCredits,
          credits_after: newCredits,
          reason: reason || null,
        },
      } as any)
      if (uncheckedInsertErr1) console.error(`[db] insert failed (admin_logs): ${uncheckedInsertErr1.message}`)
    } catch (logErr) {
      // admin_logs table may not exist yet — silently continue
      console.warn('Non-critical: admin log insert failed:', logErr)
    }

    return NextResponse.json({
      success: true,
      credits_before: currentCredits,
      credits_after: newCredits,
    })
  } catch (err) {
    console.error('POST /api/admin/credits error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
