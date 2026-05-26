-- Per-cell production lines for Site DDS "by line" KPI table; values per line × KPI × shift.

create table if not exists public.dds_cell_lines (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dds_cell_lines_cell_name_lower_uidx
  on public.dds_cell_lines (master_cell_id, lower(name));

create index if not exists dds_cell_lines_master_cell_id_idx
  on public.dds_cell_lines (master_cell_id, sort_order);

alter table public.dds_cell_lines enable row level security;

create policy "dds_cell_lines_select_dds"
  on public.dds_cell_lines for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_cell_lines_insert_admin"
  on public.dds_cell_lines for insert to authenticated
  with check (public.is_app_admin());

create policy "dds_cell_lines_update_admin"
  on public.dds_cell_lines for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_cell_lines_delete_admin"
  on public.dds_cell_lines for delete to authenticated
  using (public.is_app_admin());

grant select, insert, update, delete on public.dds_cell_lines to authenticated;

create table if not exists public.dds_kpi_line_entries (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  line_id uuid not null references public.dds_cell_lines (id) on delete cascade,
  kpi_id uuid not null references public.dds_kpis (id) on delete cascade,
  plan_date date not null,
  shift_kind text not null default '',
  value_numeric numeric,
  comment text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create unique index if not exists dds_kpi_line_entries_line_kpi_date_shift_uidx
  on public.dds_kpi_line_entries (line_id, kpi_id, plan_date, shift_kind);

create index if not exists dds_kpi_line_entries_cell_date_idx
  on public.dds_kpi_line_entries (master_cell_id, plan_date, shift_kind);

alter table public.dds_kpi_line_entries enable row level security;

create policy "dds_kpi_line_entries_select_dds"
  on public.dds_kpi_line_entries for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_kpi_line_entries_insert_dds"
  on public.dds_kpi_line_entries for insert to authenticated
  with check (public.app_user_can_access_dds());

create policy "dds_kpi_line_entries_update_dds"
  on public.dds_kpi_line_entries for update to authenticated
  using (public.app_user_can_access_dds()) with check (public.app_user_can_access_dds());

create policy "dds_kpi_line_entries_delete_dds"
  on public.dds_kpi_line_entries for delete to authenticated
  using (public.app_user_can_access_dds());

grant select, insert, update, delete on public.dds_kpi_line_entries to authenticated;

alter table public.dds_kpis
  drop constraint if exists dds_kpis_site_dds_presentation_chk;

alter table public.dds_kpis
  add constraint dds_kpis_site_dds_presentation_chk
  check (
    site_dds_presentation is null
    or site_dds_presentation in ('sum', 'avg', 'max', 'min', 'by_line')
  );

comment on column public.dds_kpis.site_dds_presentation is
  'Site DDS: null = per cell tiles; sum/avg/max/min = consolidated site tile; by_line = metric × line table (lines from dds_cell_lines per cell).';

comment on table public.dds_cell_lines is
  'Named production lines within a cell; columns on Site DDS when KPI site_dds_presentation is by_line.';

comment on table public.dds_kpi_line_entries is
  'KPI value per cell line, plan date, and shift (Site DDS by-line table).';

notify pgrst, 'reload schema';
