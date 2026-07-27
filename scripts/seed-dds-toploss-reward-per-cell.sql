-- Seed 3 top losses + 3 rewards per cell (line-dds) for today + next 14 NZ days.
-- Idempotent by deterministic text keys.

set statement_timeout = '0';
set lock_timeout = '120s';

begin;

do $$
declare
  v_today date := (now() at time zone 'Pacific/Auckland')::date;
  v_plan_date date;
  v_day_offset int;
  v_days_ahead int := 14;
  v_shift text := 'day_night';
  c record;
  tl_type uuid;
  tl_root uuid;
  tl_ps uuid;
  rr_value uuid;
  rr_behaviour uuid;
  i int;
  v_id uuid;
  v_loss text;
  v_reason text;
begin
  select id into tl_type from public.dds_tl_type_options order by sort_order limit 1;
  select id into tl_root from public.dds_tl_root_cause_options order by sort_order limit 1;
  select id into tl_ps from public.dds_tl_problem_solve_options order by sort_order limit 1;

  select id into rr_value from public.dds_rr_value_options order by sort_order limit 1;
  select b.id into rr_behaviour
  from public.dds_rr_behaviour_options b
  where b.value_option_id = rr_value
  order by b.sort_order
  limit 1;

  if tl_type is null or tl_root is null or tl_ps is null or rr_value is null or rr_behaviour is null then
    raise exception 'Missing DDS top-loss / reward config options';
  end if;

  for v_day_offset in 0..v_days_ahead loop
    v_plan_date := v_today + v_day_offset;

  for c in
    select id, name
    from public.master_cells
    where id in (
      'b3000001-0000-4000-8000-000000000001',
      'b3000001-0000-4000-8000-000000000002',
      'b3000001-0000-4000-8000-000000000003',
      'b3000001-0000-4000-8000-000000000004'
    )
    order by sort_order, name
  loop
    for i in 1..3 loop
      v_loss := format('Today demo — %s — top loss %s', c.name, i);
      if not exists (
        select 1 from public.dds_tl_entries e
        where e.master_cell_id = c.id
          and e.plan_date = v_plan_date
          and e.visible_surface = 'line-dds'
          and e.top_loss = v_loss
          and e.deleted_at is null
      ) then
        insert into public.dds_tl_entries (
          root_entry_id, master_cell_id, plan_date, shift_kind,
          visible_surface, created_on_surface,
          top_loss, amount, type_option_id,
          immediate_cause, immediate_action,
          root_cause_option_id, problem_solve_option_id
        )
        values (
          null, c.id, v_plan_date, v_shift,
          'line-dds', 'line-dds',
          v_loss,
          case i when 1 then '14.2%' when 2 then '11.7%' else '9.9%' end,
          tl_type,
          case i when 1 then 'Short stop cluster around startup' when 2 then 'Frequent changeover resets' else 'Minor waiting for material' end,
          case i when 1 then 'Assigned tech + operator reset checklist' when 2 then 'Pre-stage changeover kit' else 'Escalated to planning for staging' end,
          tl_root,
          tl_ps
        )
        returning id into v_id;

        update public.dds_tl_entries set root_entry_id = v_id where id = v_id;
      end if;
    end loop;

    for i in 1..3 loop
      v_reason := format('Today demo — %s — reward %s', c.name, i);
      if not exists (
        select 1 from public.dds_rr_entries r
        where r.master_cell_id = c.id
          and r.plan_date = v_plan_date
          and r.visible_surface = 'line-dds'
          and r.reason = v_reason
          and r.deleted_at is null
      ) then
        insert into public.dds_rr_entries (
          root_entry_id, master_cell_id, plan_date, shift_kind,
          visible_surface, created_on_surface,
          name_mode, free_text_names, reason,
          value_option_id, behaviour_option_id
        )
        values (
          null, c.id, v_plan_date, v_shift,
          'line-dds', 'line-dds',
          'free_text',
          case i when 1 then 'Team lead' when 2 then 'Packing team' else 'Quality checker' end,
          v_reason,
          rr_value,
          rr_behaviour
        )
        returning id into v_id;

        update public.dds_rr_entries set root_entry_id = v_id where id = v_id;
      end if;
    end loop;
  end loop;

  end loop;
end
$$;

commit;
