-- Who recorded the L2→3 matrix update (assessor / admin JWT at request time).

alter table public.skill_progression_events
  add column if not exists assessed_by uuid references public.profiles (id) on delete set null;

create index if not exists skill_progression_events_assessed_by_idx
  on public.skill_progression_events (assessed_by)
  where assessed_by is not null;

comment on column public.skill_progression_events.assessed_by is
  'Profile id of the user who performed the person_skills update (from JWT).';

create or replace function public.log_person_skill_level_progression()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
begin
  if tg_op = 'UPDATE'
     and old.actual_level is not null
     and new.actual_level is not null
     and old.actual_level = 2
     and new.actual_level = 3
     and (old.actual_level is distinct from new.actual_level)
  then
    actor := coalesce(
      nullif(trim(current_setting('request.jwt.claim.sub', true)), '')::uuid,
      auth.uid()
    );
    insert into public.skill_progression_events (person_id, skill_id, from_level, to_level, assessed_by)
    values (new.person_id, new.skill_id, 2, 3, actor);
  end if;
  return new;
end;
$$;
