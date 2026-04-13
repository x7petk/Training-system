-- Observation systems: one LDR activity link per workspace (SOS/QOS/PPO),
-- while keeping types independent from activities.

-- ---------------------------------------------------------------------------
-- New config table: one linked activity per workspace + system kind
-- ---------------------------------------------------------------------------

create table if not exists public.obs_system_activity_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.ldr_workspaces (id) on delete cascade,
  kind text not null check (kind in ('sos', 'qos', 'ppo')),
  ldr_activity_id uuid not null references public.ldr_activities (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obs_system_activity_links_one_kind_per_workspace unique (workspace_id, kind),
  constraint obs_system_activity_links_one_activity_per_workspace unique (workspace_id, ldr_activity_id)
);

create index if not exists obs_system_activity_links_workspace_kind_idx
  on public.obs_system_activity_links (workspace_id, kind);

create or replace function public.obs_system_activity_links_validate_workspace()
returns trigger
language plpgsql
as $$
declare
  v_activity_workspace uuid;
begin
  select a.workspace_id into v_activity_workspace
  from public.ldr_activities a
  where a.id = new.ldr_activity_id;

  if v_activity_workspace is null then
    raise exception 'Linked activity not found.';
  end if;

  if v_activity_workspace <> new.workspace_id then
    raise exception 'Linked activity must belong to the selected workspace.';
  end if;

  return new;
end;
$$;

drop trigger if exists obs_system_activity_links_validate_workspace_trg on public.obs_system_activity_links;
create trigger obs_system_activity_links_validate_workspace_trg
  before insert or update on public.obs_system_activity_links
  for each row
  execute function public.obs_system_activity_links_validate_workspace();

drop trigger if exists obs_system_activity_links_updated_at on public.obs_system_activity_links;
create trigger obs_system_activity_links_updated_at
  before update on public.obs_system_activity_links
  for each row
  execute function public.obs_touch_updated_at();

grant select, insert, update, delete on public.obs_system_activity_links to authenticated;
alter table public.obs_system_activity_links enable row level security;
drop policy if exists "obs_system_activity_links_select_ldr" on public.obs_system_activity_links;
create policy "obs_system_activity_links_select_ldr"
  on public.obs_system_activity_links
  for select
  to authenticated
  using (public.can_access_ldr_tools());
drop policy if exists "obs_system_activity_links_write_admin" on public.obs_system_activity_links;
create policy "obs_system_activity_links_write_admin"
  on public.obs_system_activity_links
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- ---------------------------------------------------------------------------
-- Scope observation types by workspace (per-site admin context)
-- ---------------------------------------------------------------------------

alter table public.sos_types add column if not exists workspace_id uuid references public.ldr_workspaces (id) on delete cascade;
alter table public.qos_types add column if not exists workspace_id uuid references public.ldr_workspaces (id) on delete cascade;
alter table public.ppo_types add column if not exists workspace_id uuid references public.ldr_workspaces (id) on delete cascade;

update public.sos_types t
set workspace_id = a.workspace_id
from public.ldr_activities a
where t.workspace_id is null
  and t.ldr_activity_id = a.id;

update public.qos_types t
set workspace_id = a.workspace_id
from public.ldr_activities a
where t.workspace_id is null
  and t.ldr_activity_id = a.id;

update public.ppo_types t
set workspace_id = a.workspace_id
from public.ldr_activities a
where t.workspace_id is null
  and t.ldr_activity_id = a.id;

alter table public.sos_types alter column workspace_id set not null;
alter table public.qos_types alter column workspace_id set not null;
alter table public.ppo_types alter column workspace_id set not null;

create index if not exists sos_types_workspace_idx on public.sos_types (workspace_id);
create index if not exists qos_types_workspace_idx on public.qos_types (workspace_id);
create index if not exists ppo_types_workspace_idx on public.ppo_types (workspace_id);

-- Keep old ldr_activity_id data for historical compatibility, but stop requiring it.
alter table public.sos_types alter column ldr_activity_id drop not null;
alter table public.qos_types alter column ldr_activity_id drop not null;
alter table public.ppo_types alter column ldr_activity_id drop not null;

drop index if exists public.sos_types_one_per_ldr_activity;
drop index if exists public.qos_types_one_per_ldr_activity;
drop index if exists public.ppo_types_one_per_ldr_activity;

-- Type names are now managed manually in admin (no auto-sync from activity names).
drop trigger if exists sos_types_set_name_from_activity_trg on public.sos_types;
drop trigger if exists qos_types_set_name_from_activity_trg on public.qos_types;
drop trigger if exists ppo_types_set_name_from_activity_trg on public.ppo_types;
drop trigger if exists ldr_activities_name_to_sos_types_trg on public.ldr_activities;
drop trigger if exists ldr_activities_name_to_qos_types_trg on public.ldr_activities;
drop trigger if exists ldr_activities_name_to_ppo_types_trg on public.ldr_activities;

-- ---------------------------------------------------------------------------
-- Backfill system links from existing types (first type by sort/name per workspace)
-- ---------------------------------------------------------------------------

insert into public.obs_system_activity_links (workspace_id, kind, ldr_activity_id)
select x.workspace_id, 'sos', x.ldr_activity_id
from (
  select
    t.workspace_id,
    t.ldr_activity_id,
    row_number() over (partition by t.workspace_id order by t.sort_order, t.name, t.id) as rn
  from public.sos_types t
  where t.workspace_id is not null and t.ldr_activity_id is not null
) x
where x.rn = 1
on conflict (workspace_id, kind) do nothing;

insert into public.obs_system_activity_links (workspace_id, kind, ldr_activity_id)
select x.workspace_id, 'qos', x.ldr_activity_id
from (
  select
    t.workspace_id,
    t.ldr_activity_id,
    row_number() over (partition by t.workspace_id order by t.sort_order, t.name, t.id) as rn
  from public.qos_types t
  where t.workspace_id is not null and t.ldr_activity_id is not null
) x
where x.rn = 1
on conflict (workspace_id, kind) do nothing;

insert into public.obs_system_activity_links (workspace_id, kind, ldr_activity_id)
select x.workspace_id, 'ppo', x.ldr_activity_id
from (
  select
    t.workspace_id,
    t.ldr_activity_id,
    row_number() over (partition by t.workspace_id order by t.sort_order, t.name, t.id) as rn
  from public.ppo_types t
  where t.workspace_id is not null and t.ldr_activity_id is not null
) x
where x.rn = 1
on conflict (workspace_id, kind) do nothing;

-- ---------------------------------------------------------------------------
-- Assignment sync checks now validate against system-level activity links
-- ---------------------------------------------------------------------------

create or replace function public.sos_records_sync_assignment_rag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ldr_rag public.ldr_rag_status;
  v_ok boolean;
  v_feedback text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if old.completed_at is not null then
    return new;
  end if;
  if new.completed_at is null or new.ldr_assignment_id is null or new.status is null then
    return new;
  end if;

  case new.status::text
    when 'green' then v_ldr_rag := 'green';
    when 'amber' then v_ldr_rag := 'yellow';
    when 'red' then v_ldr_rag := 'red';
    else return new;
  end case;

  select exists (
    select 1
    from public.ldr_assignments a
    inner join public.obs_system_activity_links l
      on l.workspace_id = a.workspace_id
     and l.kind = 'sos'
     and l.ldr_activity_id = a.activity_id
    where a.id = new.ldr_assignment_id
  )
  into v_ok;

  if not v_ok then
    return new;
  end if;

  v_feedback := case when btrim(coalesce(new.overall_comment, '')) <> '' then btrim(new.overall_comment) else null end;

  update public.ldr_assignments
  set
    rag_status = v_ldr_rag,
    comment = case
      when v_feedback is null then comment
      when btrim(coalesce(comment, '')) = '' then v_feedback
      else concat_ws(E'\n', btrim(comment), v_feedback)
    end
  where id = new.ldr_assignment_id;

  return new;
end;
$$;

create or replace function public.qos_records_sync_assignment_rag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ldr_rag public.ldr_rag_status;
  v_ok boolean;
  v_answer_feedback text;
  v_feedback text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if old.completed_at is not null then
    return new;
  end if;
  if new.completed_at is null or new.ldr_assignment_id is null or new.status is null then
    return new;
  end if;

  case new.status::text
    when 'green' then v_ldr_rag := 'green';
    when 'amber' then v_ldr_rag := 'yellow';
    when 'red' then v_ldr_rag := 'red';
    else return new;
  end case;

  select exists (
    select 1
    from public.ldr_assignments a
    inner join public.obs_system_activity_links l
      on l.workspace_id = a.workspace_id
     and l.kind = 'qos'
     and l.ldr_activity_id = a.activity_id
    where a.id = new.ldr_assignment_id
  )
  into v_ok;

  if not v_ok then
    return new;
  end if;

  select string_agg(btrim(answer.comment), E'\n' order by answer.sort_order, answer.id)
  into v_answer_feedback
  from public.qos_answers answer
  where answer.qos_record_id = new.id
    and btrim(answer.comment) <> '';

  v_feedback := concat_ws(
    E'\n',
    case when btrim(coalesce(new.overall_comment, '')) <> '' then btrim(new.overall_comment) else null end,
    case when btrim(coalesce(v_answer_feedback, '')) <> '' then btrim(v_answer_feedback) else null end
  );

  update public.ldr_assignments
  set
    rag_status = v_ldr_rag,
    comment = case
      when btrim(coalesce(v_feedback, '')) = '' then comment
      when btrim(coalesce(comment, '')) = '' then v_feedback
      else concat_ws(E'\n', btrim(comment), v_feedback)
    end
  where id = new.ldr_assignment_id;

  return new;
end;
$$;

create or replace function public.ppo_records_sync_assignment_rag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ldr_rag public.ldr_rag_status;
  v_ok boolean;
  v_answer_feedback text;
  v_feedback text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if old.completed_at is not null then
    return new;
  end if;
  if new.completed_at is null or new.ldr_assignment_id is null or new.status is null then
    return new;
  end if;

  case new.status::text
    when 'green' then v_ldr_rag := 'green';
    when 'amber' then v_ldr_rag := 'yellow';
    when 'red' then v_ldr_rag := 'red';
    else return new;
  end case;

  select exists (
    select 1
    from public.ldr_assignments a
    inner join public.obs_system_activity_links l
      on l.workspace_id = a.workspace_id
     and l.kind = 'ppo'
     and l.ldr_activity_id = a.activity_id
    where a.id = new.ldr_assignment_id
  )
  into v_ok;

  if not v_ok then
    return new;
  end if;

  select string_agg(btrim(answer.comment), E'\n' order by answer.sort_order, answer.id)
  into v_answer_feedback
  from public.ppo_answers answer
  where answer.ppo_record_id = new.id
    and btrim(answer.comment) <> '';

  v_feedback := concat_ws(
    E'\n',
    case when btrim(coalesce(new.overall_comment, '')) <> '' then btrim(new.overall_comment) else null end,
    case when btrim(coalesce(v_answer_feedback, '')) <> '' then btrim(v_answer_feedback) else null end
  );

  update public.ldr_assignments
  set
    rag_status = v_ldr_rag,
    comment = case
      when btrim(coalesce(v_feedback, '')) = '' then comment
      when btrim(coalesce(comment, '')) = '' then v_feedback
      else concat_ws(E'\n', btrim(comment), v_feedback)
    end
  where id = new.ldr_assignment_id;

  return new;
end;
$$;
