-- ============================================================
-- 021: Add selected_modules to audits
-- Slug-based module selection replacing the old pillar index
-- system. Keeps selected_pillars for backward compatibility.
-- ============================================================

ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS selected_modules TEXT[];

-- Backfill: convert existing selected_pillars to selected_modules
-- Mapping: 0=foundation, 1=human_experience, 2=inclusive_design, 3=future_readiness
UPDATE audits
SET selected_modules = ARRAY(
  SELECT CASE (elem::int)
    WHEN 0 THEN 'foundation'
    WHEN 1 THEN 'human_experience'
    WHEN 2 THEN 'inclusive_design'
    WHEN 3 THEN 'future_readiness'
  END
  FROM jsonb_array_elements(selected_pillars) AS elem
)
WHERE selected_pillars IS NOT NULL AND selected_modules IS NULL;
