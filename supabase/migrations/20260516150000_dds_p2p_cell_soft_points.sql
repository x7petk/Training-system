-- Per-cell P2P soft point configuration (only Soft Point KPIs; global P2P questions stay separate).

create table public.dds_p2p_cell_soft_points (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  kpi_id uuid not null references public.dds_kpis (id) on delete cascade,
  is_enabled boolean not null default true,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (master_cell_id, kpi_id)
);

create index dds_p2p_cell_soft_points_master_cell_id_idx
  on public.dds_p2p_cell_soft_points (master_cell_id);

create or replace function public.dds_p2p_cell_soft_points_enforce_soft_kpi()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.dds_kpis k
    where k.id = new.kpi_id
      and k.point_kind = 'soft_point'::public.dds_kpi_point_kind
  ) then
    raise exception 'dds_p2p_cell_soft_points: kpi_id must reference a Soft Point KPI';
  end if;
  return new;
end;
$$;

create trigger dds_p2p_cell_soft_points_enforce_soft_kpi
  before insert or update of kpi_id on public.dds_p2p_cell_soft_points
  for each row
  execute function public.dds_p2p_cell_soft_points_enforce_soft_kpi();

alter table public.dds_p2p_cell_soft_points enable row level security;

create policy "dds_p2p_cell_soft_points_select_dds"
  on public.dds_p2p_cell_soft_points for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_p2p_cell_soft_points_insert_admin"
  on public.dds_p2p_cell_soft_points for insert to authenticated
  with check (public.is_app_admin());

create policy "dds_p2p_cell_soft_points_update_admin"
  on public.dds_p2p_cell_soft_points for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_p2p_cell_soft_points_delete_admin"
  on public.dds_p2p_cell_soft_points for delete to authenticated
  using (public.is_app_admin());

grant select, insert, update, delete on public.dds_p2p_cell_soft_points to authenticated;

notify pgrst, 'reload schema';
