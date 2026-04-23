-- plan24_events.schedule_id / template_version_id are shared across the standard check engine
-- and the CL / CIL / Quality families. FK targets that only reference plan24_check_* tables
-- block materialization for the other families.

alter table public.plan24_events
  drop constraint if exists plan24_events_schedule_id_fkey;

alter table public.plan24_events
  drop constraint if exists plan24_events_template_version_id_fkey;
