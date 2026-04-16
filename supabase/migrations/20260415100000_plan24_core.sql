-- Plan 24 (RTT): rosters per master cell, shifts, events, tasks. See plan_24_rtt_planning.md.

-- ---------------------------------------------------------------------------
-- Access helper (reads profiles.can_access_rtt_systems)
-- ---------------------------------------------------------------------------

create or replace function public.app_user_can_access_rtt()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.can_access_rtt_systems from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

grant execute on function public.app_user_can_access_rtt() to authenticated;

-- ---------------------------------------------------------------------------
-- Master data read for RTT users (policies OR with existing LDR read)
-- ---------------------------------------------------------------------------

create policy "master_sites_select_rtt"
  on public.master_sites for select to authenticated
  using (public.app_user_can_access_rtt());

create policy "master_plants_select_rtt"
  on public.master_plants for select to authenticated
  using (public.app_user_can_access_rtt());

create policy "master_cells_select_rtt"
  on public.master_cells for select to authenticated
  using (public.app_user_can_access_rtt());

-- ---------------------------------------------------------------------------
-- Rosters (per cell; one active per cell via partial unique index)
-- ---------------------------------------------------------------------------

create table public.plan24_rosters (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default false,
  effective_from date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan24_rosters_name_unique unique (master_cell_id, name)
);

create index plan24_rosters_master_cell_id_idx on public.plan24_rosters (master_cell_id);

create unique index plan24_rosters_one_active_per_cell
  on public.plan24_rosters (master_cell_id)
  where is_active;

create trigger plan24_rosters_touch_updated_at
  before update on public.plan24_rosters
  for each row execute function public.master_data_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Roles on a roster (column headers on Plan 24)
-- ---------------------------------------------------------------------------

create table public.plan24_roster_roles (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.plan24_rosters (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  default_person_id uuid references public.people (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan24_roster_roles_name_unique unique (roster_id, name)
);

create index plan24_roster_roles_roster_id_idx on public.plan24_roster_roles (roster_id);

create trigger plan24_roster_roles_touch_updated_at
  before update on public.plan24_roster_roles
  for each row execute function public.master_data_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Shifts (day / night local window per roster)
-- ---------------------------------------------------------------------------

create table public.plan24_roster_shifts (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.plan24_rosters (id) on delete cascade,
  kind text not null check (kind in ('day', 'night')),
  start_local time not null,
  end_local time not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan24_roster_shifts_kind_unique unique (roster_id, kind)
);

create index plan24_roster_shifts_roster_id_idx on public.plan24_roster_shifts (roster_id);

create trigger plan24_roster_shifts_touch_updated_at
  before update on public.plan24_roster_shifts
  for each row execute function public.master_data_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Events (checks v1; unassigned when role_name is null)
-- ---------------------------------------------------------------------------

create table public.plan24_events (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  roster_id uuid references public.plan24_rosters (id) on delete set null,
  plan_date date not null,
  shift_kind text not null check (shift_kind in ('day', 'night')),
  role_name text,
  title text not null default 'Check',
  event_type text not null default 'check',
  source text not null default 'scheduled' check (source in ('scheduled', 'ad_hoc')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'complete')),
  sub_tasks jsonb not null default '[]'::jsonb,
  opened_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles (id) on delete set null,
  assigned_person_id uuid references public.people (id) on delete set null,
  deleted_at timestamptz,
  delete_comment text,
  deleted_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan24_events_time_order check (end_at > start_at)
);

create index plan24_events_cell_date_idx on public.plan24_events (master_cell_id, plan_date, shift_kind)
  where deleted_at is null;

create index plan24_events_roster_idx on public.plan24_events (roster_id);

create trigger plan24_events_touch_updated_at
  before update on public.plan24_events
  for each row execute function public.master_data_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Bottom task bar (per cell + role; not linked to events in v1)
-- ---------------------------------------------------------------------------

create table public.plan24_tasks (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  role_name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plan24_tasks_cell_owner_idx on public.plan24_tasks (master_cell_id, owner_id);

create trigger plan24_tasks_touch_updated_at
  before update on public.plan24_tasks
  for each row execute function public.master_data_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Per day / shift person on role (plan context; §2.3)
-- ---------------------------------------------------------------------------

create table public.plan24_role_day_assignments (
  roster_id uuid not null references public.plan24_rosters (id) on delete cascade,
  plan_date date not null,
  shift_kind text not null check (shift_kind in ('day', 'night')),
  role_name text not null,
  person_id uuid references public.people (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (roster_id, plan_date, shift_kind, role_name)
);

create index plan24_role_day_assignments_date_idx
  on public.plan24_role_day_assignments (plan_date, shift_kind);

create trigger plan24_role_day_assignments_touch_updated_at
  before update on public.plan24_role_day_assignments
  for each row execute function public.master_data_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.plan24_rosters to authenticated;
grant select, insert, update, delete on public.plan24_roster_roles to authenticated;
grant select, insert, update, delete on public.plan24_roster_shifts to authenticated;
grant select, insert, update, delete on public.plan24_events to authenticated;
grant select, insert, update, delete on public.plan24_tasks to authenticated;
grant select, insert, update, delete on public.plan24_role_day_assignments to authenticated;

alter table public.plan24_rosters enable row level security;
alter table public.plan24_roster_roles enable row level security;
alter table public.plan24_roster_shifts enable row level security;
alter table public.plan24_events enable row level security;
alter table public.plan24_tasks enable row level security;
alter table public.plan24_role_day_assignments enable row level security;

-- Rosters / roles / shifts: app admins only (D11)
create policy "plan24_rosters_admin_all"
  on public.plan24_rosters for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "plan24_roster_roles_admin_all"
  on public.plan24_roster_roles for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "plan24_roster_shifts_admin_all"
  on public.plan24_roster_shifts for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

-- Events: RTT users read/write non-deleted; soft delete = update with deleted_at set
create policy "plan24_events_select_rtt"
  on public.plan24_events for select to authenticated
  using (public.app_user_can_access_rtt());

create policy "plan24_events_insert_rtt"
  on public.plan24_events for insert to authenticated
  with check (public.app_user_can_access_rtt());

create policy "plan24_events_update_rtt"
  on public.plan24_events for update to authenticated
  using (public.app_user_can_access_rtt()) with check (public.app_user_can_access_rtt());

-- Tasks: RTT users manage own rows (owner_id)
create policy "plan24_tasks_select_rtt"
  on public.plan24_tasks for select to authenticated
  using (public.app_user_can_access_rtt() and owner_id = auth.uid());

create policy "plan24_tasks_write_own"
  on public.plan24_tasks for insert to authenticated
  with check (public.app_user_can_access_rtt() and owner_id = auth.uid());

create policy "plan24_tasks_update_own"
  on public.plan24_tasks for update to authenticated
  using (public.app_user_can_access_rtt() and owner_id = auth.uid())
  with check (public.app_user_can_access_rtt() and owner_id = auth.uid());

create policy "plan24_tasks_delete_own"
  on public.plan24_tasks for delete to authenticated
  using (public.app_user_can_access_rtt() and owner_id = auth.uid());

create policy "plan24_role_day_assignments_all_rtt"
  on public.plan24_role_day_assignments for all to authenticated
  using (public.app_user_can_access_rtt()) with check (public.app_user_can_access_rtt());

-- ---------------------------------------------------------------------------
-- Seed default roster for Darfield Powder cell (idempotent)
-- ---------------------------------------------------------------------------

insert into public.plan24_rosters (id, master_cell_id, name, sort_order, is_active)
values
  (
    'c1000001-0000-4000-8000-000000000001',
    'b3000001-0000-4000-8000-000000000001',
    'Default',
    0,
    true
  )
on conflict (id) do nothing;

insert into public.plan24_roster_shifts (roster_id, kind, start_local, end_local, sort_order)
values
  ('c1000001-0000-4000-8000-000000000001', 'day', time '05:00', time '17:00', 0),
  ('c1000001-0000-4000-8000-000000000001', 'night', time '17:00', time '05:00', 1)
on conflict (roster_id, kind) do nothing;

insert into public.plan24_roster_roles (roster_id, name, sort_order, is_active)
values
  ('c1000001-0000-4000-8000-000000000001', 'Team lead', 0, true),
  ('c1000001-0000-4000-8000-000000000001', 'Packing 1', 1, true),
  ('c1000001-0000-4000-8000-000000000001', 'Packing 2', 2, true),
  ('c1000001-0000-4000-8000-000000000001', 'Packing 3', 3, true),
  ('c1000001-0000-4000-8000-000000000001', 'Packing 4', 4, true),
  ('c1000001-0000-4000-8000-000000000001', 'Packing 5', 5, true),
  ('c1000001-0000-4000-8000-000000000001', 'Packing 6', 6, true)
on conflict (roster_id, name) do nothing;
