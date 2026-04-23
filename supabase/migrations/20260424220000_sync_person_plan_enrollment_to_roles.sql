-- Keep person_skill_plans aligned with current person_roles + role_skill_requirements
-- for skills where kind = 'plan' and required_level >= 1.
-- Prunes stale enrollments (and stage rows) when roles or requirements change.

create or replace function public.sync_person_plan_enrollment(p_person_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.person_skill_plan_stages psps
  where psps.person_id = p_person_id
    and not exists (
      select 1
      from public.person_roles pr
      join public.role_skill_requirements rsr
        on rsr.role_id = pr.role_id
       and rsr.required_level >= 1
      join public.skills s
        on s.id = rsr.skill_id
       and s.kind = 'plan'::public.skill_kind
      where pr.person_id = psps.person_id
        and rsr.skill_id = psps.plan_skill_id
    );

  delete from public.person_skill_plans psp
  where psp.person_id = p_person_id
    and not exists (
      select 1
      from public.person_roles pr
      join public.role_skill_requirements rsr
        on rsr.role_id = pr.role_id
       and rsr.required_level >= 1
      join public.skills s
        on s.id = rsr.skill_id
       and s.kind = 'plan'::public.skill_kind
      where pr.person_id = psp.person_id
        and rsr.skill_id = psp.plan_skill_id
    );

  perform public.assign_plan_on_role_link(p_person_id);
end;
$$;

create or replace function public.person_roles_plan_assign_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_person_plan_enrollment(coalesce(new.person_id, old.person_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists person_roles_plan_assign_trg on public.person_roles;
create trigger person_roles_plan_assign_trg
  after insert or update or delete on public.person_roles
  for each row
  execute function public.person_roles_plan_assign_trg();

create or replace function public.role_skill_requirements_plan_sync_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if tg_op = 'UPDATE' and new.role_id is distinct from old.role_id then
    for pid in
      select distinct pr.person_id
      from public.person_roles pr
      where pr.role_id = old.role_id
    loop
      perform public.sync_person_plan_enrollment(pid);
    end loop;
    for pid in
      select distinct pr.person_id
      from public.person_roles pr
      where pr.role_id = new.role_id
    loop
      perform public.sync_person_plan_enrollment(pid);
    end loop;
  else
    for pid in
      select distinct pr.person_id
      from public.person_roles pr
      where pr.role_id = coalesce(new.role_id, old.role_id)
    loop
      perform public.sync_person_plan_enrollment(pid);
    end loop;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists role_skill_requirements_plan_sync_trg on public.role_skill_requirements;
create trigger role_skill_requirements_plan_sync_trg
  after insert or update or delete on public.role_skill_requirements
  for each row
  execute function public.role_skill_requirements_plan_sync_trg();

-- One-time backfill: align enrollments for anyone with roles or existing plan rows.
do $$
declare
  pid uuid;
begin
  for pid in
    select distinct person_id
    from (
      select person_id from public.person_roles
      union
      select person_id from public.person_skill_plans
    ) u
  loop
    perform public.sync_person_plan_enrollment(pid);
  end loop;
end
$$;
