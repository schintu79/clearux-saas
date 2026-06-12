-- 2026-06-12: Seventh & eighth silent-write incidents (found by Phase 0.3 contract sweep)
-- 1) process-audit.ts WCAG step updates audit_pages.wcag_checklist / wcag_score
--    — columns never existed; unchecked .update() failed silently on every
--    accessibility audit since the feature shipped. src/types/database.ts and
--    WcagChecklist.tsx already expect them.
-- 2) audit-engine/index.ts writes audit_pages.code_quality (read by the audit
--    detail page as JSON) — column never existed.
-- Applied to live DB 2026-06-12 via MCP (same commit as this file + snapshot refresh).
ALTER TABLE audit_pages ADD COLUMN IF NOT EXISTS wcag_checklist TEXT;
ALTER TABLE audit_pages ADD COLUMN IF NOT EXISTS wcag_score INTEGER;
ALTER TABLE audit_pages ADD COLUMN IF NOT EXISTS code_quality JSONB;
