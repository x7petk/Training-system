-- Cell soft point questions belong to a KPI group (like global P2P standard).

delete from public.dds_p2p_cell_soft_point_questions;

drop index if exists public.dds_p2p_cell_soft_point_questions_cell_prompt_lower_idx;

alter table public.dds_p2p_cell_soft_point_questions
  add column kpi_group_id uuid not null references public.dds_kpi_groups (id) on delete cascade;

create unique index dds_p2p_cell_soft_point_questions_cell_group_prompt_lower_idx
  on public.dds_p2p_cell_soft_point_questions (master_cell_id, kpi_group_id, lower(prompt));

create index dds_p2p_cell_soft_point_questions_cell_group_idx
  on public.dds_p2p_cell_soft_point_questions (master_cell_id, kpi_group_id);

notify pgrst, 'reload schema';
