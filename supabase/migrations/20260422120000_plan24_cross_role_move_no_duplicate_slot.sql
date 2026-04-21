-- When a scheduled check is reassigned to another role, we clear its schedule link so it
-- does not collide on plan24_events_schedule_occurrence_role_unique. Materialization would
-- then re-insert the vacated (schedule_id, occurrence, old_role) row on every refresh.
-- Record suppressions so plan24_materialize_check_schedules skips those inserts.

create table if not exists public.plan24_check_schedule_occurrence_suppressions (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  schedule_id uuid not null references public.plan24_check_schedules (id) on delete cascade,
  schedule_occurrence_at timestamptz not null,
  schedule_role_name text not null,
  created_at timestamptz not null default now(),
  constraint plan24_check_sched_occ_sup_unique unique (schedule_id, schedule_occurrence_at, schedule_role_name)
);

create index if not exists plan24_check_sched_occ_sup_cell_idx
  on public.plan24_check_schedule_occurrence_suppressions (master_cell_id);

grant select, insert, delete on public.plan24_check_schedule_occurrence_suppressions to authenticated;

alter table public.plan24_check_schedule_occurrence_suppressions enable row level security;

create policy "plan24_check_sched_occ_sup_select_rtt"
  on public.plan24_check_schedule_occurrence_suppressions for select to authenticated
  using (public.app_user_can_access_rtt());

create policy "plan24_check_sched_occ_sup_insert_rtt"
  on public.plan24_check_schedule_occurrence_suppressions for insert to authenticated
  with check (public.app_user_can_access_rtt());

create policy "plan24_check_sched_occ_sup_delete_rtt"
  on public.plan24_check_schedule_occurrence_suppressions for delete to authenticated
  using (public.app_user_can_access_rtt());

-- ---------------------------------------------------------------------------
-- Materialize: skip suppressed (schedule_id, occurrence, schedule_role_name)
-- ---------------------------------------------------------------------------

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
  sched_rec record;
  shift_rec record;
  d date;
  tz text;
  shift_start_at timestamptz;
  shift_end_at timestamptz;
  day_start_at timestamptz;
  day_end_at timestamptz;
  ts timestamptz;
  event_end_at timestamptz;
  dur interval;
  rname text;
  role_names text[];
  inserted_count int := 0;
  tasks jsonb;
  slot_role text;
begin
  if p_from_date is null or p_to_date is null or p_to_date < p_from_date then
    return 0;
  end if;

  for sched_rec in
    select sch.*
    from public.plan24_check_schedules sch
    where sch.master_cell_id = p_master_cell_id
      and sch.state = 'active'
      and sch.starts_on <= p_to_date
      and (sch.ends_on is null or sch.ends_on >= p_from_date)
  loop
    tz := coalesce(nullif(trim(sched_rec.timezone), ''), 'UTC');
    dur := make_interval(mins => greatest(1, sched_rec.duration_minutes));

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
    where t.version_id = sched_rec.template_version_id;
    tasks := coalesce(tasks, '[]'::jsonb);

    select array_agg(sr.role_name order by sr.role_name)
    into role_names
    from public.plan24_check_schedule_roles sr
    where sr.schedule_id = sched_rec.id;

    if coalesce(array_length(role_names, 1), 0) = 0 then
      role_names := array[null::text];
    end if;

    select shf.start_local, shf.end_local
    into shift_rec
    from public.plan24_roster_shifts shf
    join public.plan24_rosters r on r.id = shf.roster_id
    where r.master_cell_id = p_master_cell_id
      and r.is_active = true
      and shf.kind = sched_rec.shift_kind
    order by shf.sort_order
    limit 1;

    if shift_rec.start_local is null then
      continue;
    end if;

    d := greatest(p_from_date, sched_rec.starts_on);
    while d <= least(p_to_date, coalesce(sched_rec.ends_on, p_to_date)) loop
      if public.plan24_check_schedule_matches_day(
        sched_rec.recurrence_kind,
        sched_rec.interval_n,
        sched_rec.weekdays,
        sched_rec.month_day,
        sched_rec.starts_on,
        d
      ) then
        shift_start_at := ((d + shift_rec.start_local)::timestamp) at time zone tz;
        if shift_rec.end_local <= shift_rec.start_local then
          shift_end_at := (((d + 1) + shift_rec.end_local)::timestamp) at time zone tz;
        else
          shift_end_at := ((d + shift_rec.end_local)::timestamp) at time zone tz;
        end if;

        if sched_rec.recurrence_kind = 'hourly' then
          day_start_at := ((d + sched_rec.start_local_time)::timestamp) at time zone tz;
          if sched_rec.hourly_until_local is null then
            day_end_at := shift_end_at;
          elsif sched_rec.hourly_until_local <= sched_rec.start_local_time then
            day_end_at := (((d + 1) + sched_rec.hourly_until_local)::timestamp) at time zone tz;
          else
            day_end_at := ((d + sched_rec.hourly_until_local)::timestamp) at time zone tz;
          end if;
          day_start_at := greatest(day_start_at, shift_start_at);
          day_end_at := least(day_end_at, shift_end_at);
          ts := day_start_at;
          while ts < day_end_at loop
            event_end_at := least(ts + dur, shift_end_at);
            if event_end_at > ts then
              foreach rname in array role_names loop
                slot_role := coalesce(rname, '');
                if not exists (
                  select 1
                  from public.plan24_check_schedule_occurrence_suppressions sup
                  where sup.schedule_id = sched_rec.id
                    and sup.schedule_occurrence_at = ts
                    and sup.schedule_role_name = slot_role
                ) then
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
                    sched_rec.shift_kind,
                    rname,
                    slot_role,
                    sched_rec.name,
                    'check',
                    'scheduled',
                    ts,
                    event_end_at,
                    'scheduled',
                    tasks,
                    sched_rec.created_by,
                    sched_rec.id,
                    sched_rec.template_version_id,
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
                    and public.plan24_events.deleted_at is null
                    and public.plan24_events.source = 'scheduled';
                end if;
              end loop;
              inserted_count := inserted_count + 1;
            end if;
            ts := ts + make_interval(hours => greatest(1, sched_rec.interval_n));
          end loop;
        else
          ts := ((d + sched_rec.start_local_time)::timestamp) at time zone tz;
          event_end_at := least(ts + dur, shift_end_at);
          if ts >= shift_start_at and ts < shift_end_at and event_end_at > ts then
            foreach rname in array role_names loop
              slot_role := coalesce(rname, '');
              if not exists (
                select 1
                from public.plan24_check_schedule_occurrence_suppressions sup
                where sup.schedule_id = sched_rec.id
                  and sup.schedule_occurrence_at = ts
                  and sup.schedule_role_name = slot_role
              ) then
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
                  sched_rec.shift_kind,
                  rname,
                  slot_role,
                  sched_rec.name,
                  'check',
                  'scheduled',
                  ts,
                  event_end_at,
                  'scheduled',
                  tasks,
                  sched_rec.created_by,
                  sched_rec.id,
                  sched_rec.template_version_id,
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
                  and public.plan24_events.deleted_at is null
                  and public.plan24_events.source = 'scheduled';
              end if;
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
