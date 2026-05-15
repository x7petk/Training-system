-- Per-KPI display surfaces + scoring config; per-cell manual values for reports / Shift DDS.

alter table public.dds_kpis
  add column if not exists display_sections text[] not null default '{}'::text[];

alter table public.dds_kpis
  add column if not exists scoring jsonb not null default '{"kind":"no_target"}'::jsonb;

comment on column public.dds_kpis.display_sections is
  'Route keys (e.g. shift-dds, p2p) where this KPI metric is shown; empty = hidden everywhere until configured.';

comment on column public.dds_kpis.scoring is
  'JSON scoring rule: kind no_target | min_red | max_red | range_green | symmetric_abs | symmetric_pct | pass_fail; see app types.';

create table if not exists public.dds_kpi_cell_entries (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  kpi_id uuid not null references public.dds_kpis (id) on delete cascade,
  plan_date date not null,
  shift_kind text not null default '',
  value_numeric numeric,
  comment text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create unique index if not exists dds_kpi_cell_entries_cell_kpi_date_shift_uidx
  on public.dds_kpi_cell_entries (master_cell_id, kpi_id, plan_date, shift_kind);

create index if not exists dds_kpi_cell_entries_cell_date_idx
  on public.dds_kpi_cell_entries (master_cell_id, plan_date);

alter table public.dds_kpi_cell_entries enable row level security;

create policy "dds_kpi_cell_entries_select_dds"
  on public.dds_kpi_cell_entries for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_kpi_cell_entries_insert_dds"
  on public.dds_kpi_cell_entries for insert to authenticated
  with check (public.app_user_can_access_dds());

create policy "dds_kpi_cell_entries_update_dds"
  on public.dds_kpi_cell_entries for update to authenticated
  using (public.app_user_can_access_dds()) with check (public.app_user_can_access_dds());

create policy "dds_kpi_cell_entries_delete_dds"
  on public.dds_kpi_cell_entries for delete to authenticated
  using (public.app_user_can_access_dds());

grant select, insert, update, delete on public.dds_kpi_cell_entries to authenticated;

notify pgrst, 'reload schema';
