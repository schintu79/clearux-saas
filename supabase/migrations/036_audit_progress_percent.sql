-- ============================================================
-- 036 — Audit progress percent
-- ============================================================
-- Adds a `progress_percent` integer column to `audits` so the
-- audit engine can persist a real-time completion percentage and
-- the dashboard loader can render a smooth circular progress ring
-- (0–100) instead of the discrete 5-step bar.
-- ============================================================

alter table public.audits
  add column if not exists progress_percent integer;
