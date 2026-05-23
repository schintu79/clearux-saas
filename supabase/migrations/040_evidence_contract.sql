-- Fix 2 Phase 1: Evidence contract for findings precision
-- Adds confidence_level and detection_source to standardize evidence quality

ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS confidence_level text NOT NULL DEFAULT 'heuristic',
  ADD COLUMN IF NOT EXISTS detection_source text NOT NULL DEFAULT 'analyzer';

-- Validate allowed values
ALTER TABLE audit_findings
  ADD CONSTRAINT chk_confidence_level
    CHECK (confidence_level IN ('deterministic', 'heuristic', 'interpretive'));

ALTER TABLE audit_findings
  ADD CONSTRAINT chk_detection_source
    CHECK (detection_source IN (
      'analyzer',           -- LLM-analyzed findings from crawled HTML
      'deep_analyzer',      -- Deep mode LLM analysis
      'wcag_checker',       -- WCAG 2.1 AA accessibility checks
      'responsive_checker', -- Multi-viewport layout checks
      'structured_data',    -- JSON-LD / schema validator
      'head_tag',           -- Head tag extraction checks
      'crawler',            -- Direct crawler observations
      'gap_fill',           -- Findings inherited from previous audit
      'brand_analyzer'      -- Brand identity LLM analysis
    ));

COMMENT ON COLUMN audit_findings.confidence_level IS 'How certain the detection is: deterministic (measurable), heuristic (rule-based), interpretive (AI judgment)';
COMMENT ON COLUMN audit_findings.detection_source IS 'Which pipeline stage produced this finding';
