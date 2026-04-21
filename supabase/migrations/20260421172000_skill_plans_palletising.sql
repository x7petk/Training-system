-- Plan skills: staged knowledge progression with locked stage flow.
-- Adds kind=plan, stage/knowledge model, automation, and palletising conversion.

create table if not exists public.skill_plan_stages (
  id uuid primary key default gen_random_uuid(),
  plan_skill_id uuid not null references public.skills (id) on delete cascade,
  stage_no smallint not null check (stage_no >= 1 and stage_no <= 20),
  name text not null,
  duration_months int not null default 3 check (duration_months >= 0 and duration_months <= 36),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (plan_skill_id, stage_no),
  unique (plan_skill_id, sort_order)
);

create table if not exists public.skill_plan_stage_knowledges (
  stage_id uuid not null references public.skill_plan_stages (id) on delete cascade,
  knowledge_skill_id uuid not null references public.skills (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (stage_id, knowledge_skill_id)
);

create table if not exists public.person_skill_plans (
  person_id uuid not null references public.people (id) on delete cascade,
  plan_skill_id uuid not null references public.skills (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles (id) on delete set null,
  current_stage_no smallint not null default 1,
  completed boolean not null default false,
  completed_at timestamptz,
  primary key (person_id, plan_skill_id),
  check (current_stage_no between 1 and 20)
);

create table if not exists public.person_skill_plan_stages (
  person_id uuid not null references public.people (id) on delete cascade,
  stage_id uuid not null references public.skill_plan_stages (id) on delete cascade,
  plan_skill_id uuid not null references public.skills (id) on delete cascade,
  is_unlocked boolean not null default false,
  unlocked_at timestamptz,
  target_date date,
  progress_percent numeric(5,2) not null default 0,
  total_knowledges int not null default 0,
  completed_knowledges int not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (person_id, stage_id),
  check (progress_percent >= 0 and progress_percent <= 100),
  check (total_knowledges >= 0),
  check (completed_knowledges >= 0)
);

create or replace function public.compute_stage_target_date(
  p_unlocked_at timestamptz,
  p_duration_months int
)
returns date
language sql
stable
as $$
  select (
    date_trunc('day', coalesce(p_unlocked_at, now()))::date
    + make_interval(months => greatest(0, coalesce(p_duration_months, 0)))
  )::date
$$;

create or replace function public.seed_unlocked_stage_knowledges(
  p_person_id uuid,
  p_stage_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.person_skills (person_id, skill_id, actual_level, is_extra, due_date)
  select p_person_id, spk.knowledge_skill_id, 1, false, null
  from public.skill_plan_stage_knowledges spk
  where spk.stage_id = p_stage_id
  on conflict (person_id, skill_id) do update
    set actual_level = coalesce(public.person_skills.actual_level, excluded.actual_level),
        is_extra = false;
end;
$$;

create or replace function public.recompute_person_plan_progress(
  p_person_id uuid,
  p_plan_skill_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  stage_row record;
  total_k int;
  done_k int;
  pct numeric(5,2);
  prev_complete boolean := true;
  this_complete boolean;
  first_incomplete smallint := null;
  max_stage smallint := 1;
  unlock_ts timestamptz;
begin
  if not exists (
    select 1 from public.person_skill_plans psp
    where psp.person_id = p_person_id and psp.plan_skill_id = p_plan_skill_id
  ) then
    return;
  end if;

  for stage_row in
    select sps.id, sps.stage_no, sps.duration_months, psps.is_unlocked, psps.unlocked_at
    from public.skill_plan_stages sps
    join public.person_skill_plan_stages psps
      on psps.stage_id = sps.id
     and psps.person_id = p_person_id
    where sps.plan_skill_id = p_plan_skill_id
    order by sps.stage_no
  loop
    max_stage := greatest(max_stage, stage_row.stage_no);

    select count(*)::int into total_k
    from public.skill_plan_stage_knowledges spk
    where spk.stage_id = stage_row.id;

    select count(*)::int into done_k
    from public.skill_plan_stage_knowledges spk
    join public.person_skills ps
      on ps.person_id = p_person_id
     and ps.skill_id = spk.knowledge_skill_id
    where spk.stage_id = stage_row.id
      and ps.actual_level = 3;

    if total_k = 0 then
      pct := 0;
      this_complete := false;
    else
      pct := round((done_k::numeric * 100.0) / total_k, 2);
      this_complete := (done_k = total_k);
    end if;

    unlock_ts := stage_row.unlocked_at;
    if (stage_row.stage_no = 1 or prev_complete) and not stage_row.is_unlocked then
      unlock_ts := now();
      update public.person_skill_plan_stages
      set
        is_unlocked = true,
        unlocked_at = unlock_ts,
        target_date = public.compute_stage_target_date(unlock_ts, stage_row.duration_months),
        updated_at = now()
      where person_id = p_person_id and stage_id = stage_row.id;
      perform public.seed_unlocked_stage_knowledges(p_person_id, stage_row.id);
    end if;

    update public.person_skill_plan_stages
    set
      is_unlocked = (stage_row.stage_no = 1 or prev_complete),
      unlocked_at = case
        when (stage_row.stage_no = 1 or prev_complete) then coalesce(unlock_ts, now())
        else unlocked_at
      end,
      target_date = case
        when (stage_row.stage_no = 1 or prev_complete)
          then public.compute_stage_target_date(coalesce(unlock_ts, now()), stage_row.duration_months)
        else target_date
      end,
      total_knowledges = total_k,
      completed_knowledges = done_k,
      progress_percent = pct,
      completed_at = case when this_complete then coalesce(completed_at, now()) else null end,
      updated_at = now()
    where person_id = p_person_id and stage_id = stage_row.id;

    if first_incomplete is null and not this_complete then
      first_incomplete := stage_row.stage_no;
    end if;

    prev_complete := prev_complete and this_complete;
  end loop;

  update public.person_skill_plans
  set
    current_stage_no = coalesce(first_incomplete, max_stage),
    completed = (first_incomplete is null),
    completed_at = case when first_incomplete is null then coalesce(completed_at, now()) else null end
  where person_id = p_person_id and plan_skill_id = p_plan_skill_id;
end;
$$;

create or replace function public.ensure_person_plan_stage_rows(
  p_person_id uuid,
  p_plan_skill_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.person_skill_plan_stages (
    person_id, stage_id, plan_skill_id, is_unlocked, progress_percent, total_knowledges, completed_knowledges
  )
  select p_person_id, sps.id, p_plan_skill_id, false, 0, 0, 0
  from public.skill_plan_stages sps
  where sps.plan_skill_id = p_plan_skill_id
  on conflict (person_id, stage_id) do nothing;

  perform public.recompute_person_plan_progress(p_person_id, p_plan_skill_id);
end;
$$;

create or replace function public.assign_plan_on_role_link(
  p_person_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_row record;
begin
  for plan_row in
    select distinct s.id as plan_skill_id
    from public.person_roles pr
    join public.role_skill_requirements rsr on rsr.role_id = pr.role_id and rsr.required_level >= 1
    join public.skills s on s.id = rsr.skill_id
    where pr.person_id = p_person_id
      and s.kind = 'plan'
  loop
    insert into public.person_skill_plans (person_id, plan_skill_id, assigned_at, assigned_by)
    values (
      p_person_id,
      plan_row.plan_skill_id,
      now(),
      coalesce(nullif(trim(current_setting('request.jwt.claim.sub', true)), '')::uuid, auth.uid())
    )
    on conflict (person_id, plan_skill_id) do nothing;

    perform public.ensure_person_plan_stage_rows(p_person_id, plan_row.plan_skill_id);
  end loop;
end;
$$;

create or replace function public.person_roles_plan_assign_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assign_plan_on_role_link(coalesce(new.person_id, old.person_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists person_roles_plan_assign_trg on public.person_roles;
create trigger person_roles_plan_assign_trg
  after insert or update on public.person_roles
  for each row
  execute function public.person_roles_plan_assign_trg();

create or replace function public.enforce_plan_knowledge_rules_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  stage_lock boolean;
  has_knowledge boolean;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if current_setting('app.bypass_plan_lock', true) = 'on' then
    return coalesce(new, old);
  end if;

  select exists (
    select 1
    from public.skill_plan_stage_knowledges spk
    where spk.knowledge_skill_id = coalesce(new.skill_id, old.skill_id)
  )
  into has_knowledge;

  if not has_knowledge then
    return coalesce(new, old);
  end if;

  if tg_op <> 'DELETE' and new.actual_level is not null then
    if new.actual_level < 1 or new.actual_level > 3 then
      raise exception 'Plan knowledge levels must be between 1 and 3';
    end if;
  end if;

  select coalesce((
    select psps.is_unlocked
    from public.skill_plan_stage_knowledges spk
    join public.skill_plan_stages sps on sps.id = spk.stage_id
    left join public.person_skill_plan_stages psps
      on psps.person_id = coalesce(new.person_id, old.person_id)
     and psps.stage_id = sps.id
    where spk.knowledge_skill_id = coalesce(new.skill_id, old.skill_id)
    limit 1
  ), false)
  into stage_lock;

  if stage_lock = false then
    raise exception 'This stage is locked for this person';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists enforce_plan_knowledge_rules_trg on public.person_skills;
create trigger enforce_plan_knowledge_rules_trg
  before insert or update or delete on public.person_skills
  for each row
  execute function public.enforce_plan_knowledge_rules_trg();

create or replace function public.recompute_plan_on_person_skill_change_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pp record;
begin
  if not exists (
    select 1
    from public.skill_plan_stage_knowledges spk
    where spk.knowledge_skill_id = coalesce(new.skill_id, old.skill_id)
  ) then
    return coalesce(new, old);
  end if;

  for pp in
    select distinct sps.plan_skill_id
    from public.skill_plan_stage_knowledges spk
    join public.skill_plan_stages sps on sps.id = spk.stage_id
    where spk.knowledge_skill_id = coalesce(new.skill_id, old.skill_id)
  loop
    perform public.recompute_person_plan_progress(coalesce(new.person_id, old.person_id), pp.plan_skill_id);
  end loop;
  return coalesce(new, old);
end;
$$;

drop trigger if exists recompute_plan_on_person_skill_change_trg on public.person_skills;
create trigger recompute_plan_on_person_skill_change_trg
  after insert or update or delete on public.person_skills
  for each row
  execute function public.recompute_plan_on_person_skill_change_trg();

create or replace function public.recompute_targets_on_stage_duration_change_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.person_skill_plan_stages psps
  set
    target_date = public.compute_stage_target_date(psps.unlocked_at, new.duration_months),
    updated_at = now()
  where psps.stage_id = new.id
    and psps.is_unlocked;
  return new;
end;
$$;

drop trigger if exists recompute_targets_on_stage_duration_change_trg on public.skill_plan_stages;
create trigger recompute_targets_on_stage_duration_change_trg
  after update of duration_months on public.skill_plan_stages
  for each row
  execute function public.recompute_targets_on_stage_duration_change_trg();

create or replace function public.rebuild_person_plan_after_config_change(
  p_plan_skill_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  person_row record;
begin
  for person_row in
    select psp.person_id
    from public.person_skill_plans psp
    where psp.plan_skill_id = p_plan_skill_id
  loop
    perform public.ensure_person_plan_stage_rows(person_row.person_id, p_plan_skill_id);
  end loop;
end;
$$;

create or replace function public.rebuild_on_stage_change_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.rebuild_person_plan_after_config_change(coalesce(new.plan_skill_id, old.plan_skill_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists rebuild_on_stage_change_trg on public.skill_plan_stages;
create trigger rebuild_on_stage_change_trg
  after insert or update or delete on public.skill_plan_stages
  for each row
  execute function public.rebuild_on_stage_change_trg();

create or replace function public.rebuild_on_knowledge_change_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_skill_id uuid;
begin
  select sps.plan_skill_id
  into v_plan_skill_id
  from public.skill_plan_stages sps
  where sps.id = coalesce(new.stage_id, old.stage_id);

  if v_plan_skill_id is not null then
    perform public.rebuild_person_plan_after_config_change(v_plan_skill_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists rebuild_on_knowledge_change_trg on public.skill_plan_stage_knowledges;
create trigger rebuild_on_knowledge_change_trg
  after insert or update or delete on public.skill_plan_stage_knowledges
  for each row
  execute function public.rebuild_on_knowledge_change_trg();

grant select, insert, update, delete on public.skill_plan_stages to authenticated;
grant select, insert, update, delete on public.skill_plan_stage_knowledges to authenticated;
grant select, insert, update, delete on public.person_skill_plans to authenticated;
grant select, insert, update, delete on public.person_skill_plan_stages to authenticated;

alter table public.skill_plan_stages enable row level security;
alter table public.skill_plan_stage_knowledges enable row level security;
alter table public.person_skill_plans enable row level security;
alter table public.person_skill_plan_stages enable row level security;

create policy "skill_plan_stages_select_auth"
  on public.skill_plan_stages for select to authenticated using (true);
create policy "skill_plan_stage_knowledges_select_auth"
  on public.skill_plan_stage_knowledges for select to authenticated using (true);
create policy "person_skill_plans_select_auth"
  on public.person_skill_plans for select to authenticated using (true);
create policy "person_skill_plan_stages_select_auth"
  on public.person_skill_plan_stages for select to authenticated using (true);

create policy "skill_plan_stages_write_staff"
  on public.skill_plan_stages for all to authenticated
  using (public.is_app_admin() or public.is_app_assessor())
  with check (public.is_app_admin() or public.is_app_assessor());

create policy "skill_plan_stage_knowledges_write_staff"
  on public.skill_plan_stage_knowledges for all to authenticated
  using (public.is_app_admin() or public.is_app_assessor())
  with check (public.is_app_admin() or public.is_app_assessor());

create policy "person_skill_plans_write_staff"
  on public.person_skill_plans for all to authenticated
  using (public.is_app_admin() or public.is_app_assessor())
  with check (public.is_app_admin() or public.is_app_assessor());

create policy "person_skill_plan_stages_write_staff"
  on public.person_skill_plan_stages for all to authenticated
  using (public.is_app_admin() or public.is_app_assessor())
  with check (public.is_app_admin() or public.is_app_assessor());

create or replace view public.v_person_plan_stage_progress as
select
  psps.person_id,
  psps.plan_skill_id,
  sk.name as plan_name,
  sps.id as stage_id,
  sps.stage_no,
  sps.name as stage_name,
  sps.duration_months,
  psps.is_unlocked,
  psps.target_date,
  psps.progress_percent,
  psps.total_knowledges,
  psps.completed_knowledges
from public.person_skill_plan_stages psps
join public.skill_plan_stages sps on sps.id = psps.stage_id
join public.skills sk on sk.id = psps.plan_skill_id;

grant select on public.v_person_plan_stage_progress to authenticated;

create or replace view public.v_person_plan_stage_knowledges as
select
  psps.person_id,
  sps.plan_skill_id,
  sps.id as stage_id,
  sps.stage_no,
  sps.name as stage_name,
  spk.knowledge_skill_id,
  sk.name as knowledge_name,
  ps.actual_level,
  psps.is_unlocked
from public.person_skill_plan_stages psps
join public.skill_plan_stages sps on sps.id = psps.stage_id
join public.skill_plan_stage_knowledges spk on spk.stage_id = sps.id
join public.skills sk on sk.id = spk.knowledge_skill_id
left join public.person_skills ps
  on ps.person_id = psps.person_id
 and ps.skill_id = spk.knowledge_skill_id;

grant select on public.v_person_plan_stage_knowledges to authenticated;

-- ----------------------------------------------------------------------------
-- Palletising conversion
-- ----------------------------------------------------------------------------
select set_config('app.bypass_plan_lock', 'on', true);

with pallet_group as (
  select sg.id
  from public.skill_groups sg
  where lower(sg.name) like '%pallet%'
  order by sg.sort_order, sg.name
  limit 1
),
plan_skill as (
  insert into public.skills (skill_group_id, name, kind, sort_order)
  select pg.id, 'Palletising', 'plan'::public.skill_kind, 1
  from pallet_group pg
  where not exists (
    select 1 from public.skills s where lower(s.name) = 'palletising'
  )
  returning id
)
select 1;

with plan_ref as (
  select s.id as plan_skill_id
  from public.skills s
  where lower(s.name) = 'palletising' and s.kind = 'plan'
  limit 1
)
insert into public.skill_plan_stages (plan_skill_id, stage_no, name, duration_months, sort_order)
select pr.plan_skill_id, v.stage_no, v.name, v.duration_months, v.sort_order
from plan_ref pr
cross join (values
  (1::smallint, 'Palletising Stage 1', 2, 1),
  (2::smallint, 'Palletising Stage 2', 3, 2),
  (3::smallint, 'Palletising Stage 3', 4, 3)
) as v(stage_no, name, duration_months, sort_order)
on conflict (plan_skill_id, stage_no) do update
set name = excluded.name,
    duration_months = excluded.duration_months,
    sort_order = excluded.sort_order;

with plan_ref as (
  select s.id as plan_skill_id
  from public.skills s
  where lower(s.name) = 'palletising' and s.kind = 'plan'
  limit 1
),
knowledge_src as (
  select s.id as knowledge_skill_id
  from public.skills s
  join public.skill_groups sg on sg.id = s.skill_group_id
  join plan_ref pr on true
  where lower(sg.name) like '%pallet%'
    and s.kind = 'numeric'
    and s.id <> pr.plan_skill_id
),
bucketed as (
  select knowledge_skill_id, ntile(3) over (order by md5(knowledge_skill_id::text)) as stage_no
  from knowledge_src
),
stage_ref as (
  select sps.id as stage_id, sps.stage_no
  from public.skill_plan_stages sps
  join plan_ref pr on pr.plan_skill_id = sps.plan_skill_id
)
insert into public.skill_plan_stage_knowledges (stage_id, knowledge_skill_id)
select sr.stage_id, b.knowledge_skill_id
from bucketed b
join stage_ref sr on sr.stage_no = b.stage_no
on conflict (stage_id, knowledge_skill_id) do nothing;

with plan_ref as (
  select s.id as plan_skill_id
  from public.skills s
  where lower(s.name) = 'palletising' and s.kind = 'plan'
  limit 1
),
legacy_knowledge as (
  select distinct spk.knowledge_skill_id as skill_id
  from public.skill_plan_stage_knowledges spk
  join public.skill_plan_stages sps on sps.id = spk.stage_id
  join plan_ref pr on pr.plan_skill_id = sps.plan_skill_id
)
insert into public.role_skill_requirements (role_id, skill_id, required_level)
select distinct rsr.role_id, pr.plan_skill_id, 1
from public.role_skill_requirements rsr
join legacy_knowledge lk on lk.skill_id = rsr.skill_id
join plan_ref pr on true
on conflict (role_id, skill_id) do nothing;

with plan_ref as (
  select s.id as plan_skill_id
  from public.skills s
  where lower(s.name) = 'palletising' and s.kind = 'plan'
  limit 1
),
legacy_knowledge as (
  select distinct spk.knowledge_skill_id as skill_id
  from public.skill_plan_stage_knowledges spk
  join public.skill_plan_stages sps on sps.id = spk.stage_id
  join plan_ref pr on pr.plan_skill_id = sps.plan_skill_id
)
delete from public.role_skill_requirements rsr
using legacy_knowledge lk
where rsr.skill_id = lk.skill_id;

with plan_ref as (
  select s.id as plan_skill_id
  from public.skills s
  where lower(s.name) = 'palletising' and s.kind = 'plan'
  limit 1
),
people_to_assign as (
  select distinct pr.person_id
  from public.person_roles pr
  join public.role_skill_requirements rsr on rsr.role_id = pr.role_id and rsr.required_level >= 1
  join plan_ref p on p.plan_skill_id = rsr.skill_id
),
assigned as (
  insert into public.person_skill_plans (person_id, plan_skill_id, assigned_at)
  select pta.person_id, pr.plan_skill_id, now()
  from people_to_assign pta
  join plan_ref pr on true
  on conflict (person_id, plan_skill_id) do update
    set assigned_at = excluded.assigned_at,
        current_stage_no = 1,
        completed = false,
        completed_at = null
  returning person_id, plan_skill_id
)
select 1;

do $$
declare
  rec record;
begin
  for rec in
    select psp.person_id, psp.plan_skill_id
    from public.person_skill_plans psp
    join public.skills s on s.id = psp.plan_skill_id
    where lower(s.name) = 'palletising'
  loop
    perform public.ensure_person_plan_stage_rows(rec.person_id, rec.plan_skill_id);
  end loop;
end
$$;

select set_config('app.bypass_plan_lock', 'off', true);

with plan_ref as (
  select s.id as plan_skill_id
  from public.skills s
  where lower(s.name) = 'palletising' and s.kind = 'plan'
  limit 1
),
stage_ref as (
  select sps.id as stage_id, sps.stage_no
  from public.skill_plan_stages sps
  join plan_ref pr on pr.plan_skill_id = sps.plan_skill_id
),
knowledge_ref as (
  select sr.stage_no, spk.knowledge_skill_id
  from stage_ref sr
  join public.skill_plan_stage_knowledges spk on spk.stage_id = sr.stage_id
),
assigned_people as (
  select psp.person_id
  from public.person_skill_plans psp
  join plan_ref pr on pr.plan_skill_id = psp.plan_skill_id
)
delete from public.person_skills ps
using knowledge_ref kr, assigned_people ap
where ps.person_id = ap.person_id
  and ps.skill_id = kr.knowledge_skill_id
  and kr.stage_no in (2, 3);

with plan_ref as (
  select s.id as plan_skill_id
  from public.skills s
  where lower(s.name) = 'palletising' and s.kind = 'plan'
  limit 1
),
stage_one_knowledges as (
  select spk.knowledge_skill_id
  from public.skill_plan_stage_knowledges spk
  join public.skill_plan_stages sps on sps.id = spk.stage_id
  join plan_ref pr on pr.plan_skill_id = sps.plan_skill_id
  where sps.stage_no = 1
),
assigned_people as (
  select psp.person_id
  from public.person_skill_plans psp
  join plan_ref pr on pr.plan_skill_id = psp.plan_skill_id
)
insert into public.person_skills (person_id, skill_id, actual_level, is_extra, due_date)
select ap.person_id, s1.knowledge_skill_id, 1, false, null
from assigned_people ap
cross join stage_one_knowledges s1
on conflict (person_id, skill_id) do update
set actual_level = 1,
    is_extra = false,
    due_date = excluded.due_date;

do $$
declare
  rec record;
begin
  for rec in
    select psp.person_id, psp.plan_skill_id
    from public.person_skill_plans psp
    join public.skills s on s.id = psp.plan_skill_id
    where lower(s.name) = 'palletising'
  loop
    update public.person_skill_plans
    set current_stage_no = 1, completed = false, completed_at = null
    where person_id = rec.person_id and plan_skill_id = rec.plan_skill_id;
    perform public.recompute_person_plan_progress(rec.person_id, rec.plan_skill_id);
  end loop;
end
$$;
