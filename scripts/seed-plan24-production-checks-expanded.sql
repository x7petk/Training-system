-- Idempotent seed: +2 CL, +2 CIL, +2 Checks (with sub-tasks), +1 Quality — each on day and night
-- shift for all roster roles (Team lead + Packing 1–6) on the default Darfield Powder cell.
--
-- Run (linked remote):
--   node_modules/supabase/bin/supabase db query --linked --yes -f scripts/seed-plan24-production-checks-expanded.sql

begin;

do $$
declare
  v_cell_id uuid := 'b3000001-0000-4000-8000-000000000001';
  v_today date := current_date;
  v_horizon date := current_date + 90;
  v_roles text[] := array[
    'Team lead',
    'Packing 1',
    'Packing 2',
    'Packing 3',
    'Packing 4',
    'Packing 5',
    'Packing 6'
  ];
  r text;

  -- CL
  cl3_t uuid; cl3_v uuid; cl3_sd uuid; cl3_sn uuid;
  cl4_t uuid; cl4_v uuid; cl4_sd uuid; cl4_sn uuid;
  -- CIL
  cil3_t uuid; cil3_v uuid; cil3_sd uuid; cil3_sn uuid;
  cil4_t uuid; cil4_v uuid; cil4_sd uuid; cil4_sn uuid;
  -- Checks
  ck3_t uuid; ck3_v uuid; ck3_sd uuid; ck3_sn uuid;
  ck4_t uuid; ck4_v uuid; ck4_sd uuid; ck4_sn uuid;
  -- Quality
  q3_t uuid; q3_v uuid; q3_sd uuid; q3_sn uuid;

  v_schedule_id uuid;
begin
  -- =========================================================================
  -- CL #3 — Filler head drip tray centerline
  -- =========================================================================
  insert into public.plan24_cl_check_templates (master_cell_id, name, description)
  values (
    v_cell_id,
    'CL — Filler head drip tray',
    'Centerline: filler drip tray and surround — no product buildup or leaks.'
  )
  on conflict (master_cell_id, name) do update set description = excluded.description
  returning id into cl3_t;

  insert into public.plan24_cl_check_template_versions (template_id, version_no, title, notes, state)
  values (cl3_t, 1, 'CL — Filler head drip tray v1', 'Production centerline at filler.', 'published')
  on conflict (template_id, version_no) do update
    set title = excluded.title, notes = excluded.notes, state = 'published'
  returning id into cl3_v;

  delete from public.plan24_cl_check_template_tasks where version_id = cl3_v;
  insert into public.plan24_cl_check_template_tasks (
    version_id, label, required, input_kind, sort_order,
    min_value, max_value, target_value, standard_description, photo_path
  )
  values
    (
      cl3_v, 'Drip tray dry and product-free', true, 'text', 0,
      null, null, null,
      E'Standard\n• Tray and shroud wiped dry; no pooled milk powder or syrup.\n• Note condition (clear / wipe required / leak logged).',
      'https://placehold.co/360x240/166534/ffffff/png?text=Drip+tray'
    ),
    (
      cl3_v, 'Filler nozzle alignment within mark', true, 'number', 1,
      -2, 2, 0,
      E'Standard\n• Measure offset mm vs centerline mark on gauge.\n• Outside ±2 mm: adjust per SOP and re-check before run release.',
      'https://placehold.co/360x240/15803d/ffffff/png?text=Nozzle'
    );

  update public.plan24_cl_check_template_versions
  set state = 'archived'
  where template_id = cl3_t and id <> cl3_v and state = 'published';

  select id into cl3_sd from public.plan24_cl_check_schedules
  where master_cell_id = v_cell_id and name = 'CL — Filler head drip tray — day';
  if cl3_sd is null then
    insert into public.plan24_cl_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, cl3_t, cl3_v, 'CL — Filler head drip tray — day', 'day',
      'daily', 1, '{}'::int[], time '06:35', 20, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into cl3_sd;
  else
    update public.plan24_cl_check_schedules set
      template_id = cl3_t, template_version_id = cl3_v, shift_kind = 'day',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '06:35', duration_minutes = 20, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = cl3_sd;
  end if;

  select id into cl3_sn from public.plan24_cl_check_schedules
  where master_cell_id = v_cell_id and name = 'CL — Filler head drip tray — night';
  if cl3_sn is null then
    insert into public.plan24_cl_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, cl3_t, cl3_v, 'CL — Filler head drip tray — night', 'night',
      'daily', 1, '{}'::int[], time '18:10', 20, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into cl3_sn;
  else
    update public.plan24_cl_check_schedules set
      template_id = cl3_t, template_version_id = cl3_v, shift_kind = 'night',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '18:10', duration_minutes = 20, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = cl3_sn;
  end if;

  delete from public.plan24_cl_check_schedule_roles where schedule_id in (cl3_sd, cl3_sn);
  foreach r in array v_roles loop
    insert into public.plan24_cl_check_schedule_roles (schedule_id, role_name) values (cl3_sd, r);
    insert into public.plan24_cl_check_schedule_roles (schedule_id, role_name) values (cl3_sn, r);
  end loop;

  -- =========================================================================
  -- CL #4 — Weigher feed mouth centerline
  -- =========================================================================
  insert into public.plan24_cl_check_templates (master_cell_id, name, description)
  values (
    v_cell_id,
    'CL — Weigher feed mouth',
    'Centerline: weigher infeed — no bridging, dust, or off-spec feed.'
  )
  on conflict (master_cell_id, name) do update set description = excluded.description
  returning id into cl4_t;

  insert into public.plan24_cl_check_template_versions (template_id, version_no, title, notes, state)
  values (cl4_t, 1, 'CL — Weigher feed mouth v1', 'Production centerline at weigher.', 'published')
  on conflict (template_id, version_no) do update
    set title = excluded.title, notes = excluded.notes, state = 'published'
  returning id into cl4_v;

  delete from public.plan24_cl_check_template_tasks where version_id = cl4_v;
  insert into public.plan24_cl_check_template_tasks (
    version_id, label, required, input_kind, sort_order,
    min_value, max_value, target_value, standard_description, photo_path
  )
  values
    (
      cl4_v, 'Feed mouth clear — no bridge', true, 'text', 0,
      null, null, null,
      E'Standard\n• Product flows freely; no arching or bridge at throat.\n• Short observation note required each check.',
      'https://placehold.co/360x240/14532d/ffffff/png?text=Feed+mouth'
    ),
    (
      cl4_v, 'Weigher vibration setpoint (Hz)', true, 'number', 1,
      45, 55, 50,
      E'Standard\n• Target 50 Hz (plant-specific).\n• Outside band: tune per SOP, re-sample, escalate if still out.',
      'https://placehold.co/360x240/166534/ffffff/png?text=Vibration'
    );

  update public.plan24_cl_check_template_versions
  set state = 'archived'
  where template_id = cl4_t and id <> cl4_v and state = 'published';

  select id into cl4_sd from public.plan24_cl_check_schedules
  where master_cell_id = v_cell_id and name = 'CL — Weigher feed mouth — day';
  if cl4_sd is null then
    insert into public.plan24_cl_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, cl4_t, cl4_v, 'CL — Weigher feed mouth — day', 'day',
      'daily', 1, '{}'::int[], time '11:15', 20, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into cl4_sd;
  else
    update public.plan24_cl_check_schedules set
      template_id = cl4_t, template_version_id = cl4_v, shift_kind = 'day',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '11:15', duration_minutes = 20, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = cl4_sd;
  end if;

  select id into cl4_sn from public.plan24_cl_check_schedules
  where master_cell_id = v_cell_id and name = 'CL — Weigher feed mouth — night';
  if cl4_sn is null then
    insert into public.plan24_cl_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, cl4_t, cl4_v, 'CL — Weigher feed mouth — night', 'night',
      'daily', 1, '{}'::int[], time '22:20', 20, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into cl4_sn;
  else
    update public.plan24_cl_check_schedules set
      template_id = cl4_t, template_version_id = cl4_v, shift_kind = 'night',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '22:20', duration_minutes = 20, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = cl4_sn;
  end if;

  delete from public.plan24_cl_check_schedule_roles where schedule_id in (cl4_sd, cl4_sn);
  foreach r in array v_roles loop
    insert into public.plan24_cl_check_schedule_roles (schedule_id, role_name) values (cl4_sd, r);
    insert into public.plan24_cl_check_schedule_roles (schedule_id, role_name) values (cl4_sn, r);
  end loop;

  -- =========================================================================
  -- CIL #3 — Changeover allergen flush
  -- =========================================================================
  insert into public.plan24_cil_check_templates (master_cell_id, name, description)
  values (
    v_cell_id,
    'CIL — Changeover allergen flush',
    'CIL: allergen flush sequence after SKU change on packing line.'
  )
  on conflict (master_cell_id, name) do update set description = excluded.description
  returning id into cil3_t;

  insert into public.plan24_cil_check_template_versions (template_id, version_no, title, notes, state)
  values (cil3_t, 1, 'CIL — Changeover allergen flush v1', 'Production CIL at changeover.', 'published')
  on conflict (template_id, version_no) do update
    set title = excluded.title, notes = excluded.notes, state = 'published'
  returning id into cil3_v;

  delete from public.plan24_cil_check_template_tasks where version_id = cil3_v;
  insert into public.plan24_cil_check_template_tasks (
    version_id, label, required, input_kind, sort_order,
    standard_description, photo_path, recurrence_kind, interval_n, weekdays, check_types, when_condition
  )
  values
    (
      cil3_v, 'Prior SKU purge verified', true, 'pass_fail', 0,
      E'Standard\n• Last-good run product removed from contact surfaces and hoppers.\n• Visual sweep complete before flush water introduced.',
      'https://placehold.co/360x240/0f7668/ffffff/png?text=SKU+purge',
      'daily', 1, '{}'::int[], array['cleaning','inspection']::text[], 'down'
    ),
    (
      cil3_v, 'Flush conductivity below release limit', true, 'pass_fail', 1,
      E'Standard\n• End-of-flush sample meets plant conductivity gate for allergen change.\n• Fail: extend flush per SOP and re-test.',
      'https://placehold.co/360x240/0e7490/ffffff/png?text=Conductivity',
      'daily', 1, '{}'::int[], array['inspection']::text[], 'down'
    );

  update public.plan24_cil_check_template_versions
  set state = 'archived'
  where template_id = cil3_t and id <> cil3_v and state = 'published';

  select id into cil3_sd from public.plan24_cil_check_schedules
  where master_cell_id = v_cell_id and name = 'CIL — Changeover allergen flush — day';
  if cil3_sd is null then
    insert into public.plan24_cil_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, cil3_t, cil3_v, 'CIL — Changeover allergen flush — day', 'day',
      'daily', 1, '{}'::int[], time '07:25', 35, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into cil3_sd;
  else
    update public.plan24_cil_check_schedules set
      template_id = cil3_t, template_version_id = cil3_v, shift_kind = 'day',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '07:25', duration_minutes = 35, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = cil3_sd;
  end if;

  select id into cil3_sn from public.plan24_cil_check_schedules
  where master_cell_id = v_cell_id and name = 'CIL — Changeover allergen flush — night';
  if cil3_sn is null then
    insert into public.plan24_cil_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, cil3_t, cil3_v, 'CIL — Changeover allergen flush — night', 'night',
      'daily', 1, '{}'::int[], time '19:05', 35, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into cil3_sn;
  else
    update public.plan24_cil_check_schedules set
      template_id = cil3_t, template_version_id = cil3_v, shift_kind = 'night',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '19:05', duration_minutes = 35, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = cil3_sn;
  end if;

  delete from public.plan24_cil_check_schedule_roles where schedule_id in (cil3_sd, cil3_sn);
  foreach r in array v_roles loop
    insert into public.plan24_cil_check_schedule_roles (schedule_id, role_name) values (cil3_sd, r);
    insert into public.plan24_cil_check_schedule_roles (schedule_id, role_name) values (cil3_sn, r);
  end loop;

  -- =========================================================================
  -- CIL #4 — Sanitizer circuit flush
  -- =========================================================================
  insert into public.plan24_cil_check_templates (master_cell_id, name, description)
  values (
    v_cell_id,
    'CIL — Sanitizer circuit flush',
    'CIL: sanitizer loop flush and verify before production restart.'
  )
  on conflict (master_cell_id, name) do update set description = excluded.description
  returning id into cil4_t;

  insert into public.plan24_cil_check_template_versions (template_id, version_no, title, notes, state)
  values (cil4_t, 1, 'CIL — Sanitizer circuit flush v1', 'Production CIL sanitizer loop.', 'published')
  on conflict (template_id, version_no) do update
    set title = excluded.title, notes = excluded.notes, state = 'published'
  returning id into cil4_v;

  delete from public.plan24_cil_check_template_tasks where version_id = cil4_v;
  insert into public.plan24_cil_check_template_tasks (
    version_id, label, required, input_kind, sort_order,
    standard_description, photo_path, recurrence_kind, interval_n, weekdays, check_types, when_condition
  )
  values
    (
      cil4_v, 'Sanitizer tank level adequate', true, 'pass_fail', 0,
      E'Standard\n• Tank above minimum for planned flush volume.\n• Refill logged if topped up before sequence.',
      'https://placehold.co/360x240/155e75/ffffff/png?text=Tank+level',
      'daily', 1, '{}'::int[], array['inspection']::text[], 'running'
    ),
    (
      cil4_v, 'Return line temperature (°C)', true, 'number', 1,
      E'Standard\n• Return within 65–75 °C during active flush (plant setpoint).\n• Log actual reading; escalate sustained deviation.',
      'https://placehold.co/360x240/115e59/ffffff/png?text=Temperature',
      'daily', 1, '{}'::int[], array['inspection']::text[], 'running'
    );

  update public.plan24_cil_check_template_versions
  set state = 'archived'
  where template_id = cil4_t and id <> cil4_v and state = 'published';

  select id into cil4_sd from public.plan24_cil_check_schedules
  where master_cell_id = v_cell_id and name = 'CIL — Sanitizer circuit flush — day';
  if cil4_sd is null then
    insert into public.plan24_cil_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, cil4_t, cil4_v, 'CIL — Sanitizer circuit flush — day', 'day',
      'daily', 1, '{}'::int[], time '13:10', 30, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into cil4_sd;
  else
    update public.plan24_cil_check_schedules set
      template_id = cil4_t, template_version_id = cil4_v, shift_kind = 'day',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '13:10', duration_minutes = 30, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = cil4_sd;
  end if;

  select id into cil4_sn from public.plan24_cil_check_schedules
  where master_cell_id = v_cell_id and name = 'CIL — Sanitizer circuit flush — night';
  if cil4_sn is null then
    insert into public.plan24_cil_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, cil4_t, cil4_v, 'CIL — Sanitizer circuit flush — night', 'night',
      'daily', 1, '{}'::int[], time '01:40', 30, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into cil4_sn;
  else
    update public.plan24_cil_check_schedules set
      template_id = cil4_t, template_version_id = cil4_v, shift_kind = 'night',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '01:40', duration_minutes = 30, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = cil4_sn;
  end if;

  delete from public.plan24_cil_check_schedule_roles where schedule_id in (cil4_sd, cil4_sn);
  foreach r in array v_roles loop
    insert into public.plan24_cil_check_schedule_roles (schedule_id, role_name) values (cil4_sd, r);
    insert into public.plan24_cil_check_schedule_roles (schedule_id, role_name) values (cil4_sn, r);
  end loop;

  -- =========================================================================
  -- Check #3 — Line start-up readiness gate
  -- =========================================================================
  insert into public.plan24_check_templates (master_cell_id, name, description)
  values (
    v_cell_id,
    'Line start-up readiness gate',
    'Pre-run checks before releasing the packing line to production speed.'
  )
  on conflict (master_cell_id, name) do update set description = excluded.description
  returning id into ck3_t;

  insert into public.plan24_check_template_versions (template_id, version_no, title, notes, state)
  values (ck3_t, 1, 'Line start-up readiness gate v1', 'Production start-up checklist.', 'published')
  on conflict (template_id, version_no) do update
    set title = excluded.title, notes = excluded.notes, state = 'published'
  returning id into ck3_v;

  delete from public.plan24_check_template_tasks where version_id = ck3_v;
  insert into public.plan24_check_template_tasks (version_id, label, required, sort_order)
  values
    (ck3_v, 'Correct SKU and BOM loaded in MES', true, 0),
    (ck3_v, 'Metal detector test piece passed', true, 1),
    (ck3_v, 'Compressed air pressure within green band', true, 2),
    (ck3_v, 'Guard doors closed and interlocks OK', true, 3),
    (ck3_v, 'Handover from previous shift reviewed', false, 4);

  update public.plan24_check_template_versions
  set state = 'archived'
  where template_id = ck3_t and id <> ck3_v and state = 'published';

  select id into ck3_sd from public.plan24_check_schedules
  where master_cell_id = v_cell_id and name = 'Line start-up readiness gate — day';
  if ck3_sd is null then
    insert into public.plan24_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, ck3_t, ck3_v, 'Line start-up readiness gate — day', 'day',
      'daily', 1, '{}'::int[], time '05:50', 25, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into ck3_sd;
  else
    update public.plan24_check_schedules set
      template_id = ck3_t, template_version_id = ck3_v, shift_kind = 'day',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '05:50', duration_minutes = 25, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = ck3_sd;
  end if;

  select id into ck3_sn from public.plan24_check_schedules
  where master_cell_id = v_cell_id and name = 'Line start-up readiness gate — night';
  if ck3_sn is null then
    insert into public.plan24_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, ck3_t, ck3_v, 'Line start-up readiness gate — night', 'night',
      'daily', 1, '{}'::int[], time '17:15', 25, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into ck3_sn;
  else
    update public.plan24_check_schedules set
      template_id = ck3_t, template_version_id = ck3_v, shift_kind = 'night',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '17:15', duration_minutes = 25, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = ck3_sn;
  end if;

  delete from public.plan24_check_schedule_roles where schedule_id in (ck3_sd, ck3_sn);
  foreach r in array v_roles loop
    insert into public.plan24_check_schedule_roles (schedule_id, role_name) values (ck3_sd, r);
    insert into public.plan24_check_schedule_roles (schedule_id, role_name) values (ck3_sn, r);
  end loop;

  -- =========================================================================
  -- Check #4 — End-of-run drain-down verification
  -- =========================================================================
  insert into public.plan24_check_templates (master_cell_id, name, description)
  values (
    v_cell_id,
    'End-of-run drain-down verification',
    'Shutdown checks: product run-out, drains, and safe state for maintenance.'
  )
  on conflict (master_cell_id, name) do update set description = excluded.description
  returning id into ck4_t;

  insert into public.plan24_check_template_versions (template_id, version_no, title, notes, state)
  values (ck4_t, 1, 'End-of-run drain-down verification v1', 'Production shutdown checklist.', 'published')
  on conflict (template_id, version_no) do update
    set title = excluded.title, notes = excluded.notes, state = 'published'
  returning id into ck4_v;

  delete from public.plan24_check_template_tasks where version_id = ck4_v;
  insert into public.plan24_check_template_tasks (version_id, label, required, sort_order)
  values
    (ck4_v, 'Hopper and belt run empty — no product carryover', true, 0),
    (ck4_v, 'Low-point drains opened and tagged', true, 1),
    (ck4_v, 'Steam and compressed air isolated at local valves', true, 2),
    (ck4_v, 'Waste stream cleared and bins labelled', true, 3),
    (ck4_v, 'Maintenance lockout needs logged if required', false, 4);

  update public.plan24_check_template_versions
  set state = 'archived'
  where template_id = ck4_t and id <> ck4_v and state = 'published';

  select id into ck4_sd from public.plan24_check_schedules
  where master_cell_id = v_cell_id and name = 'End-of-run drain-down verification — day';
  if ck4_sd is null then
    insert into public.plan24_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, ck4_t, ck4_v, 'End-of-run drain-down verification — day', 'day',
      'daily', 1, '{}'::int[], time '16:40', 25, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into ck4_sd;
  else
    update public.plan24_check_schedules set
      template_id = ck4_t, template_version_id = ck4_v, shift_kind = 'day',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '16:40', duration_minutes = 25, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = ck4_sd;
  end if;

  select id into ck4_sn from public.plan24_check_schedules
  where master_cell_id = v_cell_id and name = 'End-of-run drain-down verification — night';
  if ck4_sn is null then
    insert into public.plan24_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, ck4_t, ck4_v, 'End-of-run drain-down verification — night', 'night',
      'daily', 1, '{}'::int[], time '04:50', 25, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into ck4_sn;
  else
    update public.plan24_check_schedules set
      template_id = ck4_t, template_version_id = ck4_v, shift_kind = 'night',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '04:50', duration_minutes = 25, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = ck4_sn;
  end if;

  delete from public.plan24_check_schedule_roles where schedule_id in (ck4_sd, ck4_sn);
  foreach r in array v_roles loop
    insert into public.plan24_check_schedule_roles (schedule_id, role_name) values (ck4_sd, r);
    insert into public.plan24_check_schedule_roles (schedule_id, role_name) values (ck4_sn, r);
  end loop;

  -- =========================================================================
  -- Quality #3 — In-process seal integrity audit
  -- =========================================================================
  insert into public.plan24_quality_check_templates (master_cell_id, name, description)
  values (
    v_cell_id,
    'Quality — In-process seal integrity',
    'Quality: pouch seal and leak check during the production run.'
  )
  on conflict (master_cell_id, name) do update set description = excluded.description
  returning id into q3_t;

  insert into public.plan24_quality_check_template_versions (template_id, version_no, title, notes, state)
  values (q3_t, 1, 'Quality — In-process seal integrity v1', 'Production quality audit.', 'published')
  on conflict (template_id, version_no) do update
    set title = excluded.title, notes = excluded.notes, state = 'published'
  returning id into q3_v;

  delete from public.plan24_quality_check_template_tasks where version_id = q3_v;
  insert into public.plan24_quality_check_template_tasks (
    version_id, label, required, input_kind, sort_order,
    min_value, max_value, target_value, standard_description, photo_path
  )
  values
    (
      q3_v, 'Seal width within specification', true, 'pass_fail', 0,
      null, null, null,
      E'Standard\n• Random pouch: seal width 3–5 mm per print spec.\n• Fail triggers hold-and-review per quality SOP.',
      'https://placehold.co/360x240/5b21b6/ffffff/png?text=Seal+width'
    ),
    (
      q3_v, 'Leak test — no bubbles at 2 bar', true, 'pass_fail', 1,
      null, null, null,
      E'Standard\n• Submerge sample 30 s at 2 bar; zero bubble stream.\n• Any leak: stop line segment and record quality fail.',
      'https://placehold.co/360x240/6d28d9/ffffff/png?text=Leak+test'
    ),
    (
      q3_v, 'Print registration aligned', true, 'pass_fail', 2,
      null, null, null,
      E'Standard\n• Graphics and bar code within registration tolerance.\n• Misregister: notify team lead and quarantine last 10 min output.',
      'https://placehold.co/360x240/4c1d95/ffffff/png?text=Registration'
    );

  update public.plan24_quality_check_template_versions
  set state = 'archived'
  where template_id = q3_t and id <> q3_v and state = 'published';

  select id into q3_sd from public.plan24_quality_check_schedules
  where master_cell_id = v_cell_id and name = 'Quality — In-process seal integrity — day';
  if q3_sd is null then
    insert into public.plan24_quality_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, q3_t, q3_v, 'Quality — In-process seal integrity — day', 'day',
      'daily', 1, '{}'::int[], time '09:45', 25, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into q3_sd;
  else
    update public.plan24_quality_check_schedules set
      template_id = q3_t, template_version_id = q3_v, shift_kind = 'day',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '09:45', duration_minutes = 25, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = q3_sd;
  end if;

  select id into q3_sn from public.plan24_quality_check_schedules
  where master_cell_id = v_cell_id and name = 'Quality — In-process seal integrity — night';
  if q3_sn is null then
    insert into public.plan24_quality_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, q3_t, q3_v, 'Quality — In-process seal integrity — night', 'night',
      'daily', 1, '{}'::int[], time '21:30', 25, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into q3_sn;
  else
    update public.plan24_quality_check_schedules set
      template_id = q3_t, template_version_id = q3_v, shift_kind = 'night',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '21:30', duration_minutes = 25, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = q3_sn;
  end if;

  delete from public.plan24_quality_check_schedule_roles where schedule_id in (q3_sd, q3_sn);
  foreach r in array v_roles loop
    insert into public.plan24_quality_check_schedule_roles (schedule_id, role_name) values (q3_sd, r);
    insert into public.plan24_quality_check_schedule_roles (schedule_id, role_name) values (q3_sn, r);
  end loop;

  -- =========================================================================
  -- Materialize events (today → +90 days)
  -- =========================================================================
  perform public.plan24_reset_cl_check_schedule_future_events(cl3_sd, v_today);
  perform public.plan24_reset_cl_check_schedule_future_events(cl3_sn, v_today);
  perform public.plan24_reset_cl_check_schedule_future_events(cl4_sd, v_today);
  perform public.plan24_reset_cl_check_schedule_future_events(cl4_sn, v_today);

  perform public.plan24_reset_cil_check_schedule_future_events(cil3_sd, v_today);
  perform public.plan24_reset_cil_check_schedule_future_events(cil3_sn, v_today);
  perform public.plan24_reset_cil_check_schedule_future_events(cil4_sd, v_today);
  perform public.plan24_reset_cil_check_schedule_future_events(cil4_sn, v_today);

  perform public.plan24_reset_schedule_future_events(ck3_sd, v_today);
  perform public.plan24_reset_schedule_future_events(ck3_sn, v_today);
  perform public.plan24_reset_schedule_future_events(ck4_sd, v_today);
  perform public.plan24_reset_schedule_future_events(ck4_sn, v_today);

  perform public.plan24_reset_quality_check_schedule_future_events(q3_sd, v_today);
  perform public.plan24_reset_quality_check_schedule_future_events(q3_sn, v_today);

  perform public.plan24_materialize_cl_check_schedules(v_cell_id, v_today, v_horizon);
  perform public.plan24_materialize_cil_check_schedules(v_cell_id, v_today, v_horizon);
  perform public.plan24_materialize_check_schedules(v_cell_id, v_today, v_horizon);
  perform public.plan24_materialize_quality_check_schedules(v_cell_id, v_today, v_horizon);
end
$$;

commit;
