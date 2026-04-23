-- Operator "when" condition is defined on CIL template tasks (admin); materialized into sub_tasks.

alter table public.plan24_cil_check_template_tasks
  add column if not exists when_condition text;

alter table public.plan24_cil_check_template_tasks
  drop constraint if exists plan24_cil_check_template_tasks_when_condition_ck;

alter table public.plan24_cil_check_template_tasks
  add constraint plan24_cil_check_template_tasks_when_condition_ck
  check (when_condition is null or when_condition in ('running', 'down', 'other'));

-- Refresh materializer: copy template when_condition into event sub_tasks JSON.
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
  slot_role text;
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
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', t.id::text,
            'label', t.label,
            'done', false,
            'required', t.required,
            'input_kind', t.input_kind,
            'min_value', t.min_value,
            'max_value', t.max_value,
            'standard_description', coalesce(t.standard_description, ''),
            'photo_path', coalesce(t.photo_path, ''),
            'check_types', coalesce(to_jsonb(t.check_types), '[]'::jsonb),
            'when_condition', t.when_condition
          ) order by t.sort_order, t.label
        ), '[]'::jsonb) into tasks
        from public.plan24_cil_check_template_tasks t
        where t.version_id = s.template_version_id
          and public.plan24_check_schedule_matches_day(
            t.recurrence_kind, t.interval_n, t.weekdays, t.month_day, s.starts_on, d
          );
        tasks := coalesce(tasks, '[]'::jsonb);
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
              slot_role := coalesce(rname, '');
              if not exists (
                select 1 from public.plan24_check_schedule_occurrence_suppressions sup
                where sup.schedule_id = s.id
                  and sup.schedule_occurrence_at = ts
                  and sup.schedule_role_name = slot_role
              ) then
                insert into public.plan24_events (
                  master_cell_id, roster_id, plan_date, shift_kind, role_name, schedule_role_name,
                  title, event_type, source, start_at, end_at, status, sub_tasks, created_by, schedule_id, template_version_id, schedule_occurrence_at,
                  area_id, equipment_id, equipment_ids, cil_template_id
                )
                values (
                  p_master_cell_id, null, d, s.shift_kind, rname, coalesce(rname, ''), s.name, 'cil_check', 'scheduled',
                  ts, least(ts + dur, shift_end_at), 'scheduled', tasks, s.created_by, s.id, s.template_version_id, ts,
                  s.area_id, s.equipment_id, coalesce(s.equipment_ids, '{}'::uuid[]), s.template_id
                )
                on conflict (schedule_id, schedule_occurrence_at, schedule_role_name)
                do update set
                  role_name = excluded.role_name, title = excluded.title, template_version_id = excluded.template_version_id,
                  sub_tasks = excluded.sub_tasks, end_at = excluded.end_at, shift_kind = excluded.shift_kind, event_type = excluded.event_type,
                  area_id = excluded.area_id, equipment_id = excluded.equipment_id, equipment_ids = excluded.equipment_ids,
                  cil_template_id = excluded.cil_template_id
                where public.plan24_events.status = 'scheduled' and public.plan24_events.deleted_at is null;
              end if;
            end loop;
            inserted_count := inserted_count + 1;
            ts := ts + make_interval(hours => greatest(1, s.interval_n));
          end loop;
        else
          ts := ((d + s.start_local_time)::timestamp) at time zone tz;
          if ts >= shift_start_at and ts < shift_end_at then
            foreach rname in array role_names loop
              slot_role := coalesce(rname, '');
              if not exists (
                select 1 from public.plan24_check_schedule_occurrence_suppressions sup
                where sup.schedule_id = s.id
                  and sup.schedule_occurrence_at = ts
                  and sup.schedule_role_name = slot_role
              ) then
                insert into public.plan24_events (
                  master_cell_id, roster_id, plan_date, shift_kind, role_name, schedule_role_name,
                  title, event_type, source, start_at, end_at, status, sub_tasks, created_by, schedule_id, template_version_id, schedule_occurrence_at,
                  area_id, equipment_id, equipment_ids, cil_template_id
                )
                values (
                  p_master_cell_id, null, d, s.shift_kind, rname, coalesce(rname, ''), s.name, 'cil_check', 'scheduled',
                  ts, least(ts + dur, shift_end_at), 'scheduled', tasks, s.created_by, s.id, s.template_version_id, ts,
                  s.area_id, s.equipment_id, coalesce(s.equipment_ids, '{}'::uuid[]), s.template_id
                )
                on conflict (schedule_id, schedule_occurrence_at, schedule_role_name)
                do update set
                  role_name = excluded.role_name, title = excluded.title, template_version_id = excluded.template_version_id,
                  sub_tasks = excluded.sub_tasks, end_at = excluded.end_at, shift_kind = excluded.shift_kind, event_type = excluded.event_type,
                  area_id = excluded.area_id, equipment_id = excluded.equipment_id, equipment_ids = excluded.equipment_ids,
                  cil_template_id = excluded.cil_template_id
                where public.plan24_events.status = 'scheduled' and public.plan24_events.deleted_at is null;
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
