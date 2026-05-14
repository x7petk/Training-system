-- KPI groups apply to all sites/cells: drop per-cell scope, unique name globally (case-insensitive).

-- Collapse duplicate names across cells before global uniqueness (keep oldest row per lower(name)).
delete from public.dds_kpi_groups a
where exists (
  select 1
  from public.dds_kpi_groups b
  where lower(b.name) = lower(a.name)
    and b.id < a.id
);

alter table public.dds_kpi_groups drop constraint if exists dds_kpi_groups_master_cell_id_fkey;

drop index if exists public.dds_kpi_groups_cell_name_lower_idx;
drop index if exists public.dds_kpi_groups_master_cell_id_idx;

alter table public.dds_kpi_groups drop column if exists master_cell_id;

create unique index if not exists dds_kpi_groups_name_lower_idx
  on public.dds_kpi_groups (lower(name));

notify pgrst, 'reload schema';
