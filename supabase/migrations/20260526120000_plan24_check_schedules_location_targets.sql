-- Align plan24_check_schedules with CL/CIL/Quality schedule location columns.
alter table public.plan24_check_schedules
  add column if not exists area_id uuid references public.master_areas (id) on delete set null,
  add column if not exists equipment_id uuid references public.master_equipment (id) on delete set null,
  add column if not exists equipment_ids uuid[] not null default '{}'::uuid[];

create index if not exists plan24_check_schedules_area_id_idx
  on public.plan24_check_schedules (area_id)
  where area_id is not null;

notify pgrst, 'reload schema';
