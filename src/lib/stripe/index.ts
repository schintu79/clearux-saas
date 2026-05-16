// ============================================================
// ClearUX — Stripe Client Initialization
//
// Lazy Stripe client. Defers construction until first use so that
// importing this module at build time (e.g. `next build` page-data
// collection) does not throw when STRIPE_SECRET_KEY is unset. Any
// runtime call that requires Stripe still fails loudly with the
// same error message — only the module import is now side-effect free.
// ============================================================

import Stripe from 'stripe'

let _stripe: Stripe | null = null

function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set')
  }
  _stripe = new Stripe(key)
  return _stripe
}

// Proxy preserves the historic `import { stripe } from '@/lib/stripe'`
// surface — callers see a `Stripe` instance; we just delay construction.
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const client = getStripe()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
})

// ── Helper Types ──────────────────────────────────────────────

export type StripeCheckoutSession = Stripe.Checkout.Session
export type StripeEvent = Stripe.Event
export type StripeCustomer = Stripe.Customer
export type StripePaymentIntent = Stripe.PaymentIntent
