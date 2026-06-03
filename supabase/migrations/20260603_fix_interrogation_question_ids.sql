-- ============================================================
-- Fix AI interrogation question ID types
-- ============================================================
-- The static question library uses short string IDs (e.g. 'df-001',
-- 'gd-002') instead of UUIDs. The original migration defined these
-- columns as uuid / uuid[], which causes insert failures.
--
-- This migration:
--   1. Drops the FK constraint on workspace_ai_interrogations.question_id
--   2. Changes question_id from uuid to text (nullable)
--   3. Changes question_ids in workspace_ai_question_sets from uuid[] to text[]
--   4. Changes followup_question_ids in ai_question_library from uuid[] to text[]
--   5. Changes ai_question_library.id from uuid to text (to match library IDs)
-- ============================================================

-- 1. Drop FK constraint on workspace_ai_interrogations.question_id
ALTER TABLE workspace_ai_interrogations
  DROP CONSTRAINT IF EXISTS workspace_ai_interrogations_question_id_fkey;

-- 2. Change question_id column type to text
ALTER TABLE workspace_ai_interrogations
  ALTER COLUMN question_id TYPE text USING question_id::text;

-- 3. Change question_ids in workspace_ai_question_sets to text[]
ALTER TABLE workspace_ai_question_sets
  ALTER COLUMN question_ids TYPE text[] USING question_ids::text[];

-- 4. Change followup_question_ids in ai_question_library to text[]
ALTER TABLE ai_question_library
  ALTER COLUMN followup_question_ids TYPE text[] USING followup_question_ids::text[];

-- 5. Change ai_question_library PK to text
ALTER TABLE ai_question_library
  ALTER COLUMN id TYPE text USING id::text;
