// ============================================================
// ClearUX — Stripe Client Initialization
// ============================================================

import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// ── Helper Types ──────────────────────────────────────────────

export type StripeCheckoutSession = Stripe.Checkout.Session
export type StripeEvent = Stripe.Event
export type StripeCustomer = Stripe.Customer
export type StripePaymentIntent = Stripe.PaymentIntent
