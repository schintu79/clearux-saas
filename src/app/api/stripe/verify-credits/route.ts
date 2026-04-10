// ============================================================
// ClearUX API — POST /api/stripe/verify-credits
// Verify credit pack purchase directly with Stripe.
// Fallback for when the webhook hasn't fired yet.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Search recent Stripe checkout sessions for this user's credit pack purchases
    const sessions = await stripe.checkout.sessions.list({ limit: 10 })

    const matchingSession = sessions.data.find(
      (s) =>
        s.metadata?.user_id === user.id &&
        s.metadata?.type === 'credit_pack' &&
        s.payment_status === 'paid',
    )

    if (!matchingSession) {
      return NextResponse.json({
        verified: false,
        message: 'No completed credit pack purchase found',
      })
    }

    const creditsToAdd = parseInt(matchingSession.metadata?.credits || '0', 10)
    if (creditsToAdd <= 0) {
      return NextResponse.json({
        verified: false,
        message: 'Invalid credits in session metadata',
      })
    }

    // Check if we've already processed this session (idempotency)
    // We use a simple approach: look at the session ID in audit_logs or a
    // dedicated payments table. For credit packs, we check if the credits
    // were already added by comparing expected vs actual.
    const db = createServiceSupabase()
    const { data: profile } = await db
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()

    // Check if this specific session was already processed
    // We'll store a record to prevent double-crediting
    const { data: existingRecord } = await db
      .from('payments')
      .select('id')
      .eq('stripe_payment_intent_id', matchingSession.payment_intent as string)
      .maybeSingle()

    if (existingRecord) {
      // Already processed — just return the current balance
      return NextResponse.json({
        verified: true,
        already_processed: true,
        credits: profile?.credits ?? 0,
      })
    }

    // Not yet processed — add credits
    const currentCredits = profile?.credits ?? 0
    const newBalance = currentCredits + creditsToAdd

    await db
      .from('profiles')
      .update({
        credits: newBalance,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', user.id)

    // Record the payment to prevent duplicate processing
    await db.from('payments').insert({
      user_id: user.id,
      audit_id: null,
      stripe_payment_intent_id: matchingSession.payment_intent as string,
      stripe_customer_id: matchingSession.customer as string,
      amount_cents: matchingSession.amount_total || 0,
      currency: matchingSession.currency || 'usd',
      status: 'succeeded',
    } as any)

    console.log(
      `[verify-credits] Added ${creditsToAdd} credits for user ${user.id}. Balance: ${currentCredits} → ${newBalance}`,
    )

    return NextResponse.json({
      verified: true,
      credits_added: creditsToAdd,
      credits: newBalance,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error in POST /api/stripe/verify-credits:', message)
    return NextResponse.json(
      { error: 'Failed to verify credits' },
      { status: 500 },
    )
  }
}
