// ============================================================
// ClearUX API — /api/credits
// GET  → returns credit balance for current user
// POST → deducts 1 credit for a new audit
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { inngest } from '@/lib/inngest/client'

/* ── GET — credit balance ───────────────────────────────── */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()
    const { data: profile } = await db
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()

    return NextResponse.json({ credits: profile?.credits ?? 0 })
  } catch (err) {
    console.error('GET /api/credits error:', err)
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 })
  }
}

/* ── POST — use 1 credit for an audit ───────────────────── */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { audit_id } = await request.json()
    if (!audit_id)
      return NextResponse.json({ error: 'audit_id required' }, { status: 400 })

    const db = createServiceSupabase()

    // Check balance
    const { data: profile } = await db
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()

    const balance = profile?.credits ?? 0
    if (balance < 1)
      return NextResponse.json({ error: 'No credits available' }, { status: 400 })

    // Deduct 1 credit (atomic decrement via rpc or update)
    const { error: deductErr } = await db
      .from('profiles')
      .update({
        credits: balance - 1,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', user.id)
      .gte('credits', 1) // safety: only deduct if still >= 1

    if (deductErr) {
      console.error('Credit deduct error:', deductErr)
      return NextResponse.json({ error: 'Failed to deduct credit' }, { status: 500 })
    }

    // Create a payment record for audit tracking
    await db.from('payments').insert({
      audit_id,
      user_id: user.id,
      amount_cents: 0,
      currency: 'usd',
      status: 'succeeded',
      stripe_payment_intent_id: `credit_${Date.now()}`,
    } as any)

    // Update audit status to payment_received
    await db
      .from('audits')
      .update({
        status: 'payment_received',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', audit_id)

    // Log it
    await db.from('audit_logs').insert({
      audit_id,
      event: 'credit_used',
      status: 'success',
      message: `1 credit deducted. Remaining: ${balance - 1}`,
      metadata: { credits_before: balance, credits_after: balance - 1 },
    } as any)

    // Trigger audit processing via Inngest (background job)
    await inngest.send({
      name: 'audit/process',
      data: { auditId: audit_id },
    })

    return NextResponse.json({
      success: true,
      credits_remaining: balance - 1,
      message: 'Credit applied, audit processing started',
    })
  } catch (err) {
    console.error('POST /api/credits error:', err)
    return NextResponse.json({ error: 'Failed to use credit' }, { status: 500 })
  }
}
