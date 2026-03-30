-- Log assessor-driven (or admin) level moves 2 → 3 for reporting (L2→L3 completions).
-- L1→L2 remains on skill_training_attempts (passed).

create table if not exists public.skill_progression_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  from_level smallint not null,
  to_level smallint not null,
  created_at timestamptz not null default now(),
  constraint skill_progression_from_to check (from_level < to_level)
);

create index if not exists skill_progression_events_created_at_idx
  on public.skill_progression_events (created_at desc);

create index if not exists skill_progression_events_person_idx
  on public.skill_progression_events (person_id, created_at desc);

grant select on public.skill_progression_events to authenticated;

alter table public.skill_progression_events enable row level security;

create policy "skill_progression_events_select_staff"
  on public.skill_progression_events
  for select
  to authenticated
  using (public.is_app_admin() or public.is_app_assessor());

create or replace function public.log_person_skill_level_progression()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.actual_level is not null
     and new.actual_level is not null
     and old.actual_level = 2
     and new.actual_level = 3
     and (old.actual_level is distinct from new.actual_level)
  then
    insert into public.skill_progression_events (person_id, skill_id, from_level, to_level)
    values (new.person_id, new.skill_id, 2, 3);
  end if;
  return new;
end;
$$;

drop trigger if exists person_skills_progression_2_to_3_trg on public.person_skills;
create trigger person_skills_progression_2_to_3_trg
  after update of actual_level on public.person_skills
  for each row
  execute function public.log_person_skill_level_progression();
