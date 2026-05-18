-- Per-cell which DDS process pages (Shift / Line / Plant / Site) show each KPI metric.
-- Hard points remain visible on all four (enforced in app on save + read).

alter table public.dds_kpis
  add column if not exists metric_scope text not null default 'cell';

update public.dds_kpis
set metric_scope = 'cell'
where metric_scope is null;

alter table public.dds_kpis
  drop constraint if exists dds_kpis_metric_scope_chk;

alter table public.dds_kpis
  add constraint dds_kpis_metric_scope_chk
  check (metric_scope in ('site', 'plant', 'cell'));

comment on column public.dds_kpis.metric_scope is
  'Where this KPI is managed in KPI set-up: site-level, plant-level, or cell-level bucket (grouping only).';

create table if not exists public.dds_kpi_cell_dds_display (
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  kpi_id uuid not null references public.dds_kpis (id) on delete cascade,
  surfaces text[] not null,
  updated_at timestamptz not null default now(),
  primary key (master_cell_id, kpi_id),
  constraint dds_kpi_cell_dds_display_surfaces_chk
    check (surfaces <@ array['shift-dds', 'line-dds', 'plant-dds', 'site-dds']::text[])
);

create index if not exists dds_kpi_cell_dds_display_cell_idx
  on public.dds_kpi_cell_dds_display (master_cell_id);

comment on table public.dds_kpi_cell_dds_display is
  'Per master cell, which DDS surfaces list this KPI (subset of shift/line/plant/site). Missing row = inherit from dds_kpis.display_sections with app defaults.';

drop trigger if exists dds_kpi_cell_dds_display_touch_updated_at on public.dds_kpi_cell_dds_display;
create trigger dds_kpi_cell_dds_display_touch_updated_at
  before update on public.dds_kpi_cell_dds_display
  for each row execute function public.master_data_touch_updated_at();

alter table public.dds_kpi_cell_dds_display enable row level security;

create policy "dds_kpi_cell_dds_display_select_dds"
  on public.dds_kpi_cell_dds_display for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_kpi_cell_dds_display_insert_admin"
  on public.dds_kpi_cell_dds_display for insert to authenticated
  with check (public.is_app_admin());

create policy "dds_kpi_cell_dds_display_update_admin"
  on public.dds_kpi_cell_dds_display for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_kpi_cell_dds_display_delete_admin"
  on public.dds_kpi_cell_dds_display for delete to authenticated
  using (public.is_app_admin());

grant select, insert, update, delete on public.dds_kpi_cell_dds_display to authenticated;

notify pgrst, 'reload schema';
