-- LDR people are a manual roster for LDR tools only (not synced from public.people).

comment on table public.ldr_people is
  'Leadership roster entries for LDR tools. Add and edit only via LDR Admin; not imported from the skill matrix people list.';

alter table public.ldr_people drop constraint if exists ldr_people_person_unique;
alter table public.ldr_people drop constraint if exists ldr_people_person_id_fkey;
alter table public.ldr_people drop column if exists person_id;
