-- ============================================================
-- ClearUX — Free Audit Preview Support
-- Allows anonymous users to run a free audit from the homepage
-- with a teaser view of results. Full results require payment.
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ============================================================
-- Plan Types
-- ============================================================
-- NOTE: The 'free_preview' plan type is now a valid option
-- Plans are stored as TEXT, no enum migration needed.
-- Valid plan types: 'free_preview', 'starter', 'pro', 'enterprise'

-- ============================================================
-- Audits Table: Allow User ID to be Nullable
-- ============================================================
-- Free preview audits are created by anonymous users,
-- so user_id may not be set. Making it nullable allows
-- unlinked audits in the database.
ALTER TABLE audits ALTER COLUMN user_id DROP NOT NULL;

-- ============================================================
-- Audits Table: Mark Free Preview Audits
-- ============================================================
-- is_free_preview: boolean flag to identify free teaser audits.
-- These audits show limited results publicly without authentication.
ALTER TABLE audits ADD COLUMN IF NOT EXISTS is_free_preview BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- Audits Table: Track Claim / Purchase
-- ============================================================
-- claimed_by: references auth.users(id) when a user "unlocks"
-- or purchases full results for a free preview audit.
-- NULL means the audit has not been claimed/purchased yet.
ALTER TABLE audits ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES auth.users(id);

-- ============================================================
-- Audits Table: Rate-Limit Free Audits
-- ============================================================
-- free_audit_email: stores the email or IP that requested a free audit.
-- Used to enforce rate limits on free preview generation (e.g., 1 per day per email).
-- NULL for non-free audits or when no contact info is provided.
ALTER TABLE audits ADD COLUMN IF NOT EXISTS free_audit_email TEXT;

-- ============================================================
-- Indexes for Performance
-- ============================================================
-- Efficiently query free preview audits for the public preview page.
CREATE INDEX IF NOT EXISTS idx_audits_free_preview ON audits(is_free_preview) WHERE is_free_preview = true;

-- Efficiently look up free audits by email for rate limiting.
CREATE INDEX IF NOT EXISTS idx_audits_free_audit_email ON audits(free_audit_email) WHERE free_audit_email IS NOT NULL;

-- ============================================================
-- Row-Level Security (RLS) Policies
-- ============================================================
-- Allow anyone to view free preview audits (no auth required).
-- This policy enables the public preview page to display teaser results.
CREATE POLICY IF NOT EXISTS "Anyone can view free preview audits"
  ON audits FOR SELECT
  USING (is_free_preview = true);

-- Allow anyone to view reports linked to free preview audits.
-- Reports contain the actual findings and metrics shown on the preview page.
CREATE POLICY IF NOT EXISTS "Anyone can view free preview reports"
  ON reports FOR SELECT
  USING (audit_id IN (SELECT id FROM audits WHERE is_free_preview = true));

-- Allow anyone to view findings linked to free preview audits.
-- Findings (e.g., accessibility issues, performance problems) are shown in the preview.
CREATE POLICY IF NOT EXISTS "Anyone can view free preview findings"
  ON audit_findings FOR SELECT
  USING (audit_id IN (SELECT id FROM audits WHERE is_free_preview = true));
