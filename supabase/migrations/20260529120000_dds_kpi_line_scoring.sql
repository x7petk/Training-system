-- Per-line KPI scoring overrides for by-line (table) presentation.

create table if not exists public.dds_kpi_line_scoring (
  kpi_id uuid not null references public.dds_kpis (id) on delete cascade,
  line_id uuid not null references public.dds_cell_lines (id) on delete cascade,
  scoring jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (kpi_id, line_id)
);

create index if not exists dds_kpi_line_scoring_line_id_idx
  on public.dds_kpi_line_scoring (line_id);

alter table public.dds_kpi_line_scoring enable row level security;

create policy "dds_kpi_line_scoring_select_dds"
  on public.dds_kpi_line_scoring for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_kpi_line_scoring_insert_admin"
  on public.dds_kpi_line_scoring for insert to authenticated
  with check (public.is_app_admin());

create policy "dds_kpi_line_scoring_update_admin"
  on public.dds_kpi_line_scoring for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_kpi_line_scoring_delete_admin"
  on public.dds_kpi_line_scoring for delete to authenticated
  using (public.is_app_admin());

grant select, insert, update, delete on public.dds_kpi_line_scoring to authenticated;

comment on table public.dds_kpi_line_scoring is
  'Optional per-line scoring override for KPIs with site_dds_presentation = by_line. Falls back to dds_kpis.scoring when missing.';

notify pgrst, 'reload schema';
