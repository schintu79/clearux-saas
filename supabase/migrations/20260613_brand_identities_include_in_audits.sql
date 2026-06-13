-- Brand DNA control moved out of the audit page (2026-06-13). A workspace's
-- Brand DNA now auto-runs in every audit when completed files exist; this
-- per-brand flag is the single opt-out, lives on the Brand DNA page, and
-- defaults ON so existing brands keep their current (auto) behaviour.

ALTER TABLE brand_identities ADD COLUMN IF NOT EXISTS include_in_audits BOOLEAN NOT NULL DEFAULT true;
