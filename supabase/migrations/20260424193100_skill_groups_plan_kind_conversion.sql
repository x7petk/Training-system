-- Convert selected skill groups to plan-kind skills.
-- Target groups: Ingredients, Palletising, Packing.

update public.skills s
set kind = 'plan'::public.skill_kind
from public.skill_groups sg
where s.skill_group_id = sg.id
  and lower(trim(sg.name)) in ('ingredients', 'palletising', 'packing')
  and s.kind <> 'plan'::public.skill_kind;
