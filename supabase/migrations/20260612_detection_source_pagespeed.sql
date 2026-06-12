-- 2026-06-12: chk_detection_source predates working PageSpeed inserts —
-- 'pagespeed_api' was never in the allowed list because no PageSpeed
-- insert ever reached the DB (siteProfile TDZ killed the step for weeks,
-- and before that the category/position column bug killed the batch).
-- First successful PageSpeed run (audit adac62e1) hit the constraint
-- immediately; the checked-insert helper reported it loudly.
-- Applied live 2026-06-12 via MCP, same commit as this file.
ALTER TABLE audit_findings DROP CONSTRAINT chk_detection_source;
ALTER TABLE audit_findings ADD CONSTRAINT chk_detection_source
  CHECK (detection_source = ANY (ARRAY['analyzer'::text, 'deep_analyzer'::text, 'wcag_checker'::text, 'responsive_checker'::text, 'structured_data'::text, 'head_tag'::text, 'crawler'::text, 'gap_fill'::text, 'brand_analyzer'::text, 'pagespeed_api'::text]));
