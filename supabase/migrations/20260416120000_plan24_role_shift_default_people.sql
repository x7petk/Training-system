-- Default roster person per shift (day vs night) for Plan 24 roles.

alter table public.plan24_roster_roles
  add column default_person_day_id uuid references public.people (id) on delete set null;

alter table public.plan24_roster_roles
  add column default_person_night_id uuid references public.people (id) on delete set null;

comment on column public.plan24_roster_roles.default_person_day_id is
  'Default person for this role on day shift (when no per-day assignment).';

comment on column public.plan24_roster_roles.default_person_night_id is
  'Default person for this role on night shift (when no per-day assignment).';

-- Seed existing single default onto both shift-specific columns.
update public.plan24_roster_roles
set
  default_person_day_id = coalesce(default_person_day_id, default_person_id),
  default_person_night_id = coalesce(default_person_night_id, default_person_id)
where default_person_id is not null;
