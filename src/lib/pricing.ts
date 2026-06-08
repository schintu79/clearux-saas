// ============================================================
// Fixpath — Pricing Configuration
// Central source of truth for all plans and credit packs.
// ============================================================

export type BillingInterval = 'monthly' | 'yearly'

// ── Subscription plans ──────────────────────────────────────
export interface SubscriptionPlan {
  id: string
  name: string
  /** Max active workspaces at any given time */
  maxActiveWorkspaces: number
  /** Max workspace creations per billing cycle (deletion does NOT refund) */
  workspaceCreationsPerCycle: number
  reAuditsPerMonth: number
  deepAuditsPerMonth: number
  aiChecksPerMonth: number
  monthlyPrice: number   // cents
  yearlyPrice: number    // cents per month (billed yearly)
  bestFor: string
  features: string[]
  popular?: boolean
  /** @deprecated Use maxActiveWorkspaces instead */
  workspaces: number
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    maxActiveWorkspaces: 1,
    workspaceCreationsPerCycle: 2,
    workspaces: 1, // deprecated — kept for backward compat
    reAuditsPerMonth: 4,
    deepAuditsPerMonth: 1,
    aiChecksPerMonth: 10,
    monthlyPrice: 2900,
    yearlyPrice: 2300,
    bestFor: 'One active site',
    features: [
      '1 workspace',
      '4 re-audits per month',
      '1 deep audit per month',
      '10 AI checks per month',
      'Full product access',
      'PDF + DOCX reports',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    maxActiveWorkspaces: 3,
    workspaceCreationsPerCycle: 6,
    workspaces: 3, // deprecated — kept for backward compat
    reAuditsPerMonth: 12,
    deepAuditsPerMonth: 4,
    aiChecksPerMonth: 30,
    monthlyPrice: 5900,
    yearlyPrice: 4700,
    popular: true,
    bestFor: 'Multiple brands or client sites',
    features: [
      '3 workspaces',
      '12 re-audits per month',
      '4 deep audits per month',
      '30 AI checks per month',
      'Full product access',
      'PDF + DOCX reports',
      'Priority processing',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    maxActiveWorkspaces: 10,
    workspaceCreationsPerCycle: 20,
    workspaces: 10, // deprecated — kept for backward compat
    reAuditsPerMonth: 40,
    deepAuditsPerMonth: 15,
    aiChecksPerMonth: 100,
    monthlyPrice: 14900,
    yearlyPrice: 11900,
    bestFor: 'Agencies and teams',
    features: [
      '10 workspaces',
      '40 re-audits per month',
      '15 deep audits per month',
      '100 AI checks per month',
      'Full product access',
      'PDF + DOCX reports',
      'Priority processing',
      'Dedicated support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    maxActiveWorkspaces: 25,
    workspaceCreationsPerCycle: 50,
    workspaces: 25, // deprecated — kept for backward compat
    reAuditsPerMonth: 100,
    deepAuditsPerMonth: 50,
    aiChecksPerMonth: 500,
    monthlyPrice: 0,   // custom pricing — contact sales
    yearlyPrice: 0,    // custom pricing — contact sales
    bestFor: 'Large organisations with custom needs',
    features: [
      '25+ workspaces',
      '100+ re-audits per month',
      '50+ deep audits per month',
      '500+ AI checks per month',
      'Full product access',
      'PDF + DOCX reports',
      'Priority processing',
      'Dedicated support',
      'Custom onboarding',
      'SLA guarantee',
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
      'Full 112-checkpoint audits',
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
      'Full 112-checkpoint audits',
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
    features: [
      'Full 112-checkpoint audits',
      'PDF + DOCX reports',
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
