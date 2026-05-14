-- KPIs under each DDS KPI group (point kind: hard / hard optional / soft).

create type public.dds_kpi_point_kind as enum (
  'hard_point',
  'hard_point_optional',
  'soft_point'
);

grant usage on type public.dds_kpi_point_kind to authenticated;

create table public.dds_kpis (
  id uuid primary key default gen_random_uuid(),
  kpi_group_id uuid not null references public.dds_kpi_groups (id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  point_kind public.dds_kpi_point_kind not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dds_kpis_kpi_group_id_idx on public.dds_kpis (kpi_group_id);

create unique index dds_kpis_group_label_lower_idx
  on public.dds_kpis (kpi_group_id, lower(label));

alter table public.dds_kpis enable row level security;

create policy "dds_kpis_select_dds"
  on public.dds_kpis for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_kpis_insert_admin"
  on public.dds_kpis for insert to authenticated
  with check (public.is_app_admin());

create policy "dds_kpis_update_admin"
  on public.dds_kpis for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_kpis_delete_admin"
  on public.dds_kpis for delete to authenticated
  using (public.is_app_admin());

grant select, insert, update, delete on public.dds_kpis to authenticated;

notify pgrst, 'reload schema';
