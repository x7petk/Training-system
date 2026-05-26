-- Copy today's demo P2P audits + answers to next 7 NZ days.
-- Idempotent by (cell, date, shift, role, sheet_comment='Today demo —P2P').

begin;

do $$
declare
  v_src_date date := (now() at time zone 'Pacific/Auckland')::date;
  v_day int;
  v_dst_date date;
  src_audit record;
  src_ans record;
  v_new_audit_id uuid;
begin
  for v_day in 1..7 loop
    v_dst_date := v_src_date + v_day;

    for src_audit in
      select a.*
      from public.dds_p2p_audits a
      where a.plan_date = v_src_date
        and a.sheet_comment = 'Today demo —P2P'
    loop
      select x.id
      into v_new_audit_id
      from public.dds_p2p_audits x
      where x.master_cell_id = src_audit.master_cell_id
        and x.plan_date = v_dst_date
        and x.shift_kind = src_audit.shift_kind
        and x.roster_role_id = src_audit.roster_role_id
        and x.sheet_comment = src_audit.sheet_comment
      limit 1;

      if v_new_audit_id is null then
        insert into public.dds_p2p_audits (
          master_cell_id,
          plan_date,
          shift_kind,
          roster_role_id,
          submitted_by,
          submitted_at,
          sheet_comment
        )
        values (
          src_audit.master_cell_id,
          v_dst_date,
          src_audit.shift_kind,
          src_audit.roster_role_id,
          src_audit.submitted_by,
          src_audit.submitted_at + make_interval(days => v_day),
          src_audit.sheet_comment
        )
        returning id into v_new_audit_id;

        for src_ans in
          select an.*
          from public.dds_p2p_audit_answers an
          where an.audit_id = src_audit.id
        loop
          insert into public.dds_p2p_audit_answers (
            audit_id,
            question_kind,
            standard_question_id,
            soft_question_id,
            answer_yes_no,
            answer_number,
            question_comment,
            kpi_link_value,
            kpi_link_comment
          )
          values (
            v_new_audit_id,
            src_ans.question_kind,
            src_ans.standard_question_id,
            src_ans.soft_question_id,
            src_ans.answer_yes_no,
            src_ans.answer_number,
            src_ans.question_comment,
            src_ans.kpi_link_value,
            src_ans.kpi_link_comment
          );
        end loop;
      end if;
    end loop;
  end loop;
end
$$;

commit;
