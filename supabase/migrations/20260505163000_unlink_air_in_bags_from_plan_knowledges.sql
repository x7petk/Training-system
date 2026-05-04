-- Remove "Air in bags" from plan knowledge links so it behaves as a normal skill.
-- Keeps the skill itself and any existing person skill records intact.
with target_skill as (
  select s.id
  from public.skills s
  where regexp_replace(lower(s.name), '[^a-z0-9]+', '', 'g') = 'airinbags'
)
delete from public.skill_plan_stage_knowledges spk
where spk.knowledge_skill_id in (select id from target_skill);
