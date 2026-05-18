-- ============================================================
-- 035 — Technical audit per page
-- ============================================================
-- Adds a `technical_audit` jsonb column to `audit_pages` so the
-- audit engine can persist measured technical-health data (performance,
-- images, headings, accessibility, links, etc.) per crawled page.
--
-- Note: the requested filename was 033_technical_audit.sql but 033 and 034
-- are already taken (competitor_benchmarks_manual, multi_model_probe_status).
-- Renumbered to 035 to preserve migration ordering.
-- ============================================================

alter table public.audit_pages
  add column if not exists technical_audit jsonb;

comment on column public.audit_pages.technical_audit is
  'Per-page technical audit results: performance (load time, byte size), images (count, missing alt), headings (h1/h2/h3 counts, hierarchy issues), accessibility (lang attr, viewport, ARIA hints), links (internal/external counts, broken).';

-- Optional partial index for queries that filter on the presence of the column.
create index if not exists idx_audit_pages_has_technical_audit
  on public.audit_pages (audit_id)
  where technical_audit is not null;
