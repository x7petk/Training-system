-- P2P standard: global categories (toggle active) and questions per category (yes/no or number + target).

create type public.dds_p2p_response_kind as enum (
  'yes_no',
  'number_with_target'
);

grant usage on type public.dds_p2p_response_kind to authenticated;

create table public.dds_p2p_standard_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index dds_p2p_standard_categories_name_lower_idx
  on public.dds_p2p_standard_categories (lower(name));

create table public.dds_p2p_standard_questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.dds_p2p_standard_categories (id) on delete cascade,
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

create index dds_p2p_standard_questions_category_id_idx
  on public.dds_p2p_standard_questions (category_id);

alter table public.dds_p2p_standard_categories enable row level security;
alter table public.dds_p2p_standard_questions enable row level security;

create policy "dds_p2p_standard_categories_select_dds"
  on public.dds_p2p_standard_categories for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_p2p_standard_categories_insert_admin"
  on public.dds_p2p_standard_categories for insert to authenticated
  with check (public.is_app_admin());

create policy "dds_p2p_standard_categories_update_admin"
  on public.dds_p2p_standard_categories for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_p2p_standard_categories_delete_admin"
  on public.dds_p2p_standard_categories for delete to authenticated
  using (public.is_app_admin());

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

grant select, insert, update, delete on public.dds_p2p_standard_categories to authenticated;
grant select, insert, update, delete on public.dds_p2p_standard_questions to authenticated;

notify pgrst, 'reload schema';
