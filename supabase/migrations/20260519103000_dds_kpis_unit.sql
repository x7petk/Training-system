-- Display unit for KPI values (Shift DDS blocks, reports).

alter table public.dds_kpis
  add column if not exists unit text not null default 'none';

alter table public.dds_kpis
  add constraint dds_kpis_unit_chk
  check (unit in ('none', 'pct', 'mt', 'kg', 'num', 'm3', 'usd', 'min'));

comment on column public.dds_kpis.unit is
  'Display suffix for manual KPI values: none, pct (%), mt, kg, num (#), m3, usd ($), min.';

notify pgrst, 'reload schema';
