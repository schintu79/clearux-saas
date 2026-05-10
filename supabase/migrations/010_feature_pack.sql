-- ============================================================
-- ClearUX — Feature Pack Migration
-- Adds: finding status tracking, shareable audit links,
--        scheduled/recurring audits
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- 1. Finding status tracking (fixed / in_progress / backlog / open)
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS status_note TEXT;

-- 2. Shareable audit links (read-only share tokens)
ALTER TABLE audits ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN NOT NULL DEFAULT false;

-- Index for fast share token lookup
CREATE INDEX IF NOT EXISTS idx_audits_share_token ON audits(share_token) WHERE share_token IS NOT NULL;

-- 3. Scheduled/recurring audits
CREATE TABLE IF NOT EXISTS scheduled_audits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_url   TEXT NOT NULL,
  frequency     TEXT NOT NULL DEFAULT 'monthly',  -- weekly, monthly, quarterly
  language      TEXT NOT NULL DEFAULT 'en',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_run_at   TIMESTAMPTZ,
  next_run_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for scheduled_audits
ALTER TABLE scheduled_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own scheduled audits" ON scheduled_audits;
CREATE POLICY "Users can view own scheduled audits"
  ON scheduled_audits FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own scheduled audits" ON scheduled_audits;
CREATE POLICY "Users can insert own scheduled audits"
  ON scheduled_audits FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own scheduled audits" ON scheduled_audits;
CREATE POLICY "Users can update own scheduled audits"
  ON scheduled_audits FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own scheduled audits" ON scheduled_audits;
CREATE POLICY "Users can delete own scheduled audits"
  ON scheduled_audits FOR DELETE USING (auth.uid() = user_id);

-- RLS policy: allow read access to audits via share token (public)
DROP POLICY IF EXISTS "Anyone can view shared audits" ON audits;
CREATE POLICY "Anyone can view shared audits"
  ON audits FOR SELECT
  USING (share_enabled = true AND share_token IS NOT NULL);
