-- ============================================================
-- Fix: audit_findings.viewport column missing from live DB
-- ============================================================
-- Commit 757e800 (2026-06-07, "Add finding reliability — viewport
-- fields, contradiction checker, viewport chips") added `viewport`
-- to the website-audit findings insert payload in process-audit.ts
-- but never created this migration.
--
-- Result: PostgREST rejected EVERY website-audit findings batch
-- insert from 2026-06-07 onward. The insert error was silently
-- ignored (response `error` field never destructured), so audits
-- "completed" with zero findings and jitter-fabricated scores.
--
-- This is the third schema-drift incident (see CLAUDE_SESSION_GUIDE.md
-- sections 3 and 8). Applied to live DB via MCP on 2026-06-10.
-- ============================================================

ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS viewport TEXT;

COMMENT ON COLUMN audit_findings.viewport IS
  'Viewport context for the finding: mobile | desktop | tablet | all | cross-viewport | technical | brand-dna';
