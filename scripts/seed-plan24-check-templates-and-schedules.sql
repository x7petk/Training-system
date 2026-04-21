begin;

do $$
declare
  v_cell_id uuid := 'b3000001-0000-4000-8000-000000000001';
  v_today date := current_date;
  v_horizon date := current_date + 90;

  t1_id uuid;
  t1_v1_id uuid;
  s1_id uuid;

  t2_id uuid;
  t2_v1_id uuid;
  s2_id uuid;
begin
  -- -------------------------------------------------------------------------
  -- Template 1: Pre-start safety walk
  -- -------------------------------------------------------------------------
  insert into public.plan24_check_templates (master_cell_id, name, description)
  values (
    v_cell_id,
    'Pre-start safety walk',
    'Start-of-shift safety checks for area readiness.'
  )
  on conflict (master_cell_id, name) do update
    set description = excluded.description
  returning id into t1_id;

  insert into public.plan24_check_template_versions (
    template_id,
    version_no,
    title,
    notes,
    state
  )
  values (
    t1_id,
    1,
    'Pre-start safety walk v1',
    'Baseline checklist for daily startup.',
    'published'
  )
  on conflict (template_id, version_no) do update
    set title = excluded.title,
        notes = excluded.notes,
        state = 'published'
  returning id into t1_v1_id;

  delete from public.plan24_check_template_tasks
  where version_id = t1_v1_id;

  insert into public.plan24_check_template_tasks (version_id, label, required, sort_order)
  values
    (t1_v1_id, 'Emergency exits are clear and unobstructed', true, 0),
    (t1_v1_id, 'PPE stock is available at entry points', true, 1),
    (t1_v1_id, 'Guards/interlocks visually inspected', true, 2),
    (t1_v1_id, 'Housekeeping is acceptable around machines', true, 3),
    (t1_v1_id, 'Any hazard noted and logged', false, 4);

  -- keep one published version per template
  update public.plan24_check_template_versions
  set state = 'archived'
  where template_id = t1_id
    and id <> t1_v1_id
    and state = 'published';

  -- schedule (daily)
  select id
  into s1_id
  from public.plan24_check_schedules
  where master_cell_id = v_cell_id
    and name = 'Pre-start safety walk - day';

  if s1_id is null then
    insert into public.plan24_check_schedules (
      master_cell_id,
      template_id,
      template_version_id,
      name,
      shift_kind,
      recurrence_kind,
      interval_n,
      weekdays,
      start_local_time,
      duration_minutes,
      starts_on,
      timezone,
      state
    )
    values (
      v_cell_id,
      t1_id,
      t1_v1_id,
      'Pre-start safety walk - day',
      'day',
      'daily',
      1,
      '{}'::int[],
      time '06:15',
      30,
      v_today,
      'Pacific/Auckland',
      'active'
    )
    returning id into s1_id;
  else
    update public.plan24_check_schedules
    set template_id = t1_id,
        template_version_id = t1_v1_id,
        shift_kind = 'day',
        recurrence_kind = 'daily',
        interval_n = 1,
        weekdays = '{}'::int[],
        start_local_time = time '06:15',
        duration_minutes = 30,
        starts_on = v_today,
        timezone = 'Pacific/Auckland',
        state = 'active'
    where id = s1_id;
  end if;

  delete from public.plan24_check_schedule_roles where schedule_id = s1_id;
  insert into public.plan24_check_schedule_roles (schedule_id, role_name)
  values
    (s1_id, 'Team lead'),
    (s1_id, 'Packing 1');

  -- -------------------------------------------------------------------------
  -- Template 2: Changeover quality verification
  -- -------------------------------------------------------------------------
  insert into public.plan24_check_templates (master_cell_id, name, description)
  values (
    v_cell_id,
    'Changeover quality verification',
    'Verification checks after product changeover.'
  )
  on conflict (master_cell_id, name) do update
    set description = excluded.description
  returning id into t2_id;

  insert into public.plan24_check_template_versions (
    template_id,
    version_no,
    title,
    notes,
    state
  )
  values (
    t2_id,
    1,
    'Changeover quality verification v1',
    'Every second day on night shift.',
    'published'
  )
  on conflict (template_id, version_no) do update
    set title = excluded.title,
        notes = excluded.notes,
        state = 'published'
  returning id into t2_v1_id;

  delete from public.plan24_check_template_tasks
  where version_id = t2_v1_id;

  insert into public.plan24_check_template_tasks (version_id, label, required, sort_order)
  values
    (t2_v1_id, 'Previous SKU remnants removed from contact surfaces', true, 0),
    (t2_v1_id, 'Correct labels and packaging loaded for new run', true, 1),
    (t2_v1_id, 'First-off sample inspected against standard', true, 2),
    (t2_v1_id, 'Line settings confirmed in handover sheet', true, 3),
    (t2_v1_id, 'Escalate any mismatch to team lead', false, 4);

  update public.plan24_check_template_versions
  set state = 'archived'
  where template_id = t2_id
    and id <> t2_v1_id
    and state = 'published';

  -- schedule (every second day)
  select id
  into s2_id
  from public.plan24_check_schedules
  where master_cell_id = v_cell_id
    and name = 'Changeover quality verification - night';

  if s2_id is null then
    insert into public.plan24_check_schedules (
      master_cell_id,
      template_id,
      template_version_id,
      name,
      shift_kind,
      recurrence_kind,
      interval_n,
      weekdays,
      start_local_time,
      duration_minutes,
      starts_on,
      timezone,
      state
    )
    values (
      v_cell_id,
      t2_id,
      t2_v1_id,
      'Changeover quality verification - night',
      'night',
      'daily',
      2,
      '{}'::int[],
      time '19:30',
      25,
      v_today,
      'Pacific/Auckland',
      'active'
    )
    returning id into s2_id;
  else
    update public.plan24_check_schedules
    set template_id = t2_id,
        template_version_id = t2_v1_id,
        shift_kind = 'night',
        recurrence_kind = 'daily',
        interval_n = 2,
        weekdays = '{}'::int[],
        start_local_time = time '19:30',
        duration_minutes = 25,
        starts_on = v_today,
        timezone = 'Pacific/Auckland',
        state = 'active'
    where id = s2_id;
  end if;

  delete from public.plan24_check_schedule_roles where schedule_id = s2_id;
  insert into public.plan24_check_schedule_roles (schedule_id, role_name)
  values
    (s2_id, 'Packing 2'),
    (s2_id, 'Packing 3');

  -- regenerate future scheduled events for both schedules
  perform public.plan24_reset_schedule_future_events(s1_id, v_today);
  perform public.plan24_reset_schedule_future_events(s2_id, v_today);
  perform public.plan24_materialize_check_schedules(v_cell_id, v_today, v_horizon);
end
$$;

commit;
