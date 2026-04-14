-- ============================================================
-- ClearUX — Site Notes & Finding Dismissals
-- Persistent context that carries across re-audits:
--   - Site notes: "Founder info is on /about page"
--   - Finding dismissals: "This is intentional because..."
--   - Discussions: "We use this terminology because..."
-- The AI reads these on re-audit and skips/adjusts accordingly.
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- Site-level notes that persist across audits for the same domain
CREATE TABLE IF NOT EXISTS site_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain      TEXT NOT NULL,               -- e.g. "clearux.ai" (normalized)
  note_type   TEXT NOT NULL DEFAULT 'context',  -- context | dismissal | discussion
  category    TEXT,                         -- optional: which audit category this relates to
  title       TEXT NOT NULL,               -- short label, e.g. "Founder credentials on About page"
  content     TEXT NOT NULL,               -- full explanation
  finding_ref TEXT,                         -- optional: original finding title this dismisses
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by user + domain
CREATE INDEX IF NOT EXISTS idx_site_notes_user_domain ON site_notes(user_id, domain) WHERE is_active = true;

-- RLS
ALTER TABLE site_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own site notes" ON site_notes;
CREATE POLICY "Users can view own site notes"
  ON site_notes FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own site notes" ON site_notes;
CREATE POLICY "Users can insert own site notes"
  ON site_notes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own site notes" ON site_notes;
CREATE POLICY "Users can update own site notes"
  ON site_notes FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own site notes" ON site_notes;
CREATE POLICY "Users can delete own site notes"
  ON site_notes FOR DELETE USING (auth.uid() = user_id);

-- Add dismissal fields to audit_findings
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS dismissed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS dismissal_reason TEXT;
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;
