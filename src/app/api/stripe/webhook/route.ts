// ============================================================
// ClearUX API — POST /api/stripe/webhook
// Handle Stripe webhook events:
//   - checkout.session.completed (credit packs, single audits, subscriptions)
//   - customer.subscription.updated (plan changes)
//   - customer.subscription.deleted (cancellations)
//   - invoice.payment_succeeded (subscription renewals)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceSupabase } from '@/lib/supabase-server'
import { inngest } from '@/lib/inngest/client'
import { sendPaymentConfirmation, sendCreditsPurchased } from '@/lib/audit-engine/email'
import { SUBSCRIPTION_PLANS } from '@/lib/pricing'

/** Safely advance a date by one month without JS setMonth overflow.
 *  Jan 31 → Feb 28, Mar 31 → Apr 30, etc. */
function addOneMonth(date: Date): Date {
  const result = new Date(date)
  const day = result.getDate()
  result.setMonth(result.getMonth() + 1)
  // If the day rolled over (e.g. 31→3), clamp to last day of target month
  if (result.getDate() !== day) {
    result.setDate(0) // Go to last day of previous month (the target month)
  }
  return result
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
    }

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
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
    }

    console.log(`Received Stripe webhook event: ${event.type}`)
    const supabase = createServiceSupabase()

    // ── checkout.session.completed ────────────────────────────
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any
      const meta = session.metadata || {}
      const userId = meta.user_id
      const paymentType = meta.type // 'credit_pack' | 'single_audit' | 'subscription'

      if (!userId) {
        console.error('Webhook CRITICAL: missing user_id in metadata — payment may be lost:', meta)
        return NextResponse.json({ error: 'Missing user_id in metadata' }, { status: 400 })
      }

      // ── Subscription activated ──────────────────────────────
      if (paymentType === 'subscription') {
        const planId = meta.plan // 'starter' | 'pro' | 'team'
        const billingInterval = meta.interval // 'monthly' | 'yearly'
        const stripeSubscriptionId = session.subscription

        // Use pricing.ts as source of truth for plan entitlements
        const planConfig = SUBSCRIPTION_PLANS.find((p) => p.id === planId)
        const reAuditsPerMonth = planConfig?.reAuditsPerMonth ?? 4
        const deepAuditsPerMonth = planConfig?.deepAuditsPerMonth ?? 0

        // Compute billing period from now
        const now = new Date()
        const periodEnd = addOneMonth(now)

        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_plan: planId,
            subscription_status: 'active',
            subscription_interval: billingInterval,
            stripe_subscription_id: stripeSubscriptionId,
            stripe_customer_id: session.customer,
            audits_remaining: reAuditsPerMonth,
            audits_per_month: reAuditsPerMonth,
            deep_audits_per_month: deepAuditsPerMonth,
            ai_checks_per_month: planConfig?.aiChecksPerMonth ?? 0,
            billing_period_start: now.toISOString(),
            billing_period_end: periodEnd.toISOString(),
            package_tier: planId,
            updated_at: now.toISOString(),
          } as any)
          .eq('id', userId)

        if (error) {
          console.error(`Failed to activate subscription for user ${userId}:`, error)
          return NextResponse.json({ error: 'Failed to activate subscription' }, { status: 500 })
        }

        console.log(`Subscription activated: user=${userId} plan=${planId} interval=${billingInterval} reAudits=${reAuditsPerMonth} deepAudits=${deepAuditsPerMonth}`)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // ── Credit pack purchase ────────────────────────────────
      if (paymentType === 'credit_pack') {
        const creditsToAdd = parseInt(meta.credits || '0', 10)
        const pack = meta.pack as string | undefined
        if (creditsToAdd > 0) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('credits')
            .eq('id', userId)
            .single()
          const current = (prof as any)?.credits ?? 0

          const { error: creditError } = await supabase
            .from('profiles')
            .update({
              credits: current + creditsToAdd,
              updated_at: new Date().toISOString(),
            } as any)
            .eq('id', userId)

          if (creditError) {
            console.error(`Failed to add credits for user ${userId}:`, creditError)
            return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 })
          }

          console.log(`Added ${creditsToAdd} credits to user ${userId}. New balance: ${current + creditsToAdd}`)

          // Update tier (non-critical)
          try {
            await supabase
              .from('profiles')
              .update({ package_tier: pack } as any)
              .eq('id', userId)
          } catch (tierErr) {
            console.warn(`Non-critical: failed to update tier for user ${userId}:`, tierErr)
          }

          // Send credits email (non-blocking)
          try {
            const { data: userProf } = await supabase
              .from('profiles')
              .select('email, credits')
              .eq('id', userId)
              .single()
            if (userProf && (userProf as any).email) {
              const packNames: Record<string, string> = { starter: 'Starter', growth: 'Growth', scale: 'Scale' }
              await sendCreditsPurchased(
                (userProf as any).email,
                creditsToAdd,
                (userProf as any).credits ?? creditsToAdd,
                packNames[pack || 'starter'] || 'Credit Pack',
                session.amount_total || 0,
              )
            }
          } catch (emailErr) {
            console.warn(`Non-critical: credits email failed for user ${userId}:`, emailErr)
          }
        }
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // ── Single audit payment ────────────────────────────────
      const auditId = meta.audit_id
      if (!auditId) {
        console.warn('Webhook missing audit_id for single_audit:', meta)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // Insert payment record
      const { error: paymentError } = await supabase
        .from('payments')
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
          receipt_url: null,
        } as any)

      if (paymentError) {
        console.error('Failed to insert payment:', paymentError)
        return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 })
      }

      // Update audit status
      const { error: auditError } = await supabase
        .from('audits')
        .update({ status: 'payment_received', progress_percent: 1, audit_stage: 'preflight', updated_at: new Date().toISOString() } as any)
        .eq('id', auditId)

      if (auditError) {
        console.error('Failed to update audit:', auditError)
        return NextResponse.json({ error: 'Failed to update audit' }, { status: 500 })
      }

      // Log payment event
      await supabase.from('audit_logs').insert({
        audit_id: auditId,
        event: 'payment_received',
        status: 'success',
        message: 'Payment received for single audit',
        metadata: { stripe_payment_intent_id: session.payment_intent, amount_cents: session.amount_total },
      } as any)

      // Send confirmation email
      const { data: audit } = await supabase
        .from('audits')
        .select('product_url, audit_type, brand_identity_id, brand_identities(name)')
        .eq('id', auditId)
        .single()
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single()

      const aw = audit as any
      const auditType = aw?.audit_type || (aw?.brand_identity_id && !aw?.product_url ? 'brand_identity' : 'website')

      if (audit && (profileData as any)?.email) {
        await sendPaymentConfirmation(
          (profileData as any).email,
          auditId,
          session.amount_total,
          aw?.product_url || aw?.brand_identities?.name || 'your brand',
          auditType as 'website' | 'brand_identity' | 'design',
        )
      }

      // Trigger audit processing via Inngest only.
      // We intentionally do NOT call processAudit() inline here:
      //   1. Inngest workers already listen for these events (see
      //      src/lib/inngest/functions/process-audit.ts), so an inline
      //      call would race the Inngest worker and produce duplicate
      //      crawls, duplicate findings, and double Anthropic spend.
      //   2. Vercel serverless functions are bounded by maxDuration; the
      //      audit pipeline routinely exceeds that, so inline execution
      //      would be killed mid-flight and leave the audit in a
      //      half-processed state.
      // All DB writes above (payment row, audit status flip, audit_logs)
      // have already committed, so the Inngest worker will see consistent
      // state when it picks up the event.
      const eventName = auditType === 'brand_identity' ? 'brand-audit/process' : 'audit/process'
      console.log(`[webhook] Dispatching ${eventName} for audit ${auditId}`)
      try {
        await inngest.send({ name: eventName, data: { auditId } })
      } catch (dispatchErr) {
        console.error(`[webhook] CRITICAL: Inngest dispatch failed for ${auditId}:`, dispatchErr)
        // We don't fail the webhook because the payment + audit row are
        // already committed; the user can retry via /api/audits/[id]/retry
        // or admin can re-dispatch. Failing here would cause Stripe to
        // retry the webhook and could double-bill side-effects.
      }

      console.log(`Payment processed for audit ${auditId}`)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // ── invoice.payment_succeeded (subscription renewal) ─────
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as any
      const subscriptionId = invoice.subscription
      if (!subscriptionId || invoice.billing_reason === 'subscription_create') {
        // Skip initial subscription creation (handled by checkout.session.completed)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // Reset billing period on renewal.
      // Re-audit, deep audit, and workspace creation usage are all
      // query-derived from records scoped to the billing period, so
      // resetting the period window effectively resets all monthly usage
      // counters. No counter columns to touch.
      // Active inventory (active_workspaces) is NOT affected — it's a
      // live count that changes only when workspaces are created/deleted.
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, subscription_plan, audits_per_month')
        .eq('stripe_subscription_id', subscriptionId)

      if (profiles && profiles.length > 0) {
        const p = profiles[0] as any
        const planConfig = SUBSCRIPTION_PLANS.find((pl) => pl.id === p.subscription_plan)
        const reAuditsPerMonth = planConfig?.reAuditsPerMonth ?? (p.audits_per_month ?? 0)

        const now = new Date()
        const periodEnd = addOneMonth(now)

        await supabase
          .from('profiles')
          .update({
            audits_remaining: reAuditsPerMonth, // Legacy counter — kept in sync for backward compat
            billing_period_start: now.toISOString(),
            billing_period_end: periodEnd.toISOString(),
            updated_at: now.toISOString(),
          } as any)
          .eq('id', p.id)
        console.log(`Subscription renewed: reset billing period for user ${p.id} (plan=${p.subscription_plan})`)
      }
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // ── customer.subscription.updated ────────────────────────
    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as any
      const subMeta = sub.metadata || {}
      const userId = subMeta.user_id

      if (userId) {
        const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status
        await supabase
          .from('profiles')
          .update({
            subscription_status: status,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', userId)
        console.log(`Subscription updated for user ${userId}: status=${status}`)
      }
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // ── customer.subscription.deleted ────────────────────────
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as any
      const subMeta = sub.metadata || {}
      const userId = subMeta.user_id

      if (userId) {
        await supabase
          .from('profiles')
          .update({
            subscription_plan: null,
            subscription_status: 'cancelled',
            stripe_subscription_id: null,
            audits_remaining: 0,
            audits_per_month: 0,
            deep_audits_per_month: 0,
            ai_checks_per_month: 0,
            billing_period_start: null,
            billing_period_end: null,
            // Clear admin quota overrides — they were tied to the subscription
            max_active_workspaces: null,
            workspace_creations_per_cycle: null,
            reaudits_per_cycle: null,
            deep_audits_per_cycle: null,
            brand_ai_requests_per_cycle: null,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', userId)
        console.log(`Subscription cancelled for user ${userId}`)
      }
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // Handle other events gracefully
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error in webhook handler:', message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
