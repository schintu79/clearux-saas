// ============================================================
// ClearUX API — POST /api/stripe/verify
// Verify payment status directly with Stripe.
// Used as a fallback when the webhook hasn't fired yet
// (common in development, or race condition in production).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { stripe } from '@/lib/stripe'
import { createServerSupabase } from '@/lib/supabase-server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { processAudit } from '@/lib/audit-engine'

const verifySchema = z.object({
  audit_id: z.string().uuid('Invalid audit ID'),
})

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request
    const body = await request.json()
    const result = verifySchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { audit_id } = result.data

    // Fetch the audit
    const serviceDb = createServiceSupabase()
    const { data: audit, error: auditError } = await serviceDb
      .from('audits')
      .select('*')
      .eq('id', audit_id)
      .single()

    if (auditError || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    if ((audit as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // If already past pending_payment, no need to verify
    if ((audit as any).status !== 'pending_payment') {
      return NextResponse.json({
        status: (audit as any).status,
        message: 'Audit already progressed past payment',
      })
    }

    // Search Stripe for a completed checkout session with this audit_id
    const sessions = await stripe.checkout.sessions.list({
      limit: 10,
    })

    const matchingSession = sessions.data.find(
      (s) =>
        s.metadata?.audit_id === audit_id &&
        s.payment_status === 'paid'
    )

    if (!matchingSession) {
      return NextResponse.json({
        status: 'pending_payment',
        message: 'No completed payment found yet',
      })
    }

    // Payment found! Update the audit status (mimicking what the webhook does)
    console.log(`[verify] Found paid session for audit ${audit_id}, updating status`)

    // Check if payment record already exists
    const { data: existingPayment } = await serviceDb
      .from('payments')
      .select('id')
      .eq('audit_id', audit_id)
      .maybeSingle()

    if (!existingPayment) {
      // Insert payment record
      await serviceDb.from('payments').insert({
        audit_id,
        user_id: user.id,
        stripe_payment_intent_id: matchingSession.payment_intent as string,
        stripe_customer_id: matchingSession.customer as string,
        stripe_invoice_id: matchingSession.invoice as string,
        amount_cents: matchingSession.amount_total || 0,
        currency: matchingSession.currency || 'usd',
        status: 'succeeded',
        invoice_url: null,
        receipt_url: null,
      } as any)
    }

    // Update audit status
    await serviceDb
      .from('audits')
      .update({
        status: 'payment_received',
        progress_percent: 1,
        audit_stage: 'preflight',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', audit_id)

    // Log it
    await serviceDb.from('audit_logs').insert({
      audit_id,
      event: 'payment_verified',
      status: 'success',
      message: 'Payment verified via Stripe API (webhook fallback)',
      metadata: {
        stripe_session_id: matchingSession.id,
        amount_total: matchingSession.amount_total,
      },
    } as any)

    // Trigger audit processing
    processAudit(audit_id).catch((err) => {
      console.error(`Failed to process audit ${audit_id}:`, err)
    })

    return NextResponse.json({
      status: 'payment_received',
      message: 'Payment verified and audit processing started',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error in POST /api/stripe/verify:', message)
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 },
    )
  }
}
