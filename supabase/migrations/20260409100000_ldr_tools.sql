-- LDR tools: sites, roster people (subset of main people), activities, events, assignments.

-- ---------------------------------------------------------------------------
-- Access helpers (security definer reads profiles)
-- ---------------------------------------------------------------------------

create or replace function public.can_access_ldr_tools()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.can_access_ldr_tools from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

grant execute on function public.can_access_ldr_tools() to authenticated;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

do $e$
begin
  create type public.ldr_rag_status as enum ('green', 'yellow', 'red');
exception
  when duplicate_object then null;
end $e$;

grant usage on type public.ldr_rag_status to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.ldr_sites (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users on delete set null,
  updated_by uuid references auth.users on delete set null,
  constraint ldr_sites_code_unique unique (code)
);

create table if not exists public.ldr_people (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people on delete cascade,
  site_id uuid not null references public.ldr_sites on delete restrict,
  status text not null default 'available'
    check (status in ('available', 'leave', 'training', 'travel', 'sick', 'off_site')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users on delete set null,
  updated_by uuid references auth.users on delete set null,
  constraint ldr_people_person_unique unique (person_id)
);

create index if not exists ldr_people_site_id_idx on public.ldr_people (site_id);

create table if not exists public.ldr_activities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users on delete set null,
  updated_by uuid references auth.users on delete set null,
  constraint ldr_activities_name_unique unique (name)
);

create table if not exists public.ldr_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  site_id uuid not null references public.ldr_sites on delete restrict,
  start_date date not null,
  end_date date not null,
  color text not null default '#6366f1',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users on delete set null,
  updated_by uuid references auth.users on delete set null,
  constraint ldr_events_date_order check (end_date >= start_date)
);

create index if not exists ldr_events_dates_idx on public.ldr_events (start_date, end_date);
create index if not exists ldr_events_site_id_idx on public.ldr_events (site_id);

create table if not exists public.ldr_assignments (
  id uuid primary key default gen_random_uuid(),
  ldr_person_id uuid not null references public.ldr_people on delete cascade,
  activity_id uuid not null references public.ldr_activities on delete cascade,
  assignment_date date not null,
  rag_status public.ldr_rag_status not null default 'green',
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users on delete set null,
  updated_by uuid references auth.users on delete set null,
  constraint ldr_assignments_unique_cell unique (ldr_person_id, activity_id, assignment_date)
);

create index if not exists ldr_assignments_date_idx on public.ldr_assignments (assignment_date);
create index if not exists ldr_assignments_activity_idx on public.ldr_assignments (activity_id);

-- ---------------------------------------------------------------------------
-- Audit: updated_at + updated_by (created_* on insert)
-- ---------------------------------------------------------------------------

create or replace function public.ldr_touch_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();
    new.created_by := coalesce(new.created_by, auth.uid());
    new.updated_by := coalesce(new.updated_by, auth.uid());
  else
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists ldr_sites_touch_audit on public.ldr_sites;
create trigger ldr_sites_touch_audit
  before insert or update on public.ldr_sites
  for each row execute function public.ldr_touch_audit();

drop trigger if exists ldr_people_touch_audit on public.ldr_people;
create trigger ldr_people_touch_audit
  before insert or update on public.ldr_people
  for each row execute function public.ldr_touch_audit();

drop trigger if exists ldr_activities_touch_audit on public.ldr_activities;
create trigger ldr_activities_touch_audit
  before insert or update on public.ldr_activities
  for each row execute function public.ldr_touch_audit();

drop trigger if exists ldr_events_touch_audit on public.ldr_events;
create trigger ldr_events_touch_audit
  before insert or update on public.ldr_events
  for each row execute function public.ldr_touch_audit();

drop trigger if exists ldr_assignments_touch_audit on public.ldr_assignments;
create trigger ldr_assignments_touch_audit
  before insert or update on public.ldr_assignments
  for each row execute function public.ldr_touch_audit();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.ldr_sites to authenticated;
grant select, insert, update, delete on public.ldr_people to authenticated;
grant select, insert, update, delete on public.ldr_activities to authenticated;
grant select, insert, update, delete on public.ldr_events to authenticated;
grant select, insert, update, delete on public.ldr_assignments to authenticated;

alter table public.ldr_sites enable row level security;
alter table public.ldr_people enable row level security;
alter table public.ldr_activities enable row level security;
alter table public.ldr_events enable row level security;
alter table public.ldr_assignments enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

-- Sites: read for anyone with LDR access; write super_admin only
create policy "ldr_sites_select"
  on public.ldr_sites for select to authenticated
  using (public.can_access_ldr_tools());

create policy "ldr_sites_write_super"
  on public.ldr_sites for all to authenticated
  using (public.is_app_super_admin()) with check (public.is_app_super_admin());

-- People / activities: admin module (app admin)
create policy "ldr_people_select"
  on public.ldr_people for select to authenticated
  using (public.can_access_ldr_tools());

create policy "ldr_people_write_admin"
  on public.ldr_people for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "ldr_activities_select"
  on public.ldr_activities for select to authenticated
  using (public.can_access_ldr_tools());

create policy "ldr_activities_write_admin"
  on public.ldr_activities for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

-- Events: all LDR users read/write
create policy "ldr_events_select"
  on public.ldr_events for select to authenticated
  using (public.can_access_ldr_tools());

create policy "ldr_events_write_ldr"
  on public.ldr_events for insert to authenticated
  with check (public.can_access_ldr_tools());

create policy "ldr_events_update_ldr"
  on public.ldr_events for update to authenticated
  using (public.can_access_ldr_tools()) with check (public.can_access_ldr_tools());

create policy "ldr_events_delete_ldr"
  on public.ldr_events for delete to authenticated
  using (public.can_access_ldr_tools());

-- Assignments: all LDR users read/write
create policy "ldr_assignments_select"
  on public.ldr_assignments for select to authenticated
  using (public.can_access_ldr_tools());

create policy "ldr_assignments_insert"
  on public.ldr_assignments for insert to authenticated
  with check (public.can_access_ldr_tools());

create policy "ldr_assignments_update"
  on public.ldr_assignments for update to authenticated
  using (public.can_access_ldr_tools()) with check (public.can_access_ldr_tools());

create policy "ldr_assignments_delete"
  on public.ldr_assignments for delete to authenticated
  using (public.can_access_ldr_tools());

-- ---------------------------------------------------------------------------
-- MVP seed: two sites (idempotent by code)
-- ---------------------------------------------------------------------------

insert into public.ldr_sites (code, name, is_active)
select v.code, v.name, true
from (values
  ('SITE_A', 'Site A'),
  ('SITE_B', 'Site B')
) as v(code, name)
where not exists (select 1 from public.ldr_sites s where s.code = v.code);
