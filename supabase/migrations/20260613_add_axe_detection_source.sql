-- Phase 1, item 1: axe-core deterministic accessibility findings.
-- Adds 'axe' to the audit_findings.detection_source CHECK constraint so
-- axe-core violations can be persisted with their own provenance (distinct
-- from the custom 'wcag_checker'). Idempotent: drop-if-exists then recreate.

ALTER TABLE audit_findings DROP CONSTRAINT IF EXISTS chk_detection_source;

ALTER TABLE audit_findings ADD CONSTRAINT chk_detection_source CHECK (
  detection_source = ANY (ARRAY[
    'analyzer'::text,
    'deep_analyzer'::text,
    'wcag_checker'::text,
    'responsive_checker'::text,
    'structured_data'::text,
    'head_tag'::text,
    'crawler'::text,
    'gap_fill'::text,
    'brand_analyzer'::text,
    'pagespeed_api'::text,
    'axe'::text
  ])
);
