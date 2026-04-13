-- SOS / QOS / PPO observation systems (mirror HC: roster, RLS, duplicate guard, assignment sync).

-- ---------------------------------------------------------------------------
-- Enum: per-question answers (QOS + PPO)
-- ---------------------------------------------------------------------------

do $e$
begin
  create type public.obs_answer_kind as enum ('pass', 'fail', 'na');
exception
  when duplicate_object then null;
end $e$;

grant usage on type public.obs_answer_kind to authenticated;

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.obs_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- SOS config + run
-- ---------------------------------------------------------------------------

create table public.sos_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  sort_order int not null default 0,
  ldr_activity_id uuid not null references public.ldr_activities (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index sos_types_one_per_ldr_activity
  on public.sos_types (ldr_activity_id);

create table public.sos_templates (
  id uuid primary key default gen_random_uuid(),
  sos_type_id uuid not null references public.sos_types (id) on delete restrict,
  name text not null,
  version int not null default 1,
  description text,
  active boolean not null default false,
  threshold_score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index sos_templates_one_active_per_type
  on public.sos_templates (sos_type_id)
  where active;

create table public.sos_template_questions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.sos_templates (id) on delete cascade,
  question_text text not null,
  expected_standard text not null default '',
  sort_order int not null default 0,
  active boolean not null default true,
  is_critical boolean not null default false,
  help_text text,
  good_image_path text not null default '',
  bad_image_path text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sos_template_questions_template_id_idx on public.sos_template_questions (template_id);

create table public.sos_records (
  id uuid primary key default gen_random_uuid(),
  sos_type_id uuid not null references public.sos_types (id) on delete restrict,
  template_id uuid not null references public.sos_templates (id) on delete restrict,
  master_site_id uuid not null references public.master_sites (id) on delete restrict,
  master_plant_id uuid not null references public.master_plants (id) on delete restrict,
  master_cell_id uuid not null references public.master_cells (id) on delete restrict,
  completed_by_user_id uuid not null references auth.users (id) on delete cascade,
  completed_by_name text not null,
  operator_name text,
  completed_at timestamptz,
  score int,
  status public.hc_rag_status,
  sos_level text,
  overall_comment text,
  template_version_snapshot int,
  ldr_assignment_id uuid references public.ldr_assignments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sos_records_submit_consistency_ck check (
    (completed_at is null and status is null and score is null and template_version_snapshot is null)
    or
    (completed_at is not null and status is not null and score is not null and template_version_snapshot is not null and sos_level is not null)
  ),
  constraint sos_records_sos_level_ck check (
    sos_level is null or sos_level in ('full', 'partly', 'not')
  )
);

create index sos_records_cell_idx on public.sos_records (master_cell_id);
create index sos_records_completed_at_idx on public.sos_records (completed_at desc nulls last);
create index sos_records_ldr_assignment_id_idx on public.sos_records (ldr_assignment_id)
  where ldr_assignment_id is not null;

-- ---------------------------------------------------------------------------
-- QOS
-- ---------------------------------------------------------------------------

create table public.qos_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  sort_order int not null default 0,
  ldr_activity_id uuid not null references public.ldr_activities (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index qos_types_one_per_ldr_activity on public.qos_types (ldr_activity_id);

create table public.qos_templates (
  id uuid primary key default gen_random_uuid(),
  qos_type_id uuid not null references public.qos_types (id) on delete restrict,
  name text not null,
  version int not null default 1,
  description text,
  active boolean not null default false,
  threshold_score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index qos_templates_one_active_per_type
  on public.qos_templates (qos_type_id)
  where active;

create table public.qos_template_questions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.qos_templates (id) on delete cascade,
  question_text text not null,
  expected_standard text not null default '',
  sort_order int not null default 0,
  active boolean not null default true,
  is_critical boolean not null default false,
  help_text text,
  good_image_path text not null default '',
  bad_image_path text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index qos_template_questions_template_id_idx on public.qos_template_questions (template_id);

create table public.qos_records (
  id uuid primary key default gen_random_uuid(),
  qos_type_id uuid not null references public.qos_types (id) on delete restrict,
  template_id uuid not null references public.qos_templates (id) on delete restrict,
  master_site_id uuid not null references public.master_sites (id) on delete restrict,
  master_plant_id uuid not null references public.master_plants (id) on delete restrict,
  master_cell_id uuid not null references public.master_cells (id) on delete restrict,
  completed_by_user_id uuid not null references auth.users (id) on delete cascade,
  completed_by_name text not null,
  operator_name text,
  completed_at timestamptz,
  score int,
  status public.hc_rag_status,
  overall_comment text,
  template_version_snapshot int,
  ldr_assignment_id uuid references public.ldr_assignments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qos_records_submit_consistency_ck check (
    (completed_at is null and status is null and score is null and template_version_snapshot is null)
    or
    (completed_at is not null and status is not null and score is not null and template_version_snapshot is not null)
  )
);

create index qos_records_cell_idx on public.qos_records (master_cell_id);
create index qos_records_completed_at_idx on public.qos_records (completed_at desc nulls last);
create index qos_records_ldr_assignment_id_idx on public.qos_records (ldr_assignment_id)
  where ldr_assignment_id is not null;

create table public.qos_answers (
  id uuid primary key default gen_random_uuid(),
  qos_record_id uuid not null references public.qos_records (id) on delete cascade,
  template_question_id uuid not null references public.qos_template_questions (id) on delete restrict,
  question_text_snapshot text,
  expected_standard_snapshot text,
  answer public.obs_answer_kind not null,
  score_value int,
  comment text not null default '',
  operator_user_id uuid references auth.users (id) on delete set null,
  operator_name text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qos_answers_one_per_question unique (qos_record_id, template_question_id),
  constraint qos_answers_score_ck check (
    (answer = 'na' and score_value is null)
    or (answer = 'pass' and score_value = 1)
    or (answer = 'fail' and score_value = 0)
  )
);

create index qos_answers_record_idx on public.qos_answers (qos_record_id);

-- ---------------------------------------------------------------------------
-- PPO
-- ---------------------------------------------------------------------------

create table public.ppo_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  sort_order int not null default 0,
  ldr_activity_id uuid not null references public.ldr_activities (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index ppo_types_one_per_ldr_activity on public.ppo_types (ldr_activity_id);

create table public.ppo_templates (
  id uuid primary key default gen_random_uuid(),
  ppo_type_id uuid not null references public.ppo_types (id) on delete restrict,
  name text not null,
  version int not null default 1,
  description text,
  active boolean not null default false,
  threshold_score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index ppo_templates_one_active_per_type
  on public.ppo_templates (ppo_type_id)
  where active;

create table public.ppo_template_questions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.ppo_templates (id) on delete cascade,
  question_text text not null,
  expected_standard text not null default '',
  sort_order int not null default 0,
  active boolean not null default true,
  is_critical boolean not null default false,
  help_text text,
  good_image_path text not null default '',
  bad_image_path text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ppo_template_questions_template_id_idx on public.ppo_template_questions (template_id);

create table public.ppo_records (
  id uuid primary key default gen_random_uuid(),
  ppo_type_id uuid not null references public.ppo_types (id) on delete restrict,
  template_id uuid not null references public.ppo_templates (id) on delete restrict,
  master_site_id uuid not null references public.master_sites (id) on delete restrict,
  master_plant_id uuid not null references public.master_plants (id) on delete restrict,
  master_cell_id uuid not null references public.master_cells (id) on delete restrict,
  completed_by_user_id uuid not null references auth.users (id) on delete cascade,
  completed_by_name text not null,
  operator_name text,
  completed_at timestamptz,
  score int,
  status public.hc_rag_status,
  overall_comment text,
  template_version_snapshot int,
  ldr_assignment_id uuid references public.ldr_assignments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ppo_records_submit_consistency_ck check (
    (completed_at is null and status is null and score is null and template_version_snapshot is null)
    or
    (completed_at is not null and status is not null and score is not null and template_version_snapshot is not null)
  )
);

create index ppo_records_cell_idx on public.ppo_records (master_cell_id);
create index ppo_records_completed_at_idx on public.ppo_records (completed_at desc nulls last);
create index ppo_records_ldr_assignment_id_idx on public.ppo_records (ldr_assignment_id)
  where ldr_assignment_id is not null;

create table public.ppo_answers (
  id uuid primary key default gen_random_uuid(),
  ppo_record_id uuid not null references public.ppo_records (id) on delete cascade,
  template_question_id uuid not null references public.ppo_template_questions (id) on delete restrict,
  question_text_snapshot text,
  expected_standard_snapshot text,
  answer public.obs_answer_kind not null,
  score_value int,
  comment text not null default '',
  operator_user_id uuid references auth.users (id) on delete set null,
  operator_name text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ppo_answers_one_per_question unique (ppo_record_id, template_question_id),
  constraint ppo_answers_score_ck check (
    (answer = 'na' and score_value is null)
    or (answer = 'pass' and score_value = 1)
    or (answer = 'fail' and score_value = 0)
  )
);

create index ppo_answers_record_idx on public.ppo_answers (ppo_record_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists sos_types_updated_at on public.sos_types;
create trigger sos_types_updated_at before update on public.sos_types for each row execute function public.obs_touch_updated_at();
drop trigger if exists sos_templates_updated_at on public.sos_templates;
create trigger sos_templates_updated_at before update on public.sos_templates for each row execute function public.obs_touch_updated_at();
drop trigger if exists sos_template_questions_updated_at on public.sos_template_questions;
create trigger sos_template_questions_updated_at before update on public.sos_template_questions for each row execute function public.obs_touch_updated_at();
drop trigger if exists sos_records_updated_at on public.sos_records;
create trigger sos_records_updated_at before update on public.sos_records for each row execute function public.obs_touch_updated_at();

drop trigger if exists qos_types_updated_at on public.qos_types;
create trigger qos_types_updated_at before update on public.qos_types for each row execute function public.obs_touch_updated_at();
drop trigger if exists qos_templates_updated_at on public.qos_templates;
create trigger qos_templates_updated_at before update on public.qos_templates for each row execute function public.obs_touch_updated_at();
drop trigger if exists qos_template_questions_updated_at on public.qos_template_questions;
create trigger qos_template_questions_updated_at before update on public.qos_template_questions for each row execute function public.obs_touch_updated_at();
drop trigger if exists qos_records_updated_at on public.qos_records;
create trigger qos_records_updated_at before update on public.qos_records for each row execute function public.obs_touch_updated_at();
drop trigger if exists qos_answers_updated_at on public.qos_answers;
create trigger qos_answers_updated_at before update on public.qos_answers for each row execute function public.obs_touch_updated_at();

drop trigger if exists ppo_types_updated_at on public.ppo_types;
create trigger ppo_types_updated_at before update on public.ppo_types for each row execute function public.obs_touch_updated_at();
drop trigger if exists ppo_templates_updated_at on public.ppo_templates;
create trigger ppo_templates_updated_at before update on public.ppo_templates for each row execute function public.obs_touch_updated_at();
drop trigger if exists ppo_template_questions_updated_at on public.ppo_template_questions;
create trigger ppo_template_questions_updated_at before update on public.ppo_template_questions for each row execute function public.obs_touch_updated_at();
drop trigger if exists ppo_records_updated_at on public.ppo_records;
create trigger ppo_records_updated_at before update on public.ppo_records for each row execute function public.obs_touch_updated_at();
drop trigger if exists ppo_answers_updated_at on public.ppo_answers;
create trigger ppo_answers_updated_at before update on public.ppo_answers for each row execute function public.obs_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Type name sync from ldr_activities (per family)
-- ---------------------------------------------------------------------------

create or replace function public.sos_types_set_name_from_activity()
returns trigger
language plpgsql
as $$
begin
  if new.ldr_activity_id is not null then
    select a.name into strict new.name from public.ldr_activities a where a.id = new.ldr_activity_id;
  end if;
  return new;
end;
$$;

create or replace function public.qos_types_set_name_from_activity()
returns trigger
language plpgsql
as $$
begin
  if new.ldr_activity_id is not null then
    select a.name into strict new.name from public.ldr_activities a where a.id = new.ldr_activity_id;
  end if;
  return new;
end;
$$;

create or replace function public.ppo_types_set_name_from_activity()
returns trigger
language plpgsql
as $$
begin
  if new.ldr_activity_id is not null then
    select a.name into strict new.name from public.ldr_activities a where a.id = new.ldr_activity_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sos_types_set_name_from_activity_trg on public.sos_types;
create trigger sos_types_set_name_from_activity_trg
  before insert or update on public.sos_types
  for each row
  execute function public.sos_types_set_name_from_activity();

drop trigger if exists qos_types_set_name_from_activity_trg on public.qos_types;
create trigger qos_types_set_name_from_activity_trg
  before insert or update on public.qos_types
  for each row
  execute function public.qos_types_set_name_from_activity();

drop trigger if exists ppo_types_set_name_from_activity_trg on public.ppo_types;
create trigger ppo_types_set_name_from_activity_trg
  before insert or update on public.ppo_types
  for each row
  execute function public.ppo_types_set_name_from_activity();

create or replace function public.ldr_activities_propagate_name_to_sos_types()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'update' and new.name is distinct from old.name then
    update public.sos_types set name = new.name, updated_at = now() where ldr_activity_id = new.id;
  end if;
  return new;
end;
$$;

create or replace function public.ldr_activities_propagate_name_to_qos_types()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'update' and new.name is distinct from old.name then
    update public.qos_types set name = new.name, updated_at = now() where ldr_activity_id = new.id;
  end if;
  return new;
end;
$$;

create or replace function public.ldr_activities_propagate_name_to_ppo_types()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'update' and new.name is distinct from old.name then
    update public.ppo_types set name = new.name, updated_at = now() where ldr_activity_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists ldr_activities_name_to_sos_types_trg on public.ldr_activities;
create trigger ldr_activities_name_to_sos_types_trg
  after update of name on public.ldr_activities
  for each row
  execute function public.ldr_activities_propagate_name_to_sos_types();

drop trigger if exists ldr_activities_name_to_qos_types_trg on public.ldr_activities;
create trigger ldr_activities_name_to_qos_types_trg
  after update of name on public.ldr_activities
  for each row
  execute function public.ldr_activities_propagate_name_to_qos_types();

drop trigger if exists ldr_activities_name_to_ppo_types_trg on public.ldr_activities;
create trigger ldr_activities_name_to_ppo_types_trg
  after update of name on public.ldr_activities
  for each row
  execute function public.ldr_activities_propagate_name_to_ppo_types();

-- ---------------------------------------------------------------------------
-- Duplicate submit (scheduled day), per family
-- ---------------------------------------------------------------------------

create or replace function public.sos_records_enforce_one_submit_per_day()
returns trigger
language plpgsql
as $$
declare
  v_new_day date;
begin
  if new.completed_at is null then
    return new;
  end if;

  if new.ldr_assignment_id is not null then
    select a.assignment_date into v_new_day
    from public.ldr_assignments a
    where a.id = new.ldr_assignment_id;
  end if;

  v_new_day := coalesce(v_new_day, (new.completed_at at time zone 'utc')::date);

  if exists (
    select 1
    from public.sos_records r
    left join public.ldr_assignments ra on ra.id = r.ldr_assignment_id
    where r.id is distinct from new.id
      and r.completed_at is not null
      and r.completed_by_user_id = new.completed_by_user_id
      and r.sos_type_id = new.sos_type_id
      and r.master_cell_id = new.master_cell_id
      and coalesce(ra.assignment_date, (r.completed_at at time zone 'utc')::date) = v_new_day
  ) then
    raise exception 'sos_duplicate_submit: %'
      , 'You already completed this SOS for this cell and type on this scheduled day.';
  end if;

  return new;
end;
$$;

drop trigger if exists sos_records_enforce_one_submit_per_day_trg on public.sos_records;
create trigger sos_records_enforce_one_submit_per_day_trg
  before insert or update on public.sos_records
  for each row
  execute function public.sos_records_enforce_one_submit_per_day();

create or replace function public.qos_records_enforce_one_submit_per_day()
returns trigger
language plpgsql
as $$
declare
  v_new_day date;
begin
  if new.completed_at is null then
    return new;
  end if;

  if new.ldr_assignment_id is not null then
    select a.assignment_date into v_new_day
    from public.ldr_assignments a
    where a.id = new.ldr_assignment_id;
  end if;

  v_new_day := coalesce(v_new_day, (new.completed_at at time zone 'utc')::date);

  if exists (
    select 1
    from public.qos_records r
    left join public.ldr_assignments ra on ra.id = r.ldr_assignment_id
    where r.id is distinct from new.id
      and r.completed_at is not null
      and r.completed_by_user_id = new.completed_by_user_id
      and r.qos_type_id = new.qos_type_id
      and r.master_cell_id = new.master_cell_id
      and coalesce(ra.assignment_date, (r.completed_at at time zone 'utc')::date) = v_new_day
  ) then
    raise exception 'qos_duplicate_submit: %'
      , 'You already completed this QOS for this cell and type on this scheduled day.';
  end if;

  return new;
end;
$$;

drop trigger if exists qos_records_enforce_one_submit_per_day_trg on public.qos_records;
create trigger qos_records_enforce_one_submit_per_day_trg
  before insert or update on public.qos_records
  for each row
  execute function public.qos_records_enforce_one_submit_per_day();

create or replace function public.ppo_records_enforce_one_submit_per_day()
returns trigger
language plpgsql
as $$
declare
  v_new_day date;
begin
  if new.completed_at is null then
    return new;
  end if;

  if new.ldr_assignment_id is not null then
    select a.assignment_date into v_new_day
    from public.ldr_assignments a
    where a.id = new.ldr_assignment_id;
  end if;

  v_new_day := coalesce(v_new_day, (new.completed_at at time zone 'utc')::date);

  if exists (
    select 1
    from public.ppo_records r
    left join public.ldr_assignments ra on ra.id = r.ldr_assignment_id
    where r.id is distinct from new.id
      and r.completed_at is not null
      and r.completed_by_user_id = new.completed_by_user_id
      and r.ppo_type_id = new.ppo_type_id
      and r.master_cell_id = new.master_cell_id
      and coalesce(ra.assignment_date, (r.completed_at at time zone 'utc')::date) = v_new_day
  ) then
    raise exception 'ppo_duplicate_submit: %'
      , 'You already completed this PPO for this cell and type on this scheduled day.';
  end if;

  return new;
end;
$$;

drop trigger if exists ppo_records_enforce_one_submit_per_day_trg on public.ppo_records;
create trigger ppo_records_enforce_one_submit_per_day_trg
  before insert or update on public.ppo_records
  for each row
  execute function public.ppo_records_enforce_one_submit_per_day();

-- ---------------------------------------------------------------------------
-- Assignment RAG + comment sync
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
    inner join public.sos_types t on t.id = new.sos_type_id and a.activity_id = t.ldr_activity_id
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

drop trigger if exists sos_records_sync_assignment_rag_trg on public.sos_records;
create trigger sos_records_sync_assignment_rag_trg
  after update on public.sos_records
  for each row
  execute function public.sos_records_sync_assignment_rag();

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
    inner join public.qos_types t on t.id = new.qos_type_id and a.activity_id = t.ldr_activity_id
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

drop trigger if exists qos_records_sync_assignment_rag_trg on public.qos_records;
create trigger qos_records_sync_assignment_rag_trg
  after update on public.qos_records
  for each row
  execute function public.qos_records_sync_assignment_rag();

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
    inner join public.ppo_types t on t.id = new.ppo_type_id and a.activity_id = t.ldr_activity_id
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

drop trigger if exists ppo_records_sync_assignment_rag_trg on public.ppo_records;
create trigger ppo_records_sync_assignment_rag_trg
  after update on public.ppo_records
  for each row
  execute function public.ppo_records_sync_assignment_rag();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.sos_types to authenticated;
grant select, insert, update, delete on public.sos_templates to authenticated;
grant select, insert, update, delete on public.sos_template_questions to authenticated;
grant select, insert, update, delete on public.sos_records to authenticated;

grant select, insert, update, delete on public.qos_types to authenticated;
grant select, insert, update, delete on public.qos_templates to authenticated;
grant select, insert, update, delete on public.qos_template_questions to authenticated;
grant select, insert, update, delete on public.qos_records to authenticated;
grant select, insert, update, delete on public.qos_answers to authenticated;

grant select, insert, update, delete on public.ppo_types to authenticated;
grant select, insert, update, delete on public.ppo_templates to authenticated;
grant select, insert, update, delete on public.ppo_template_questions to authenticated;
grant select, insert, update, delete on public.ppo_records to authenticated;
grant select, insert, update, delete on public.ppo_answers to authenticated;

-- ---------------------------------------------------------------------------
-- RLS (mirror HC)
-- ---------------------------------------------------------------------------

alter table public.sos_types enable row level security;
alter table public.sos_templates enable row level security;
alter table public.sos_template_questions enable row level security;
alter table public.sos_records enable row level security;

alter table public.qos_types enable row level security;
alter table public.qos_templates enable row level security;
alter table public.qos_template_questions enable row level security;
alter table public.qos_records enable row level security;
alter table public.qos_answers enable row level security;

alter table public.ppo_types enable row level security;
alter table public.ppo_templates enable row level security;
alter table public.ppo_template_questions enable row level security;
alter table public.ppo_records enable row level security;
alter table public.ppo_answers enable row level security;

-- SOS policies
drop policy if exists "sos_types_select_ldr" on public.sos_types;
create policy "sos_types_select_ldr" on public.sos_types for select to authenticated using (public.can_access_ldr_tools());
drop policy if exists "sos_types_write_admin" on public.sos_types;
create policy "sos_types_write_admin" on public.sos_types for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "sos_templates_select_ldr" on public.sos_templates;
create policy "sos_templates_select_ldr" on public.sos_templates for select to authenticated using (public.can_access_ldr_tools() and (active or public.is_app_admin()));
drop policy if exists "sos_templates_write_admin" on public.sos_templates;
create policy "sos_templates_write_admin" on public.sos_templates for insert to authenticated with check (public.is_app_admin());
drop policy if exists "sos_templates_update_admin" on public.sos_templates;
create policy "sos_templates_update_admin" on public.sos_templates for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists "sos_templates_delete_admin" on public.sos_templates;
create policy "sos_templates_delete_admin" on public.sos_templates for delete to authenticated using (public.is_app_admin());

drop policy if exists "sos_template_questions_select_ldr" on public.sos_template_questions;
create policy "sos_template_questions_select_ldr" on public.sos_template_questions for select to authenticated using (
  public.is_app_admin()
  or (public.can_access_ldr_tools() and exists (select 1 from public.sos_templates t where t.id = sos_template_questions.template_id and t.active = true))
);
drop policy if exists "sos_template_questions_write_admin" on public.sos_template_questions;
create policy "sos_template_questions_write_admin" on public.sos_template_questions for insert to authenticated with check (public.is_app_admin());
drop policy if exists "sos_template_questions_update_admin" on public.sos_template_questions;
create policy "sos_template_questions_update_admin" on public.sos_template_questions for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists "sos_template_questions_delete_admin" on public.sos_template_questions;
create policy "sos_template_questions_delete_admin" on public.sos_template_questions for delete to authenticated using (public.is_app_admin());

drop policy if exists "sos_records_select_ldr" on public.sos_records;
create policy "sos_records_select_ldr" on public.sos_records for select to authenticated using (public.can_access_ldr_tools());
drop policy if exists "sos_records_insert_ldr" on public.sos_records;
create policy "sos_records_insert_ldr" on public.sos_records for insert to authenticated with check (
  public.can_access_ldr_tools() and completed_by_user_id = auth.uid() and completed_at is null and status is null and score is null and template_version_snapshot is null
);
drop policy if exists "sos_records_update_draft_owner" on public.sos_records;
create policy "sos_records_update_draft_owner" on public.sos_records for update to authenticated using (
  public.can_access_ldr_tools() and completed_by_user_id = auth.uid() and completed_at is null
) with check (
  public.can_access_ldr_tools() and completed_by_user_id = auth.uid()
  and ((completed_at is null and status is null and score is null and template_version_snapshot is null)
    or (completed_at is not null and status is not null and score is not null and template_version_snapshot is not null and sos_level is not null))
);
drop policy if exists "sos_records_delete_admin" on public.sos_records;
create policy "sos_records_delete_admin" on public.sos_records for delete to authenticated using (public.is_app_admin());

-- QOS policies
drop policy if exists "qos_types_select_ldr" on public.qos_types;
create policy "qos_types_select_ldr" on public.qos_types for select to authenticated using (public.can_access_ldr_tools());
drop policy if exists "qos_types_write_admin" on public.qos_types;
create policy "qos_types_write_admin" on public.qos_types for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "qos_templates_select_ldr" on public.qos_templates;
create policy "qos_templates_select_ldr" on public.qos_templates for select to authenticated using (public.can_access_ldr_tools() and (active or public.is_app_admin()));
drop policy if exists "qos_templates_write_admin" on public.qos_templates;
create policy "qos_templates_write_admin" on public.qos_templates for insert to authenticated with check (public.is_app_admin());
drop policy if exists "qos_templates_update_admin" on public.qos_templates;
create policy "qos_templates_update_admin" on public.qos_templates for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists "qos_templates_delete_admin" on public.qos_templates;
create policy "qos_templates_delete_admin" on public.qos_templates for delete to authenticated using (public.is_app_admin());

drop policy if exists "qos_template_questions_select_ldr" on public.qos_template_questions;
create policy "qos_template_questions_select_ldr" on public.qos_template_questions for select to authenticated using (
  public.is_app_admin()
  or (public.can_access_ldr_tools() and exists (select 1 from public.qos_templates t where t.id = qos_template_questions.template_id and t.active = true))
);
drop policy if exists "qos_template_questions_write_admin" on public.qos_template_questions;
create policy "qos_template_questions_write_admin" on public.qos_template_questions for insert to authenticated with check (public.is_app_admin());
drop policy if exists "qos_template_questions_update_admin" on public.qos_template_questions;
create policy "qos_template_questions_update_admin" on public.qos_template_questions for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists "qos_template_questions_delete_admin" on public.qos_template_questions;
create policy "qos_template_questions_delete_admin" on public.qos_template_questions for delete to authenticated using (public.is_app_admin());

drop policy if exists "qos_records_select_ldr" on public.qos_records;
create policy "qos_records_select_ldr" on public.qos_records for select to authenticated using (public.can_access_ldr_tools());
drop policy if exists "qos_records_insert_ldr" on public.qos_records;
create policy "qos_records_insert_ldr" on public.qos_records for insert to authenticated with check (
  public.can_access_ldr_tools() and completed_by_user_id = auth.uid() and completed_at is null and status is null and score is null and template_version_snapshot is null
);
drop policy if exists "qos_records_update_draft_owner" on public.qos_records;
create policy "qos_records_update_draft_owner" on public.qos_records for update to authenticated using (
  public.can_access_ldr_tools() and completed_by_user_id = auth.uid() and completed_at is null
) with check (
  public.can_access_ldr_tools() and completed_by_user_id = auth.uid()
  and ((completed_at is null and status is null and score is null and template_version_snapshot is null)
    or (completed_at is not null and status is not null and score is not null and template_version_snapshot is not null))
);
drop policy if exists "qos_records_delete_admin" on public.qos_records;
create policy "qos_records_delete_admin" on public.qos_records for delete to authenticated using (public.is_app_admin());

drop policy if exists "qos_answers_select_ldr" on public.qos_answers;
create policy "qos_answers_select_ldr" on public.qos_answers for select to authenticated using (
  exists (select 1 from public.qos_records r where r.id = qos_answers.qos_record_id and public.can_access_ldr_tools())
);
drop policy if exists "qos_answers_insert_draft" on public.qos_answers;
create policy "qos_answers_insert_draft" on public.qos_answers for insert to authenticated with check (
  exists (select 1 from public.qos_records r where r.id = qos_answers.qos_record_id and public.can_access_ldr_tools() and r.completed_by_user_id = auth.uid() and r.completed_at is null)
);
drop policy if exists "qos_answers_update_draft" on public.qos_answers;
create policy "qos_answers_update_draft" on public.qos_answers for update to authenticated using (
  exists (select 1 from public.qos_records r where r.id = qos_answers.qos_record_id and r.completed_by_user_id = auth.uid() and r.completed_at is null)
) with check (
  exists (select 1 from public.qos_records r where r.id = qos_answers.qos_record_id and r.completed_by_user_id = auth.uid() and r.completed_at is null)
);
drop policy if exists "qos_answers_delete_draft" on public.qos_answers;
create policy "qos_answers_delete_draft" on public.qos_answers for delete to authenticated using (
  exists (select 1 from public.qos_records r where r.id = qos_answers.qos_record_id and r.completed_by_user_id = auth.uid() and r.completed_at is null)
);

-- PPO policies (same pattern as QOS)
drop policy if exists "ppo_types_select_ldr" on public.ppo_types;
create policy "ppo_types_select_ldr" on public.ppo_types for select to authenticated using (public.can_access_ldr_tools());
drop policy if exists "ppo_types_write_admin" on public.ppo_types;
create policy "ppo_types_write_admin" on public.ppo_types for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "ppo_templates_select_ldr" on public.ppo_templates;
create policy "ppo_templates_select_ldr" on public.ppo_templates for select to authenticated using (public.can_access_ldr_tools() and (active or public.is_app_admin()));
drop policy if exists "ppo_templates_write_admin" on public.ppo_templates;
create policy "ppo_templates_write_admin" on public.ppo_templates for insert to authenticated with check (public.is_app_admin());
drop policy if exists "ppo_templates_update_admin" on public.ppo_templates;
create policy "ppo_templates_update_admin" on public.ppo_templates for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists "ppo_templates_delete_admin" on public.ppo_templates;
create policy "ppo_templates_delete_admin" on public.ppo_templates for delete to authenticated using (public.is_app_admin());

drop policy if exists "ppo_template_questions_select_ldr" on public.ppo_template_questions;
create policy "ppo_template_questions_select_ldr" on public.ppo_template_questions for select to authenticated using (
  public.is_app_admin()
  or (public.can_access_ldr_tools() and exists (select 1 from public.ppo_templates t where t.id = ppo_template_questions.template_id and t.active = true))
);
drop policy if exists "ppo_template_questions_write_admin" on public.ppo_template_questions;
create policy "ppo_template_questions_write_admin" on public.ppo_template_questions for insert to authenticated with check (public.is_app_admin());
drop policy if exists "ppo_template_questions_update_admin" on public.ppo_template_questions;
create policy "ppo_template_questions_update_admin" on public.ppo_template_questions for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists "ppo_template_questions_delete_admin" on public.ppo_template_questions;
create policy "ppo_template_questions_delete_admin" on public.ppo_template_questions for delete to authenticated using (public.is_app_admin());

drop policy if exists "ppo_records_select_ldr" on public.ppo_records;
create policy "ppo_records_select_ldr" on public.ppo_records for select to authenticated using (public.can_access_ldr_tools());
drop policy if exists "ppo_records_insert_ldr" on public.ppo_records;
create policy "ppo_records_insert_ldr" on public.ppo_records for insert to authenticated with check (
  public.can_access_ldr_tools() and completed_by_user_id = auth.uid() and completed_at is null and status is null and score is null and template_version_snapshot is null
);
drop policy if exists "ppo_records_update_draft_owner" on public.ppo_records;
create policy "ppo_records_update_draft_owner" on public.ppo_records for update to authenticated using (
  public.can_access_ldr_tools() and completed_by_user_id = auth.uid() and completed_at is null
) with check (
  public.can_access_ldr_tools() and completed_by_user_id = auth.uid()
  and ((completed_at is null and status is null and score is null and template_version_snapshot is null)
    or (completed_at is not null and status is not null and score is not null and template_version_snapshot is not null))
);
drop policy if exists "ppo_records_delete_admin" on public.ppo_records;
create policy "ppo_records_delete_admin" on public.ppo_records for delete to authenticated using (public.is_app_admin());

drop policy if exists "ppo_answers_select_ldr" on public.ppo_answers;
create policy "ppo_answers_select_ldr" on public.ppo_answers for select to authenticated using (
  exists (select 1 from public.ppo_records r where r.id = ppo_answers.ppo_record_id and public.can_access_ldr_tools())
);
drop policy if exists "ppo_answers_insert_draft" on public.ppo_answers;
create policy "ppo_answers_insert_draft" on public.ppo_answers for insert to authenticated with check (
  exists (select 1 from public.ppo_records r where r.id = ppo_answers.ppo_record_id and public.can_access_ldr_tools() and r.completed_by_user_id = auth.uid() and r.completed_at is null)
);
drop policy if exists "ppo_answers_update_draft" on public.ppo_answers;
create policy "ppo_answers_update_draft" on public.ppo_answers for update to authenticated using (
  exists (select 1 from public.ppo_records r where r.id = ppo_answers.ppo_record_id and r.completed_by_user_id = auth.uid() and r.completed_at is null)
) with check (
  exists (select 1 from public.ppo_records r where r.id = ppo_answers.ppo_record_id and r.completed_by_user_id = auth.uid() and r.completed_at is null)
);
drop policy if exists "ppo_answers_delete_draft" on public.ppo_answers;
create policy "ppo_answers_delete_draft" on public.ppo_answers for delete to authenticated using (
  exists (select 1 from public.ppo_records r where r.id = ppo_answers.ppo_record_id and r.completed_by_user_id = auth.uid() and r.completed_at is null)
);

-- ---------------------------------------------------------------------------
-- Storage bucket + policies (Supabase Storage)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('observation_assets', 'observation_assets', false)
on conflict (id) do nothing;

drop policy if exists "observation_assets_select_ldr" on storage.objects;
create policy "observation_assets_select_ldr"
  on storage.objects for select to authenticated
  using (bucket_id = 'observation_assets' and public.can_access_ldr_tools());

drop policy if exists "observation_assets_insert_admin" on storage.objects;
create policy "observation_assets_insert_admin"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'observation_assets' and public.is_app_admin());

drop policy if exists "observation_assets_update_admin" on storage.objects;
create policy "observation_assets_update_admin"
  on storage.objects for update to authenticated
  using (bucket_id = 'observation_assets' and public.is_app_admin())
  with check (bucket_id = 'observation_assets' and public.is_app_admin());

drop policy if exists "observation_assets_delete_admin" on storage.objects;
create policy "observation_assets_delete_admin"
  on storage.objects for delete to authenticated
  using (bucket_id = 'observation_assets' and public.is_app_admin());
