-- ============================================================
-- 042: Performance data — page-level and site-level
-- ============================================================
-- Adds performance_data jsonb to audit_pages for per-page
-- performance metrics, and performance_summary jsonb to audits
-- for site-level aggregation. Also adds owner_team to findings.
-- ============================================================

-- Page-level performance data (LCP estimate, page weight, scripts, images, third-party, CLS)
ALTER TABLE audit_pages
  ADD COLUMN IF NOT EXISTS performance_data jsonb DEFAULT NULL;

-- Site-level performance summary (aggregated from page-level data)
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS performance_summary jsonb DEFAULT NULL;

-- Finding owner team — who should fix this issue
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'owner_team') THEN
    CREATE TYPE owner_team AS ENUM ('engineering', 'marketing', 'product', 'design');
  END IF;
END$$;

-- Add owner_team to findings (nullable — only set on performance findings)
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS owner_team text DEFAULT NULL;

-- Add performance_metric_type to findings for filtering performance-related findings
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS performance_metric_type text DEFAULT NULL;

-- Index for querying performance findings
CREATE INDEX IF NOT EXISTS idx_findings_performance_metric
  ON audit_findings (performance_metric_type)
  WHERE performance_metric_type IS NOT NULL;
