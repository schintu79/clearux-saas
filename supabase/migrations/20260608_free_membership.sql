-- ============================================================
-- Migration: Free membership columns on profiles
--
-- Adds free_membership flag and expiry date so admins can grant
-- free access to specific users without requiring a Stripe sub.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS free_membership boolean NOT NULL DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS free_membership_expiry timestamptz DEFAULT NULL;

COMMENT ON COLUMN profiles.free_membership IS
  'True when an admin has granted free access (bypasses Stripe subscription).';

COMMENT ON COLUMN profiles.free_membership_expiry IS
  'When the free membership expires. NULL = never expires.';
