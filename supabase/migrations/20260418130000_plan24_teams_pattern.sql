-- Plan 24: Teams, flexible shifts (N per roster), shift pattern rotation.

-- ---------------------------------------------------------------------------
-- 1. Relax shift_kind constraints to support N named shifts
-- ---------------------------------------------------------------------------

-- Drop the hard 'day'/'night' check on plan24_roster_shifts
alter table public.plan24_roster_shifts drop constraint if exists plan24_roster_shifts_kind_check;
alter table public.plan24_roster_shifts drop constraint if exists plan24_roster_shifts_kind_unique;

-- kind becomes a free-text label (e.g. 'day', 'afternoon', 'night')
alter table public.plan24_roster_shifts
  add constraint plan24_roster_shifts_name_unique unique (roster_id, kind);

-- Add display_name for friendlier UI labelling
alter table public.plan24_roster_shifts
  add column if not exists display_name text;

update public.plan24_roster_shifts set display_name = initcap(kind) where display_name is null;

-- ---------------------------------------------------------------------------
-- 2. Teams (shift crews: A, B, C, D …)
-- ---------------------------------------------------------------------------

create table if not exists public.plan24_teams (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.plan24_rosters (id) on delete cascade,
  name text not null,
  color text not null default '#3b82f6',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan24_teams_name_unique unique (roster_id, name)
);

create index if not exists plan24_teams_roster_id_idx on public.plan24_teams (roster_id);

create trigger plan24_teams_touch_updated_at
  before update on public.plan24_teams
  for each row execute function public.master_data_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Shift pattern (rotation matrix)
--    For a roster with pattern_length = 8 and 2 shifts (day/night) and 4 teams:
--    rows describe which team works which shift on each pattern day.
-- ---------------------------------------------------------------------------

alter table public.plan24_rosters
  add column if not exists pattern_length int not null default 8;

alter table public.plan24_rosters
  add column if not exists pattern_start_date date;

create table if not exists public.plan24_pattern_slots (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.plan24_rosters (id) on delete cascade,
  pattern_day int not null,            -- 1-based day index within the pattern
  shift_kind text not null,            -- matches plan24_roster_shifts.kind
  team_id uuid references public.plan24_teams (id) on delete set null,
  constraint plan24_pattern_slots_unique unique (roster_id, pattern_day, shift_kind)
);

create index if not exists plan24_pattern_slots_roster_idx on public.plan24_pattern_slots (roster_id);

-- ---------------------------------------------------------------------------
-- 4. Role default person per team (replaces per-shift defaults)
-- ---------------------------------------------------------------------------

create table if not exists public.plan24_role_team_defaults (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.plan24_roster_roles (id) on delete cascade,
  team_id uuid not null references public.plan24_teams (id) on delete cascade,
  person_id uuid references public.people (id) on delete set null,
  constraint plan24_role_team_defaults_unique unique (role_id, team_id)
);

-- ---------------------------------------------------------------------------
-- 5. Grants & RLS
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.plan24_teams to authenticated;
grant select, insert, update, delete on public.plan24_pattern_slots to authenticated;
grant select, insert, update, delete on public.plan24_role_team_defaults to authenticated;

alter table public.plan24_teams enable row level security;
alter table public.plan24_pattern_slots enable row level security;
alter table public.plan24_role_team_defaults enable row level security;

create policy "plan24_teams_admin_all"
  on public.plan24_teams for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "plan24_pattern_slots_admin_all"
  on public.plan24_pattern_slots for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "plan24_role_team_defaults_admin_all"
  on public.plan24_role_team_defaults for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

-- Read access for RTT users
create policy "plan24_teams_select_rtt"
  on public.plan24_teams for select to authenticated
  using (public.app_user_can_access_rtt());

create policy "plan24_pattern_slots_select_rtt"
  on public.plan24_pattern_slots for select to authenticated
  using (public.app_user_can_access_rtt());

create policy "plan24_role_team_defaults_select_rtt"
  on public.plan24_role_team_defaults for select to authenticated
  using (public.app_user_can_access_rtt());
