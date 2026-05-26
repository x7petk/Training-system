-- Plan 24 auto-value source for DDS KPIs (admin dropdown); manual override flag on cell entries.

alter table public.dds_kpis
  add column if not exists plan24_value_source text;

alter table public.dds_kpis
  drop constraint if exists dds_kpis_plan24_value_source_check;

alter table public.dds_kpis
  add constraint dds_kpis_plan24_value_source_check check (
    plan24_value_source is null
    or plan24_value_source in (
      'cl_completion_pct',
      'cil_completion_pct',
      'quality_completion_pct',
      'check_completion_pct',
      'deviations_count',
      'defects_new_count',
      'defects_fixed_count',
      'defects_open_count',
      'quality_fails_count'
    )
  );

comment on column public.dds_kpis.plan24_value_source is
  'When set, DDS loads auto-fill value_numeric from Plan 24 (completions, deviations, defects, fails). Unit and scoring stay manual in admin.';

alter table public.dds_kpi_cell_entries
  add column if not exists plan24_manual_override boolean not null default false;

comment on column public.dds_kpi_cell_entries.plan24_manual_override is
  'When true, Plan 24 auto-rollup does not overwrite this entry until cleared (set on manual KPI save).';

notify pgrst, 'reload schema';
