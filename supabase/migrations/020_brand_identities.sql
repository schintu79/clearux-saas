-- ============================================================
-- 020: Brand Identities
-- Allows users to create and manage brand identities with
-- uploaded reference files (brand bible, voice doc, guidelines).
-- Brand identities can be linked to audits for brand
-- consistency checking.
-- ============================================================

-- ── Brand Identities ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brand_identities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brand_identities_user ON brand_identities(user_id);

-- Row-Level Security
ALTER TABLE brand_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brand identities"
  ON brand_identities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own brand identities"
  ON brand_identities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own brand identities"
  ON brand_identities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own brand identities"
  ON brand_identities FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER on_brand_identities_updated
  BEFORE UPDATE ON brand_identities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Brand Identity Files ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS brand_identity_files (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_identity_id UUID NOT NULL REFERENCES brand_identities(id) ON DELETE CASCADE,
  file_name         TEXT NOT NULL,
  file_url          TEXT NOT NULL,
  file_type         TEXT,             -- e.g. 'pdf', 'docx', 'png', 'txt'
  file_size_bytes   BIGINT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brand_identity_files_identity ON brand_identity_files(brand_identity_id);

-- Row-Level Security (via join to parent)
ALTER TABLE brand_identity_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brand identity files"
  ON brand_identity_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brand_identities bi
      WHERE bi.id = brand_identity_files.brand_identity_id
        AND bi.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own brand identity files"
  ON brand_identity_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM brand_identities bi
      WHERE bi.id = brand_identity_files.brand_identity_id
        AND bi.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own brand identity files"
  ON brand_identity_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM brand_identities bi
      WHERE bi.id = brand_identity_files.brand_identity_id
        AND bi.user_id = auth.uid()
    )
  );

-- ── Add brand_identity_id to audits ──────────────────────────

ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS brand_identity_id UUID REFERENCES brand_identities(id) ON DELETE SET NULL;
