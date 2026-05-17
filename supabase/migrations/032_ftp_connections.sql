-- ============================================================
-- 032 — FTP/SFTP connections for one-click fix deployment
-- ============================================================

create table if not exists public.ftp_connections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  brand_identity_id uuid references public.brand_identities(id) on delete set null,
  -- Connection details
  label         text not null default 'My server',
  protocol      text not null default 'sftp' check (protocol in ('ftp', 'ftps', 'sftp')),
  host          text not null,
  port          integer not null default 22,
  username      text not null,
  password_encrypted text not null,  -- encrypted at app layer before storage
  remote_path   text not null default '/',
  -- Status
  last_connected_at timestamptz,
  is_active     boolean not null default true,
  -- Timestamps
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index for quick lookup by user + brand
create index idx_ftp_connections_user on public.ftp_connections(user_id);
create index idx_ftp_connections_brand on public.ftp_connections(brand_identity_id);

-- RLS
alter table public.ftp_connections enable row level security;

create policy "Users can view own FTP connections"
  on public.ftp_connections for select
  using (auth.uid() = user_id);

create policy "Users can insert own FTP connections"
  on public.ftp_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update own FTP connections"
  on public.ftp_connections for update
  using (auth.uid() = user_id);

create policy "Users can delete own FTP connections"
  on public.ftp_connections for delete
  using (auth.uid() = user_id);

-- Deploy log — track every file change pushed via FTP
create table if not exists public.ftp_deploy_log (
  id            uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.ftp_connections(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  audit_id      uuid references public.audits(id) on delete set null,
  finding_id    uuid references public.audit_findings(id) on delete set null,
  -- What was changed
  file_path     text not null,
  action        text not null check (action in ('create', 'update', 'delete', 'backup')),
  backup_content text,  -- original content before modification
  new_content   text,   -- what was written
  -- Status
  status        text not null default 'success' check (status in ('success', 'failed', 'rolled_back')),
  error_message text,
  created_at    timestamptz not null default now()
);

create index idx_ftp_deploy_log_connection on public.ftp_deploy_log(connection_id);
create index idx_ftp_deploy_log_user on public.ftp_deploy_log(user_id);

alter table public.ftp_deploy_log enable row level security;

create policy "Users can view own deploy logs"
  on public.ftp_deploy_log for select
  using (auth.uid() = user_id);

create policy "Users can insert own deploy logs"
  on public.ftp_deploy_log for insert
  with check (auth.uid() = user_id);
