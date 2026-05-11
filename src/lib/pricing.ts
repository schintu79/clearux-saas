// ============================================================
// ClearUX — Pricing Configuration
// Central source of truth for all plans and credit packs.
// ============================================================

export type BillingInterval = 'monthly' | 'yearly'

// ── Subscription plans ──────────────────────────────────────
export interface SubscriptionPlan {
  id: string
  name: string
  auditsPerMonth: number
  monthlyPrice: number   // cents
  yearlyPrice: number    // cents per month (billed yearly)
  features: string[]
  popular?: boolean
  whiteLabel?: boolean
  teamSeats?: number
  apiAccess?: boolean
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    auditsPerMonth: 3,
    monthlyPrice: 2900,
    yearlyPrice: 2300,
    features: [
      '3 audits per month',
      'Unlimited re-audits',
      'PDF + DOCX reports',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    auditsPerMonth: 10,
    monthlyPrice: 5900,
    yearlyPrice: 4700,
    popular: true,
    whiteLabel: true,
    features: [
      '10 audits per month',
      'Unlimited re-audits',
      'PDF + DOCX reports',
      'Priority processing',
      'White-label reports',
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    auditsPerMonth: 30,
    monthlyPrice: 14900,
    yearlyPrice: 11900,
    whiteLabel: true,
    features: [
      '30 audits per month',
      'Unlimited re-audits',
      'PDF + DOCX reports',
      'Priority processing',
      'White-label reports',
      'Dedicated support',
    ],
  },
]

// ── Credit packs ────────────────────────────────────────────
export interface CreditPack {
  id: string
  name: string
  credits: number
  price: number        // cents
  perAudit: string     // display string
  savePercent: number | null
  features: string[]
  popular?: boolean
  whiteLabel?: boolean
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 3,
    price: 3900,
    perAudit: '$13',
    savePercent: null,
    features: [
      'Full 96-checkpoint audits',
      'PDF + DOCX reports',
      'Never expire',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    credits: 10,
    price: 9900,
    perAudit: '$9.90',
    savePercent: 24,
    popular: true,
    features: [
      'Full 96-checkpoint audits',
      'PDF + DOCX reports',
      'Never expire',
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    credits: 30,
    price: 24900,
    perAudit: '$8.30',
    savePercent: 36,
    whiteLabel: true,
    features: [
      'Full 96-checkpoint audits',
      'PDF + DOCX reports',
      'White-label included',
      'Never expire',
    ],
  },
]

// ── Helpers ─────────────────────────────────────────────────
export function formatPrice(cents: number): string {
  const dollars = cents / 100
  return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`
}

export function getPlan(id: string) {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id)
}

export function getPack(id: string) {
  return CREDIT_PACKS.find((p) => p.id === id)
}
