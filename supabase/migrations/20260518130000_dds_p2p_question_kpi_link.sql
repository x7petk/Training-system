-- Optional KPI link on P2P questions (yes/no "No" path → incident count + comment, rolled up into KPI cell entries).

alter table public.dds_p2p_standard_questions
  add column if not exists linked_kpi_id uuid references public.dds_kpis (id) on delete set null;

alter table public.dds_p2p_cell_soft_point_questions
  add column if not exists linked_kpi_id uuid references public.dds_kpis (id) on delete set null;

create index if not exists dds_p2p_standard_questions_linked_kpi_idx
  on public.dds_p2p_standard_questions (linked_kpi_id)
  where linked_kpi_id is not null;

create index if not exists dds_p2p_cell_soft_point_questions_linked_kpi_idx
  on public.dds_p2p_cell_soft_point_questions (linked_kpi_id)
  where linked_kpi_id is not null;

comment on column public.dds_p2p_standard_questions.linked_kpi_id is
  'When set on a yes/no question, answering No requires KPI incident count + comment; values roll up across roles into dds_kpi_cell_entries.';

comment on column public.dds_p2p_cell_soft_point_questions.linked_kpi_id is
  'Same as dds_p2p_standard_questions.linked_kpi_id, scoped to this cell.';

alter table public.dds_p2p_audit_answers
  add column if not exists kpi_link_value numeric,
  add column if not exists kpi_link_comment text;

comment on column public.dds_p2p_audit_answers.kpi_link_value is
  'Incident-style count for a linked yes/no question answered No (per role revision).';

comment on column public.dds_p2p_audit_answers.kpi_link_comment is
  'Required explanation alongside kpi_link_value for linked No answers.';

alter table public.dds_kpi_cell_entries
  add column if not exists p2p_breakdown jsonb;

comment on column public.dds_kpi_cell_entries.p2p_breakdown is
  'JSON array: { roster_role_id, role_name, question_key, prompt, value, comment } from latest P2P audits per role; value_numeric is the sum of value.';

notify pgrst, 'reload schema';
