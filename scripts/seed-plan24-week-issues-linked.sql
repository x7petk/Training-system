-- Seed linked deviations/defects/fails for Plan24 demo week.
--
-- Creates issues in:
--   - public.deviations (cl_check -> deviation)
--   - public.dh_defects (cil_check -> dh_defect)
--   - public.quality_fails (quality_check -> quality_fail)
-- and links them back to plan24_events via linked_issue_kind / linked_issue_id.
--
-- Idempotent by deterministic titles (does not rely on randomness).
--
-- Run:
--   node_modules/supabase/bin/supabase db query --linked --yes -f scripts/seed-plan24-week-issues-linked.sql

begin;

do $$
declare
  v_cell_id uuid := 'b3000001-0000-4000-8000-000000000001';
  v_from date := '2026-05-20';
  v_to date := '2026-05-26';

  v_dev_type_id uuid;
  v_dh_type_id uuid;
  v_qf_type_id uuid;

  v_cl_event record;
  v_cil_event record;
  v_qf_event record;

  v_issue_id uuid;
  v_title text;

  d date;
  day_off int;

  v_now timestamptz := now();
begin
  -- Pick a stable active type from each catalogue.
  select dt.id
  into v_dev_type_id
  from public.deviation_types dt
  where dt.is_active = true
  order by dt.sort_order, dt.label
  limit 1;

  select dt.id
  into v_dh_type_id
  from public.dh_defect_types dt
  where dt.is_active = true
  order by dt.sort_order, dt.label
  limit 1;

  select qt.id
  into v_qf_type_id
  from public.quality_fail_types qt
  where qt.is_active = true
  order by qt.sort_order, qt.label
  limit 1;

  if v_dev_type_id is null or v_dh_type_id is null or v_qf_type_id is null then
    raise notice 'Week issue seed skipped: missing deviation_types, dh_defect_types, or quality_fail_types.';
    return;
  end if;

  -- Deviations + Quality fails: every second day (from v_from).
  d := v_from;
  while d <= v_to loop
    day_off := (d - v_from)::int;

    if mod(day_off, 2) = 0 then
      for v_cl_event in
        select e.id, e.plan_date, e.shift_kind, e.role_name
        from public.plan24_events e
        where e.master_cell_id = v_cell_id
          and e.plan_date = d
          and e.deleted_at is null
          and lower(coalesce(e.event_type, '')) = 'cl_check'
      loop
        v_title := format('Plan24 issues seed — deviation — %s — %s — %s', v_cl_event.plan_date, v_cl_event.shift_kind, coalesce(v_cl_event.role_name, 'unassigned'));

        if not exists (
          select 1 from public.deviations x
          where x.master_cell_id = v_cell_id
            and x.title = v_title
            and x.deleted_at is null
        ) then
          insert into public.deviations (
            master_cell_id,
            defect_type_id,
            title,
            description,
            area,
            equipment,
            status,
            priority,
            location_summary,
            created_by
          )
          values (
            v_cell_id,
            v_dev_type_id,
            v_title,
            'Seeded deviation for Plan24 demo week.',
            'Production',
            'Line',
            'open',
            'medium',
            concat('Production / ', coalesce(v_cl_event.role_name, 'Unassigned')),
            null
          )
          returning id into v_issue_id;
        else
          select x.id into v_issue_id
          from public.deviations x
          where x.master_cell_id = v_cell_id
            and x.title = v_title
            and x.deleted_at is null
          limit 1;
        end if;

        if v_issue_id is not null then
          update public.plan24_events e
          set
            linked_issue_kind = 'deviation',
            linked_issue_id = v_issue_id,
            linked_issue_created_at = coalesce(e.linked_issue_created_at, v_now)
          where e.id = v_cl_event.id
            and e.deleted_at is null;
        end if;
      end loop;

      for v_qf_event in
        select e.id, e.plan_date, e.shift_kind, e.role_name
        from public.plan24_events e
        where e.master_cell_id = v_cell_id
          and e.plan_date = d
          and e.deleted_at is null
          and lower(coalesce(e.event_type, '')) = 'quality_check'
      loop
        v_title := format('Plan24 issues seed — quality fail — %s — %s — %s', v_qf_event.plan_date, v_qf_event.shift_kind, coalesce(v_qf_event.role_name, 'unassigned'));

        if not exists (
          select 1 from public.quality_fails x
          where x.master_cell_id = v_cell_id
            and x.title = v_title
            and x.deleted_at is null
        ) then
          insert into public.quality_fails (
            master_cell_id,
            defect_type_id,
            title,
            description,
            area,
            equipment,
            status,
            priority,
            location_summary,
            created_by
          )
          values (
            v_cell_id,
            v_qf_type_id,
            v_title,
            'Seeded quality fail for Plan24 demo week.',
            'Production',
            'Line',
            'open',
            'high',
            concat('Production / ', coalesce(v_qf_event.role_name, 'Unassigned')),
            null
          )
          returning id into v_issue_id;
        else
          select x.id into v_issue_id
          from public.quality_fails x
          where x.master_cell_id = v_cell_id
            and x.title = v_title
            and x.deleted_at is null
          limit 1;
        end if;

        if v_issue_id is not null then
          update public.plan24_events e
          set
            linked_issue_kind = 'quality_fail',
            linked_issue_id = v_issue_id,
            linked_issue_created_at = coalesce(e.linked_issue_created_at, v_now)
          where e.id = v_qf_event.id
            and e.deleted_at is null;
        end if;
      end loop;
    end if;

    d := d + 1;
  end loop;

  -- Defects: seed on every day for every CIL check event in the window.
  for v_cil_event in
    select e.id, e.plan_date, e.shift_kind, e.role_name, e.cil_template_id
    from public.plan24_events e
    where e.master_cell_id = v_cell_id
      and e.plan_date between v_from and v_to
      and e.deleted_at is null
      and lower(coalesce(e.event_type, '')) = 'cil_check'
  loop
    v_title := format(
      'Plan24 issues seed — dh defect — %s — %s — %s',
      v_cil_event.plan_date,
      v_cil_event.shift_kind,
      coalesce(v_cil_event.role_name, 'unassigned')
    );

    if not exists (
      select 1 from public.dh_defects x
      where x.master_cell_id = v_cell_id
        and x.title = v_title
        and x.deleted_at is null
    ) then
      insert into public.dh_defects (
        master_cell_id,
        defect_type_id,
        title,
        description,
        area,
        equipment,
        status,
        priority,
        location_summary,
        created_by,
        cil_template_id,
        cil_template_task_id
      )
      values (
        v_cell_id,
        v_dh_type_id,
        v_title,
        'Seeded defect for Plan24 demo week (CIL-linked).',
        'Production',
        'Line',
        'open',
        'medium',
        concat('Production / ', coalesce(v_cil_event.role_name, 'Unassigned')),
        null,
        v_cil_event.cil_template_id,
        null
      )
      returning id into v_issue_id;
    else
      select x.id into v_issue_id
      from public.dh_defects x
      where x.master_cell_id = v_cell_id
        and x.title = v_title
        and x.deleted_at is null
      limit 1;
    end if;

    if v_issue_id is not null then
      update public.plan24_events e
      set
        linked_issue_kind = 'dh_defect',
        linked_issue_id = v_issue_id,
        linked_issue_created_at = coalesce(e.linked_issue_created_at, v_now)
      where e.id = v_cil_event.id
        and e.deleted_at is null;
    end if;
  end loop;

  raise notice 'Plan24 linked issues seeded for %..% (deviation+quality every 2nd day; defects every day).', v_from, v_to;
end
$$;

commit;

