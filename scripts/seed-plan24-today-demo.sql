-- Today demo: Plan24 ~95% complete, 6 DDS actions, issues, P2P all roles yes, Line DDS KPI values.
-- Default cell: Darfield Powder. Idempotent via "Today demo —" title / sheet_comment prefix.
--
-- Run:
--   npx supabase db query --linked --yes -f scripts/seed-plan24-today-demo.sql

begin;

create or replace function pg_temp.demo_roll(p_key text)
returns integer
language sql
immutable
as $$
  select (abs(hashtextextended(p_key, 0)) % 100)::integer;
$$;

create or replace function pg_temp.demo_kpi_value(p_scoring jsonb, p_in_target boolean, p_key text)
returns numeric
language plpgsql
immutable
as $$
declare
  k text := coalesce(p_scoring->>'kind', 'no_target');
  t numeric;
  tmin numeric;
  tmax numeric;
  tol numeric;
  j numeric := (pg_temp.demo_roll(p_key || ':j') % 400)::numeric / 100.0;
begin
  case k
    when 'pass_fail' then
      return case when p_in_target then 1 else 0 end;
    when 'min_red' then
      t := (p_scoring->>'target')::numeric;
      if p_in_target then return t + j; end if;
      return greatest(t - 2 - j, 0);
    when 'max_red' then
      t := (p_scoring->>'target')::numeric;
      if p_in_target then return greatest(t - j, 0); end if;
      return t + 1 + j;
    when 'range_green' then
      tmin := (p_scoring->>'min')::numeric;
      tmax := (p_scoring->>'max')::numeric;
      if p_in_target then return tmin + (tmax - tmin) * (0.15 + j / 5.0); end if;
      if pg_temp.demo_roll(p_key || ':side') % 2 = 0 then return tmin - 1 - j; end if;
      return tmax + 1 + j;
    when 'symmetric_abs' then
      t := (p_scoring->>'target')::numeric;
      tol := (p_scoring->>'tolerance')::numeric;
      if p_in_target then return t + (j - 0.2) * tol; end if;
      return t + tol * (1.2 + j);
    when 'symmetric_pct' then
      t := (p_scoring->>'target')::numeric;
      tol := (abs(t) * (p_scoring->>'tolerancePct')::numeric) / 100.0;
      if p_in_target then return t + (j - 0.2) * tol; end if;
      return t + tol * (1.5 + j);
    else
      return j;
  end case;
end;
$$;

do $$
declare
  v_cell_id uuid := 'b3000001-0000-4000-8000-000000000001';
  v_roster_id uuid := 'c1000001-0000-4000-8000-000000000001';
  -- Match Plan24 / DDS scope bar (Pacific/Auckland), not UTC current_date.
  v_today date := (now() at time zone 'Pacific/Auckland')::date;
  v_tz text := 'Pacific/Auckland';
  v_shift_p2p text := 'day';
  v_shift_kpi text := 'day_night';
  v_prefix text := 'Today demo —';
  v_user_id uuid;

  v_total int;
  v_target_complete int;
  v_marked int;

  v_dev_type_id uuid;
  v_dh_type_id uuid;
  v_ev_id uuid;
  v_cil_tpl uuid;
  v_issue_id uuid;

  act_rec record;
  role_rec record;
  asn record;
  kpi record;
  ln record;
  v_response_kind text;
  v_target_number numeric;
  v_audit_id uuid;
  prod_kpi record;
  cell_rec record;
  v_key text;
  v_in_target boolean;
  v_val numeric;
  v_person_offset int := 0;
  v_role_name text;
  v_person_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_slot int;
  v_closed int;
begin
  select u.id into v_user_id from auth.users u order by u.created_at limit 1;
  if v_user_id is null then
    raise exception 'No auth.users row — cannot seed P2P audits.';
  end if;

  perform public.plan24_materialize_check_schedules(v_cell_id, v_today, v_today);
  perform public.plan24_materialize_cl_check_schedules(v_cell_id, v_today, v_today);
  perform public.plan24_materialize_cil_check_schedules(v_cell_id, v_today, v_today);
  perform public.plan24_materialize_quality_check_schedules(v_cell_id, v_today, v_today);

  -- Remove prior today-demo P2P rows for this date
  delete from public.dds_p2p_audit_answers ans
  using public.dds_p2p_audits aud
  where ans.audit_id = aud.id
    and aud.master_cell_id = v_cell_id
    and aud.plan_date = v_today
    and aud.shift_kind = v_shift_p2p
    and coalesce(aud.sheet_comment, '') = v_prefix || 'P2P';

  delete from public.dds_p2p_audits aud
  where aud.master_cell_id = v_cell_id
    and aud.plan_date = v_today
    and aud.shift_kind = v_shift_p2p
    and coalesce(aud.sheet_comment, '') = v_prefix || 'P2P';

  -- Six DDS actions for today
  for act_rec in
    select *
    from (
      values
        (1, 'day'::text, time '07:30', 40, 'DDS action 1 — shift start review'),
        (2, 'day'::text, time '09:15', 35, 'DDS action 2 — CL gap follow-up'),
        (3, 'day'::text, time '11:00', 45, 'DDS action 3 — CIL defect containment'),
        (4, 'day'::text, time '13:30', 30, 'DDS action 4 — quality hold check'),
        (5, 'night'::text, time '18:45', 40, 'DDS action 5 — night handover'),
        (6, 'night'::text, time '21:10', 35, 'DDS action 6 — end-of-day close-out')
    ) as t(ord, shift_kind, start_local, duration_min, title_suffix)
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
    if v_person_id is null then continue; end if;

    insert into public.plan24_role_day_assignments (roster_id, plan_date, shift_kind, role_name, person_id)
    values (v_roster_id, v_today, act_rec.shift_kind, v_role_name, v_person_id)
    on conflict (roster_id, plan_date, shift_kind, role_name) do update
      set person_id = excluded.person_id;

    v_start := ((v_today + act_rec.start_local)::timestamp) at time zone v_tz;
    v_end := v_start + make_interval(mins => act_rec.duration_min);

    if not exists (
      select 1
      from public.plan24_events e
      where e.master_cell_id = v_cell_id
        and e.plan_date = v_today
        and e.shift_kind = act_rec.shift_kind
        and e.event_type = 'dds_action'
        and e.title = v_prefix || act_rec.title_suffix
        and e.deleted_at is null
    ) then
      insert into public.plan24_events (
        master_cell_id, roster_id, plan_date, shift_kind,
        role_name, schedule_role_name, title, event_type, source,
        start_at, end_at, status, sub_tasks, assigned_person_id, comment, dds_display_surfaces
      )
      values (
        v_cell_id, v_roster_id, v_today, act_rec.shift_kind,
        v_role_name, v_role_name, v_prefix || act_rec.title_suffix,
        'dds_action', 'ad_hoc',
        v_start, v_end, 'scheduled', '[]'::jsonb, v_person_id,
        'Seeded DDS action for today demo.',
        array['line-dds', 'plant-dds', 'site-dds']::text[]
      );
    end if;
  end loop;

  -- ~95% completion for today only
  select count(*)::int
  into v_total
  from public.plan24_events e
  where e.master_cell_id = v_cell_id
    and e.plan_date = v_today
    and e.deleted_at is null
    and lower(coalesce(e.event_type, '')) in (
      'check', 'cl_check', 'cil_check', 'quality_check', 'dds_action'
    );

  if v_total = 0 then
    raise notice 'No plan24 events for % — run schedule seeds first.', v_today;
  else
    v_target_complete := greatest(0, floor(v_total * 0.95)::int);
    if v_target_complete >= v_total and v_total > 1 then
      v_target_complete := v_total - 1;
    end if;

    update public.plan24_events e
    set status = 'scheduled', opened_at = null, completed_at = null, completed_by = null
    where e.master_cell_id = v_cell_id
      and e.plan_date = v_today
      and e.deleted_at is null
      and lower(coalesce(e.event_type, '')) in (
        'check', 'cl_check', 'cil_check', 'quality_check', 'dds_action'
      );

    with pick as (
      select e.id
      from public.plan24_events e
      where e.master_cell_id = v_cell_id
        and e.plan_date = v_today
        and e.deleted_at is null
        and lower(coalesce(e.event_type, '')) in (
          'check', 'cl_check', 'cil_check', 'quality_check', 'dds_action'
        )
      order by md5(e.id::text || v_today::text)
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
    raise notice 'Today %: total=%, target_complete=%, marked_complete=%', v_today, v_total, v_target_complete, v_marked;
  end if;

  -- Issue catalogues
  select dt.id into v_dev_type_id
  from public.deviation_types dt
  where dt.is_active = true
  order by dt.sort_order, dt.label
  limit 1;

  select dt.id into v_dh_type_id
  from public.dh_defect_types dt
  where dt.is_active = true
  order by dt.sort_order, dt.label
  limit 1;

  if v_dev_type_id is not null then
    for v_slot in 1..2 loop
      if not exists (
        select 1 from public.deviations x
        where x.master_cell_id = v_cell_id
          and x.title = v_prefix || format('Deviation %s', v_slot)
          and x.deleted_at is null
      ) then
        select evpick.id into v_ev_id
        from (
          select e.id, row_number() over (order by e.id) as rn
          from public.plan24_events e
          where e.master_cell_id = v_cell_id
            and e.plan_date = v_today
            and e.deleted_at is null
            and lower(coalesce(e.event_type, '')) = 'cl_check'
        ) evpick
        where evpick.rn = v_slot
        limit 1;

        insert into public.deviations (
          master_cell_id, defect_type_id, title, description,
          area, equipment, status, priority, location_summary, created_by
        )
        values (
          v_cell_id, v_dev_type_id,
          v_prefix || format('Deviation %s', v_slot),
          'Seeded deviation for today demo.',
          'Production', 'Filler', 'open', 'medium', 'Production / Filler', null
        )
        returning id into v_issue_id;

        if v_ev_id is not null then
          update public.plan24_events e
          set
            status = 'complete',
            opened_at = coalesce(e.opened_at, e.start_at + interval '3 minutes'),
            completed_at = coalesce(e.completed_at, least(e.end_at - interval '1 minute', e.start_at + interval '18 minutes')),
            linked_issue_kind = 'deviation',
            linked_issue_id = v_issue_id,
            linked_issue_created_at = coalesce(e.linked_issue_created_at, now())
          where e.id = v_ev_id;
        end if;
      end if;
    end loop;
  end if;

  if v_dh_type_id is not null then
    -- Close 3 oldest open defects (not today-demo titles)
    with close_pick as (
      select x.id
      from public.dh_defects x
      where x.master_cell_id = v_cell_id
        and x.status in ('open', 'in_progress')
        and x.deleted_at is null
        and x.title not like v_prefix || '%'
      order by x.created_at
      limit 3
    )
    update public.dh_defects d
    set
      status = 'closed',
      closed_at = ((v_today::text || ' 15:00:00')::timestamp at time zone v_tz),
      resolved_at = coalesce(d.resolved_at, ((v_today::text || ' 14:30:00')::timestamp at time zone v_tz)),
      updated_at = now()
    from close_pick c
    where d.id = c.id;

    get diagnostics v_closed = row_count;
    raise notice 'Closed % existing defects for today demo.', v_closed;

    for v_slot in 1..2 loop
      if exists (
        select 1 from public.dh_defects x
        where x.master_cell_id = v_cell_id
          and x.title = v_prefix || format('Defect %s', v_slot)
          and x.deleted_at is null
      ) then
        continue;
      end if;

      select evpick.id, evpick.cil_template_id
      into v_ev_id, v_cil_tpl
      from (
        select e.id, e.cil_template_id, row_number() over (order by e.id) as rn
        from public.plan24_events e
        where e.master_cell_id = v_cell_id
          and e.plan_date = v_today
          and e.deleted_at is null
          and lower(coalesce(e.event_type, '')) = 'cil_check'
      ) evpick
      where evpick.rn = v_slot + 2
      limit 1;

      insert into public.dh_defects (
        master_cell_id, defect_type_id, title, description,
        area, equipment, status, priority, location_summary,
        created_by, cil_template_id, cil_template_task_id
      )
      values (
        v_cell_id, v_dh_type_id,
        v_prefix || format('Defect %s', v_slot),
        'Seeded defect for today demo.',
        'Production', 'Line', 'open', 'medium', 'Production / Line',
        null, v_cil_tpl, null
      )
      returning id into v_issue_id;

      if v_ev_id is not null then
        update public.plan24_events e
        set
          status = 'complete',
          opened_at = coalesce(e.opened_at, e.start_at + interval '3 minutes'),
          completed_at = coalesce(e.completed_at, least(e.end_at - interval '1 minute', e.start_at + interval '15 minutes')),
          linked_issue_kind = 'dh_defect',
          linked_issue_id = v_issue_id,
          linked_issue_created_at = coalesce(e.linked_issue_created_at, now())
        where e.id = v_ev_id;
      end if;
    end loop;
  end if;

  -- P2P: all roster roles, day shift, all answers yes
  for role_rec in
    select rr.id as role_id, rr.name as role_name
    from public.plan24_roster_roles rr
    where rr.roster_id = v_roster_id
      and rr.is_active = true
    order by rr.sort_order, rr.name
  loop
    insert into public.dds_p2p_audits (
      master_cell_id, plan_date, shift_kind, roster_role_id, submitted_by, sheet_comment
    )
    values (
      v_cell_id, v_today, v_shift_p2p, role_rec.role_id, v_user_id, v_prefix || 'P2P'
    )
    returning id into v_audit_id;

    for asn in
      select
        asg.question_kind,
        asg.standard_question_id,
        asg.soft_question_id
      from public.dds_p2p_cell_question_role_assignments asg
      where asg.master_cell_id = v_cell_id
        and asg.roster_role_id = role_rec.role_id
    loop
      if asn.question_kind = 'standard' then
        select sq.response_kind, sq.target_number
        into v_response_kind, v_target_number
        from public.dds_p2p_standard_questions sq
        where sq.id = asn.standard_question_id;

        insert into public.dds_p2p_audit_answers (
          audit_id, question_kind, standard_question_id, soft_question_id,
          answer_yes_no, answer_number, question_comment, kpi_link_value, kpi_link_comment
        )
        values (
          v_audit_id, 'standard', asn.standard_question_id, null,
          case when v_response_kind = 'yes_no' then true else null end,
          case when v_response_kind = 'number_with_target' then v_target_number else null end,
          null, null, null
        );
      else
        select sq.response_kind, sq.target_number
        into v_response_kind, v_target_number
        from public.dds_p2p_cell_soft_point_questions sq
        where sq.id = asn.soft_question_id;

        insert into public.dds_p2p_audit_answers (
          audit_id, question_kind, standard_question_id, soft_question_id,
          answer_yes_no, answer_number, question_comment, kpi_link_value, kpi_link_comment
        )
        values (
          v_audit_id, 'soft', null, asn.soft_question_id,
          case when v_response_kind = 'yes_no' then true else null end,
          case when v_response_kind = 'number_with_target' then v_target_number else null end,
          null, null, null
        );
      end if;
    end loop;
  end loop;

  raise notice 'P2P audits seeded for all active roster roles (%).', v_shift_p2p;

  -- Line DDS KPI tile values (Safety / Quality), ~95% in target — powder + cheese cells
  for cell_rec in
    select c.id, c.name
    from public.master_cells c
    where lower(c.name) like '%powder%'
       or lower(c.name) like '%cheese%'
       or lower(c.name) like '%cream%'
    order by c.sort_order, c.name
  loop
    for kpi in
      select k.id, k.label, k.scoring
      from public.dds_kpis k
      join public.dds_kpi_groups g on g.id = k.kpi_group_id
      where lower(g.name) in ('safety', 'quality')
        and 'line-dds' = any(k.display_sections)
        and coalesce(k.site_dds_presentation, '') <> 'by_line'
      order by g.sort_order, k.sort_order
    loop
      v_key := cell_rec.id::text || ':' || kpi.id::text || ':' || v_today::text;
      v_in_target := pg_temp.demo_roll(v_key) < 95;
      v_val := pg_temp.demo_kpi_value(kpi.scoring, v_in_target, v_key);

      insert into public.dds_kpi_cell_entries (
        master_cell_id, kpi_id, plan_date, shift_kind,
        value_numeric, comment, plan24_manual_override
      )
      values (
        cell_rec.id, kpi.id, v_today, v_shift_kpi,
        round(v_val::numeric, 2),
        case when not v_in_target then v_prefix || ' below target' else null end,
        true
      )
      on conflict (master_cell_id, kpi_id, plan_date, shift_kind) do update set
        value_numeric = excluded.value_numeric,
        comment = excluded.comment,
        plan24_manual_override = true,
        updated_at = now();
    end loop;
  end loop;

  raise notice 'Line DDS Safety/Quality tile values seeded for powder/cheese cells on %.', v_today;

  -- Production by-line KPIs (Line DDS table) — powder + cheese/cream cells
  for cell_rec in
    select c.id, c.name
    from public.master_cells c
    where lower(c.name) like '%powder%'
       or lower(c.name) like '%cheese%'
       or lower(c.name) like '%cream%'
    order by c.sort_order, c.name
  loop
    for ln in
      select id
      from public.dds_cell_lines
      where master_cell_id = cell_rec.id
        and active
      order by sort_order, name
    loop
      for prod_kpi in
        select k.id, k.scoring
        from public.dds_kpis k
        join public.dds_kpi_groups g on g.id = k.kpi_group_id
        where lower(g.name) = 'production'
          and k.site_dds_presentation = 'by_line'
        order by k.sort_order
      loop
        v_key := cell_rec.id::text || ':' || ln.id::text || ':' || prod_kpi.id::text || ':' || v_today::text;
        v_in_target := pg_temp.demo_roll(v_key) < 95;
        v_val := pg_temp.demo_kpi_value(prod_kpi.scoring, v_in_target, v_key);

        insert into public.dds_kpi_line_entries (
          master_cell_id, line_id, kpi_id, plan_date, shift_kind, value_numeric, comment
        )
        values (
          cell_rec.id, ln.id, prod_kpi.id, v_today, v_shift_kpi,
          round(v_val::numeric, 2),
          case when not v_in_target then v_prefix || ' below target' else null end
        )
        on conflict (line_id, kpi_id, plan_date, shift_kind) do update set
          value_numeric = excluded.value_numeric,
          comment = excluded.comment,
          updated_at = now();
      end loop;
    end loop;
  end loop;

  raise notice 'Production by-line KPI values seeded for powder/cheese cells on %.', v_today;
end;
$$;

drop function if exists pg_temp.demo_kpi_value(jsonb, boolean, text);
drop function if exists pg_temp.demo_roll(text);

commit;
