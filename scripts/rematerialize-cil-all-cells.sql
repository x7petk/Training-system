-- Re-run CIL materialization per cell so scheduled plan24_events get fresh sub_tasks
-- (standard text, photo_path, when_condition, etc.) from current template rows.
-- Only conflicts on scheduled rows are updated by the materializer (see migration).
--
-- Run (linked remote):
--   node_modules/supabase/bin/supabase db query --linked --yes -f scripts/rematerialize-cil-all-cells.sql

select
  c.master_cell_id as cell_id,
  public.plan24_materialize_cil_check_schedules(
    c.master_cell_id,
    (current_date - 60)::date,
    (current_date + 365)::date
  ) as materializer_iterations
from (
  select distinct master_cell_id
  from public.plan24_cil_check_schedules
  where state = 'active'
) c;
