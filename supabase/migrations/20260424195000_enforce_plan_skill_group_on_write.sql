-- Enforce grouped plan skills for new/updated rows.
-- Existing legacy rows remain readable and are surfaced as "Unassigned" in UI.

create or replace function public.enforce_plan_skill_group_on_write_trg()
returns trigger
language plpgsql
as $$
begin
  if new.kind = 'plan'::public.skill_kind and new.skill_group_id is null then
    raise exception 'Plan skills must belong to a skill group';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_plan_skill_group_on_write_trg on public.skills;
create trigger enforce_plan_skill_group_on_write_trg
  before insert or update on public.skills
  for each row
  execute function public.enforce_plan_skill_group_on_write_trg();
