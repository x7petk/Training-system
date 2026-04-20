-- Allow any shift label on events and per-day assignments (matches plan24_roster_shifts.kind).

alter table public.plan24_events drop constraint if exists plan24_events_shift_kind_check;

alter table public.plan24_role_day_assignments drop constraint if exists plan24_role_day_assignments_shift_kind_check;
