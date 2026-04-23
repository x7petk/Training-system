-- Every plan skill (kind=plan): exactly 3 stages; knowledges spread across stages 1–3
-- (shuffled then round-robin for even-ish random distribution).

select set_config('app.bypass_plan_lock', 'on', true);

do $$
declare
  pid uuid;
  kids uuid[];
  sid1 uuid;
  sid2 uuid;
  sid3 uuid;
  n int;
  b int;
begin
  for pid in
    select distinct sps.plan_skill_id
    from public.skill_plan_stages sps
    join public.skills sk on sk.id = sps.plan_skill_id
    where sk.kind = 'plan'::public.skill_kind
  loop
    select coalesce(
      array_agg(spk.knowledge_skill_id order by random()),
      '{}'::uuid[]
    )
    into kids
    from public.skill_plan_stage_knowledges spk
    join public.skill_plan_stages sps on sps.id = spk.stage_id
    where sps.plan_skill_id = pid;

    delete from public.skill_plan_stage_knowledges spk
    using public.skill_plan_stages sps
    where spk.stage_id = sps.id
      and sps.plan_skill_id = pid;

    delete from public.skill_plan_stages sps
    where sps.plan_skill_id = pid
      and sps.stage_no > 3;

    insert into public.skill_plan_stages (plan_skill_id, stage_no, name, duration_months, sort_order)
    select pid, 1, 'Stage 1', 3, 1
    where not exists (
      select 1 from public.skill_plan_stages x where x.plan_skill_id = pid and x.stage_no = 1
    );

    insert into public.skill_plan_stages (plan_skill_id, stage_no, name, duration_months, sort_order)
    select pid, 2, 'Stage 2', 3, 2
    where not exists (
      select 1 from public.skill_plan_stages x where x.plan_skill_id = pid and x.stage_no = 2
    );

    insert into public.skill_plan_stages (plan_skill_id, stage_no, name, duration_months, sort_order)
    select pid, 3, 'Stage 3', 3, 3
    where not exists (
      select 1 from public.skill_plan_stages x where x.plan_skill_id = pid and x.stage_no = 3
    );

    select sps.id into sid1 from public.skill_plan_stages sps where sps.plan_skill_id = pid and sps.stage_no = 1;
    select sps.id into sid2 from public.skill_plan_stages sps where sps.plan_skill_id = pid and sps.stage_no = 2;
    select sps.id into sid3 from public.skill_plan_stages sps where sps.plan_skill_id = pid and sps.stage_no = 3;

    if sid1 is null or sid2 is null or sid3 is null then
      raise exception 'Missing stage row for plan %', pid;
    end if;

    n := coalesce(array_length(kids, 1), 0);
    for i in 1..n loop
      b := ((i - 1) % 3) + 1;
      insert into public.skill_plan_stage_knowledges (stage_id, knowledge_skill_id)
      values (
        case b
          when 1 then sid1
          when 2 then sid2
          else sid3
        end,
        kids[i]
      );
    end loop;
  end loop;
end
$$;

select set_config('app.bypass_plan_lock', 'off', true);

do $$
declare
  rec record;
begin
  for rec in
    select psp.person_id, psp.plan_skill_id
    from public.person_skill_plans psp
    join public.skills s on s.id = psp.plan_skill_id
    where s.kind = 'plan'::public.skill_kind
  loop
    perform public.ensure_person_plan_stage_rows(rec.person_id, rec.plan_skill_id);
    perform public.recompute_person_plan_progress(rec.person_id, rec.plan_skill_id);
  end loop;
end
$$;
