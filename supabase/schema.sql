create type public.check_area as enum (
  'cleaning',
  'fire',
  'staffguard',
  'food',
  'cold'
);

create type public.check_status as enum ('ok', 'warning');
create type public.cold_unit_type as enum ('fridge', 'freezer');
create type public.check_shift as enum ('morning', 'evening');
create type public.cleaning_frequency as enum ('daily', 'weekly', 'monthly');
create type public.user_role as enum ('management', 'staff');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'staff',
  created_at timestamptz not null default now()
);

create table public.cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text not null,
  frequency public.cleaning_frequency not null default 'daily',
  requires_photo boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.fire_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  call_point text not null,
  description text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.staffguard_remotes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.food_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_temp numeric(5, 2) not null default 75,
  max_temp numeric(5, 2) not null default 99,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.cold_units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.cold_unit_type not null,
  min_temp numeric(5, 2) not null,
  max_temp numeric(5, 2) not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.check_submissions (
  id uuid primary key default gen_random_uuid(),
  area public.check_area not null,
  item_id uuid not null,
  item_name text not null,
  staff_id uuid references public.profiles(id) on delete set null,
  staff_name text not null,
  submitted_at timestamptz not null default now(),
  measured_value numeric(6, 2),
  shift public.check_shift,
  photo_path text,
  notes text,
  status public.check_status not null default 'ok',
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  corrective_action text
);

create index check_submissions_area_item_submitted_idx
  on public.check_submissions(area, item_id, submitted_at desc);

create index check_submissions_status_idx
  on public.check_submissions(status)
  where status = 'warning';

alter table public.profiles enable row level security;
alter table public.cleaning_tasks enable row level security;
alter table public.fire_zones enable row level security;
alter table public.staffguard_remotes enable row level security;
alter table public.food_products enable row level security;
alter table public.cold_units enable row level security;
alter table public.check_submissions enable row level security;

create policy "Everyone signed in can read active setup"
  on public.cleaning_tasks for select
  to authenticated
  using (active = true);

create policy "Everyone signed in can read fire zones"
  on public.fire_zones for select
  to authenticated
  using (active = true);

create policy "Everyone signed in can read StaffGuard remotes"
  on public.staffguard_remotes for select
  to authenticated
  using (active = true);

create policy "Everyone signed in can read food products"
  on public.food_products for select
  to authenticated
  using (active = true);

create policy "Everyone signed in can read cold units"
  on public.cold_units for select
  to authenticated
  using (active = true);

create policy "Signed in staff can add submissions"
  on public.check_submissions for insert
  to authenticated
  with check (true);

create policy "Management can read all submissions"
  on public.check_submissions for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'management'
    )
  );

create policy "Management can update submissions"
  on public.check_submissions for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'management'
    )
  );

create policy "Management can manage cleaning tasks"
  on public.cleaning_tasks for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'management'
    )
  );

create policy "Management can manage fire zones"
  on public.fire_zones for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'management'
    )
  );

create policy "Management can manage StaffGuard remotes"
  on public.staffguard_remotes for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'management'
    )
  );

create policy "Management can manage food products"
  on public.food_products for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'management'
    )
  );

create policy "Management can manage cold units"
  on public.cold_units for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'management'
    )
  );
