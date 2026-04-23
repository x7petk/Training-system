-- Remove person_skills rows that only existed for plan progression but the person
-- is no longer enrolled in any plan stage that includes that knowledge.
-- Keeps: role-required skills, is_extra = true, and rows still tied to current plan stages.

create or replace function public.cleanup_orphan_plan_knowledge_person_skills(p_person_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.person_skills ps
  where ps.person_id = p_person_id
    and ps.is_extra = false
    and exists (
      select 1
      from public.skill_plan_stage_knowledges spk
      where spk.knowledge_skill_id = ps.skill_id
    )
    and not exists (
      select 1
      from public.person_skill_plan_stages psps
      join public.skill_plan_stage_knowledges spk2 on spk2.stage_id = psps.stage_id
      where psps.person_id = ps.person_id
        and spk2.knowledge_skill_id = ps.skill_id
    )
    and not exists (
      select 1
      from public.person_roles pr
      join public.role_skill_requirements rsr
        on rsr.role_id = pr.role_id
       and rsr.required_level >= 1
      where pr.person_id = ps.person_id
        and rsr.skill_id = ps.skill_id
    );
end;
$$;

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
  perform public.cleanup_orphan_plan_knowledge_person_skills(p_person_id);
end;
$$;

-- One-time: clean everyone who has person_skills (others are no-ops).
do $$
declare
  pid uuid;
begin
  for pid in select distinct person_id from public.person_skills
  loop
    perform public.cleanup_orphan_plan_knowledge_person_skills(pid);
  end loop;
end
$$;
