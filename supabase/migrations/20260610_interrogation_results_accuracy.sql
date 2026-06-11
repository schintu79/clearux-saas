-- ============================================================
-- Persist interrogation accuracy grades
-- ============================================================
-- The engine computed accuracy (Accurate/Partial/Inaccurate) and
-- accuracy_note in memory and returned them in the POST response, but
-- never wrote them to workspace_ai_interrogation_results. After any
-- refresh the UI hydrated answers WITHOUT grades: "No Data" badges on
-- full answers, "saved" chips instead of accuracy counts, "Not
-- measured" model cards, and a null accuracy hero.
--
-- Applied to live DB via MCP on 2026-06-10. Historical rows are
-- backfilled lazily by GET /api/ai-interrogation/run (grade-on-read,
-- persisted once).

ALTER TABLE workspace_ai_interrogation_results ADD COLUMN IF NOT EXISTS accuracy TEXT;
ALTER TABLE workspace_ai_interrogation_results ADD COLUMN IF NOT EXISTS accuracy_note TEXT;
