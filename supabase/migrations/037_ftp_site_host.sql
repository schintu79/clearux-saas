-- ============================================================
-- 037 — Add site_host to FTP connections for site-scoped connections
-- Connections can be scoped to either a brand_identity_id OR a site_host.
-- This lets users save FTP connections when they have a website selected
-- in the sidebar (not just a brand identity).
-- ============================================================

alter table public.ftp_connections
  add column if not exists site_host text;

create index if not exists idx_ftp_connections_site_host
  on public.ftp_connections(site_host);
