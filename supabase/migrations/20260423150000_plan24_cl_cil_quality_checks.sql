-- CL / CIL / Quality checks engines mirroring Plan24 checks with separate tables.
-- Includes location targeting (area/equipment/equipment set) and family materializers.

create table if not exists public.master_equipment_groups (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.master_cells (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint master_equipment_groups_cell_name_unique unique (cell_id, name)
);

create index if not exists master_equipment_groups_cell_id_idx on public.master_equipment_groups (cell_id, sort_order, name);

drop trigger if exists master_equipment_groups_updated_at on public.master_equipment_groups;
create trigger master_equipment_groups_updated_at
  before update on public.master_equipment_groups
  for each row execute function public.master_data_touch_updated_at();

create table if not exists public.master_equipment_group_items (
  id uuid primary key default gen_random_uuid(),
  equipment_group_id uuid not null references public.master_equipment_groups (id) on delete cascade,
  equipment_id uuid not null references public.master_equipment (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint master_equipment_group_items_unique unique (equipment_group_id, equipment_id)
);

create index if not exists master_equipment_group_items_group_idx on public.master_equipment_group_items (equipment_group_id);
create index if not exists master_equipment_group_items_equipment_idx on public.master_equipment_group_items (equipment_id);

grant select, insert, update, delete on public.master_equipment_groups to authenticated;
grant select, insert, update, delete on public.master_equipment_group_items to authenticated;

alter table public.master_equipment_groups enable row level security;
alter table public.master_equipment_group_items enable row level security;

drop policy if exists "master_equipment_groups_super_admin" on public.master_equipment_groups;
create policy "master_equipment_groups_super_admin"
  on public.master_equipment_groups for all to authenticated
  using (public.is_app_super_admin()) with check (public.is_app_super_admin());

drop policy if exists "master_equipment_group_items_super_admin" on public.master_equipment_group_items;
create policy "master_equipment_group_items_super_admin"
  on public.master_equipment_group_items for all to authenticated
  using (public.is_app_super_admin()) with check (public.is_app_super_admin());

-- ---------------------------------------------------------------------------
-- CL family
-- ---------------------------------------------------------------------------

create table if not exists public.plan24_cl_check_templates (like public.plan24_check_templates including all);
create unique index if not exists plan24_cl_check_templates_name_unique on public.plan24_cl_check_templates (master_cell_id, name);
create index if not exists plan24_cl_check_templates_cell_idx on public.plan24_cl_check_templates (master_cell_id);
drop trigger if exists plan24_cl_check_templates_touch_updated_at on public.plan24_cl_check_templates;
create trigger plan24_cl_check_templates_touch_updated_at before update on public.plan24_cl_check_templates for each row execute function public.master_data_touch_updated_at();

create table if not exists public.plan24_cl_check_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.plan24_cl_check_templates (id) on delete cascade,
  version_no int not null,
  title text not null,
  notes text,
  state text not null default 'draft' check (state in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan24_cl_check_template_versions_unique unique (template_id, version_no)
);
create unique index if not exists plan24_cl_check_template_versions_one_published on public.plan24_cl_check_template_versions (template_id) where state = 'published';
create index if not exists plan24_cl_check_template_versions_template_idx on public.plan24_cl_check_template_versions (template_id, version_no desc);
drop trigger if exists plan24_cl_check_template_versions_touch_updated_at on public.plan24_cl_check_template_versions;
create trigger plan24_cl_check_template_versions_touch_updated_at before update on public.plan24_cl_check_template_versions for each row execute function public.master_data_touch_updated_at();

create table if not exists public.plan24_cl_check_template_tasks (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.plan24_cl_check_template_versions (id) on delete cascade,
  label text not null,
  required boolean not null default true,
  input_kind text not null default 'pass_fail' check (input_kind in ('pass_fail', 'number', 'range', 'text')),
  min_value numeric,
  max_value numeric,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plan24_cl_check_template_tasks_version_idx on public.plan24_cl_check_template_tasks (version_id, sort_order, label);
drop trigger if exists plan24_cl_check_template_tasks_touch_updated_at on public.plan24_cl_check_template_tasks;
create trigger plan24_cl_check_template_tasks_touch_updated_at before update on public.plan24_cl_check_template_tasks for each row execute function public.master_data_touch_updated_at();

create table if not exists public.plan24_cl_check_schedules (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  template_id uuid not null references public.plan24_cl_check_templates (id) on delete restrict,
  template_version_id uuid not null references public.plan24_cl_check_template_versions (id) on delete restrict,
  area_id uuid references public.master_areas (id) on delete set null,
  equipment_id uuid references public.master_equipment (id) on delete set null,
  equipment_ids uuid[] not null default '{}'::uuid[],
  name text not null,
  shift_kind text not null default 'day',
  recurrence_kind text not null check (recurrence_kind in ('hourly', 'daily', 'weekly', 'monthly')),
  interval_n int not null default 1,
  weekdays int[] not null default '{}'::int[],
  month_day int,
  start_local_time time not null default time '06:00',
  hourly_until_local time,
  duration_minutes int not null default 30,
  starts_on date not null default current_date,
  ends_on date,
  timezone text not null default 'UTC',
  state text not null default 'active' check (state in ('active', 'paused', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plan24_cl_check_schedules_cell_state_idx on public.plan24_cl_check_schedules (master_cell_id, state, starts_on);
drop trigger if exists plan24_cl_check_schedules_touch_updated_at on public.plan24_cl_check_schedules;
create trigger plan24_cl_check_schedules_touch_updated_at before update on public.plan24_cl_check_schedules for each row execute function public.master_data_touch_updated_at();

create table if not exists public.plan24_cl_check_schedule_roles (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.plan24_cl_check_schedules (id) on delete cascade,
  role_name text not null,
  created_at timestamptz not null default now(),
  constraint plan24_cl_check_schedule_roles_unique unique (schedule_id, role_name)
);
create index if not exists plan24_cl_check_schedule_roles_schedule_idx on public.plan24_cl_check_schedule_roles (schedule_id);

-- ---------------------------------------------------------------------------
-- CIL family
-- ---------------------------------------------------------------------------

create table if not exists public.plan24_cil_check_templates (like public.plan24_cl_check_templates including all);
create unique index if not exists plan24_cil_check_templates_name_unique on public.plan24_cil_check_templates (master_cell_id, name);
create index if not exists plan24_cil_check_templates_cell_idx on public.plan24_cil_check_templates (master_cell_id);
drop trigger if exists plan24_cil_check_templates_touch_updated_at on public.plan24_cil_check_templates;
create trigger plan24_cil_check_templates_touch_updated_at before update on public.plan24_cil_check_templates for each row execute function public.master_data_touch_updated_at();

create table if not exists public.plan24_cil_check_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.plan24_cil_check_templates (id) on delete cascade,
  version_no int not null,
  title text not null,
  notes text,
  state text not null default 'draft' check (state in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan24_cil_check_template_versions_unique unique (template_id, version_no)
);
create unique index if not exists plan24_cil_check_template_versions_one_published on public.plan24_cil_check_template_versions (template_id) where state = 'published';
create index if not exists plan24_cil_check_template_versions_template_idx on public.plan24_cil_check_template_versions (template_id, version_no desc);
drop trigger if exists plan24_cil_check_template_versions_touch_updated_at on public.plan24_cil_check_template_versions;
create trigger plan24_cil_check_template_versions_touch_updated_at before update on public.plan24_cil_check_template_versions for each row execute function public.master_data_touch_updated_at();

create table if not exists public.plan24_cil_check_template_tasks (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.plan24_cil_check_template_versions (id) on delete cascade,
  label text not null,
  required boolean not null default true,
  input_kind text not null default 'pass_fail' check (input_kind in ('pass_fail', 'number', 'range', 'text')),
  min_value numeric,
  max_value numeric,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plan24_cil_check_template_tasks_version_idx on public.plan24_cil_check_template_tasks (version_id, sort_order, label);
drop trigger if exists plan24_cil_check_template_tasks_touch_updated_at on public.plan24_cil_check_template_tasks;
create trigger plan24_cil_check_template_tasks_touch_updated_at before update on public.plan24_cil_check_template_tasks for each row execute function public.master_data_touch_updated_at();

create table if not exists public.plan24_cil_check_schedules (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  template_id uuid not null references public.plan24_cil_check_templates (id) on delete restrict,
  template_version_id uuid not null references public.plan24_cil_check_template_versions (id) on delete restrict,
  area_id uuid references public.master_areas (id) on delete set null,
  equipment_id uuid references public.master_equipment (id) on delete set null,
  equipment_ids uuid[] not null default '{}'::uuid[],
  name text not null,
  shift_kind text not null default 'day',
  recurrence_kind text not null check (recurrence_kind in ('hourly', 'daily', 'weekly', 'monthly')),
  interval_n int not null default 1,
  weekdays int[] not null default '{}'::int[],
  month_day int,
  start_local_time time not null default time '06:00',
  hourly_until_local time,
  duration_minutes int not null default 30,
  starts_on date not null default current_date,
  ends_on date,
  timezone text not null default 'UTC',
  state text not null default 'active' check (state in ('active', 'paused', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plan24_cil_check_schedules_cell_state_idx on public.plan24_cil_check_schedules (master_cell_id, state, starts_on);
drop trigger if exists plan24_cil_check_schedules_touch_updated_at on public.plan24_cil_check_schedules;
create trigger plan24_cil_check_schedules_touch_updated_at before update on public.plan24_cil_check_schedules for each row execute function public.master_data_touch_updated_at();

create table if not exists public.plan24_cil_check_schedule_roles (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.plan24_cil_check_schedules (id) on delete cascade,
  role_name text not null,
  created_at timestamptz not null default now(),
  constraint plan24_cil_check_schedule_roles_unique unique (schedule_id, role_name)
);
create index if not exists plan24_cil_check_schedule_roles_schedule_idx on public.plan24_cil_check_schedule_roles (schedule_id);

-- ---------------------------------------------------------------------------
-- Quality family
-- ---------------------------------------------------------------------------

create table if not exists public.plan24_quality_check_templates (like public.plan24_cl_check_templates including all);
create unique index if not exists plan24_quality_check_templates_name_unique on public.plan24_quality_check_templates (master_cell_id, name);
create index if not exists plan24_quality_check_templates_cell_idx on public.plan24_quality_check_templates (master_cell_id);
drop trigger if exists plan24_quality_check_templates_touch_updated_at on public.plan24_quality_check_templates;
create trigger plan24_quality_check_templates_touch_updated_at before update on public.plan24_quality_check_templates for each row execute function public.master_data_touch_updated_at();

create table if not exists public.plan24_quality_check_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.plan24_quality_check_templates (id) on delete cascade,
  version_no int not null,
  title text not null,
  notes text,
  state text not null default 'draft' check (state in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan24_quality_check_template_versions_unique unique (template_id, version_no)
);
create unique index if not exists plan24_quality_check_template_versions_one_published on public.plan24_quality_check_template_versions (template_id) where state = 'published';
create index if not exists plan24_quality_check_template_versions_template_idx on public.plan24_quality_check_template_versions (template_id, version_no desc);
drop trigger if exists plan24_quality_check_template_versions_touch_updated_at on public.plan24_quality_check_template_versions;
create trigger plan24_quality_check_template_versions_touch_updated_at before update on public.plan24_quality_check_template_versions for each row execute function public.master_data_touch_updated_at();

create table if not exists public.plan24_quality_check_template_tasks (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.plan24_quality_check_template_versions (id) on delete cascade,
  label text not null,
  required boolean not null default true,
  input_kind text not null default 'pass_fail' check (input_kind in ('pass_fail', 'number', 'range', 'text')),
  min_value numeric,
  max_value numeric,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plan24_quality_check_template_tasks_version_idx on public.plan24_quality_check_template_tasks (version_id, sort_order, label);
drop trigger if exists plan24_quality_check_template_tasks_touch_updated_at on public.plan24_quality_check_template_tasks;
create trigger plan24_quality_check_template_tasks_touch_updated_at before update on public.plan24_quality_check_template_tasks for each row execute function public.master_data_touch_updated_at();

create table if not exists public.plan24_quality_check_schedules (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  template_id uuid not null references public.plan24_quality_check_templates (id) on delete restrict,
  template_version_id uuid not null references public.plan24_quality_check_template_versions (id) on delete restrict,
  area_id uuid references public.master_areas (id) on delete set null,
  equipment_id uuid references public.master_equipment (id) on delete set null,
  equipment_ids uuid[] not null default '{}'::uuid[],
  name text not null,
  shift_kind text not null default 'day',
  recurrence_kind text not null check (recurrence_kind in ('hourly', 'daily', 'weekly', 'monthly')),
  interval_n int not null default 1,
  weekdays int[] not null default '{}'::int[],
  month_day int,
  start_local_time time not null default time '06:00',
  hourly_until_local time,
  duration_minutes int not null default 30,
  starts_on date not null default current_date,
  ends_on date,
  timezone text not null default 'UTC',
  state text not null default 'active' check (state in ('active', 'paused', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plan24_quality_check_schedules_cell_state_idx on public.plan24_quality_check_schedules (master_cell_id, state, starts_on);
drop trigger if exists plan24_quality_check_schedules_touch_updated_at on public.plan24_quality_check_schedules;
create trigger plan24_quality_check_schedules_touch_updated_at before update on public.plan24_quality_check_schedules for each row execute function public.master_data_touch_updated_at();

create table if not exists public.plan24_quality_check_schedule_roles (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.plan24_quality_check_schedules (id) on delete cascade,
  role_name text not null,
  created_at timestamptz not null default now(),
  constraint plan24_quality_check_schedule_roles_unique unique (schedule_id, role_name)
);
create index if not exists plan24_quality_check_schedule_roles_schedule_idx on public.plan24_quality_check_schedule_roles (schedule_id);

-- ---------------------------------------------------------------------------
-- RLS (admin all / rtt read)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'plan24_cl_check_templates',
    'plan24_cl_check_template_versions',
    'plan24_cl_check_template_tasks',
    'plan24_cl_check_schedules',
    'plan24_cl_check_schedule_roles',
    'plan24_cil_check_templates',
    'plan24_cil_check_template_versions',
    'plan24_cil_check_template_tasks',
    'plan24_cil_check_schedules',
    'plan24_cil_check_schedule_roles',
    'plan24_quality_check_templates',
    'plan24_quality_check_template_versions',
    'plan24_quality_check_template_tasks',
    'plan24_quality_check_schedules',
    'plan24_quality_check_schedule_roles'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_select_rtt" on public.%I', t, t);
    execute format('create policy "%s_select_rtt" on public.%I for select to authenticated using (public.app_user_can_access_rtt())', t, t);
    execute format('drop policy if exists "%s_admin_all" on public.%I', t, t);
    execute format('create policy "%s_admin_all" on public.%I for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin())', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Family publish + reset + materialize wrappers
-- ---------------------------------------------------------------------------

create or replace function public.plan24_publish_cl_check_template_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_template_id uuid;
begin
  if not public.is_app_admin() then raise exception 'Only admins can publish template versions.'; end if;
  select template_id into v_template_id from public.plan24_cl_check_template_versions where id = p_version_id;
  if v_template_id is null then raise exception 'Template version not found.'; end if;
  update public.plan24_cl_check_template_versions set state = 'archived' where template_id = v_template_id and state = 'published' and id <> p_version_id;
  update public.plan24_cl_check_template_versions set state = 'published' where id = p_version_id;
end;
$$;
grant execute on function public.plan24_publish_cl_check_template_version(uuid) to authenticated;

create or replace function public.plan24_publish_cil_check_template_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_template_id uuid;
begin
  if not public.is_app_admin() then raise exception 'Only admins can publish template versions.'; end if;
  select template_id into v_template_id from public.plan24_cil_check_template_versions where id = p_version_id;
  if v_template_id is null then raise exception 'Template version not found.'; end if;
  update public.plan24_cil_check_template_versions set state = 'archived' where template_id = v_template_id and state = 'published' and id <> p_version_id;
  update public.plan24_cil_check_template_versions set state = 'published' where id = p_version_id;
end;
$$;
grant execute on function public.plan24_publish_cil_check_template_version(uuid) to authenticated;

create or replace function public.plan24_publish_quality_check_template_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_template_id uuid;
begin
  if not public.is_app_admin() then raise exception 'Only admins can publish template versions.'; end if;
  select template_id into v_template_id from public.plan24_quality_check_template_versions where id = p_version_id;
  if v_template_id is null then raise exception 'Template version not found.'; end if;
  update public.plan24_quality_check_template_versions set state = 'archived' where template_id = v_template_id and state = 'published' and id <> p_version_id;
  update public.plan24_quality_check_template_versions set state = 'published' where id = p_version_id;
end;
$$;
grant execute on function public.plan24_publish_quality_check_template_version(uuid) to authenticated;

create or replace function public.plan24_reset_cl_check_schedule_future_events(
  p_schedule_id uuid,
  p_from_date date default current_date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int := 0;
begin
  delete from public.plan24_events e
  where e.schedule_id = p_schedule_id
    and e.plan_date >= p_from_date
    and e.status = 'scheduled'
    and e.event_type = 'cl_check';
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.plan24_reset_cl_check_schedule_future_events(uuid, date) to authenticated;

create or replace function public.plan24_reset_cil_check_schedule_future_events(
  p_schedule_id uuid,
  p_from_date date default current_date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int := 0;
begin
  delete from public.plan24_events e
  where e.schedule_id = p_schedule_id
    and e.plan_date >= p_from_date
    and e.status = 'scheduled'
    and e.event_type = 'cil_check';
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.plan24_reset_cil_check_schedule_future_events(uuid, date) to authenticated;

create or replace function public.plan24_reset_quality_check_schedule_future_events(
  p_schedule_id uuid,
  p_from_date date default current_date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int := 0;
begin
  delete from public.plan24_events e
  where e.schedule_id = p_schedule_id
    and e.plan_date >= p_from_date
    and e.status = 'scheduled'
    and e.event_type = 'quality_check';
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.plan24_reset_quality_check_schedule_future_events(uuid, date) to authenticated;

create or replace function public.plan24_materialize_cl_check_schedules(
  p_master_cell_id uuid,
  p_from_date date,
  p_to_date date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  sh record;
  d date;
  tz text;
  shift_start_at timestamptz;
  shift_end_at timestamptz;
  day_start_at timestamptz;
  day_end_at timestamptz;
  ts timestamptz;
  dur interval;
  rname text;
  role_names text[];
  inserted_count int := 0;
  tasks jsonb;
begin
  if p_from_date is null or p_to_date is null or p_to_date < p_from_date then return 0; end if;
  for s in
    select sch.* from public.plan24_cl_check_schedules sch
    where sch.master_cell_id = p_master_cell_id
      and sch.state = 'active'
      and sch.starts_on <= p_to_date
      and (sch.ends_on is null or sch.ends_on >= p_from_date)
  loop
    tz := coalesce(nullif(trim(s.timezone), ''), 'UTC');
    dur := make_interval(mins => greatest(1, s.duration_minutes));
    select jsonb_agg(
      jsonb_build_object('id', t.id::text, 'label', t.label, 'done', false, 'required', t.required, 'input_kind', t.input_kind, 'min_value', t.min_value, 'max_value', t.max_value)
      order by t.sort_order, t.label
    ) into tasks
    from public.plan24_cl_check_template_tasks t
    where t.version_id = s.template_version_id;
    tasks := coalesce(tasks, '[]'::jsonb);
    select array_agg(sr.role_name order by sr.role_name) into role_names from public.plan24_cl_check_schedule_roles sr where sr.schedule_id = s.id;
    if coalesce(array_length(role_names, 1), 0) = 0 then role_names := array[null::text]; end if;
    select shf.start_local, shf.end_local into sh
    from public.plan24_roster_shifts shf
    join public.plan24_rosters r on r.id = shf.roster_id
    where r.master_cell_id = p_master_cell_id and r.is_active = true and shf.kind = s.shift_kind
    order by shf.sort_order limit 1;
    if sh.start_local is null then continue; end if;
    d := greatest(p_from_date, s.starts_on);
    while d <= least(p_to_date, coalesce(s.ends_on, p_to_date)) loop
      if public.plan24_check_schedule_matches_day(s.recurrence_kind, s.interval_n, s.weekdays, s.month_day, s.starts_on, d) then
        shift_start_at := ((d + sh.start_local)::timestamp) at time zone tz;
        if sh.end_local <= sh.start_local then shift_end_at := (((d + 1) + sh.end_local)::timestamp) at time zone tz; else shift_end_at := ((d + sh.end_local)::timestamp) at time zone tz; end if;
        if s.recurrence_kind = 'hourly' then
          day_start_at := ((d + s.start_local_time)::timestamp) at time zone tz;
          if s.hourly_until_local is null then day_end_at := shift_end_at;
          elsif s.hourly_until_local <= s.start_local_time then day_end_at := (((d + 1) + s.hourly_until_local)::timestamp) at time zone tz;
          else day_end_at := ((d + s.hourly_until_local)::timestamp) at time zone tz; end if;
          day_start_at := greatest(day_start_at, shift_start_at);
          day_end_at := least(day_end_at, shift_end_at);
          ts := day_start_at;
          while ts < day_end_at loop
            foreach rname in array role_names loop
              insert into public.plan24_events (
                master_cell_id, roster_id, plan_date, shift_kind, role_name, schedule_role_name,
                title, event_type, source, start_at, end_at, status, sub_tasks, created_by, schedule_id, template_version_id, schedule_occurrence_at
              )
              values (
                p_master_cell_id, null, d, s.shift_kind, rname, coalesce(rname, ''), s.name, 'cl_check', 'scheduled',
                ts, least(ts + dur, shift_end_at), 'scheduled', tasks, s.created_by, s.id, s.template_version_id, ts
              )
              on conflict (schedule_id, schedule_occurrence_at, schedule_role_name)
              do update set
                role_name = excluded.role_name, title = excluded.title, template_version_id = excluded.template_version_id,
                sub_tasks = excluded.sub_tasks, end_at = excluded.end_at, shift_kind = excluded.shift_kind, event_type = excluded.event_type
              where public.plan24_events.status = 'scheduled' and public.plan24_events.deleted_at is null;
            end loop;
            inserted_count := inserted_count + 1;
            ts := ts + make_interval(hours => greatest(1, s.interval_n));
          end loop;
        else
          ts := ((d + s.start_local_time)::timestamp) at time zone tz;
          if ts >= shift_start_at and ts < shift_end_at then
            foreach rname in array role_names loop
              insert into public.plan24_events (
                master_cell_id, roster_id, plan_date, shift_kind, role_name, schedule_role_name,
                title, event_type, source, start_at, end_at, status, sub_tasks, created_by, schedule_id, template_version_id, schedule_occurrence_at
              )
              values (
                p_master_cell_id, null, d, s.shift_kind, rname, coalesce(rname, ''), s.name, 'cl_check', 'scheduled',
                ts, least(ts + dur, shift_end_at), 'scheduled', tasks, s.created_by, s.id, s.template_version_id, ts
              )
              on conflict (schedule_id, schedule_occurrence_at, schedule_role_name)
              do update set
                role_name = excluded.role_name, title = excluded.title, template_version_id = excluded.template_version_id,
                sub_tasks = excluded.sub_tasks, end_at = excluded.end_at, shift_kind = excluded.shift_kind, event_type = excluded.event_type
              where public.plan24_events.status = 'scheduled' and public.plan24_events.deleted_at is null;
            end loop;
            inserted_count := inserted_count + 1;
          end if;
        end if;
      end if;
      d := d + 1;
    end loop;
  end loop;
  return inserted_count;
end;
$$;
grant execute on function public.plan24_materialize_cl_check_schedules(uuid, date, date) to authenticated;

create or replace function public.plan24_materialize_cil_check_schedules(
  p_master_cell_id uuid,
  p_from_date date,
  p_to_date date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  sh record;
  d date;
  tz text;
  shift_start_at timestamptz;
  shift_end_at timestamptz;
  day_start_at timestamptz;
  day_end_at timestamptz;
  ts timestamptz;
  dur interval;
  rname text;
  role_names text[];
  inserted_count int := 0;
  tasks jsonb;
begin
  if p_from_date is null or p_to_date is null or p_to_date < p_from_date then return 0; end if;
  for s in
    select sch.* from public.plan24_cil_check_schedules sch
    where sch.master_cell_id = p_master_cell_id
      and sch.state = 'active'
      and sch.starts_on <= p_to_date
      and (sch.ends_on is null or sch.ends_on >= p_from_date)
  loop
    tz := coalesce(nullif(trim(s.timezone), ''), 'UTC');
    dur := make_interval(mins => greatest(1, s.duration_minutes));
    select jsonb_agg(
      jsonb_build_object('id', t.id::text, 'label', t.label, 'done', false, 'required', t.required, 'input_kind', t.input_kind, 'min_value', t.min_value, 'max_value', t.max_value)
      order by t.sort_order, t.label
    ) into tasks
    from public.plan24_cil_check_template_tasks t
    where t.version_id = s.template_version_id;
    tasks := coalesce(tasks, '[]'::jsonb);
    select array_agg(sr.role_name order by sr.role_name) into role_names from public.plan24_cil_check_schedule_roles sr where sr.schedule_id = s.id;
    if coalesce(array_length(role_names, 1), 0) = 0 then role_names := array[null::text]; end if;
    select shf.start_local, shf.end_local into sh
    from public.plan24_roster_shifts shf
    join public.plan24_rosters r on r.id = shf.roster_id
    where r.master_cell_id = p_master_cell_id and r.is_active = true and shf.kind = s.shift_kind
    order by shf.sort_order limit 1;
    if sh.start_local is null then continue; end if;
    d := greatest(p_from_date, s.starts_on);
    while d <= least(p_to_date, coalesce(s.ends_on, p_to_date)) loop
      if public.plan24_check_schedule_matches_day(s.recurrence_kind, s.interval_n, s.weekdays, s.month_day, s.starts_on, d) then
        shift_start_at := ((d + sh.start_local)::timestamp) at time zone tz;
        if sh.end_local <= sh.start_local then shift_end_at := (((d + 1) + sh.end_local)::timestamp) at time zone tz; else shift_end_at := ((d + sh.end_local)::timestamp) at time zone tz; end if;
        if s.recurrence_kind = 'hourly' then
          day_start_at := ((d + s.start_local_time)::timestamp) at time zone tz;
          if s.hourly_until_local is null then day_end_at := shift_end_at;
          elsif s.hourly_until_local <= s.start_local_time then day_end_at := (((d + 1) + s.hourly_until_local)::timestamp) at time zone tz;
          else day_end_at := ((d + s.hourly_until_local)::timestamp) at time zone tz; end if;
          day_start_at := greatest(day_start_at, shift_start_at);
          day_end_at := least(day_end_at, shift_end_at);
          ts := day_start_at;
          while ts < day_end_at loop
            foreach rname in array role_names loop
              insert into public.plan24_events (
                master_cell_id, roster_id, plan_date, shift_kind, role_name, schedule_role_name,
                title, event_type, source, start_at, end_at, status, sub_tasks, created_by, schedule_id, template_version_id, schedule_occurrence_at
              )
              values (
                p_master_cell_id, null, d, s.shift_kind, rname, coalesce(rname, ''), s.name, 'cil_check', 'scheduled',
                ts, least(ts + dur, shift_end_at), 'scheduled', tasks, s.created_by, s.id, s.template_version_id, ts
              )
              on conflict (schedule_id, schedule_occurrence_at, schedule_role_name)
              do update set
                role_name = excluded.role_name, title = excluded.title, template_version_id = excluded.template_version_id,
                sub_tasks = excluded.sub_tasks, end_at = excluded.end_at, shift_kind = excluded.shift_kind, event_type = excluded.event_type
              where public.plan24_events.status = 'scheduled' and public.plan24_events.deleted_at is null;
            end loop;
            inserted_count := inserted_count + 1;
            ts := ts + make_interval(hours => greatest(1, s.interval_n));
          end loop;
        else
          ts := ((d + s.start_local_time)::timestamp) at time zone tz;
          if ts >= shift_start_at and ts < shift_end_at then
            foreach rname in array role_names loop
              insert into public.plan24_events (
                master_cell_id, roster_id, plan_date, shift_kind, role_name, schedule_role_name,
                title, event_type, source, start_at, end_at, status, sub_tasks, created_by, schedule_id, template_version_id, schedule_occurrence_at
              )
              values (
                p_master_cell_id, null, d, s.shift_kind, rname, coalesce(rname, ''), s.name, 'cil_check', 'scheduled',
                ts, least(ts + dur, shift_end_at), 'scheduled', tasks, s.created_by, s.id, s.template_version_id, ts
              )
              on conflict (schedule_id, schedule_occurrence_at, schedule_role_name)
              do update set
                role_name = excluded.role_name, title = excluded.title, template_version_id = excluded.template_version_id,
                sub_tasks = excluded.sub_tasks, end_at = excluded.end_at, shift_kind = excluded.shift_kind, event_type = excluded.event_type
              where public.plan24_events.status = 'scheduled' and public.plan24_events.deleted_at is null;
            end loop;
            inserted_count := inserted_count + 1;
          end if;
        end if;
      end if;
      d := d + 1;
    end loop;
  end loop;
  return inserted_count;
end;
$$;
grant execute on function public.plan24_materialize_cil_check_schedules(uuid, date, date) to authenticated;

create or replace function public.plan24_materialize_quality_check_schedules(
  p_master_cell_id uuid,
  p_from_date date,
  p_to_date date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  sh record;
  d date;
  tz text;
  shift_start_at timestamptz;
  shift_end_at timestamptz;
  day_start_at timestamptz;
  day_end_at timestamptz;
  ts timestamptz;
  dur interval;
  rname text;
  role_names text[];
  inserted_count int := 0;
  tasks jsonb;
begin
  if p_from_date is null or p_to_date is null or p_to_date < p_from_date then return 0; end if;
  for s in
    select sch.* from public.plan24_quality_check_schedules sch
    where sch.master_cell_id = p_master_cell_id
      and sch.state = 'active'
      and sch.starts_on <= p_to_date
      and (sch.ends_on is null or sch.ends_on >= p_from_date)
  loop
    tz := coalesce(nullif(trim(s.timezone), ''), 'UTC');
    dur := make_interval(mins => greatest(1, s.duration_minutes));
    select jsonb_agg(
      jsonb_build_object('id', t.id::text, 'label', t.label, 'done', false, 'required', t.required, 'input_kind', t.input_kind, 'min_value', t.min_value, 'max_value', t.max_value)
      order by t.sort_order, t.label
    ) into tasks
    from public.plan24_quality_check_template_tasks t
    where t.version_id = s.template_version_id;
    tasks := coalesce(tasks, '[]'::jsonb);
    select array_agg(sr.role_name order by sr.role_name) into role_names from public.plan24_quality_check_schedule_roles sr where sr.schedule_id = s.id;
    if coalesce(array_length(role_names, 1), 0) = 0 then role_names := array[null::text]; end if;
    select shf.start_local, shf.end_local into sh
    from public.plan24_roster_shifts shf
    join public.plan24_rosters r on r.id = shf.roster_id
    where r.master_cell_id = p_master_cell_id and r.is_active = true and shf.kind = s.shift_kind
    order by shf.sort_order limit 1;
    if sh.start_local is null then continue; end if;
    d := greatest(p_from_date, s.starts_on);
    while d <= least(p_to_date, coalesce(s.ends_on, p_to_date)) loop
      if public.plan24_check_schedule_matches_day(s.recurrence_kind, s.interval_n, s.weekdays, s.month_day, s.starts_on, d) then
        shift_start_at := ((d + sh.start_local)::timestamp) at time zone tz;
        if sh.end_local <= sh.start_local then shift_end_at := (((d + 1) + sh.end_local)::timestamp) at time zone tz; else shift_end_at := ((d + sh.end_local)::timestamp) at time zone tz; end if;
        if s.recurrence_kind = 'hourly' then
          day_start_at := ((d + s.start_local_time)::timestamp) at time zone tz;
          if s.hourly_until_local is null then day_end_at := shift_end_at;
          elsif s.hourly_until_local <= s.start_local_time then day_end_at := (((d + 1) + s.hourly_until_local)::timestamp) at time zone tz;
          else day_end_at := ((d + s.hourly_until_local)::timestamp) at time zone tz; end if;
          day_start_at := greatest(day_start_at, shift_start_at);
          day_end_at := least(day_end_at, shift_end_at);
          ts := day_start_at;
          while ts < day_end_at loop
            foreach rname in array role_names loop
              insert into public.plan24_events (
                master_cell_id, roster_id, plan_date, shift_kind, role_name, schedule_role_name,
                title, event_type, source, start_at, end_at, status, sub_tasks, created_by, schedule_id, template_version_id, schedule_occurrence_at
              )
              values (
                p_master_cell_id, null, d, s.shift_kind, rname, coalesce(rname, ''), s.name, 'quality_check', 'scheduled',
                ts, least(ts + dur, shift_end_at), 'scheduled', tasks, s.created_by, s.id, s.template_version_id, ts
              )
              on conflict (schedule_id, schedule_occurrence_at, schedule_role_name)
              do update set
                role_name = excluded.role_name, title = excluded.title, template_version_id = excluded.template_version_id,
                sub_tasks = excluded.sub_tasks, end_at = excluded.end_at, shift_kind = excluded.shift_kind, event_type = excluded.event_type
              where public.plan24_events.status = 'scheduled' and public.plan24_events.deleted_at is null;
            end loop;
            inserted_count := inserted_count + 1;
            ts := ts + make_interval(hours => greatest(1, s.interval_n));
          end loop;
        else
          ts := ((d + s.start_local_time)::timestamp) at time zone tz;
          if ts >= shift_start_at and ts < shift_end_at then
            foreach rname in array role_names loop
              insert into public.plan24_events (
                master_cell_id, roster_id, plan_date, shift_kind, role_name, schedule_role_name,
                title, event_type, source, start_at, end_at, status, sub_tasks, created_by, schedule_id, template_version_id, schedule_occurrence_at
              )
              values (
                p_master_cell_id, null, d, s.shift_kind, rname, coalesce(rname, ''), s.name, 'quality_check', 'scheduled',
                ts, least(ts + dur, shift_end_at), 'scheduled', tasks, s.created_by, s.id, s.template_version_id, ts
              )
              on conflict (schedule_id, schedule_occurrence_at, schedule_role_name)
              do update set
                role_name = excluded.role_name, title = excluded.title, template_version_id = excluded.template_version_id,
                sub_tasks = excluded.sub_tasks, end_at = excluded.end_at, shift_kind = excluded.shift_kind, event_type = excluded.event_type
              where public.plan24_events.status = 'scheduled' and public.plan24_events.deleted_at is null;
            end loop;
            inserted_count := inserted_count + 1;
          end if;
        end if;
      end if;
      d := d + 1;
    end loop;
  end loop;
  return inserted_count;
end;
$$;
grant execute on function public.plan24_materialize_quality_check_schedules(uuid, date, date) to authenticated;
