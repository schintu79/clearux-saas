-- ============================================================
-- Migration 024: Add subscription fields to profiles
-- Supports the new dual pricing model (subscriptions + credits)
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_plan      text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subscription_status    text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subscription_interval  text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS audits_remaining       integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audits_per_month       integer DEFAULT 0;

-- Index for webhook lookups by subscription ID
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id
  ON profiles (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Index for customer lookup
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN profiles.subscription_plan IS 'Active subscription tier: starter, pro, agency';
COMMENT ON COLUMN profiles.subscription_status IS 'Stripe subscription status: active, cancelled, past_due';
COMMENT ON COLUMN profiles.subscription_interval IS 'Billing interval: monthly, yearly';
COMMENT ON COLUMN profiles.audits_remaining IS 'Monthly audit allowance remaining (resets on renewal)';
COMMENT ON COLUMN profiles.audits_per_month IS 'Total monthly audit allowance for this plan';
