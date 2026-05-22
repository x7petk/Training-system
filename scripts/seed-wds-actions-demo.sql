-- Demo seed: System & Capability actions per WDS column (mixed statuses / overdue).
-- Run after migration 20260522160000_wds_actions.sql:
--   npx supabase db query --linked --yes -f scripts/seed-wds-actions-demo.sql

begin;

do $$
declare
  col record;
  hc uuid;
  owners text[] := array['Alex Kim', 'Sam Patel', 'Jordan Lee', 'Morgan Chen', 'Riley Ng'];
  titles_system text[] := array[
    'Standardise changeover checklist',
    'Update LOTO procedure on filler',
    'Align KPI definitions with plant',
    'Review alarm response playbook',
    'Close gap on PPE station signage'
  ];
  titles_cap text[] := array[
    'Train team on new SPC chart',
    'Coach operators on centre-lining',
    'Run problem-solving on repeat fail',
    'Shadow shift handover quality',
    'Build visual management board'
  ];
  statuses text[] := array['not_started', 'in_progress', 'off_track', 'completed', 'not_required'];
  i int;
  n int;
  kind text;
  t text;
  st text;
  off int;
begin
  for col in
    select c.id as column_id, c.master_cell_id as cell_id, c.sort_order
    from public.dds_wds_columns c
    order by c.master_cell_id, c.sort_order, c.created_at
  loop
    select t.id into hc
    from public.hc_types t
    where t.active
    order by t.sort_order, t.name
    offset (col.sort_order % greatest(1, (select count(*)::int from public.hc_types where active)))
    limit 1;

    n := 2 + (abs(hashtext(col.column_id::text)) % 3);
    for i in 0 .. n - 1 loop
      kind := case when i % 2 = 0 then 'system' else 'capability' end;
      if kind = 'system' then
        t := titles_system[1 + (abs(hashtext(col.column_id::text || i::text)) % array_length(titles_system, 1))];
      else
        t := titles_cap[1 + (abs(hashtext(col.column_id::text || (i + 7)::text)) % array_length(titles_cap, 1))];
      end if;
      st := statuses[1 + (abs(hashtext(col.column_id::text || i::text)) % array_length(statuses, 1))];
      off := case
        when st in ('completed', 'not_required') then (3 + (i % 5))
        when st = 'off_track' then -(2 + (i % 4))
        else (i % 5) - 7
      end;

      insert into public.dds_wds_actions (
        dds_wds_column_id,
        master_cell_id,
        kind,
        title,
        owner_name,
        target_date,
        status,
        hc_type_id,
        sort_order
      )
      select
        col.column_id,
        col.cell_id,
        kind,
        t,
        owners[1 + (abs(hashtext(col.column_id::text || i::text)) % array_length(owners, 1))],
        (current_date + off)::date,
        st,
        hc,
        i * 10
      where not exists (
        select 1 from public.dds_wds_actions a
        where a.dds_wds_column_id = col.column_id and lower(a.title) = lower(t)
      );
    end loop;
  end loop;
end $$;

commit;
