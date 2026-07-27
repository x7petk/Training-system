-- Materialize Plan 24 checks (check, CL, CIL, Quality) for today + next 6 days,
-- then set ~95% of those events to complete per active cell roster.
--
-- Run (linked remote):
--   node_modules/supabase/bin/supabase db query --linked --yes -f scripts/complete-plan24-checks-next-7-days.sql

set statement_timeout = '0';
set lock_timeout = '120s';

begin;

do $$
declare
  cell_rec record;
  v_from date := current_date;
  v_to date := current_date + 6;
  d date;

  v_total int;
  v_target_complete int;
  v_already int;
  v_need int;
  v_excess int;
  v_marked int;
  v_unmarked int;
begin
  for cell_rec in
    select r.master_cell_id as cell_id
    from public.plan24_rosters r
    where r.is_active = true
    group by r.master_cell_id
    order by r.master_cell_id
  loop
    d := v_from;
    while d <= v_to loop
      perform public.plan24_materialize_check_schedules(cell_rec.cell_id, d, d);
      perform public.plan24_materialize_cl_check_schedules(cell_rec.cell_id, d, d);
      perform public.plan24_materialize_cil_check_schedules(cell_rec.cell_id, d, d);
      perform public.plan24_materialize_quality_check_schedules(cell_rec.cell_id, d, d);
      d := d + 1;
    end loop;

    select count(*)::int
    into v_total
    from public.plan24_events e
    where e.master_cell_id = cell_rec.cell_id
      and e.plan_date between v_from and v_to
      and e.deleted_at is null
      and lower(coalesce(e.event_type, '')) in (
        'check',
        'cl_check',
        'cil_check',
        'quality_check'
      );

    if v_total = 0 then
      raise notice 'Cell %: no check/CL/CIL/Quality events in %..% — skip.', cell_rec.cell_id, v_from, v_to;
      continue;
    end if;

    v_target_complete := greatest(0, floor(v_total * 0.95)::int);
    if v_target_complete >= v_total and v_total > 1 then
      v_target_complete := v_total - 1;
    end if;

    select count(*)::int
    into v_already
    from public.plan24_events e
    where e.master_cell_id = cell_rec.cell_id
      and e.plan_date between v_from and v_to
      and e.deleted_at is null
      and lower(coalesce(e.event_type, '')) in (
        'check',
        'cl_check',
        'cil_check',
        'quality_check'
      )
      and e.status = 'complete';

    v_excess := greatest(0, v_already - v_target_complete);
    if v_excess > 0 then
      with demote as (
        select e.id
        from public.plan24_events e
        where e.master_cell_id = cell_rec.cell_id
          and e.plan_date between v_from and v_to
          and e.deleted_at is null
          and lower(coalesce(e.event_type, '')) in (
            'check',
            'cl_check',
            'cil_check',
            'quality_check'
          )
          and e.status = 'complete'
        order by md5(e.id::text || v_from::text || 'demote')
        limit v_excess
      )
      update public.plan24_events e
      set
        status = 'scheduled',
        opened_at = null,
        completed_at = null,
        completed_by = null
      from demote
      where e.id = demote.id;

      get diagnostics v_unmarked = row_count;
      v_already := v_already - v_unmarked;
    else
      v_unmarked := 0;
    end if;

    v_need := greatest(0, v_target_complete - v_already);

    if v_need > 0 then
      with pick as (
        select e.id
        from public.plan24_events e
        where e.master_cell_id = cell_rec.cell_id
          and e.plan_date between v_from and v_to
          and e.deleted_at is null
          and lower(coalesce(e.event_type, '')) in (
            'check',
            'cl_check',
            'cil_check',
            'quality_check'
          )
          and e.status is distinct from 'complete'
        order by md5(e.id::text || v_from::text || 'complete')
        limit v_need
      )
      update public.plan24_events e
      set
        status = 'complete',
        opened_at = coalesce(e.opened_at, e.start_at + interval '5 minutes'),
        completed_at = least(e.end_at - interval '1 minute', e.start_at + interval '20 minutes')
      from pick
      where e.id = pick.id;

      get diagnostics v_marked = row_count;
    else
      v_marked := 0;
    end if;

    raise notice
      'Cell %: window %..% total=% target=% demoted=% newly_complete=%',
      cell_rec.cell_id,
      v_from,
      v_to,
      v_total,
      v_target_complete,
      v_unmarked,
      v_marked;
  end loop;
end
$$;

commit;
