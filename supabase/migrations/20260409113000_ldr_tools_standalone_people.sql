-- LDR tools v2: standalone LDR people list + site-free calendar events.

alter table public.ldr_people
  alter column person_id drop not null,
  alter column site_id drop not null;

alter table public.ldr_people
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists initials text,
  add column if not exists avatar_variant smallint not null default 1;

alter table public.ldr_people
  add constraint ldr_people_avatar_variant_range
  check (avatar_variant >= 1 and avatar_variant <= 8);

comment on column public.ldr_people.first_name is 'LDR standalone first name.';
comment on column public.ldr_people.last_name is 'LDR standalone last name / second name.';
comment on column public.ldr_people.initials is 'Short initials shown in placeholder avatar.';
comment on column public.ldr_people.avatar_variant is 'Built-in placeholder avatar style (1-8).';

update public.ldr_people lp
set
  first_name = coalesce(lp.first_name, split_part(trim(p.display_name), ' ', 1)),
  last_name = coalesce(
    lp.last_name,
    nullif(trim(substr(trim(p.display_name), length(split_part(trim(p.display_name), ' ', 1)) + 1)), '')
  ),
  initials = coalesce(
    lp.initials,
    upper(left(split_part(trim(p.display_name), ' ', 1), 1) ||
      left(nullif(trim(substr(trim(p.display_name), length(split_part(trim(p.display_name), ' ', 1)) + 1)), ''), 1))
  )
from public.people p
where lp.person_id = p.id;

alter table public.ldr_people
  alter column first_name set default '',
  alter column initials set default '';

update public.ldr_people
set
  first_name = coalesce(first_name, ''),
  initials = coalesce(initials, '')
where first_name is null or initials is null;

alter table public.ldr_people
  alter column first_name set not null,
  alter column initials set not null;

alter table public.ldr_events
  alter column site_id drop not null;

comment on column public.ldr_events.site_id is 'Deprecated for current MVP; events are created directly from calendar without site selection.';
