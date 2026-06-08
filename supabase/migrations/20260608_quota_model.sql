-- ============================================================
-- Quota Model — Separate active inventory from monthly usage
-- ============================================================
--
-- Adds admin-overridable quota columns to profiles.
-- NULL = use plan default from pricing.ts.
-- Numeric value = per-user admin override.
-- These columns are ONLY read by audit-usage.ts / workspace
-- creation route to resolve effective limits.
-- ============================================================

-- ── Active inventory caps ───────────────────────────────────
-- Controls how many items can be live at once.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS max_active_workspaces INT DEFAULT NULL;

COMMENT ON COLUMN profiles.max_active_workspaces IS
  'Admin override: max active workspaces. NULL = use plan default.';

-- ── Monthly creation / usage caps ───────────────────────────
-- Controls how many items can be CREATED per billing cycle.
-- Deleting an item does NOT refund the creation slot.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS workspace_creations_per_cycle INT DEFAULT NULL;

COMMENT ON COLUMN profiles.workspace_creations_per_cycle IS
  'Admin override: max workspace creations per billing cycle. NULL = use plan default.';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS reaudits_per_cycle INT DEFAULT NULL;

COMMENT ON COLUMN profiles.reaudits_per_cycle IS
  'Admin override: max re-audits per billing cycle. NULL = use plan default (audits_per_month).';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deep_audits_per_cycle INT DEFAULT NULL;

COMMENT ON COLUMN profiles.deep_audits_per_cycle IS
  'Admin override: max deep audits per billing cycle. NULL = use plan default (deep_audits_per_month).';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS brand_ai_requests_per_cycle INT DEFAULT NULL;

COMMENT ON COLUMN profiles.brand_ai_requests_per_cycle IS
  'Admin override: max brand AI / interrogation requests per billing cycle. NULL = use plan default (ai_checks_per_month).';
