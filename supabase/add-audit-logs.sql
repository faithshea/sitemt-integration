create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_account_id uuid references public.site_accounts(id) on delete set null,
  actor_name text not null,
  action text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx
  on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

revoke all on public.audit_logs from anon, authenticated;
