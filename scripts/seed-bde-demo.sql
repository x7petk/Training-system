-- 8 demo BDE records with varied dates, types, AODC codes, and actions for Trends/Actions reports.
-- Default cell: Darfield Powder. Idempotent via "Demo BDE —" title prefix.
--
-- Run:
--   node_modules/supabase/bin/supabase db query --linked --yes -f scripts/seed-bde-demo.sql

set statement_timeout = '0';

begin;

do $$
declare
  v_cell uuid := 'b3000001-0000-4000-8000-000000000001';
  v_area uuid;
  v_equip uuid[] := array[]::uuid[];
  v_eq uuid;
  v_types uuid[];
  v_acts uuid[];
  v_objs uuid[];
  v_dmgs uuid[];
  v_causes uuid[];
  v_people uuid[];
  r record;
  i int;
  v_bde uuid;
  v_title text;
  v_status text;
  v_type uuid;
  v_created timestamptz;
  v_prefix text := 'Demo BDE — ';
  v_names text[] := array[
    'Feedpump seal leak',
    'Chlorine dosing fault',
    'Baghouse differential high',
    'Homogeniser vibration spike',
    'HP pump room packing weep',
    'Concentrate tank level fault',
    '25kg bag filler mis-seal',
    'Niro dryer CIP valve stick'
  ];
  v_equip_names text[] := array[
    'Mills',
    'Niro Dryer',
    '25kg Bag Filler',
    'Concentrate Tanks',
    'Homogeniser',
    'HP Pump Room',
    'Baghouse',
    'Condensate System'
  ];
  v_days_ago int[] := array[42, 35, 28, 21, 14, 10, 5, 1];
  v_statuses text[] := array[
    'completed', 'saved', 'completed', 'saved',
    'completed', 'saved', 'saved', 'completed'
  ];
begin
  if not exists (select 1 from public.master_cells where id = v_cell) then
    raise notice 'Demo cell missing; skip BDE seed.';
    return;
  end if;

  -- Soft-delete prior demo BDEs (and cascade-friendly: actions soft-deleted with records later via filter)
  update public.bde_actions a
  set deleted_at = now()
  where a.deleted_at is null
    and a.bde_id in (
      select id from public.bde_records
      where master_cell_id = v_cell and title like v_prefix || '%' and deleted_at is null
    );

  update public.bde_records
  set deleted_at = now()
  where master_cell_id = v_cell
    and deleted_at is null
    and title like v_prefix || '%';

  -- Ensure a Production (or demo) area + 8 equipment for chart variety
  select id into v_area
  from public.master_areas
  where cell_id = v_cell
  order by case when lower(name) = 'production' then 0 else 1 end, sort_order, name
  limit 1;

  if v_area is null then
    insert into public.master_areas (cell_id, name, sort_order)
    values (v_cell, 'Production', 0)
    returning id into v_area;
  end if;

  foreach i in array array[1,2,3,4,5,6,7,8]
  loop
    select e.id into v_eq
    from public.master_equipment e
    where e.area_id = v_area and e.name = v_equip_names[i]
    limit 1;
    if v_eq is null then
      insert into public.master_equipment (area_id, name, sort_order)
      values (v_area, v_equip_names[i], i)
      returning id into v_eq;
    end if;
    v_equip := array_append(v_equip, v_eq);
  end loop;

  select coalesce(array_agg(id order by sort_order), array[]::uuid[])
  into v_types
  from public.bde_problem_types where is_active;

  select coalesce(array_agg(id order by sort_order), array[]::uuid[])
  into v_acts from public.bde_activity_codes where is_active;

  select coalesce(array_agg(id order by sort_order), array[]::uuid[])
  into v_objs from public.bde_object_part_codes where is_active;

  select coalesce(array_agg(id order by sort_order), array[]::uuid[])
  into v_dmgs from public.bde_damage_codes where is_active;

  select coalesce(array_agg(id order by sort_order), array[]::uuid[])
  into v_causes from public.bde_cause_codes where is_active;

  select coalesce(array_agg(id), array[]::uuid[])
  into v_people
  from (
    select id from public.people order by display_name nulls last limit 8
  ) p;

  for i in 1..8 loop
    v_title := v_prefix || v_names[i];
    v_status := v_statuses[i];
    v_created := (current_timestamp - make_interval(days => v_days_ago[i])) - make_interval(hours => i * 2);
    if coalesce(array_length(v_types, 1), 0) > 0 then
      v_type := v_types[1 + ((i - 1) % array_length(v_types, 1))];
    else
      v_type := null;
    end if;

    insert into public.bde_records (
      display_id, master_cell_id, area_id, equipment_id, problem_type_id, status, title,
      problem_statement, functional_location, component_part,
      what_happened, what_was_checked, what_were_the_results,
      notification_number, work_order_number,
      created_by_name, updated_by_name, ips_reference,
      created_at, updated_at
    ) values (
      '',
      v_cell,
      v_area,
      v_equip[i],
      v_type,
      v_status,
      v_title,
      'Dummy problem statement for ' || v_names[i] || '. Used to exercise BDE reports and AODC trends.',
      'FL-' || lpad(i::text, 3, '0'),
      'Component ' || i,
      'Observed abnormal condition on ' || v_equip_names[i] || ' during shift checks.',
      'Visual inspection, vibration / seals / sensors as applicable.',
      case when v_status = 'completed'
        then 'Corrective work completed; returned to normal operation.'
        else 'Investigation in progress; interim containment in place.'
      end,
      'N-' || (1000 + i)::text,
      case when i % 2 = 0 then 'WO-' || (2000 + i)::text else null end,
      case
        when coalesce(array_length(v_people, 1), 0) > 0
          then (select coalesce(nullif(trim(coalesce(first_name,'')||' '||coalesce(last_name,'')), ''), display_name, 'Demo')
                from public.people where id = v_people[1 + ((i - 1) % array_length(v_people, 1))])
        else 'Demo'
      end,
      'Demo',
      case when i in (1, 4, 8) then 'IPS-DEMO-0' || i::text else null end,
      v_created,
      v_created + interval '3 hours'
    )
    returning id into v_bde;

    -- Force timestamps (touch trigger may bump updated_at on later updates; set both again)
    update public.bde_records
    set created_at = v_created, updated_at = v_created + interval '3 hours'
    where id = v_bde;

    -- AODC: full AODC on half, partial on others
    if coalesce(array_length(v_acts, 1), 0) > 0 then
      insert into public.bde_record_codes (bde_id, code_kind, code_id)
      values (v_bde, 'activity', v_acts[1 + ((i - 1) % array_length(v_acts, 1))]);
    end if;
    if coalesce(array_length(v_objs, 1), 0) > 0 and i in (1, 2, 3, 5, 7, 8) then
      insert into public.bde_record_codes (bde_id, code_kind, code_id)
      values (v_bde, 'object_part', v_objs[1 + ((i - 1) % array_length(v_objs, 1))]);
    end if;
    if coalesce(array_length(v_dmgs, 1), 0) > 0 and i in (1, 3, 4, 5, 6, 8) then
      insert into public.bde_record_codes (bde_id, code_kind, code_id)
      values (v_bde, 'damage', v_dmgs[1 + ((i - 1) % array_length(v_dmgs, 1))]);
    end if;
    if coalesce(array_length(v_causes, 1), 0) > 0 and i in (1, 2, 4, 5, 7, 8) then
      insert into public.bde_record_codes (bde_id, code_kind, code_id)
      values (v_bde, 'cause', v_causes[1 + ((i - 1) % array_length(v_causes, 1))]);
    end if;

    if coalesce(array_length(v_people, 1), 0) > 0 then
      insert into public.bde_record_team_members (bde_id, person_id)
      values (v_bde, v_people[1 + ((i - 1) % array_length(v_people, 1))])
      on conflict do nothing;
    end if;

    -- 1–2 actions per BDE with mixed status
    insert into public.bde_actions (
      display_id, bde_id, title, status, due_date, owner_person_id, system_text,
      created_at, updated_at
    ) values (
      '',
      v_bde,
      'Containment / inspection for ' || v_names[i],
      case when i % 3 = 1 then 'completed' when i % 3 = 2 then 'in_progress' else 'open' end,
      case when i % 4 = 0 then null else (current_date + ((i % 7) - 2)) end,
      case when coalesce(array_length(v_people, 1), 0) > 0
        then v_people[1 + ((i - 1) % array_length(v_people, 1))]
        else null end,
      case (i % 4)
        when 1 then 'Maintenance'
        when 2 then 'Process'
        when 3 then 'CIL'
        else 'Reliability'
      end,
      v_created + interval '1 hour',
      v_created + interval '2 hours'
    );

    if i in (1, 3, 5, 8) then
      insert into public.bde_actions (
        display_id, bde_id, title, status, due_date, owner_person_id, system_text,
        created_at, updated_at
      ) values (
        '',
        v_bde,
        'Follow-up standard update — ' || v_equip_names[i],
        case when i = 1 then 'completed' else 'open' end,
        current_date + 7,
        case when coalesce(array_length(v_people, 1), 0) > 0
          then v_people[1 + (i % array_length(v_people, 1))]
          else null end,
        'SWP',
        v_created + interval '4 hours',
        v_created + interval '5 hours'
      );
    end if;
  end loop;

  raise notice 'Seeded 8 demo BDEs with codes and actions for cell %', v_cell;
end $$;

commit;
