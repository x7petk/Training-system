-- P2P standard: questions belong to KPI groups (remove separate category table).

drop policy if exists "dds_p2p_standard_questions_select_dds" on public.dds_p2p_standard_questions;
drop policy if exists "dds_p2p_standard_questions_insert_admin" on public.dds_p2p_standard_questions;
drop policy if exists "dds_p2p_standard_questions_update_admin" on public.dds_p2p_standard_questions;
drop policy if exists "dds_p2p_standard_questions_delete_admin" on public.dds_p2p_standard_questions;

drop table if exists public.dds_p2p_standard_questions;

drop policy if exists "dds_p2p_standard_categories_select_dds" on public.dds_p2p_standard_categories;
drop policy if exists "dds_p2p_standard_categories_insert_admin" on public.dds_p2p_standard_categories;
drop policy if exists "dds_p2p_standard_categories_update_admin" on public.dds_p2p_standard_categories;
drop policy if exists "dds_p2p_standard_categories_delete_admin" on public.dds_p2p_standard_categories;

drop table if exists public.dds_p2p_standard_categories;

create table public.dds_p2p_standard_questions (
  id uuid primary key default gen_random_uuid(),
  kpi_group_id uuid not null references public.dds_kpi_groups (id) on delete cascade,
  prompt text not null,
  response_kind public.dds_p2p_response_kind not null,
  target_number numeric,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dds_p2p_standard_questions_target_matches_kind check (
    (response_kind = 'yes_no'::public.dds_p2p_response_kind and target_number is null)
    or
    (response_kind = 'number_with_target'::public.dds_p2p_response_kind and target_number is not null)
  )
);

create index dds_p2p_standard_questions_kpi_group_id_idx
  on public.dds_p2p_standard_questions (kpi_group_id);

alter table public.dds_p2p_standard_questions enable row level security;

create policy "dds_p2p_standard_questions_select_dds"
  on public.dds_p2p_standard_questions for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_p2p_standard_questions_insert_admin"
  on public.dds_p2p_standard_questions for insert to authenticated
  with check (public.is_app_admin());

create policy "dds_p2p_standard_questions_update_admin"
  on public.dds_p2p_standard_questions for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_p2p_standard_questions_delete_admin"
  on public.dds_p2p_standard_questions for delete to authenticated
  using (public.is_app_admin());

grant select, insert, update, delete on public.dds_p2p_standard_questions to authenticated;

notify pgrst, 'reload schema';
