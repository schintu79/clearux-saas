-- ============================================================
-- 019: White Label Settings (profile-level)
-- Moves white-label configuration from per-audit to per-user.
-- Visible to all users; editable by package-tier users only
-- (enforced in the application layer, not RLS).
-- ============================================================

CREATE TABLE IF NOT EXISTS white_label_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  company_name  TEXT,
  logo_url      TEXT,
  brand_color   TEXT,            -- hex e.g. '#6366F1'
  contact_email TEXT,
  footer_text   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row-Level Security
ALTER TABLE white_label_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own white label settings"
  ON white_label_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own white label settings"
  ON white_label_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own white label settings"
  ON white_label_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own white label settings"
  ON white_label_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER on_white_label_settings_updated
  BEFORE UPDATE ON white_label_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
