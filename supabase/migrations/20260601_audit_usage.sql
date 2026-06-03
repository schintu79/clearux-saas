-- ============================================================
-- Migration: Audit usage tracking — billing period + deep audit quota
--
-- Adds billing period boundaries and deep-audit entitlement to
-- profiles so usage can be derived from audit records rather than
-- fragile decrement-counters.
-- ============================================================

-- Billing period boundaries (set by Stripe webhook on subscription
-- activation and renewal). NULL for users without a subscription.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS billing_period_start timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS billing_period_end   timestamptz DEFAULT NULL;

-- Deep-audit monthly entitlement (mirrors audits_per_month for re-audits).
-- Set by Stripe webhook from pricing.ts plan config.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deep_audits_per_month integer NOT NULL DEFAULT 0;

-- Index to speed up the canonical usage query:
-- "count audits for this user in the current billing period"
CREATE INDEX IF NOT EXISTS idx_audits_user_created
  ON audits (user_id, created_at DESC);

-- Index on workspace_id + created_at for "is this the first audit
-- for this workspace?" checks during billing classification.
CREATE INDEX IF NOT EXISTS idx_audits_workspace_created
  ON audits (workspace_id, created_at)
  WHERE workspace_id IS NOT NULL;
