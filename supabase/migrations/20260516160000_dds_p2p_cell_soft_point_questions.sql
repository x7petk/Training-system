-- Per-cell P2P soft point questions (yes/no or number+target); not tied to KPIs.

drop policy if exists "dds_p2p_cell_soft_points_select_dds" on public.dds_p2p_cell_soft_points;
drop policy if exists "dds_p2p_cell_soft_points_insert_admin" on public.dds_p2p_cell_soft_points;
drop policy if exists "dds_p2p_cell_soft_points_update_admin" on public.dds_p2p_cell_soft_points;
drop policy if exists "dds_p2p_cell_soft_points_delete_admin" on public.dds_p2p_cell_soft_points;

drop trigger if exists dds_p2p_cell_soft_points_enforce_soft_kpi on public.dds_p2p_cell_soft_points;
drop function if exists public.dds_p2p_cell_soft_points_enforce_soft_kpi();

drop table if exists public.dds_p2p_cell_soft_points;

create table public.dds_p2p_cell_soft_point_questions (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  prompt text not null,
  response_kind public.dds_p2p_response_kind not null,
  target_number numeric,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dds_p2p_cell_soft_point_questions_target_matches_kind check (
    (response_kind = 'yes_no'::public.dds_p2p_response_kind and target_number is null)
    or
    (response_kind = 'number_with_target'::public.dds_p2p_response_kind and target_number is not null)
  )
);

create unique index dds_p2p_cell_soft_point_questions_cell_prompt_lower_idx
  on public.dds_p2p_cell_soft_point_questions (master_cell_id, lower(prompt));

create index dds_p2p_cell_soft_point_questions_master_cell_id_idx
  on public.dds_p2p_cell_soft_point_questions (master_cell_id);

alter table public.dds_p2p_cell_soft_point_questions enable row level security;

create policy "dds_p2p_cell_soft_point_questions_select_dds"
  on public.dds_p2p_cell_soft_point_questions for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_p2p_cell_soft_point_questions_insert_admin"
  on public.dds_p2p_cell_soft_point_questions for insert to authenticated
  with check (public.is_app_admin());

create policy "dds_p2p_cell_soft_point_questions_update_admin"
  on public.dds_p2p_cell_soft_point_questions for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_p2p_cell_soft_point_questions_delete_admin"
  on public.dds_p2p_cell_soft_point_questions for delete to authenticated
  using (public.is_app_admin());

grant select, insert, update, delete on public.dds_p2p_cell_soft_point_questions to authenticated;

notify pgrst, 'reload schema';
