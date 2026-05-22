-- WDS: one LDR health check type per column tile (Health check row).

alter table public.dds_wds_columns
  add column if not exists hc_type_id uuid references public.hc_types (id) on delete set null;

create index if not exists dds_wds_columns_hc_type_idx
  on public.dds_wds_columns (hc_type_id)
  where hc_type_id is not null;

notify pgrst, 'reload schema';
