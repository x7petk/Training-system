-- Copy today's "Today demo" Top Losses + Rewards to next 7 NZ days.
-- Idempotent: skips rows that already exist for target date.

begin;

do $$
declare
  v_src_date date := (now() at time zone 'Pacific/Auckland')::date;
  v_day int;
  v_dst_date date;
  src record;
  new_id uuid;
begin
  for v_day in 1..7 loop
    v_dst_date := v_src_date + v_day;

    -- Top losses
    for src in
      select
        e.master_cell_id,
        e.shift_kind,
        e.visible_surface,
        e.created_on_surface,
        e.top_loss,
        e.amount,
        e.type_option_id,
        e.immediate_cause,
        e.immediate_action,
        e.root_cause_option_id,
        e.problem_solve_option_id,
        e.created_by,
        e.updated_by
      from public.dds_tl_entries e
      where e.plan_date = v_src_date
        and e.visible_surface = 'line-dds'
        and e.top_loss like 'Today demo — %'
        and e.deleted_at is null
    loop
      if not exists (
        select 1
        from public.dds_tl_entries x
        where x.master_cell_id = src.master_cell_id
          and x.plan_date = v_dst_date
          and x.visible_surface = src.visible_surface
          and x.top_loss = src.top_loss
          and x.deleted_at is null
      ) then
        insert into public.dds_tl_entries (
          root_entry_id, master_cell_id, plan_date, shift_kind,
          visible_surface, created_on_surface,
          top_loss, amount, type_option_id,
          immediate_cause, immediate_action,
          root_cause_option_id, problem_solve_option_id,
          created_by, updated_by
        )
        values (
          null, src.master_cell_id, v_dst_date, src.shift_kind,
          src.visible_surface, src.created_on_surface,
          src.top_loss, src.amount, src.type_option_id,
          src.immediate_cause, src.immediate_action,
          src.root_cause_option_id, src.problem_solve_option_id,
          src.created_by, src.updated_by
        )
        returning id into new_id;

        update public.dds_tl_entries set root_entry_id = new_id where id = new_id;
      end if;
    end loop;

    -- Rewards
    for src in
      select
        r.master_cell_id,
        r.shift_kind,
        r.visible_surface,
        r.created_on_surface,
        r.name_mode,
        r.free_text_names,
        r.reason,
        r.value_option_id,
        r.behaviour_option_id,
        r.created_by,
        r.updated_by
      from public.dds_rr_entries r
      where r.plan_date = v_src_date
        and r.visible_surface = 'line-dds'
        and r.reason like 'Today demo — %'
        and r.deleted_at is null
    loop
      if not exists (
        select 1
        from public.dds_rr_entries x
        where x.master_cell_id = src.master_cell_id
          and x.plan_date = v_dst_date
          and x.visible_surface = src.visible_surface
          and x.reason = src.reason
          and x.deleted_at is null
      ) then
        insert into public.dds_rr_entries (
          root_entry_id, master_cell_id, plan_date, shift_kind,
          visible_surface, created_on_surface,
          name_mode, free_text_names, reason,
          value_option_id, behaviour_option_id,
          created_by, updated_by
        )
        values (
          null, src.master_cell_id, v_dst_date, src.shift_kind,
          src.visible_surface, src.created_on_surface,
          src.name_mode, src.free_text_names, src.reason,
          src.value_option_id, src.behaviour_option_id,
          src.created_by, src.updated_by
        )
        returning id into new_id;

        update public.dds_rr_entries set root_entry_id = new_id where id = new_id;
      end if;
    end loop;
  end loop;
end
$$;

commit;
