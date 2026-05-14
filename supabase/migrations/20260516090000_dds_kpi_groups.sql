-- DDS Process: KPI groups per master cell (where each group appears in DDS areas).

-- ---------------------------------------------------------------------------
-- Access helper (profiles.can_access_dds_process)
-- ---------------------------------------------------------------------------

create or replace function public.app_user_can_access_dds()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.can_access_dds_process from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

grant execute on function public.app_user_can_access_dds() to authenticated;

-- ---------------------------------------------------------------------------
-- KPI groups
-- ---------------------------------------------------------------------------

create table public.dds_kpi_groups (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  -- Route segment keys under /dds-process/ (e.g. p2p, shift-dds, line-compliance).
  display_sections text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index dds_kpi_groups_cell_name_lower_idx
  on public.dds_kpi_groups (master_cell_id, lower(name));

create index dds_kpi_groups_master_cell_id_idx
  on public.dds_kpi_groups (master_cell_id);

alter table public.dds_kpi_groups enable row level security;

create policy "dds_kpi_groups_select_dds"
  on public.dds_kpi_groups for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_kpi_groups_insert_admin"
  on public.dds_kpi_groups for insert to authenticated
  with check (public.is_app_admin());

create policy "dds_kpi_groups_update_admin"
  on public.dds_kpi_groups for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_kpi_groups_delete_admin"
  on public.dds_kpi_groups for delete to authenticated
  using (public.is_app_admin());

grant select, insert, update, delete on public.dds_kpi_groups to authenticated;

notify pgrst, 'reload schema';
