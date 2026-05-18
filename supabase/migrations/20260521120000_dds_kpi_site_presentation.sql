-- Site DDS: per-KPI rollup mode (sum / avg / max / min) and manual site-level entries.

alter table public.dds_kpis
  add column if not exists site_dds_presentation text;

alter table public.dds_kpis
  drop constraint if exists dds_kpis_site_dds_presentation_chk;

alter table public.dds_kpis
  add constraint dds_kpis_site_dds_presentation_chk
  check (site_dds_presentation is null or site_dds_presentation in ('sum', 'avg', 'max', 'min'));

comment on column public.dds_kpis.site_dds_presentation is
  'Site DDS only: null = show per cell; sum/avg/max/min = one consolidated tile per site (rollup from cells unless site entry set).';

create table if not exists public.dds_kpi_site_entries (
  id uuid primary key default gen_random_uuid(),
  master_site_id uuid not null references public.master_sites (id) on delete cascade,
  kpi_id uuid not null references public.dds_kpis (id) on delete cascade,
  plan_date date not null,
  shift_kind text not null,
  value_numeric double precision,
  comment text,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dds_kpi_site_entries_site_kpi_date_shift_uidx
  on public.dds_kpi_site_entries (master_site_id, kpi_id, plan_date, shift_kind);

create index if not exists dds_kpi_site_entries_site_date_idx
  on public.dds_kpi_site_entries (master_site_id, plan_date);

drop trigger if exists dds_kpi_site_entries_touch_updated_at on public.dds_kpi_site_entries;
create trigger dds_kpi_site_entries_touch_updated_at
  before update on public.dds_kpi_site_entries
  for each row execute function public.master_data_touch_updated_at();

alter table public.dds_kpi_site_entries enable row level security;

create policy "dds_kpi_site_entries_select_dds"
  on public.dds_kpi_site_entries for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_kpi_site_entries_insert_dds"
  on public.dds_kpi_site_entries for insert to authenticated
  with check (public.app_user_can_access_dds());

create policy "dds_kpi_site_entries_update_dds"
  on public.dds_kpi_site_entries for update to authenticated
  using (public.app_user_can_access_dds()) with check (public.app_user_can_access_dds());

create policy "dds_kpi_site_entries_delete_dds"
  on public.dds_kpi_site_entries for delete to authenticated
  using (public.app_user_can_access_dds());

grant select, insert, update, delete on public.dds_kpi_site_entries to authenticated;

notify pgrst, 'reload schema';
