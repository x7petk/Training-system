-- Plan 24 demo history: last 7 days through 2026-05-26
-- 1) Six DDS actions for different people (spread across the week)
-- 2) ~95% completion on CL, CIL, Checks, Quality, and DDS actions in that window
-- 3) Raised issues (idempotent titles): 1 deviation + 1 quality fail every second day (from start date);
--    2 CIL-linked defects every calendar day in the window
--
-- Run:
--   node_modules/supabase/bin/supabase db query --linked --yes -f scripts/seed-plan24-week-completion-and-dds-actions.sql

begin;

do $$
declare
  v_cell_id uuid := 'b3000001-0000-4000-8000-000000000001';
  v_roster_id uuid := 'c1000001-0000-4000-8000-000000000001';
  v_from date := '2026-05-20';
  v_to date := '2026-05-26';
  v_tz text := 'Pacific/Auckland';
  d date;

  v_total int;
  v_target_complete int;
  v_marked int;

  v_dev_type_id uuid;
  v_dh_type_id uuid;
  v_qf_type_id uuid;
  v_issue_id uuid;
  v_ev_id uuid;
  v_cil_tpl uuid;
  v_seed_dev_title text;
  v_seed_qf_title text;
  v_seed_dh_title text;
  v_day_off int;

  a record;
  v_role_name text;
  v_person_id uuid;
  v_person_offset int := 0;
  v_start timestamptz;
  v_end timestamptz;
begin
  d := v_from;
  while d <= v_to loop
    perform public.plan24_materialize_check_schedules(v_cell_id, d, d);
    perform public.plan24_materialize_cl_check_schedules(v_cell_id, d, d);
    perform public.plan24_materialize_cil_check_schedules(v_cell_id, d, d);
    perform public.plan24_materialize_quality_check_schedules(v_cell_id, d, d);
    d := d + 1;
  end loop;

  for a in
    select *
    from (
      values
        ('2026-05-20'::date, 'day'::text, time '08:30', 45, 'DDS — Shift start KPI review', 'Review overnight KPI deltas and confirm line targets for the day.'),
        ('2026-05-21'::date, 'night'::text, time '19:15', 40, 'DDS — Weigher drift follow-up', 'Document weigher drift seen on night run and assign containment checks.'),
        ('2026-05-22'::date, 'day'::text, time '10:00', 50, 'DDS — Changeover readiness sign-off', 'Confirm allergen flush complete and release line after changeover.'),
        ('2026-05-23'::date, 'night'::text, time '20:45', 35, 'DDS — Sanitizer circuit verification', 'Verify sanitizer return temp/conductivity after deep rinse.'),
        ('2026-05-24'::date, 'day'::text, time '07:45', 55, 'DDS — Top losses containment huddle', 'Align crew on top-3 losses and countermeasures for the shift.'),
        ('2026-05-26'::date, 'day'::text, time '14:20', 30, 'DDS — End-of-week plan review', 'Close open plan items and hand over to next shift lead.')
    ) as t(plan_date, shift_kind, start_local, duration_min, title, comment_text)
  loop
    select p.id
    into v_person_id
    from public.people p
    order by p.display_name nulls last, p.id
    offset v_person_offset
    limit 1;

    select rr.name
    into v_role_name
    from public.plan24_roster_roles rr
    where rr.roster_id = v_roster_id
      and rr.is_active = true
    order by rr.sort_order, rr.name
    offset v_person_offset
    limit 1;

    v_person_offset := v_person_offset + 1;

    if v_person_id is null then
      continue;
    end if;

    insert into public.plan24_role_day_assignments (roster_id, plan_date, shift_kind, role_name, person_id)
    values (v_roster_id, a.plan_date, a.shift_kind, v_role_name, v_person_id)
    on conflict (roster_id, plan_date, shift_kind, role_name) do update
      set person_id = excluded.person_id;

    v_start := ((a.plan_date + a.start_local)::timestamp) at time zone v_tz;
    v_end := v_start + make_interval(mins => a.duration_min);

    if not exists (
      select 1
      from public.plan24_events e
      where e.master_cell_id = v_cell_id
        and e.plan_date = a.plan_date
        and e.shift_kind = a.shift_kind
        and e.event_type = 'dds_action'
        and e.title = a.title
        and e.deleted_at is null
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
        assigned_person_id,
        comment,
        dds_display_surfaces
      )
      values (
        v_cell_id,
        v_roster_id,
        a.plan_date,
        a.shift_kind,
        v_role_name,
        v_role_name,
        a.title,
        'dds_action',
        'ad_hoc',
        v_start,
        v_end,
        'scheduled',
        '[]'::jsonb,
        v_person_id,
        a.comment_text,
        array['line-dds', 'plant-dds', 'site-dds']::text[]
      );
    end if;
  end loop;

  select count(*)::int
  into v_total
  from public.plan24_events e
  where e.master_cell_id = v_cell_id
    and e.plan_date between v_from and v_to
    and e.deleted_at is null
    and lower(coalesce(e.event_type, '')) in (
      'check',
      'cl_check',
      'cil_check',
      'quality_check',
      'dds_action'
    );

  if v_total = 0 then
    raise notice 'No plan24 events in %..% — run schedule seeds first.', v_from, v_to;
    return;
  end if;

  v_target_complete := greatest(0, floor(v_total * 0.95)::int);
  if v_target_complete >= v_total and v_total > 1 then
    v_target_complete := v_total - 1;
  end if;

  update public.plan24_events e
  set
    status = 'scheduled',
    opened_at = null,
    completed_at = null,
    completed_by = null
  where e.master_cell_id = v_cell_id
    and e.plan_date between v_from and v_to
    and e.deleted_at is null
    and lower(coalesce(e.event_type, '')) in (
      'check',
      'cl_check',
      'cil_check',
      'quality_check',
      'dds_action'
    );

  with pick as (
    select e.id
    from public.plan24_events e
    where e.master_cell_id = v_cell_id
      and e.plan_date between v_from and v_to
      and e.deleted_at is null
      and lower(coalesce(e.event_type, '')) in (
        'check',
        'cl_check',
        'cil_check',
        'quality_check',
        'dds_action'
      )
    order by md5(e.id::text || v_from::text)
    limit v_target_complete
  )
  update public.plan24_events e
  set
    status = 'complete',
    opened_at = coalesce(e.opened_at, e.start_at + interval '5 minutes'),
    completed_at = least(e.end_at - interval '1 minute', e.start_at + interval '20 minutes')
  from pick
  where e.id = pick.id;

  get diagnostics v_marked = row_count;

  raise notice
    'Plan24 window %..%: total=%, target_complete=%, marked_complete=%',
    v_from,
    v_to,
    v_total,
    v_target_complete,
    v_marked;

  -- -------------------------------------------------------------------------
  -- Linked raised issues (P2P / Plan24): deviations, DH defects, quality fails
  -- -------------------------------------------------------------------------
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
  else
    d := v_from;
    while d <= v_to loop
      v_day_off := (d - v_from)::int;

      for v_slot in 1..2 loop
        v_seed_dh_title := format('Plan24 week seed — CIL defect — %s — %s', d::text, v_slot::text);
        if exists (
          select 1
          from public.dh_defects x
          where x.master_cell_id = v_cell_id
            and x.title = v_seed_dh_title
            and x.deleted_at is null
        ) then
          continue;
        end if;

        select r.id, r.cil_template_id
        into v_ev_id, v_cil_tpl
        from (
          select
            e.id,
            e.cil_template_id,
            row_number() over (order by e.id) as day_rn
          from public.plan24_events e
          where e.master_cell_id = v_cell_id
            and e.plan_date = d
            and e.deleted_at is null
            and lower(coalesce(e.event_type, '')) = 'cil_check'
        ) r
        where r.day_rn = v_slot
        limit 1;

        if v_ev_id is null then
          continue;
        end if;

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
          v_seed_dh_title,
          'Seeded for Plan24 / P2P demo (CIL observation).',
          'Production',
          'Line',
          'open',
          'medium',
          'Production / Line',
          null,
          v_cil_tpl,
          null
        )
        returning id into v_issue_id;

        update public.plan24_events e
        set
          status = 'complete',
          opened_at = coalesce(e.opened_at, e.start_at + interval '3 minutes'),
          completed_at = coalesce(e.completed_at, least(e.end_at - interval '1 minute', e.start_at + interval '15 minutes')),
          completed_by = null,
          linked_issue_kind = 'dh_defect',
          linked_issue_id = v_issue_id,
          linked_issue_created_at = coalesce(e.linked_issue_created_at, now())
        where e.id = v_ev_id;
      end loop;

      if mod(v_day_off, 2) = 0 then
        v_seed_dev_title := format('Plan24 week seed — CL deviation — %s', d::text);
        if not exists (
          select 1
          from public.deviations x
          where x.master_cell_id = v_cell_id
            and x.title = v_seed_dev_title
            and x.deleted_at is null
        ) then
          select r.id
          into v_ev_id
          from (
            select
              e.id,
              row_number() over (order by e.id) as day_rn
            from public.plan24_events e
            where e.master_cell_id = v_cell_id
              and e.plan_date = d
              and e.deleted_at is null
              and lower(coalesce(e.event_type, '')) = 'cl_check'
          ) r
          where r.day_rn = 1
          limit 1;

          if v_ev_id is not null then
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
              v_seed_dev_title,
              'Seeded CL deviation for Plan24 / P2P demo.',
              'Production',
              'Filler',
              'open',
              'medium',
              'Production / Filler',
              null
            )
            returning id into v_issue_id;

            update public.plan24_events e
            set
              status = 'complete',
              opened_at = coalesce(e.opened_at, e.start_at + interval '3 minutes'),
              completed_at = coalesce(e.completed_at, least(e.end_at - interval '1 minute', e.start_at + interval '18 minutes')),
              completed_by = null,
              linked_issue_kind = 'deviation',
              linked_issue_id = v_issue_id,
              linked_issue_created_at = coalesce(e.linked_issue_created_at, now())
            where e.id = v_ev_id;
          end if;
        end if;

        v_seed_qf_title := format('Plan24 week seed — Quality fail — %s', d::text);
        if not exists (
          select 1
          from public.quality_fails x
          where x.master_cell_id = v_cell_id
            and x.title = v_seed_qf_title
            and x.deleted_at is null
        ) then
          select r.id
          into v_ev_id
          from (
            select
              e.id,
              row_number() over (order by e.id) as day_rn
            from public.plan24_events e
            where e.master_cell_id = v_cell_id
              and e.plan_date = d
              and e.deleted_at is null
              and lower(coalesce(e.event_type, '')) = 'quality_check'
          ) r
          where r.day_rn = 1
          limit 1;

          if v_ev_id is not null then
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
              v_seed_qf_title,
              'Seeded quality fail for Plan24 / P2P demo.',
              'Production',
              'Sealer',
              'open',
              'high',
              'Production / Sealer',
              null
            )
            returning id into v_issue_id;

            update public.plan24_events e
            set
              status = 'complete',
              opened_at = coalesce(e.opened_at, e.start_at + interval '3 minutes'),
              completed_at = coalesce(e.completed_at, least(e.end_at - interval '1 minute', e.start_at + interval '12 minutes')),
              completed_by = null,
              linked_issue_kind = 'quality_fail',
              linked_issue_id = v_issue_id,
              linked_issue_created_at = coalesce(e.linked_issue_created_at, now())
            where e.id = v_ev_id;
          end if;
        end if;
      end if;

      d := d + 1;
    end loop;

    raise notice 'Plan24 week issue seed applied for %..% (deviation+quality fail on alternate days; 2 CIL defects/day).', v_from, v_to;
  end if;
end
$$;

commit;
