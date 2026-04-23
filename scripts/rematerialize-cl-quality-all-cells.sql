-- Re-materialize CL and Quality scheduled events so sub_tasks pick up template fields.
-- Run (linked remote):
--   node_modules/supabase/bin/supabase db query --linked --yes -f scripts/rematerialize-cl-quality-all-cells.sql

select
  c.master_cell_id as cell_id,
  public.plan24_materialize_cl_check_schedules(
    c.master_cell_id,
    (current_date - 60)::date,
    (current_date + 365)::date
  ) as cl_iters,
  public.plan24_materialize_quality_check_schedules(
    c.master_cell_id,
    (current_date - 60)::date,
    (current_date + 365)::date
  ) as quality_iters
from (
  select distinct master_cell_id
  from public.plan24_cl_check_schedules
  where state = 'active'
  union
  select distinct master_cell_id
  from public.plan24_quality_check_schedules
  where state = 'active'
) c;
