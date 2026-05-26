-- Insert answer_yes_no = false for assigned yes/no P2P questions missing from an audit.
--
-- Run:
--   node_modules/supabase/bin/supabase db query --linked --yes -f scripts/backfill-p2p-missing-yes-no-answers.sql

begin;

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
select
  a.id,
  'standard',
  asn.standard_question_id,
  null,
  false,
  null,
  null,
  null,
  null
from public.dds_p2p_audits a
join public.dds_p2p_cell_question_role_assignments asn
  on asn.master_cell_id = a.master_cell_id
  and asn.roster_role_id = a.roster_role_id
  and asn.question_kind = 'standard'
join public.dds_p2p_standard_questions sq on sq.id = asn.standard_question_id
where coalesce(sq.response_kind, 'yes_no') = 'yes_no'
  and not exists (
    select 1
    from public.dds_p2p_audit_answers ex
    where ex.audit_id = a.id
      and ex.question_kind = 'standard'
      and ex.standard_question_id = asn.standard_question_id
  );

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
select
  a.id,
  'soft',
  null,
  asn.soft_question_id,
  false,
  null,
  null,
  null,
  null
from public.dds_p2p_audits a
join public.dds_p2p_cell_question_role_assignments asn
  on asn.master_cell_id = a.master_cell_id
  and asn.roster_role_id = a.roster_role_id
  and asn.question_kind = 'soft'
join public.dds_p2p_cell_soft_point_questions cq
  on cq.id = asn.soft_question_id
  and cq.master_cell_id = a.master_cell_id
where coalesce(cq.response_kind, 'yes_no') = 'yes_no'
  and not exists (
    select 1
    from public.dds_p2p_audit_answers ex
    where ex.audit_id = a.id
      and ex.question_kind = 'soft'
      and ex.soft_question_id = asn.soft_question_id
  );

commit;
