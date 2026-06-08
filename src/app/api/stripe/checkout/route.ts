// ============================================================
// ClearUX API — POST /api/stripe/checkout
// Creates Stripe checkout sessions for:
//   1. Single audit purchase (pay-per-audit)
//   2. Credit pack purchases (3, 10, 30 credits)
//   3. Subscription plans (starter, pro, agency)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { stripe } from '@/lib/stripe'
import { createServerSupabase } from '@/lib/supabase-server'
import { CREDIT_PACKS, SUBSCRIPTION_PLANS } from '@/lib/pricing'

const singleAuditSchema = z.object({
  audit_id: z.string().uuid('Invalid audit ID'),
})

const creditPackSchema = z.object({
  pack: z.enum(['starter', 'growth', 'scale']),
})

const subscriptionSchema = z.object({
  subscription: z.enum(['starter', 'pro', 'agency']),
  interval: z.enum(['monthly', 'yearly']).default('monthly'),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.fixpath.ai'

    // Get user email and Stripe customer ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, stripe_customer_id')
      .eq('id', user.id)
      .single()
    const userEmail = (profile as any)?.email || user.email || ''
    let stripeCustomerId = (profile as any)?.stripe_customer_id as string | undefined

    // ── Subscription purchase ───────────────────────────────
    if (body.subscription) {
      const parsed = subscriptionSchema.safeParse(body)
      if (!parsed.success)
        return NextResponse.json({ error: 'Invalid subscription plan' }, { status: 400 })

      const plan = SUBSCRIPTION_PLANS.find((p) => p.id === parsed.data.subscription)
      if (!plan)
        return NextResponse.json({ error: 'Plan not found' }, { status: 400 })

      const isYearly = parsed.data.interval === 'yearly'
      const unitAmount = isYearly ? plan.yearlyPrice : plan.monthlyPrice
      const intervalStr = isYearly ? 'year' as const : 'month' as const

      // Create or reuse Stripe customer
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: { user_id: user.id },
        })
        stripeCustomerId = customer.id
        // Save customer ID to profile (best-effort)
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: stripeCustomerId } as any)
          .eq('id', user.id)
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: stripeCustomerId,
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Fixpath ${plan.name}`,
              description: `${plan.workspaces} workspace${plan.workspaces > 1 ? 's' : ''} · ${plan.reAuditsPerMonth} re-audits/month`,
            },
            unit_amount: isYearly ? plan.yearlyPrice * 12 : unitAmount,
            recurring: { interval: intervalStr },
          },
          quantity: 1,
        }],
        metadata: {
          user_id: user.id,
          type: 'subscription',
          plan: plan.id,
          interval: parsed.data.interval,
          workspaces: plan.workspaces.toString(),
          re_audits_per_month: plan.reAuditsPerMonth.toString(),
        },
        subscription_data: {
          metadata: {
            user_id: user.id,
            plan: plan.id,
            interval: parsed.data.interval,
            workspaces: plan.workspaces.toString(),
            re_audits_per_month: plan.reAuditsPerMonth.toString(),
          },
        },
        success_url: `${appUrl}/dashboard?subscribed=${plan.id}`,
        cancel_url: `${appUrl}/dashboard/buy-credits?cancelled=true`,
      })

      if (!session.url) throw new Error('Failed to create checkout session')
      return NextResponse.json({ url: session.url })
    }

    // ── Credit pack purchase ────────────────────────────────
    if (body.pack) {
      const parsed = creditPackSchema.safeParse(body)
      if (!parsed.success)
        return NextResponse.json({ error: 'Invalid pack' }, { status: 400 })

      const pack = CREDIT_PACKS.find((p) => p.id === parsed.data.pack)
      if (!pack)
        return NextResponse.json({ error: 'Pack not found' }, { status: 400 })

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: userEmail,
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Fixpath ${pack.name} Pack`,
              description: `${pack.credits} audit credits — ${pack.perAudit}/audit`,
            },
            unit_amount: pack.price,
          },
          quantity: 1,
        }],
        metadata: {
          user_id: user.id,
          type: 'credit_pack',
          pack: parsed.data.pack,
          credits: pack.credits.toString(),
        },
        success_url: `${appUrl}/dashboard?credits=purchased`,
        cancel_url: `${appUrl}/dashboard/buy-credits?cancelled=true`,
      })

      if (!session.url) throw new Error('Failed to create checkout session')
      return NextResponse.json({ url: session.url })
    }

    // ── Single audit purchase ───────────────────────────────
    const parsed = singleAuditSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const { audit_id } = parsed.data

    const { data: audit, error: auditError } = await supabase
      .from('audits')
      .select('*')
      .eq('id', audit_id)
      .is('deleted_at', null)
      .single()

    if (auditError || !audit)
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    if ((audit as any).user_id !== user.id)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    if ((audit as any).status !== 'pending_payment')
      return NextResponse.json({ error: 'Audit is not pending payment' }, { status: 400 })

    // Single audit price = same as 1 credit from starter pack ($13)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: userEmail,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Fixpath Audit',
            description: `AI-powered UX audit — ${(audit as any).product_url}`,
          },
          unit_amount: 1300,
        },
        quantity: 1,
      }],
      metadata: {
        audit_id,
        user_id: user.id,
        type: 'single_audit',
      },
      success_url: `${appUrl}/dashboard/competitors?payment=success&audit=${audit_id}`,
      cancel_url: `${appUrl}/dashboard/new-audit?payment=cancelled&audit=${audit_id}`,
    })

    if (!session.url) throw new Error('Failed to create checkout session')
    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error in POST /api/stripe/checkout:', message)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
