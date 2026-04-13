// ============================================================
// ClearUX API — POST /api/stripe/webhook
// Handle Stripe webhook events
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceSupabase } from '@/lib/supabase-server'
import { inngest } from '@/lib/inngest/client'
import { sendPaymentConfirmation } from '@/lib/audit-engine/email'

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 },
      )
    }

    // Verify webhook signature
    let event
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || '',
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('Webhook signature verification failed:', message)
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 },
      )
    }

    console.log(`Received Stripe webhook event: ${event.type}`)

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any
      const meta = session.metadata || {}
      const userId = meta.user_id
      const paymentType = meta.type // 'credit_pack' | 'single_audit'

      if (!userId) {
        console.warn('Webhook missing user_id in metadata:', meta)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      try {
        const supabase = createServiceSupabase()

        // ── Credit pack purchase — add credits to profile ──
        if (paymentType === 'credit_pack') {
          const creditsToAdd = parseInt(meta.credits || '0', 10)
          const pack = meta.pack as string | undefined // 'starter' | 'growth' | 'agency' | 'scale'
          if (creditsToAdd > 0) {
            // Fetch current balance and tier
            const { data: prof } = await supabase
              .from('profiles')
              .select('credits, package_tier')
              .eq('id', userId)
              .single()
            const current = (prof as any)?.credits ?? 0
            const currentTier = (prof as any)?.package_tier ?? 'starter'

            // Determine the highest tier — never downgrade
            const tierRank: Record<string, number> = { starter: 0, growth: 1, agency: 2, scale: 3 }
            const newTier = (tierRank[pack || 'starter'] ?? 0) > (tierRank[currentTier] ?? 0) ? pack : currentTier
            const isWhiteLabel = tierRank[newTier || 'starter'] >= 2 // agency or scale

            await supabase
              .from('profiles')
              .update({
                credits: current + creditsToAdd,
                package_tier: newTier,
                white_label: isWhiteLabel,
                updated_at: new Date().toISOString(),
              } as any)
              .eq('id', userId)

            console.log(`Added ${creditsToAdd} credits to user ${userId}. New balance: ${current + creditsToAdd}. Tier: ${newTier}, white_label: ${isWhiteLabel}`)
          }
          return NextResponse.json({ received: true }, { status: 200 })
        }

        // ── Single audit payment ────────────────────────────
        const auditId = meta.audit_id
        if (!auditId) {
          console.warn('Webhook missing audit_id for single_audit:', meta)
          return NextResponse.json({ received: true }, { status: 200 })
        }

        // Insert payment record
        // @ts-ignore Supabase type inference issue with Partial types
        const { error: paymentError } = await supabase
          .from('payments')
          // @ts-ignore Supabase type inference issue with Partial types
          .insert({
            audit_id: auditId,
            user_id: userId,
            stripe_payment_intent_id: session.payment_intent,
            stripe_customer_id: session.customer,
            stripe_invoice_id: session.invoice,
            amount_cents: session.amount_total,
            currency: session.currency,
            status: 'succeeded',
            invoice_url: null,
            receipt_url: session.receipt_email ? `https://stripe.com/receipts/${session.id}` : null,
          })

        if (paymentError) {
          console.error('Failed to insert payment:', paymentError)
          return NextResponse.json(
            { error: 'Failed to process payment' },
            { status: 500 },
          )
        }

        // Update audit status to payment_received
        // @ts-ignore Supabase type inference issue with generics
        const { error: auditError } = await supabase
          .from('audits')
          // @ts-ignore Supabase type inference issue with generics
          .update({
            status: 'payment_received',
            updated_at: new Date().toISOString(),
          })
          // @ts-ignore Supabase type inference issue with generics
          .eq('id', auditId)

        if (auditError) {
          console.error('Failed to update audit:', auditError)
          return NextResponse.json(
            { error: 'Failed to update audit' },
            { status: 500 },
          )
        }

        // Log payment event
        // @ts-ignore Supabase type inference issue with Partial types
        await supabase.from('audit_logs').insert({
          audit_id: auditId,
          event: 'payment_received',
          status: 'success',
          message: `Payment received for single audit`,
          metadata: {
            stripe_payment_intent_id: session.payment_intent,
            amount_cents: session.amount_total,
          },
        })

        // Get user email and product URL for payment confirmation email
        // @ts-ignore Supabase type inference issue with generics
        const { data: audit } = await supabase
          .from('audits')
          .select('product_url')
          // @ts-ignore Supabase type inference issue with generics
          .eq('id', auditId)
          .single()

        // @ts-ignore Supabase type inference issue with generics
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          // @ts-ignore Supabase type inference issue with generics
          .eq('id', userId)
          .single()

        if (audit && (profile as any)?.email) {
          await sendPaymentConfirmation(
            (profile as any).email,
            auditId,
            session.amount_total,
            (audit as any).product_url,
          )
        }

        // Trigger audit processing via Inngest (background job)
        try {
          console.log(`[webhook] Sending Inngest event for audit ${auditId}`)
          const sendResult = await inngest.send({
            name: 'audit/process',
            data: { auditId },
          })
          console.log(`[webhook] Inngest event sent:`, JSON.stringify(sendResult))
        } catch (inngestErr) {
          console.error(`[webhook] Inngest send FAILED for audit ${auditId}:`, inngestErr)
          const { processAudit } = await import('@/lib/audit-engine')
          processAudit(auditId).catch((err) => {
            console.error(`[webhook] Fallback processAudit failed:`, err)
          })
        }

        console.log(`Payment processed for audit ${auditId}`)
        return NextResponse.json({ received: true }, { status: 200 })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('Error handling payment webhook:', message)
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 },
        )
      }
    }

    // Handle other events gracefully
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error in webhook handler:', message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
