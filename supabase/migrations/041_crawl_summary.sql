-- ============================================================
-- Migration 041: Crawl Summary & Audit Transparency
-- ============================================================
-- Adds crawl summary payload and timing fields to audits table.
-- Adds per-page crawl tracking to audit_pages table.
-- Supports Fix 4 — Crawl quality and audit transparency.

-- ── Crawl summary on audits ────────────────────────────────
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS crawl_summary jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS crawl_started_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS crawl_completed_at timestamptz DEFAULT NULL;

-- ── Per-page crawl metadata on audit_pages ─────────────────
ALTER TABLE audit_pages
  ADD COLUMN IF NOT EXISTS crawl_status text DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS skip_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS canonical_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_duplicate boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS page_type text DEFAULT 'content',
  ADD COLUMN IF NOT EXISTS fetch_strategy text DEFAULT NULL;
