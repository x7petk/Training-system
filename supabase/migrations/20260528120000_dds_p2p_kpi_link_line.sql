-- P2P linked yes/no answers for by-line KPIs: which production line the incident applies to.

alter table public.dds_p2p_audit_answers
  add column if not exists kpi_link_line_id uuid references public.dds_cell_lines (id) on delete set null;

comment on column public.dds_p2p_audit_answers.kpi_link_line_id is
  'When linked KPI site_dds_presentation is by_line, required alongside kpi_link_value for Yes answers.';

alter table public.dds_kpi_line_entries
  add column if not exists p2p_breakdown jsonb;

comment on column public.dds_kpi_line_entries.p2p_breakdown is
  'JSON array from P2P rollups: { roster_role_id, role_name, question_key, prompt, value, comment, line_id?, line_name? }.';

notify pgrst, 'reload schema';
