-- Rebuild plan model:
-- 1) Root plan skills are top-level plans.
-- 2) Knowledges are existing non-plan skills linked under plan stages.
-- 3) Every new plan skill gets a default Stage 1.
-- 4) Existing plan skills are converted to knowledges (numeric) by group mapping.

create or replace function public.ensure_default_stage_for_plan_skill_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'plan'::public.skill_kind
     and (tg_op = 'INSERT' or old.kind <> 'plan'::public.skill_kind) then
    insert into public.skill_plan_stages (plan_skill_id, stage_no, name, duration_months, sort_order)
    values (new.id, 1, 'Stage 1', 3, 1)
    on conflict (plan_skill_id, stage_no) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_default_stage_for_plan_skill_trg on public.skills;
create trigger ensure_default_stage_for_plan_skill_trg
  after insert or update of kind on public.skills
  for each row
  execute function public.ensure_default_stage_for_plan_skill_trg();

create or replace function public.enforce_non_plan_knowledge_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k_kind public.skill_kind;
begin
  select s.kind into k_kind
  from public.skills s
  where s.id = new.knowledge_skill_id;

  if k_kind is null then
    raise exception 'Knowledge skill % not found', new.knowledge_skill_id;
  end if;
  if k_kind = 'plan'::public.skill_kind then
    raise exception 'Plan skills cannot be linked as knowledges';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_non_plan_knowledge_trg on public.skill_plan_stage_knowledges;
create trigger enforce_non_plan_knowledge_trg
  before insert or update on public.skill_plan_stage_knowledges
  for each row
  execute function public.enforce_non_plan_knowledge_trg();

with target_groups as (
  select distinct on (bucket)
    bucket,
    id as group_id
  from (
    select
      sg.id,
      sg.sort_order,
      sg.name,
      case
        when lower(trim(sg.name)) like 'packing%' then 'Packing'
        when lower(trim(sg.name)) like 'palletising%' then 'Palletising'
        when lower(trim(sg.name)) like 'ingredient%' then 'Ingredient'
        else null
      end as bucket
    from public.skill_groups sg
  ) x
  where bucket is not null
  order by bucket, sort_order, name
),
created_roots as (
  insert into public.skills (name, kind, skill_group_id, sort_order)
  select
    tg.bucket,
    'plan'::public.skill_kind,
    tg.group_id,
    coalesce(
      (
        select max(s.sort_order) + 1
        from public.skills s
        where s.skill_group_id = tg.group_id
      ),
      1
    )
  from target_groups tg
  where not exists (
    select 1
    from public.skills s
    where s.kind = 'plan'::public.skill_kind
      and lower(trim(s.name)) = lower(trim(tg.bucket))
  )
  returning id
)
select count(*) from created_roots;

with root_plans as (
  select s.id, s.name, s.skill_group_id
  from public.skills s
  where s.kind = 'plan'::public.skill_kind
    and lower(trim(s.name)) in ('packing', 'palletising', 'ingredient')
),
stage_seed as (
  insert into public.skill_plan_stages (plan_skill_id, stage_no, name, duration_months, sort_order)
  select rp.id, 1, 'Stage 1', 3, 1
  from root_plans rp
  where not exists (
    select 1
    from public.skill_plan_stages sps
    where sps.plan_skill_id = rp.id
  )
  returning id
)
select count(*) from stage_seed;

create temporary table tmp_plan_rebuild_map on commit drop as
with root_by_group as (
  select
    s.skill_group_id,
    s.id as root_skill_id
  from public.skills s
  where s.kind = 'plan'::public.skill_kind
    and lower(trim(s.name)) in ('packing', 'palletising', 'ingredient')
    and s.skill_group_id is not null
)
select
  src.id as old_plan_skill_id,
  rbg.root_skill_id
from public.skills src
join root_by_group rbg on rbg.skill_group_id = src.skill_group_id
where src.kind = 'plan'::public.skill_kind
  and src.id <> rbg.root_skill_id;

insert into public.role_skill_requirements (role_id, skill_id, required_level)
select distinct
  rsr.role_id,
  m.root_skill_id,
  1
from public.role_skill_requirements rsr
join tmp_plan_rebuild_map m on m.old_plan_skill_id = rsr.skill_id
where rsr.required_level >= 1
on conflict (role_id, skill_id) do update
set required_level = greatest(public.role_skill_requirements.required_level, excluded.required_level);

insert into public.person_skill_plans (
  person_id,
  plan_skill_id,
  assigned_at,
  assigned_by,
  current_stage_no,
  completed,
  completed_at
)
select distinct
  psp.person_id,
  m.root_skill_id,
  now(),
  psp.assigned_by,
  1,
  false,
  null::timestamptz
from public.person_skill_plans psp
join tmp_plan_rebuild_map m on m.old_plan_skill_id = psp.plan_skill_id
on conflict (person_id, plan_skill_id) do nothing;

delete from public.role_skill_requirements rsr
using tmp_plan_rebuild_map m
where rsr.skill_id = m.old_plan_skill_id;

delete from public.person_skill_plan_stages psps
using tmp_plan_rebuild_map m
where psps.plan_skill_id = m.old_plan_skill_id;

delete from public.person_skill_plans psp
using tmp_plan_rebuild_map m
where psp.plan_skill_id = m.old_plan_skill_id;

delete from public.skill_plan_stage_knowledges spk
using public.skill_plan_stages sps, tmp_plan_rebuild_map m
where spk.stage_id = sps.id
  and sps.plan_skill_id = m.old_plan_skill_id;

delete from public.skill_plan_stages sps
using tmp_plan_rebuild_map m
where sps.plan_skill_id = m.old_plan_skill_id;

update public.skills s
set kind = 'numeric'::public.skill_kind
from tmp_plan_rebuild_map m
where s.id = m.old_plan_skill_id;

update public.person_skills ps
set actual_level = least(greatest(coalesce(ps.actual_level, 1), 1), 3)
from tmp_plan_rebuild_map m
where ps.skill_id = m.old_plan_skill_id;

insert into public.skill_plan_stage_knowledges (stage_id, knowledge_skill_id)
select
  sps.id as stage_id,
  m.old_plan_skill_id as knowledge_skill_id
from tmp_plan_rebuild_map m
join public.skill_plan_stages sps
  on sps.plan_skill_id = m.root_skill_id
 and sps.stage_no = 1
on conflict (stage_id, knowledge_skill_id) do nothing;

do $$
declare
  rec record;
begin
  for rec in
    select psp.person_id, psp.plan_skill_id
    from public.person_skill_plans psp
    join public.skills s on s.id = psp.plan_skill_id
    where s.kind = 'plan'::public.skill_kind
      and lower(trim(s.name)) in ('packing', 'palletising', 'ingredient')
  loop
    perform public.ensure_person_plan_stage_rows(rec.person_id, rec.plan_skill_id);
    perform public.recompute_person_plan_progress(rec.person_id, rec.plan_skill_id);
  end loop;
end
$$;
