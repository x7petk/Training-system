-- Attribute CIL task-level defects to the plan event + role that raised them.

alter table public.dh_defects
  add column if not exists plan24_event_id uuid references public.plan24_events (id) on delete set null,
  add column if not exists role_name text;

create index if not exists dh_defects_plan24_event_idx
  on public.dh_defects (plan24_event_id)
  where deleted_at is null and plan24_event_id is not null;

create index if not exists dh_defects_role_name_idx
  on public.dh_defects (master_cell_id, role_name)
  where deleted_at is null and role_name is not null and role_name <> '';

comment on column public.dh_defects.plan24_event_id is
  'Plan 24 CIL event when defect was raised from a task (not event-level linked_issue).';

comment on column public.dh_defects.role_name is
  'Roster role that raised the defect (denormalized from plan24_events.role_name).';
