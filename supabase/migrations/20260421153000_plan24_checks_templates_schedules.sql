-- Plan 24 RTT checks: admin templates, immutable versions, schedule rules, and event materialization.

-- ---------------------------------------------------------------------------
-- Config tables (admin only)
-- ---------------------------------------------------------------------------

create table public.plan24_check_templates (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  name text not null,
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan24_check_templates_name_unique unique (master_cell_id, name)
);

create index plan24_check_templates_cell_idx on public.plan24_check_templates (master_cell_id);

create trigger plan24_check_templates_touch_updated_at
  before update on public.plan24_check_templates
  for each row execute function public.master_data_touch_updated_at();

create table public.plan24_check_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.plan24_check_templates (id) on delete cascade,
  version_no int not null,
  title text not null,
  notes text,
  state text not null default 'draft' check (state in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan24_check_template_versions_unique unique (template_id, version_no)
);

create index plan24_check_template_versions_template_idx
  on public.plan24_check_template_versions (template_id, version_no desc);

create unique index plan24_check_template_versions_one_published
  on public.plan24_check_template_versions (template_id)
  where state = 'published';

create trigger plan24_check_template_versions_touch_updated_at
  before update on public.plan24_check_template_versions
  for each row execute function public.master_data_touch_updated_at();

create table public.plan24_check_template_tasks (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.plan24_check_template_versions (id) on delete cascade,
  label text not null,
  required boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plan24_check_template_tasks_version_idx
  on public.plan24_check_template_tasks (version_id, sort_order, label);

create trigger plan24_check_template_tasks_touch_updated_at
  before update on public.plan24_check_template_tasks
  for each row execute function public.master_data_touch_updated_at();

create table public.plan24_check_schedules (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  template_id uuid not null references public.plan24_check_templates (id) on delete restrict,
  template_version_id uuid not null references public.plan24_check_template_versions (id) on delete restrict,
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
  updated_at timestamptz not null default now(),
  constraint plan24_check_schedules_interval_ck check (interval_n > 0),
  constraint plan24_check_schedules_duration_ck check (duration_minutes > 0),
  constraint plan24_check_schedules_month_day_ck check (month_day is null or (month_day >= 1 and month_day <= 31)),
  constraint plan24_check_schedules_range_ck check (ends_on is null or ends_on >= starts_on)
);

create index plan24_check_schedules_cell_state_idx
  on public.plan24_check_schedules (master_cell_id, state, starts_on);

create trigger plan24_check_schedules_touch_updated_at
  before update on public.plan24_check_schedules
  for each row execute function public.master_data_touch_updated_at();

create table public.plan24_check_schedule_roles (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.plan24_check_schedules (id) on delete cascade,
  role_name text not null,
  created_at timestamptz not null default now(),
  constraint plan24_check_schedule_roles_unique unique (schedule_id, role_name)
);

create index plan24_check_schedule_roles_schedule_idx
  on public.plan24_check_schedule_roles (schedule_id);

-- ---------------------------------------------------------------------------
-- Event links for schedule instances
-- ---------------------------------------------------------------------------

alter table public.plan24_events
  add column if not exists schedule_id uuid references public.plan24_check_schedules (id) on delete set null,
  add column if not exists template_version_id uuid references public.plan24_check_template_versions (id) on delete set null,
  add column if not exists schedule_occurrence_at timestamptz,
  add column if not exists schedule_role_name text not null default '';

update public.plan24_events
set schedule_role_name = coalesce(role_name, '')
where schedule_role_name is distinct from coalesce(role_name, '');

create unique index if not exists plan24_events_schedule_occurrence_role_unique
  on public.plan24_events (schedule_id, schedule_occurrence_at, schedule_role_name);

create index if not exists plan24_events_schedule_id_idx
  on public.plan24_events (schedule_id, schedule_occurrence_at)
  where schedule_id is not null;

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.plan24_check_templates to authenticated;
grant select, insert, update, delete on public.plan24_check_template_versions to authenticated;
grant select, insert, update, delete on public.plan24_check_template_tasks to authenticated;
grant select, insert, update, delete on public.plan24_check_schedules to authenticated;
grant select, insert, update, delete on public.plan24_check_schedule_roles to authenticated;

alter table public.plan24_check_templates enable row level security;
alter table public.plan24_check_template_versions enable row level security;
alter table public.plan24_check_template_tasks enable row level security;
alter table public.plan24_check_schedules enable row level security;
alter table public.plan24_check_schedule_roles enable row level security;

create policy "plan24_check_templates_select_rtt"
  on public.plan24_check_templates for select to authenticated
  using (public.app_user_can_access_rtt());

create policy "plan24_check_templates_admin_all"
  on public.plan24_check_templates for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "plan24_check_template_versions_select_rtt"
  on public.plan24_check_template_versions for select to authenticated
  using (
    public.app_user_can_access_rtt()
    and exists (
      select 1
      from public.plan24_check_templates t
      where t.id = plan24_check_template_versions.template_id
    )
  );

create policy "plan24_check_template_versions_admin_all"
  on public.plan24_check_template_versions for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "plan24_check_template_tasks_select_rtt"
  on public.plan24_check_template_tasks for select to authenticated
  using (
    public.app_user_can_access_rtt()
    and exists (
      select 1
      from public.plan24_check_template_versions v
      join public.plan24_check_templates t on t.id = v.template_id
      where v.id = plan24_check_template_tasks.version_id
    )
  );

create policy "plan24_check_template_tasks_admin_all"
  on public.plan24_check_template_tasks for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "plan24_check_schedules_select_rtt"
  on public.plan24_check_schedules for select to authenticated
  using (public.app_user_can_access_rtt());

create policy "plan24_check_schedules_admin_all"
  on public.plan24_check_schedules for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "plan24_check_schedule_roles_select_rtt"
  on public.plan24_check_schedule_roles for select to authenticated
  using (
    public.app_user_can_access_rtt()
    and exists (
      select 1
      from public.plan24_check_schedules s
      where s.id = plan24_check_schedule_roles.schedule_id
    )
  );

create policy "plan24_check_schedule_roles_admin_all"
  on public.plan24_check_schedule_roles for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

-- ---------------------------------------------------------------------------
-- Helpers + materialization
-- ---------------------------------------------------------------------------

create or replace function public.plan24_check_schedule_matches_day(
  p_rec_kind text,
  p_interval_n int,
  p_weekdays int[],
  p_month_day int,
  p_starts_on date,
  p_day date
)
returns boolean
language plpgsql
immutable
as $$
declare
  d_diff int;
  wdays int[];
  dow int;
  week_bucket int;
  anchor_day int;
  months_diff int;
begin
  if p_day < p_starts_on then
    return false;
  end if;

  if p_rec_kind = 'daily' then
    d_diff := p_day - p_starts_on;
    return mod(d_diff, greatest(1, p_interval_n)) = 0;
  end if;

  if p_rec_kind = 'weekly' then
    wdays := case
      when coalesce(array_length(p_weekdays, 1), 0) = 0
        then array[extract(dow from p_starts_on)::int]
      else p_weekdays
    end;
    dow := extract(dow from p_day)::int;
    if not (dow = any (wdays)) then
      return false;
    end if;
    d_diff := p_day - p_starts_on;
    week_bucket := floor(d_diff::numeric / 7)::int;
    return mod(week_bucket, greatest(1, p_interval_n)) = 0;
  end if;

  if p_rec_kind = 'monthly' then
    anchor_day := coalesce(p_month_day, extract(day from p_starts_on)::int);
    if extract(day from p_day)::int <> anchor_day then
      return false;
    end if;
    months_diff :=
      (extract(year from p_day)::int - extract(year from p_starts_on)::int) * 12
      + (extract(month from p_day)::int - extract(month from p_starts_on)::int);
    if months_diff < 0 then
      return false;
    end if;
    return mod(months_diff, greatest(1, p_interval_n)) = 0;
  end if;

  if p_rec_kind = 'hourly' then
    if coalesce(array_length(p_weekdays, 1), 0) = 0 then
      return true;
    end if;
    dow := extract(dow from p_day)::int;
    return dow = any (p_weekdays);
  end if;

  return false;
end;
$$;

create or replace function public.plan24_materialize_check_schedules(
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
  if p_from_date is null or p_to_date is null or p_to_date < p_from_date then
    return 0;
  end if;

  for s in
    select s.*
    from public.plan24_check_schedules s
    where s.master_cell_id = p_master_cell_id
      and s.state = 'active'
      and s.starts_on <= p_to_date
      and (s.ends_on is null or s.ends_on >= p_from_date)
  loop
    tz := coalesce(nullif(trim(s.timezone), ''), 'UTC');
    dur := make_interval(mins => greatest(1, s.duration_minutes));

    select jsonb_agg(
      jsonb_build_object(
        'id', t.id::text,
        'label', t.label,
        'done', false,
        'required', t.required
      )
      order by t.sort_order, t.label
    )
    into tasks
    from public.plan24_check_template_tasks t
    where t.version_id = s.template_version_id;
    tasks := coalesce(tasks, '[]'::jsonb);

    select array_agg(sr.role_name order by sr.role_name)
    into role_names
    from public.plan24_check_schedule_roles sr
    where sr.schedule_id = s.id;

    if coalesce(array_length(role_names, 1), 0) = 0 then
      role_names := array[null::text];
    end if;

    select shf.start_local, shf.end_local
    into sh
    from public.plan24_roster_shifts shf
    join public.plan24_rosters r on r.id = shf.roster_id
    where r.master_cell_id = p_master_cell_id
      and r.is_active = true
      and shf.kind = s.shift_kind
    order by shf.sort_order
    limit 1;

    if sh.start_local is null then
      continue;
    end if;

    d := greatest(p_from_date, s.starts_on);
    while d <= least(p_to_date, coalesce(s.ends_on, p_to_date)) loop
      if public.plan24_check_schedule_matches_day(
        s.recurrence_kind,
        s.interval_n,
        s.weekdays,
        s.month_day,
        s.starts_on,
        d
      ) then
        shift_start_at := ((d + sh.start_local)::timestamp) at time zone tz;
        if sh.end_local <= sh.start_local then
          shift_end_at := (((d + 1) + sh.end_local)::timestamp) at time zone tz;
        else
          shift_end_at := ((d + sh.end_local)::timestamp) at time zone tz;
        end if;

        if s.recurrence_kind = 'hourly' then
          day_start_at := ((d + s.start_local_time)::timestamp) at time zone tz;
          if s.hourly_until_local is null then
            day_end_at := shift_end_at;
          elsif s.hourly_until_local <= s.start_local_time then
            day_end_at := (((d + 1) + s.hourly_until_local)::timestamp) at time zone tz;
          else
            day_end_at := ((d + s.hourly_until_local)::timestamp) at time zone tz;
          end if;
          day_start_at := greatest(day_start_at, shift_start_at);
          day_end_at := least(day_end_at, shift_end_at);
          ts := day_start_at;
          while ts < day_end_at loop
            foreach rname in array role_names loop
              insert into public.plan24_events (
                master_cell_id,
                roster_id,
                plan_date,
                shift_kind,
                role_name,
                schedule_role_name,
                title,
                event_type,
                source,
                start_at,
                end_at,
                status,
                sub_tasks,
                created_by,
                schedule_id,
                template_version_id,
                schedule_occurrence_at
              )
              values (
                p_master_cell_id,
                null,
                d,
                s.shift_kind,
                rname,
                coalesce(rname, ''),
                s.name,
                'check',
                'scheduled',
                ts,
                least(ts + dur, shift_end_at),
                'scheduled',
                tasks,
                s.created_by,
                s.id,
                s.template_version_id,
                ts
              )
              on conflict (schedule_id, schedule_occurrence_at, schedule_role_name)
              do update
                set role_name = excluded.role_name,
                    title = excluded.title,
                    template_version_id = excluded.template_version_id,
                    sub_tasks = excluded.sub_tasks,
                    end_at = excluded.end_at,
                    shift_kind = excluded.shift_kind
              where public.plan24_events.status = 'scheduled'
                and public.plan24_events.deleted_at is null;
            end loop;
            inserted_count := inserted_count + 1;
            ts := ts + make_interval(hours => greatest(1, s.interval_n));
          end loop;
        else
          ts := ((d + s.start_local_time)::timestamp) at time zone tz;
          if ts >= shift_start_at and ts < shift_end_at then
            foreach rname in array role_names loop
              insert into public.plan24_events (
                master_cell_id,
                roster_id,
                plan_date,
                shift_kind,
                role_name,
                schedule_role_name,
                title,
                event_type,
                source,
                start_at,
                end_at,
                status,
                sub_tasks,
                created_by,
                schedule_id,
                template_version_id,
                schedule_occurrence_at
              )
              values (
                p_master_cell_id,
                null,
                d,
                s.shift_kind,
                rname,
                coalesce(rname, ''),
                s.name,
                'check',
                'scheduled',
                ts,
                least(ts + dur, shift_end_at),
                'scheduled',
                tasks,
                s.created_by,
                s.id,
                s.template_version_id,
                ts
              )
              on conflict (schedule_id, schedule_occurrence_at, schedule_role_name)
              do update
                set role_name = excluded.role_name,
                    title = excluded.title,
                    template_version_id = excluded.template_version_id,
                    sub_tasks = excluded.sub_tasks,
                    end_at = excluded.end_at,
                    shift_kind = excluded.shift_kind
              where public.plan24_events.status = 'scheduled'
                and public.plan24_events.deleted_at is null;
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

grant execute on function public.plan24_materialize_check_schedules(uuid, date, date) to authenticated;

create or replace function public.plan24_reset_schedule_future_events(
  p_schedule_id uuid,
  p_from_date date default current_date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
begin
  delete from public.plan24_events e
  where e.schedule_id = p_schedule_id
    and e.plan_date >= p_from_date
    and e.status = 'scheduled';
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.plan24_reset_schedule_future_events(uuid, date) to authenticated;

create or replace function public.plan24_publish_template_version(
  p_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_id uuid;
begin
  if not public.is_app_admin() then
    raise exception 'Only admins can publish template versions.';
  end if;

  select template_id into v_template_id
  from public.plan24_check_template_versions
  where id = p_version_id;

  if v_template_id is null then
    raise exception 'Template version not found.';
  end if;

  update public.plan24_check_template_versions
  set state = 'archived'
  where template_id = v_template_id
    and state = 'published'
    and id <> p_version_id;

  update public.plan24_check_template_versions
  set state = 'published'
  where id = p_version_id;
end;
$$;

grant execute on function public.plan24_publish_template_version(uuid) to authenticated;
