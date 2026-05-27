-- Task-level CL deviations and quality fails: same plan/role attribution as CIL defects.

alter table public.deviations
  add column if not exists plan24_event_id uuid references public.plan24_events (id) on delete set null,
  add column if not exists role_name text,
  add column if not exists plan24_sub_task_id text;

alter table public.quality_fails
  add column if not exists plan24_event_id uuid references public.plan24_events (id) on delete set null,
  add column if not exists role_name text,
  add column if not exists plan24_sub_task_id text;

create index if not exists deviations_plan24_event_idx
  on public.deviations (plan24_event_id)
  where deleted_at is null and plan24_event_id is not null;

create index if not exists quality_fails_plan24_event_idx
  on public.quality_fails (plan24_event_id)
  where deleted_at is null and plan24_event_id is not null;

comment on column public.deviations.plan24_event_id is
  'Plan 24 CL event when deviation was raised from a checklist step (not event-level linked_issue).';

comment on column public.quality_fails.plan24_event_id is
  'Plan 24 quality event when fail was raised from a checklist step (not event-level linked_issue).';
