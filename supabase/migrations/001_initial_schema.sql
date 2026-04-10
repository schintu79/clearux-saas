-- ============================================================
-- ClearUX SaaS — Initial Schema Migration
-- ============================================================

-- ── ENUMS ────────────────────────────────────────────────────

CREATE TYPE audit_status AS ENUM (
  'pending_payment',
  'payment_received',
  'crawling',
  'analysing',
  'generating_report',
  'completed',
  'failed'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'succeeded',
  'failed',
  'refunded'
);

CREATE TYPE finding_severity AS ENUM (
  'critical',
  'high',
  'medium',
  'low'
);

-- ── TABLES ───────────────────────────────────────────────────

-- Profiles (extended user data)
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  company       TEXT,
  email         TEXT NOT NULL UNIQUE,
  avatar_url    TEXT,
  audit_count   INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audits
CREATE TABLE IF NOT EXISTS audits (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status            audit_status NOT NULL DEFAULT 'pending_payment',
  product_url       TEXT NOT NULL,
  product_type      TEXT NOT NULL,
  target_user       TEXT,
  ux_concern        TEXT NOT NULL,
  notes             TEXT,
  pages_crawled     INT NOT NULL DEFAULT 0,
  crawl_error       TEXT,
  delivery_deadline TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id                 UUID NOT NULL UNIQUE REFERENCES audits(id) ON DELETE CASCADE,
  user_id                  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  stripe_customer_id       TEXT,
  stripe_invoice_id        TEXT,
  amount_cents             INT NOT NULL,
  currency                 TEXT NOT NULL DEFAULT 'USD',
  status                   payment_status NOT NULL DEFAULT 'pending',
  invoice_url              TEXT,
  receipt_url              TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Checklist Categories
CREATE TABLE IF NOT EXISTS checklist_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  icon        TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Checklist Items
CREATE TABLE IF NOT EXISTS checklist_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID NOT NULL REFERENCES checklist_categories(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  what_to_check TEXT NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Pages
CREATE TABLE IF NOT EXISTS audit_pages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id            UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  url                 TEXT NOT NULL,
  title               TEXT,
  h1                  TEXT,
  meta_description    TEXT,
  content_text        TEXT,
  links_found         INT NOT NULL DEFAULT 0,
  broken_links        TEXT[] DEFAULT '{}',
  has_structured_data BOOLEAN DEFAULT FALSE,
  structured_data     JSONB,
  status_code         INT,
  load_time_ms        INT,
  is_mobile_friendly  BOOLEAN,
  viewport_meta       TEXT,
  crawled_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Findings
CREATE TABLE IF NOT EXISTS audit_findings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id          UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  checklist_item_id UUID REFERENCES checklist_items(id) ON DELETE SET NULL,
  severity          finding_severity NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  evidence          TEXT,
  page_url          TEXT,
  recommendation    TEXT NOT NULL,
  estimated_impact  TEXT,
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id                 UUID NOT NULL UNIQUE REFERENCES audits(id) ON DELETE CASCADE,
  executive_summary        TEXT NOT NULL,
  key_recommendation       TEXT,
  total_issues             INT NOT NULL DEFAULT 0,
  critical_count           INT NOT NULL DEFAULT 0,
  high_count               INT NOT NULL DEFAULT 0,
  medium_count             INT NOT NULL DEFAULT 0,
  low_count                INT NOT NULL DEFAULT 0,
  overall_score            INT,
  ux_score                 INT,
  conversion_score         INT,
  mobile_score             INT,
  ai_discoverability_score INT,
  content_score            INT,
  raw_json                 JSONB,
  pdf_url                  TEXT,
  pdf_generated_at         TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id   UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  event      TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'info' CHECK (status IN ('info', 'success', 'error', 'warning')),
  message    TEXT,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── VIEWS ────────────────────────────────────────────────────

CREATE OR REPLACE VIEW audit_overview AS
SELECT
  a.id,
  a.user_id,
  a.status,
  a.product_url,
  a.product_type,
  a.created_at,
  a.delivery_deadline,
  a.completed_at,
  p.status AS payment_status,
  r.overall_score,
  r.total_issues,
  r.critical_count,
  r.pdf_url
FROM audits a
LEFT JOIN payments p ON a.id = p.audit_id
LEFT JOIN reports r ON a.id = r.audit_id;

-- ── TRIGGER FUNCTIONS ───────────────────────────────────────

-- Function: Create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Create profile on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  new.updated_at = NOW();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update profiles.updated_at
DROP TRIGGER IF EXISTS on_profiles_updated ON profiles;
CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Trigger: Update audits.updated_at
DROP TRIGGER IF EXISTS on_audits_updated ON audits;
CREATE TRIGGER on_audits_updated
  BEFORE UPDATE ON audits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Trigger: Update payments.updated_at
DROP TRIGGER IF EXISTS on_payments_updated ON payments;
CREATE TRIGGER on_payments_updated
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Trigger: Update reports.updated_at
DROP TRIGGER IF EXISTS on_reports_updated ON reports;
CREATE TRIGGER on_reports_updated
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Function: Increment audit_count on audit create
CREATE OR REPLACE FUNCTION public.increment_audit_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET audit_count = audit_count + 1
  WHERE id = new.user_id;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Increment profile audit_count on audit insert
DROP TRIGGER IF EXISTS on_audit_created ON audits;
CREATE TRIGGER on_audit_created
  AFTER INSERT ON audits
  FOR EACH ROW EXECUTE FUNCTION public.increment_audit_count();

-- ── ROW LEVEL SECURITY ──────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles RLS: Users can see and update their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Audits RLS: Users can see and update their own audits
CREATE POLICY "Users can view own audits"
  ON audits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert audits"
  ON audits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own audits"
  ON audits FOR UPDATE
  USING (auth.uid() = user_id);

-- Payments RLS: Users can see their own payments
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert payments"
  ON payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payments"
  ON payments FOR UPDATE
  USING (auth.uid() = user_id);

-- Checklist Categories RLS: Everyone can read
CREATE POLICY "Everyone can read categories"
  ON checklist_categories FOR SELECT
  USING (TRUE);

-- Checklist Items RLS: Everyone can read
CREATE POLICY "Everyone can read checklist items"
  ON checklist_items FOR SELECT
  USING (TRUE);

-- Audit Pages RLS: Users can see pages from their own audits
CREATE POLICY "Users can view pages from own audits"
  ON audit_pages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM audits
      WHERE audits.id = audit_pages.audit_id
      AND audits.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert audit pages for own audits"
  ON audit_pages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM audits
      WHERE audits.id = audit_pages.audit_id
      AND audits.user_id = auth.uid()
    )
  );

-- Audit Findings RLS: Users can see findings from their own audits
CREATE POLICY "Users can view findings from own audits"
  ON audit_findings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM audits
      WHERE audits.id = audit_findings.audit_id
      AND audits.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert findings for own audits"
  ON audit_findings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM audits
      WHERE audits.id = audit_findings.audit_id
      AND audits.user_id = auth.uid()
    )
  );

-- Reports RLS: Users can see reports from their own audits
CREATE POLICY "Users can view reports from own audits"
  ON reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM audits
      WHERE audits.id = reports.audit_id
      AND audits.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reports for own audits"
  ON reports FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM audits
      WHERE audits.id = reports.audit_id
      AND audits.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own reports"
  ON reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM audits
      WHERE audits.id = reports.audit_id
      AND audits.user_id = auth.uid()
    )
  );

-- Audit Logs RLS: Users can see logs from their own audits
CREATE POLICY "Users can view logs from own audits"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM audits
      WHERE audits.id = audit_logs.audit_id
      AND audits.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert logs for own audits"
  ON audit_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM audits
      WHERE audits.id = audit_logs.audit_id
      AND audits.user_id = auth.uid()
    )
  );

-- ── INDEXES ─────────────────────────────────────────────────

-- Audit indexes
CREATE INDEX idx_audits_user_id ON audits(user_id);
CREATE INDEX idx_audits_status ON audits(status);
CREATE INDEX idx_audits_created_at ON audits(created_at DESC);

-- Payment indexes
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);

-- Audit Pages indexes
CREATE INDEX idx_audit_pages_audit_id ON audit_pages(audit_id);
CREATE INDEX idx_audit_pages_crawled_at ON audit_pages(crawled_at DESC);

-- Audit Findings indexes
CREATE INDEX idx_audit_findings_audit_id ON audit_findings(audit_id);
CREATE INDEX idx_audit_findings_severity ON audit_findings(severity);
CREATE INDEX idx_audit_findings_checklist_item_id ON audit_findings(checklist_item_id);

-- Report indexes
CREATE INDEX idx_reports_audit_id ON reports(audit_id);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);

-- Audit Logs indexes
CREATE INDEX idx_audit_logs_audit_id ON audit_logs(audit_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Checklist indexes
CREATE INDEX idx_checklist_items_category_id ON checklist_items(category_id);
CREATE INDEX idx_checklist_categories_slug ON checklist_categories(slug);
