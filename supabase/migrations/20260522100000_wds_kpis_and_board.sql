-- WDS: configurable trend definitions per cell + WDS board columns.

create table if not exists public.dds_wds_trends (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  kpi_id uuid not null references public.dds_kpis (id) on delete cascade,
  label text not null,
  aggregation text not null default 'sum'
    constraint dds_wds_trends_aggregation_chk
    check (aggregation in ('sum', 'avg', 'min', 'max')),
  glidepath_mode text not null default 'flat'
    constraint dds_wds_trends_glidepath_mode_chk
    check (glidepath_mode in ('flat', 'start_end', 'weekly')),
  target_flat numeric,
  target_start numeric,
  target_end numeric,
  target_weekly jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dds_wds_trends_cell_idx
  on public.dds_wds_trends (master_cell_id, sort_order, created_at);

drop trigger if exists dds_wds_trends_touch_updated_at on public.dds_wds_trends;
create trigger dds_wds_trends_touch_updated_at
  before update on public.dds_wds_trends
  for each row execute function public.master_data_touch_updated_at();

alter table public.dds_wds_trends enable row level security;

create policy "dds_wds_trends_select_dds"
  on public.dds_wds_trends for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_wds_trends_insert_admin"
  on public.dds_wds_trends for insert to authenticated
  with check (public.is_app_admin());

create policy "dds_wds_trends_update_admin"
  on public.dds_wds_trends for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_wds_trends_delete_admin"
  on public.dds_wds_trends for delete to authenticated
  using (public.is_app_admin());

grant select, insert, update, delete on public.dds_wds_trends to authenticated;

create table if not exists public.dds_wds_columns (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  header text not null,
  sort_order integer not null default 0,
  output_trend_id uuid references public.dds_wds_trends (id) on delete set null,
  in_process_a_trend_id uuid references public.dds_wds_trends (id) on delete set null,
  in_process_b_trend_id uuid references public.dds_wds_trends (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dds_wds_columns_cell_idx
  on public.dds_wds_columns (master_cell_id, sort_order, created_at);

drop trigger if exists dds_wds_columns_touch_updated_at on public.dds_wds_columns;
create trigger dds_wds_columns_touch_updated_at
  before update on public.dds_wds_columns
  for each row execute function public.master_data_touch_updated_at();

alter table public.dds_wds_columns enable row level security;

create policy "dds_wds_columns_select_dds"
  on public.dds_wds_columns for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_wds_columns_insert_dds"
  on public.dds_wds_columns for insert to authenticated
  with check (public.app_user_can_access_dds());

create policy "dds_wds_columns_update_dds"
  on public.dds_wds_columns for update to authenticated
  using (public.app_user_can_access_dds()) with check (public.app_user_can_access_dds());

create policy "dds_wds_columns_delete_dds"
  on public.dds_wds_columns for delete to authenticated
  using (public.app_user_can_access_dds());

grant select, insert, update, delete on public.dds_wds_columns to authenticated;

notify pgrst, 'reload schema';
