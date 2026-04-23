-- Idempotent seed: 2 CL + 2 CIL + 2 Quality templates with published v1, daily schedules,
-- and schedule role names that match this cell's Plan 24 roster columns (plan24_roster_roles.name)
-- so materialized events land on the day grid (see Plan24Page gridPlacedEvents).
--
-- Default cell matches scripts/seed-plan24-check-templates-and-schedules.sql.
-- Replace v_cell_id if your RTT cell differs.
--
-- Run (linked remote):
--   node_modules/supabase/bin/supabase db query --linked --yes -f scripts/seed-plan24-cl-cil-quality-demos.sql

begin;

do $$
declare
  v_cell_id uuid := 'b3000001-0000-4000-8000-000000000001';
  v_today date := current_date;
  v_horizon date := current_date + 90;

  -- CL
  cl_t1 uuid;
  cl_v1 uuid;
  cl_s1 uuid;
  cl_t2 uuid;
  cl_v2 uuid;
  cl_s2 uuid;
  -- CIL
  cil_t1 uuid;
  cil_v1 uuid;
  cil_s1 uuid;
  cil_t2 uuid;
  cil_v2 uuid;
  cil_s2 uuid;
  -- Quality
  q_t1 uuid;
  q_v1 uuid;
  q_s1 uuid;
  q_t2 uuid;
  q_v2 uuid;
  q_s2 uuid;
begin
  -- =======================================================================
  -- CL #1
  -- =======================================================================
  insert into public.plan24_cl_check_templates (master_cell_id, name, description)
  values (v_cell_id, 'Demo CL — GMP walkdown', 'Cleaning-level demo: line GMP walkdown.')
  on conflict (master_cell_id, name) do update set description = excluded.description
  returning id into cl_t1;

  insert into public.plan24_cl_check_template_versions (template_id, version_no, title, notes, state)
  values (cl_t1, 1, 'Demo CL — GMP walkdown v1', 'Seed checklist.', 'published')
  on conflict (template_id, version_no) do update
    set title = excluded.title, notes = excluded.notes, state = 'published'
  returning id into cl_v1;

  delete from public.plan24_cl_check_template_tasks where version_id = cl_v1;
  insert into public.plan24_cl_check_template_tasks (
    version_id, label, required, input_kind, sort_order,
    min_value, max_value, target_value, standard_description, photo_path
  )
  values
    (
      cl_v1, 'Walk path clear of debris', true, 'pass_fail', 0,
      null, null, null,
      E'Standard\n• Aisles and infeed/outfeed clear; no slip/trip hazards.\n• Document any blocked drains or spills before Pass.',
      'https://placehold.co/360x240/166534/ffffff/png?text=Walk+path'
    ),
    (
      cl_v1, 'Sanitizer concentration logged', true, 'number', 1,
      150, 250, 200,
      E'Standard\n• Target ~200 ppm (adjust to plant spec).\n• Values outside min/max are deviations — re-sample once, then Raise deviation.',
      'https://placehold.co/360x240/15803d/ffffff/png?text=Sanitizer'
    );

  update public.plan24_cl_check_template_versions
  set state = 'archived'
  where template_id = cl_t1 and id <> cl_v1 and state = 'published';

  select id into cl_s1 from public.plan24_cl_check_schedules
  where master_cell_id = v_cell_id and name = 'Demo CL — GMP walkdown (daily)';

  if cl_s1 is null then
    insert into public.plan24_cl_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, cl_t1, cl_v1, 'Demo CL — GMP walkdown (daily)', 'day',
      'daily', 1, '{}'::int[], time '06:20', 25, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into cl_s1;
  else
    update public.plan24_cl_check_schedules set
      template_id = cl_t1, template_version_id = cl_v1, shift_kind = 'day',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '06:20', duration_minutes = 25, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = cl_s1;
  end if;

  delete from public.plan24_cl_check_schedule_roles where schedule_id = cl_s1;
  insert into public.plan24_cl_check_schedule_roles (schedule_id, role_name) values
    (cl_s1, 'Team lead'),
    (cl_s1, 'Packing 1');

  -- =======================================================================
  -- CL #2
  -- =======================================================================
  insert into public.plan24_cl_check_templates (master_cell_id, name, description)
  values (v_cell_id, 'Demo CL — Panel hygiene', 'Cleaning-level demo: panel and guards.')
  on conflict (master_cell_id, name) do update set description = excluded.description
  returning id into cl_t2;

  insert into public.plan24_cl_check_template_versions (template_id, version_no, title, notes, state)
  values (cl_t2, 1, 'Demo CL — Panel hygiene v1', 'Seed checklist.', 'published')
  on conflict (template_id, version_no) do update
    set title = excluded.title, notes = excluded.notes, state = 'published'
  returning id into cl_v2;

  delete from public.plan24_cl_check_template_tasks where version_id = cl_v2;
  insert into public.plan24_cl_check_template_tasks (
    version_id, label, required, input_kind, sort_order,
    min_value, max_value, target_value, standard_description, photo_path
  )
  values
    (
      cl_v2, 'Guards seated and latched', true, 'pass_fail', 0,
      null, null, null,
      E'Standard\n• All guards seated, latched, and interlocks functional.\n• No bypassed interlocks.',
      'https://placehold.co/360x240/14532d/ffffff/png?text=Guards'
    ),
    (
      cl_v2, 'No fluid weeps at seal points', true, 'pass_fail', 1,
      null, null, null,
      E'Standard\n• Seals dry to touch after normal run; no active drips.\n• Wipe test shows no continuous weep.',
      'https://placehold.co/360x240/166534/ffffff/png?text=Seals'
    );

  update public.plan24_cl_check_template_versions
  set state = 'archived'
  where template_id = cl_t2 and id <> cl_v2 and state = 'published';

  select id into cl_s2 from public.plan24_cl_check_schedules
  where master_cell_id = v_cell_id and name = 'Demo CL — Panel hygiene (daily)';

  if cl_s2 is null then
    insert into public.plan24_cl_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, cl_t2, cl_v2, 'Demo CL — Panel hygiene (daily)', 'day',
      'daily', 1, '{}'::int[], time '14:05', 20, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into cl_s2;
  else
    update public.plan24_cl_check_schedules set
      template_id = cl_t2, template_version_id = cl_v2, shift_kind = 'day',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '14:05', duration_minutes = 20, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = cl_s2;
  end if;

  delete from public.plan24_cl_check_schedule_roles where schedule_id = cl_s2;
  insert into public.plan24_cl_check_schedule_roles (schedule_id, role_name) values
    (cl_s2, 'Packing 2');

  -- =======================================================================
  -- CIL #1
  -- =======================================================================
  insert into public.plan24_cil_check_templates (master_cell_id, name, description)
  values (v_cell_id, 'Demo CIL — Line clearance', 'Cleaning-in-place style clearance demo.')
  on conflict (master_cell_id, name) do update set description = excluded.description
  returning id into cil_t1;

  insert into public.plan24_cil_check_template_versions (template_id, version_no, title, notes, state)
  values (cil_t1, 1, 'Demo CIL — Line clearance v1', 'Seed checklist.', 'published')
  on conflict (template_id, version_no) do update
    set title = excluded.title, notes = excluded.notes, state = 'published'
  returning id into cil_v1;

  delete from public.plan24_cil_check_template_tasks where version_id = cil_v1;
  insert into public.plan24_cil_check_template_tasks (
    version_id, label, required, input_kind, sort_order,
    standard_description, photo_path, recurrence_kind, interval_n, weekdays, check_types, when_condition
  )
  values
    (
      cil_v1, 'Product cleared from belt', true, 'pass_fail', 0,
      E'Standard\n• Belt, guides, and catch pans are visibly free of product, film, and debris.\n• Scrap removed to waste stream; no rework material left on line.\n• Guards closed after clearance; photo shows clean run path.',
      'https://placehold.co/360x240/0f7668/ffffff/png?text=Product+cleared',
      'daily', 1, '{}'::int[], array['cleaning','inspection']::text[], 'running'
    ),
    (
      cil_v1, 'Drain ports opened', true, 'pass_fail', 1,
      E'Standard\n• Low-point drains opened per SOP sequence; verify flow to drain.\n• No standing fluid in dead legs after minimum drain time.\n• Caps tagged or staged for re-close after rinse.',
      'https://placehold.co/360x240/0e7490/ffffff/png?text=Drain+ports',
      'daily', 1, '{}'::int[], array['cleaning','inspection']::text[], 'down'
    );

  update public.plan24_cil_check_template_versions
  set state = 'archived'
  where template_id = cil_t1 and id <> cil_v1 and state = 'published';

  select id into cil_s1 from public.plan24_cil_check_schedules
  where master_cell_id = v_cell_id and name = 'Demo CIL — Line clearance (daily)';

  if cil_s1 is null then
    insert into public.plan24_cil_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, cil_t1, cil_v1, 'Demo CIL — Line clearance (daily)', 'day',
      'daily', 1, '{}'::int[], time '07:00', 35, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into cil_s1;
  else
    update public.plan24_cil_check_schedules set
      template_id = cil_t1, template_version_id = cil_v1, shift_kind = 'day',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '07:00', duration_minutes = 35, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = cil_s1;
  end if;

  delete from public.plan24_cil_check_schedule_roles where schedule_id = cil_s1;
  insert into public.plan24_cil_check_schedule_roles (schedule_id, role_name) values
    (cil_s1, 'Packing 3');

  -- =======================================================================
  -- CIL #2
  -- =======================================================================
  insert into public.plan24_cil_check_templates (master_cell_id, name, description)
  values (v_cell_id, 'Demo CIL — Deep rinse', 'CIL demo: rinse sequence checkpoints.')
  on conflict (master_cell_id, name) do update set description = excluded.description
  returning id into cil_t2;

  insert into public.plan24_cil_check_template_versions (template_id, version_no, title, notes, state)
  values (cil_t2, 1, 'Demo CIL — Deep rinse v1', 'Seed checklist.', 'published')
  on conflict (template_id, version_no) do update
    set title = excluded.title, notes = excluded.notes, state = 'published'
  returning id into cil_v2;

  delete from public.plan24_cil_check_template_tasks where version_id = cil_v2;
  insert into public.plan24_cil_check_template_tasks (
    version_id, label, required, input_kind, sort_order,
    standard_description, photo_path, recurrence_kind, interval_n, weekdays, check_types, when_condition
  )
  values
    (
      cil_v2, 'Rinse flow rate in range', true, 'number', 0,
      E'Standard\n• Flow within band on local indicator or SCADA tag for this step.\n• No cavitation noise at pump; strainer differential within limit if applicable.\n• Logged value matches shift target for rinse phase.',
      'https://placehold.co/360x240/155e75/ffffff/png?text=Flow+rate',
      'daily', 1, '{}'::int[], array['inspection']::text[], 'running'
    ),
    (
      cil_v2, 'Conductivity trend stable', true, 'pass_fail', 1,
      E'Standard\n• Conductivity curve flat or declining per SOP (no sudden spikes).\n• Sample point flushed before read if required.\n• Escalate if trend violates release criteria for end-of-rinse.',
      'https://placehold.co/360x240/115e59/ffffff/png?text=Conductivity',
      'daily', 1, '{}'::int[], array['inspection']::text[], 'running'
    );

  update public.plan24_cil_check_template_versions
  set state = 'archived'
  where template_id = cil_t2 and id <> cil_v2 and state = 'published';

  select id into cil_s2 from public.plan24_cil_check_schedules
  where master_cell_id = v_cell_id and name = 'Demo CIL — Deep rinse (daily)';

  if cil_s2 is null then
    insert into public.plan24_cil_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, cil_t2, cil_v2, 'Demo CIL — Deep rinse (daily)', 'day',
      'daily', 1, '{}'::int[], time '10:40', 40, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into cil_s2;
  else
    update public.plan24_cil_check_schedules set
      template_id = cil_t2, template_version_id = cil_v2, shift_kind = 'day',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '10:40', duration_minutes = 40, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = cil_s2;
  end if;

  delete from public.plan24_cil_check_schedule_roles where schedule_id = cil_s2;
  insert into public.plan24_cil_check_schedule_roles (schedule_id, role_name) values
    (cil_s2, 'Packing 4'),
    (cil_s2, 'Packing 5');

  -- =======================================================================
  -- Quality #1
  -- =======================================================================
  insert into public.plan24_quality_check_templates (master_cell_id, name, description)
  values (v_cell_id, 'Demo Quality — First-piece', 'Quality demo: first-piece verification.')
  on conflict (master_cell_id, name) do update set description = excluded.description
  returning id into q_t1;

  insert into public.plan24_quality_check_template_versions (template_id, version_no, title, notes, state)
  values (q_t1, 1, 'Demo Quality — First-piece v1', 'Seed checklist.', 'published')
  on conflict (template_id, version_no) do update
    set title = excluded.title, notes = excluded.notes, state = 'published'
  returning id into q_v1;

  delete from public.plan24_quality_check_template_tasks where version_id = q_v1;
  insert into public.plan24_quality_check_template_tasks (
    version_id, label, required, input_kind, sort_order,
    min_value, max_value, target_value, standard_description, photo_path
  )
  values
    (
      q_v1, 'Critical dimensions within spec', true, 'pass_fail', 0,
      null, null, null,
      E'Standard\n• First-piece critical dimensions recorded on inspection sheet.\n• Use Pass only when all callouts are within print tolerance.',
      'https://placehold.co/360x240/5b21b6/ffffff/png?text=Dimensions'
    ),
    (
      q_v1, 'Label match to BOM', true, 'pass_fail', 1,
      null, null, null,
      E'Standard\n• SKU, revision, and quantity match active BOM line.\n• Any mismatch is Fail — Record quality fail.',
      'https://placehold.co/360x240/6d28d9/ffffff/png?text=Label'
    );

  update public.plan24_quality_check_template_versions
  set state = 'archived'
  where template_id = q_t1 and id <> q_v1 and state = 'published';

  select id into q_s1 from public.plan24_quality_check_schedules
  where master_cell_id = v_cell_id and name = 'Demo Quality — First-piece (daily)';

  if q_s1 is null then
    insert into public.plan24_quality_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, q_t1, q_v1, 'Demo Quality — First-piece (daily)', 'day',
      'daily', 1, '{}'::int[], time '08:30', 30, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into q_s1;
  else
    update public.plan24_quality_check_schedules set
      template_id = q_t1, template_version_id = q_v1, shift_kind = 'day',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '08:30', duration_minutes = 30, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = q_s1;
  end if;

  delete from public.plan24_quality_check_schedule_roles where schedule_id = q_s1;
  insert into public.plan24_quality_check_schedule_roles (schedule_id, role_name) values
    (q_s1, 'Packing 6');

  -- =======================================================================
  -- Quality #2
  -- =======================================================================
  insert into public.plan24_quality_check_templates (master_cell_id, name, description)
  values (v_cell_id, 'Demo Quality — Line audit', 'Quality demo: hourly line audit sweep.')
  on conflict (master_cell_id, name) do update set description = excluded.description
  returning id into q_t2;

  insert into public.plan24_quality_check_template_versions (template_id, version_no, title, notes, state)
  values (q_t2, 1, 'Demo Quality — Line audit v1', 'Seed checklist.', 'published')
  on conflict (template_id, version_no) do update
    set title = excluded.title, notes = excluded.notes, state = 'published'
  returning id into q_v2;

  delete from public.plan24_quality_check_template_tasks where version_id = q_v2;
  insert into public.plan24_quality_check_template_tasks (
    version_id, label, required, input_kind, sort_order,
    min_value, max_value, target_value, standard_description, photo_path
  )
  values
    (
      q_v2, 'Sampling points honored', true, 'pass_fail', 0,
      null, null, null,
      E'Standard\n• Samples taken only at approved points; no ad-hoc grabs.\n• Chain-of-custody labels applied.',
      'https://placehold.co/360x240/6d28d9/ffffff/png?text=Sampling'
    ),
    (
      q_v2, 'Line speed vs setpoint', true, 'number', 1,
      48, 52, 50,
      E'Standard\n• Log actual line speed; target 50 (demo band 48–52).\n• Outside band → Fail and Record quality fail.',
      'https://placehold.co/360x240/4c1d95/ffffff/png?text=Speed'
    );

  update public.plan24_quality_check_template_versions
  set state = 'archived'
  where template_id = q_t2 and id <> q_v2 and state = 'published';

  select id into q_s2 from public.plan24_quality_check_schedules
  where master_cell_id = v_cell_id and name = 'Demo Quality — Line audit (daily)';

  if q_s2 is null then
    insert into public.plan24_quality_check_schedules (
      master_cell_id, template_id, template_version_id, name, shift_kind,
      recurrence_kind, interval_n, weekdays, start_local_time, duration_minutes,
      starts_on, timezone, state
    )
    values (
      v_cell_id, q_t2, q_v2, 'Demo Quality — Line audit (daily)', 'day',
      'daily', 1, '{}'::int[], time '15:50', 25, v_today, 'Pacific/Auckland', 'active'
    )
    returning id into q_s2;
  else
    update public.plan24_quality_check_schedules set
      template_id = q_t2, template_version_id = q_v2, shift_kind = 'day',
      recurrence_kind = 'daily', interval_n = 1, weekdays = '{}'::int[],
      start_local_time = time '15:50', duration_minutes = 25, starts_on = v_today,
      timezone = 'Pacific/Auckland', state = 'active'
    where id = q_s2;
  end if;

  delete from public.plan24_quality_check_schedule_roles where schedule_id = q_s2;
  insert into public.plan24_quality_check_schedule_roles (schedule_id, role_name) values
    (q_s2, 'Team lead'),
    (q_s2, 'Packing 2');

  -- =======================================================================
  -- Regenerate scheduled events (today → horizon)
  -- =======================================================================
  perform public.plan24_reset_cl_check_schedule_future_events(cl_s1, v_today);
  perform public.plan24_reset_cl_check_schedule_future_events(cl_s2, v_today);
  perform public.plan24_reset_cil_check_schedule_future_events(cil_s1, v_today);
  perform public.plan24_reset_cil_check_schedule_future_events(cil_s2, v_today);
  perform public.plan24_reset_quality_check_schedule_future_events(q_s1, v_today);
  perform public.plan24_reset_quality_check_schedule_future_events(q_s2, v_today);

  perform public.plan24_materialize_cl_check_schedules(v_cell_id, v_today, v_horizon);
  perform public.plan24_materialize_cil_check_schedules(v_cell_id, v_today, v_horizon);
  perform public.plan24_materialize_quality_check_schedules(v_cell_id, v_today, v_horizon);
end
$$;

commit;
