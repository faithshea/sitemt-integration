-- LOL Bingo & Slots Southport site management database.
-- This reset script removes the earlier email/auth profile setup and creates
-- PIN-based site accounts for the dashboard, management, and staff areas.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

drop table if exists public.handovers cascade;
drop table if exists public.audit_logs cascade;
drop table if exists public.issues cascade;
drop table if exists public.check_submissions cascade;
drop table if exists public.routine_tasks cascade;
drop table if exists public.cold_units cascade;
drop table if exists public.food_products cascade;
drop table if exists public.staffguard_remotes cascade;
drop table if exists public.fire_zones cascade;
drop table if exists public.cleaning_tasks cascade;
drop table if exists public.site_sessions cascade;
drop table if exists public.site_accounts cascade;
drop table if exists public.profiles cascade;

drop type if exists public.issue_status cascade;
drop type if exists public.issue_priority cascade;
drop type if exists public.user_role cascade;
drop type if exists public.cleaning_frequency cascade;
drop type if exists public.check_shift cascade;
drop type if exists public.cold_unit_type cascade;
drop type if exists public.check_status cascade;
drop type if exists public.check_area cascade;

create type public.check_area as enum (
  'cleaning',
  'fire',
  'staffguard',
  'food',
  'cold',
  'opening',
  'closing',
  'safe',
  'management'
);

create type public.check_status as enum ('ok', 'warning', 'missed');
create type public.cold_unit_type as enum ('fridge', 'freezer');
create type public.check_shift as enum ('morning', 'evening');
create type public.cleaning_frequency as enum ('daily', 'weekly', 'twice_weekly', 'four_weekly', 'monthly');
create type public.user_role as enum ('dashboard', 'management', 'staff');
create type public.issue_priority as enum ('low', 'medium', 'high');
create type public.issue_status as enum ('open', 'resolved');

create table public.site_accounts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  role public.user_role not null default 'staff',
  pin_hash text not null,
  permissions jsonb not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.site_accounts(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours',
  revoked_at timestamptz
);

create table public.cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text not null,
  frequency public.cleaning_frequency not null default 'daily',
  requires_photo boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fire_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  call_point text not null,
  description text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staffguard_remotes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.food_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_temp numeric(5, 2) not null default 75,
  max_temp numeric(5, 2) not null default 99,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cold_units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.cold_unit_type not null,
  min_temp numeric(5, 2) not null,
  max_temp numeric(5, 2) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.routine_tasks (
  id uuid primary key default gen_random_uuid(),
  area public.check_area not null check (area::text in ('opening', 'closing', 'safe', 'management')),
  name text not null,
  description text not null,
  frequency public.cleaning_frequency not null default 'daily',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.check_submissions (
  id uuid primary key default gen_random_uuid(),
  area public.check_area not null,
  item_id uuid not null,
  item_name text not null,
  staff_account_id uuid references public.site_accounts(id) on delete set null,
  staff_name text not null,
  submitted_at timestamptz not null default now(),
  measured_value numeric(6, 2),
  shift public.check_shift,
  photo_path text,
  notes text,
  missed_reason text,
  status public.check_status not null default 'ok',
  reviewed_at timestamptz,
  reviewed_by_account_id uuid references public.site_accounts(id) on delete set null,
  reviewed_by_name text,
  corrective_action text
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  detail text not null,
  priority public.issue_priority not null default 'medium',
  status public.issue_status not null default 'open',
  reported_by_account_id uuid references public.site_accounts(id) on delete set null,
  reported_by_name text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_account_id uuid references public.site_accounts(id) on delete set null,
  resolved_by_name text,
  resolution text
);

create table public.handovers (
  id uuid primary key default gen_random_uuid(),
  manager_account_id uuid references public.site_accounts(id) on delete set null,
  manager_name text not null,
  summary text not null,
  unresolved_notes text,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_account_id uuid references public.site_accounts(id) on delete set null,
  actor_name text not null,
  action text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

create index site_accounts_role_active_idx on public.site_accounts(role, active);
create index site_sessions_token_hash_idx on public.site_sessions(token_hash);
create index site_sessions_account_idx on public.site_sessions(account_id);
create index check_submissions_area_item_submitted_idx
  on public.check_submissions(area, item_id, submitted_at desc);
create index check_submissions_status_idx
  on public.check_submissions(status)
  where status = 'warning';
create index issues_status_priority_idx on public.issues(status, priority);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger site_accounts_touch_updated_at
before update on public.site_accounts
for each row execute function public.touch_updated_at();

create trigger cleaning_tasks_touch_updated_at
before update on public.cleaning_tasks
for each row execute function public.touch_updated_at();

create trigger fire_zones_touch_updated_at
before update on public.fire_zones
for each row execute function public.touch_updated_at();

create trigger staffguard_remotes_touch_updated_at
before update on public.staffguard_remotes
for each row execute function public.touch_updated_at();

create trigger food_products_touch_updated_at
before update on public.food_products
for each row execute function public.touch_updated_at();

create trigger cold_units_touch_updated_at
before update on public.cold_units
for each row execute function public.touch_updated_at();

create trigger routine_tasks_touch_updated_at
before update on public.routine_tasks
for each row execute function public.touch_updated_at();

alter table public.site_accounts enable row level security;
alter table public.site_sessions enable row level security;
alter table public.cleaning_tasks enable row level security;
alter table public.fire_zones enable row level security;
alter table public.staffguard_remotes enable row level security;
alter table public.food_products enable row level security;
alter table public.cold_units enable row level security;
alter table public.routine_tasks enable row level security;
alter table public.check_submissions enable row level security;
alter table public.issues enable row level security;
alter table public.handovers enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.site_accounts from anon, authenticated;
revoke all on public.site_sessions from anon, authenticated;
revoke all on public.cleaning_tasks from anon, authenticated;
revoke all on public.fire_zones from anon, authenticated;
revoke all on public.staffguard_remotes from anon, authenticated;
revoke all on public.food_products from anon, authenticated;
revoke all on public.cold_units from anon, authenticated;
revoke all on public.routine_tasks from anon, authenticated;
revoke all on public.check_submissions from anon, authenticated;
revoke all on public.issues from anon, authenticated;
revoke all on public.handovers from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

create or replace function public.account_login_options(p_role public.user_role)
returns table (
  id uuid,
  display_name text,
  role public.user_role
)
language sql
security definer
set search_path = public, extensions
as $$
  select site_accounts.id, site_accounts.display_name, site_accounts.role
  from public.site_accounts
  where site_accounts.active = true
  and site_accounts.role = p_role
  order by site_accounts.display_name;
$$;

create or replace function public.verify_account_pin(
  p_account_id uuid,
  p_pin text
)
returns table (
  account_id uuid,
  display_name text,
  role public.user_role,
  permissions jsonb,
  session_token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matched_account public.site_accounts%rowtype;
  plain_token text;
  session_expiry timestamptz := now() + interval '12 hours';
begin
  select *
  into matched_account
  from public.site_accounts
  where id = p_account_id
  and active = true
  and pin_hash = extensions.crypt(p_pin, pin_hash);

  if not found then
    raise exception 'Invalid account or PIN';
  end if;

  plain_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.site_sessions (account_id, token_hash, expires_at)
  values (matched_account.id, encode(extensions.digest(plain_token, 'sha256'), 'hex'), session_expiry);

  return query
  select
    matched_account.id,
    matched_account.display_name,
    matched_account.role,
    matched_account.permissions,
    plain_token,
    session_expiry;
end;
$$;

create or replace function public.end_site_session(p_session_token text)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  update public.site_sessions
  set revoked_at = now()
  where token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
  and revoked_at is null;
$$;

create or replace function public.session_account(p_session_token text)
returns table (
  account_id uuid,
  display_name text,
  role public.user_role,
  permissions jsonb
)
language sql
security definer
set search_path = public, extensions
as $$
  select account.id, account.display_name, account.role, account.permissions
  from public.site_sessions session
  join public.site_accounts account on account.id = session.account_id
  where session.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
  and session.revoked_at is null
  and session.expires_at > now()
  and account.active = true;
$$;

create or replace function public.management_reset_account_pin(
  p_manager_session_token text,
  p_account_id uuid,
  p_new_pin text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  manager_role public.user_role;
begin
  if p_new_pin !~ '^[0-9]{6}$' then
    raise exception 'PIN must be exactly 6 digits';
  end if;

  select role
  into manager_role
  from public.session_account(p_manager_session_token)
  limit 1;

  if manager_role is distinct from 'management' then
    raise exception 'Management account required';
  end if;

  update public.site_accounts
  set pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf'))
  where id = p_account_id;
end;
$$;

grant execute on function public.account_login_options(public.user_role) to anon, authenticated;
grant execute on function public.verify_account_pin(uuid, text) to anon, authenticated;
grant execute on function public.end_site_session(text) to anon, authenticated;
grant execute on function public.session_account(text) to anon, authenticated;
grant execute on function public.management_reset_account_pin(text, uuid, text) to anon, authenticated;

insert into public.site_accounts (id, display_name, role, pin_hash, permissions, active)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'LOLSPTDashboard',
    'dashboard',
    extensions.crypt('654321', extensions.gen_salt('bf')),
    '{
      "canAccessDashboard": true,
      "canManageSettings": false,
      "canCompleteCleaning": false,
      "canCompleteFood": false,
      "canCompleteCold": false,
      "canCompleteFire": false,
      "canCompleteStaffGuard": false,
      "canCompleteOpening": false,
      "canCompleteClosing": false,
      "canCompleteSafe": false
    }',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Faith Shea',
    'management',
    extensions.crypt('123456', extensions.gen_salt('bf')),
    '{
      "canAccessDashboard": true,
      "canManageSettings": true,
      "canCompleteCleaning": true,
      "canCompleteFood": true,
      "canCompleteCold": true,
      "canCompleteFire": true,
      "canCompleteStaffGuard": true,
      "canCompleteOpening": true,
      "canCompleteClosing": true,
      "canCompleteSafe": true
    }',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'Alyssa Stoker',
    'staff',
    extensions.crypt('123456', extensions.gen_salt('bf')),
    '{
      "canAccessDashboard": false,
      "canManageSettings": false,
      "canCompleteCleaning": true,
      "canCompleteFood": true,
      "canCompleteCold": true,
      "canCompleteFire": false,
      "canCompleteStaffGuard": false,
      "canCompleteOpening": true,
      "canCompleteClosing": true,
      "canCompleteSafe": false
    }',
    true
  );
