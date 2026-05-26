-- Copy today's demo KPIs + DDS actions to next 7 NZ days.
-- Idempotent: updates/inserts by natural keys.

begin;

do $$
declare
  v_src_date date := (now() at time zone 'Pacific/Auckland')::date;
  v_day int;
  v_dst_date date;
  src record;
  v_new_id uuid;
  v_shift_days interval;
begin
  for v_day in 1..7 loop
    v_dst_date := v_src_date + v_day;
    v_shift_days := make_interval(days => v_day);

    -- 1) KPI tile entries (Safety/Quality/Production, day_night) for powder/cheese demo cells
    for src in
      select
        e.master_cell_id,
        e.kpi_id,
        e.shift_kind,
        e.value_numeric,
        e.comment,
        e.plan24_manual_override,
        e.p2p_breakdown,
        e.updated_by
      from public.dds_kpi_cell_entries e
      join public.dds_kpis k on k.id = e.kpi_id
      join public.dds_kpi_groups g on g.id = k.kpi_group_id
      where e.plan_date = v_src_date
        and e.shift_kind = 'day_night'
        and lower(g.name) in ('safety', 'quality', 'production')
        and e.master_cell_id in (
          'b3000001-0000-4000-8000-000000000001',
          'b3000001-0000-4000-8000-000000000002',
          'b3000001-0000-4000-8000-000000000003',
          'b3000001-0000-4000-8000-000000000004'
        )
    loop
      insert into public.dds_kpi_cell_entries (
        master_cell_id, kpi_id, plan_date, shift_kind,
        value_numeric, comment, plan24_manual_override, p2p_breakdown, updated_by
      )
      values (
        src.master_cell_id, src.kpi_id, v_dst_date, src.shift_kind,
        src.value_numeric, src.comment, src.plan24_manual_override, src.p2p_breakdown, src.updated_by
      )
      on conflict (master_cell_id, kpi_id, plan_date, shift_kind) do update set
        value_numeric = excluded.value_numeric,
        comment = excluded.comment,
        plan24_manual_override = excluded.plan24_manual_override,
        p2p_breakdown = excluded.p2p_breakdown,
        updated_by = excluded.updated_by,
        updated_at = now();
    end loop;

    -- 2) KPI by-line entries (Production by-line table values)
    for src in
      select
        e.master_cell_id,
        e.line_id,
        e.kpi_id,
        e.shift_kind,
        e.value_numeric,
        e.comment,
        e.updated_by
      from public.dds_kpi_line_entries e
      where e.plan_date = v_src_date
        and e.shift_kind = 'day_night'
        and e.master_cell_id in (
          'b3000001-0000-4000-8000-000000000001',
          'b3000001-0000-4000-8000-000000000002',
          'b3000001-0000-4000-8000-000000000003',
          'b3000001-0000-4000-8000-000000000004'
        )
    loop
      insert into public.dds_kpi_line_entries (
        master_cell_id, line_id, kpi_id, plan_date, shift_kind,
        value_numeric, comment, updated_by
      )
      values (
        src.master_cell_id, src.line_id, src.kpi_id, v_dst_date, src.shift_kind,
        src.value_numeric, src.comment, src.updated_by
      )
      on conflict (line_id, kpi_id, plan_date, shift_kind) do update set
        value_numeric = excluded.value_numeric,
        comment = excluded.comment,
        updated_by = excluded.updated_by,
        updated_at = now();
    end loop;

    -- 3) DDS actions (Today demo titles)
    for src in
      select
        e.*
      from public.plan24_events e
      where e.plan_date = v_src_date
        and e.event_type = 'dds_action'
        and e.title like 'Today demo —%'
        and e.deleted_at is null
    loop
      if not exists (
        select 1
        from public.plan24_events x
        where x.master_cell_id = src.master_cell_id
          and x.plan_date = v_dst_date
          and x.shift_kind = src.shift_kind
          and x.event_type = 'dds_action'
          and x.title = src.title
          and x.deleted_at is null
      ) then
        insert into public.plan24_events (
          roster_id,
          master_cell_id,
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
          opened_at,
          completed_at,
          completed_by,
          linked_issue_kind,
          linked_issue_id,
          linked_issue_created_at,
          sub_tasks,
          comment,
          schedule_id,
          template_version_id,
          schedule_occurrence_at,
          assigned_person_id,
          dds_display_surfaces,
          cil_template_id,
          created_by
        )
        values (
          src.roster_id,
          src.master_cell_id,
          v_dst_date,
          src.shift_kind,
          src.role_name,
          src.schedule_role_name,
          src.title,
          src.event_type,
          src.source,
          src.start_at + v_shift_days,
          src.end_at + v_shift_days,
          src.status,
          case when src.opened_at is null then null else src.opened_at + v_shift_days end,
          case when src.completed_at is null then null else src.completed_at + v_shift_days end,
          src.completed_by,
          src.linked_issue_kind,
          src.linked_issue_id,
          case when src.linked_issue_created_at is null then null else src.linked_issue_created_at + v_shift_days end,
          src.sub_tasks,
          src.comment,
          src.schedule_id,
          src.template_version_id,
          case when src.schedule_occurrence_at is null then null else src.schedule_occurrence_at + v_shift_days end,
          src.assigned_person_id,
          src.dds_display_surfaces,
          src.cil_template_id,
          src.created_by
        )
        returning id into v_new_id;
      end if;
    end loop;
  end loop;
end
$$;

commit;
