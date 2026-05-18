-- ============================================================
-- AI X-Ray: per-provider status + error message
--
-- Before this migration `multi_model_probes` only held rows for
-- providers that successfully answered at least one question. If
-- Gemini's API key was missing or the upstream call failed, the
-- row was silently dropped and the dashboard rendered "Not yet
-- measured" — indistinguishable from a brand-new audit.
--
-- We now always insert one row per provider per audit and carry
-- a `status` column ('measured' | 'skipped' | 'error') plus an
-- optional human-readable `error_message`. The UI uses these to
-- render explicit "Not configured" or "Probe failed" badges so
-- operators see when X-Ray isn't actually working.
-- ============================================================

ALTER TABLE multi_model_probes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'measured',
  ADD COLUMN IF NOT EXISTS error_message text DEFAULT NULL;

-- Constrain status to known states. Existing rows have status='measured'
-- (the default), which matches their prior semantics: they only got
-- written when the probe actually returned answers.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'multi_model_probes_status_check'
  ) THEN
    ALTER TABLE multi_model_probes
      ADD CONSTRAINT multi_model_probes_status_check
      CHECK (status IN ('measured', 'skipped', 'error'));
  END IF;
END $$;
