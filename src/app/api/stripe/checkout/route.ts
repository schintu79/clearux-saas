// ============================================================
// ClearUX API — POST /api/stripe/checkout
// Creates Stripe checkout sessions for:
//   1. Single audit purchase ($29)
//   2. Credit pack purchases (5, 15, 50 credits)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { stripe } from '@/lib/stripe'
import { createServerSupabase } from '@/lib/supabase-server'

const singleAuditSchema = z.object({
  audit_id: z.string().uuid('Invalid audit ID'),
})

const creditPackSchema = z.object({
  pack: z.enum(['starter', 'growth', 'agency', 'scale']),
})

// ── Credit packs ────────────────────────────────────────────
const CREDIT_PACKS = {
  starter: { credits: 1,  amount: 2900,  name: 'ClearUX Starter',  desc: '1 audit credit' },
  growth:  { credits: 5,  amount: 9900,  name: 'ClearUX Growth',   desc: '5 audit credits — $19.80/audit' },
  agency:  { credits: 15, amount: 24900, name: 'ClearUX Agency',   desc: '15 audit credits — $16.60/audit' },
  scale:   { credits: 50, amount: 59900, name: 'ClearUX Scale',    desc: '50 audit credits — $11.98/audit' },
} as const

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://clearux.ai'

    // Get user email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()
    const userEmail = (profile as any)?.email || user.email || ''

    // ── Credit pack purchase (no audit_id needed) ──────────
    if (body.pack) {
      const parsed = creditPackSchema.safeParse(body)
      if (!parsed.success)
        return NextResponse.json({ error: 'Invalid pack' }, { status: 400 })

      const pack = CREDIT_PACKS[parsed.data.pack]

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: userEmail,
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { name: pack.name, description: pack.desc },
            unit_amount: pack.amount,
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

    // ── Single audit purchase ($29) ─────────────────────────
    const parsed = singleAuditSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const { audit_id } = parsed.data

    // Fetch audit
    const { data: audit, error: auditError } = await supabase
      .from('audits')
      .select('*')
      .eq('id', audit_id)
      .single()

    if (auditError || !audit)
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    if ((audit as any).user_id !== user.id)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    if ((audit as any).status !== 'pending_payment')
      return NextResponse.json({ error: 'Audit is not pending payment' }, { status: 400 })

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: userEmail,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'ClearUX Full Audit',
            description: `Deep AI-powered UX audit — ${(audit as any).product_url}`,
          },
          unit_amount: 2900,
        },
        quantity: 1,
      }],
      metadata: {
        audit_id,
        user_id: user.id,
        type: 'single_audit',
      },
      success_url: `${appUrl}/dashboard/audits/${audit_id}?payment=success`,
      cancel_url: `${appUrl}/dashboard/audits/${audit_id}?payment=cancelled`,
    })

    if (!session.url) throw new Error('Failed to create checkout session')
    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error in POST /api/stripe/checkout:', message)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
