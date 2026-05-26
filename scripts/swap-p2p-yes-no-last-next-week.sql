-- Swap P2P yes/no answers for last calendar week and next calendar week (Mon–Sun, Pacific/Auckland).
-- Recomputes linked KPI rollups (p2p_breakdown) for affected cell / date / shift tuples.
--
-- Run:
--   node_modules/supabase/bin/supabase db query --linked --yes -f scripts/swap-p2p-yes-no-last-next-week.sql

begin;

do $$
declare
  v_today date := (now() at time zone 'Pacific/Auckland')::date;
  v_this_week_monday date := date_trunc('week', v_today::timestamp)::date;
  v_last_week_start date := v_this_week_monday - 7;
  v_last_week_end date := v_this_week_monday - 1;
  v_next_week_start date := v_this_week_monday + 7;
  v_next_week_end date := v_this_week_monday + 13;
  v_swap_count int;
  v_scope record;
  v_kpi_id uuid;
  v_parts jsonb;
  v_sum numeric;
  v_had_p2p boolean;
begin
  raise notice 'NZ today: %', v_today;
  raise notice 'Last week: % .. %', v_last_week_start, v_last_week_end;
  raise notice 'Next week: % .. %', v_next_week_start, v_next_week_end;

  select count(*)::int
  into v_swap_count
  from public.dds_p2p_audit_answers ans
  join public.dds_p2p_audits a on a.id = ans.audit_id
  where ans.answer_yes_no is not null
    and (
      a.plan_date between v_last_week_start and v_last_week_end
      or a.plan_date between v_next_week_start and v_next_week_end
    );

  raise notice 'Yes/no answers to swap: %', v_swap_count;

  update public.dds_p2p_audit_answers ans
  set answer_yes_no = not ans.answer_yes_no
  from public.dds_p2p_audits a
  where ans.audit_id = a.id
    and ans.answer_yes_no is not null
    and (
      a.plan_date between v_last_week_start and v_last_week_end
      or a.plan_date between v_next_week_start and v_next_week_end
    );

  raise notice 'Swapped % rows', v_swap_count;

  for v_scope in
    select distinct a.master_cell_id, a.plan_date, a.shift_kind
    from public.dds_p2p_audits a
    where a.plan_date between v_last_week_start and v_last_week_end
       or a.plan_date between v_next_week_start and v_next_week_end
  loop
    for v_kpi_id in
      select distinct l.kpi_id
      from (
        select sq.linked_kpi_id as kpi_id
        from public.dds_p2p_standard_questions sq
        where sq.linked_kpi_id is not null
        union
        select cq.linked_kpi_id as kpi_id
        from public.dds_p2p_cell_soft_point_questions cq
        where cq.master_cell_id = v_scope.master_cell_id
          and cq.linked_kpi_id is not null
      ) l
    loop
      with latest_audits as (
        select distinct on (a.roster_role_id)
          a.id as audit_id,
          a.roster_role_id
        from public.dds_p2p_audits a
        where a.master_cell_id = v_scope.master_cell_id
          and a.plan_date = v_scope.plan_date
          and a.shift_kind = v_scope.shift_kind
        order by a.roster_role_id, a.submitted_at desc
      ),
      linked_std as (
        select sq.id
        from public.dds_p2p_standard_questions sq
        where sq.linked_kpi_id = v_kpi_id
      ),
      linked_soft as (
        select cq.id
        from public.dds_p2p_cell_soft_point_questions cq
        where cq.master_cell_id = v_scope.master_cell_id
          and cq.linked_kpi_id = v_kpi_id
      ),
      parts as (
        select jsonb_agg(
          jsonb_build_object(
            'roster_role_id', la.roster_role_id,
            'role_name', coalesce(rr.name, la.roster_role_id::text),
            'question_key',
              case
                when ans.question_kind = 'standard' then 'standard:' || ans.standard_question_id::text
                else 'soft:' || ans.soft_question_id::text
              end,
            'prompt', coalesce(sq.prompt, cq.prompt, ''),
            'value', ans.kpi_link_value::numeric,
            'comment', trim(coalesce(ans.kpi_link_comment, ''))
          )
          order by rr.name, coalesce(sq.prompt, cq.prompt, '')
        ) as breakdown,
        coalesce(sum(ans.kpi_link_value::numeric), 0) as total
        from latest_audits la
        join public.dds_p2p_audit_answers ans on ans.audit_id = la.audit_id
        left join public.plan24_roster_roles rr on rr.id = la.roster_role_id
        left join public.dds_p2p_standard_questions sq
          on ans.question_kind = 'standard' and sq.id = ans.standard_question_id
        left join public.dds_p2p_cell_soft_point_questions cq
          on ans.question_kind = 'soft' and cq.id = ans.soft_question_id
        where ans.answer_yes_no is true
          and ans.kpi_link_value is not null
          and trim(coalesce(ans.kpi_link_comment, '')) <> ''
          and (
            (ans.question_kind = 'standard' and ans.standard_question_id in (select id from linked_std))
            or (ans.question_kind = 'soft' and ans.soft_question_id in (select id from linked_soft))
          )
      )
      select p.breakdown, p.total
      into v_parts, v_sum
      from parts p;

      select exists (
        select 1
        from public.dds_kpi_cell_entries e
        where e.master_cell_id = v_scope.master_cell_id
          and e.kpi_id = v_kpi_id
          and e.plan_date = v_scope.plan_date
          and e.shift_kind = v_scope.shift_kind
          and e.p2p_breakdown is not null
          and jsonb_array_length(e.p2p_breakdown) > 0
      )
      into v_had_p2p;

      if v_parts is null or jsonb_array_length(v_parts) = 0 then
        if v_had_p2p then
          update public.dds_kpi_cell_entries e
          set
            value_numeric = null,
            comment = null,
            p2p_breakdown = null,
            updated_at = now()
          where e.master_cell_id = v_scope.master_cell_id
            and e.kpi_id = v_kpi_id
            and e.plan_date = v_scope.plan_date
            and e.shift_kind = v_scope.shift_kind;
        end if;
      else
        insert into public.dds_kpi_cell_entries (
          master_cell_id,
          kpi_id,
          plan_date,
          shift_kind,
          value_numeric,
          comment,
          p2p_breakdown,
          updated_at
        )
        values (
          v_scope.master_cell_id,
          v_kpi_id,
          v_scope.plan_date,
          v_scope.shift_kind,
          v_sum,
          null,
          v_parts,
          now()
        )
        on conflict (master_cell_id, kpi_id, plan_date, shift_kind)
        do update set
          value_numeric = excluded.value_numeric,
          comment = excluded.comment,
          p2p_breakdown = excluded.p2p_breakdown,
          updated_at = excluded.updated_at;
      end if;
    end loop;
  end loop;

  raise notice 'KPI P2P rollups refreshed for scoped dates.';
end
$$;

commit;
