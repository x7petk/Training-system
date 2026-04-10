-- Health Checks v2: types, templates, questions, records, answers. LDR-scoped RLS.

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------

do $e$
begin
  create type public.hc_rag_status as enum ('green', 'amber', 'red');
exception
  when duplicate_object then null;
end $e$;

grant usage on type public.hc_rag_status to authenticated;

-- ---------------------------------------------------------------------------
-- Config tables (app admin only)
-- ---------------------------------------------------------------------------

create table public.hc_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hc_templates (
  id uuid primary key default gen_random_uuid(),
  hc_type_id uuid not null references public.hc_types (id) on delete restrict,
  name text not null,
  version int not null default 1,
  description text,
  active boolean not null default false,
  threshold_score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index hc_templates_one_active_per_type
  on public.hc_templates (hc_type_id)
  where active;

create table public.hc_template_questions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.hc_templates (id) on delete cascade,
  question_text text not null,
  expected_standard text not null default '',
  sort_order int not null default 0,
  active boolean not null default true,
  is_critical boolean not null default false,
  help_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index hc_template_questions_template_id_idx on public.hc_template_questions (template_id);

-- ---------------------------------------------------------------------------
-- Run tables (LDR users)
-- ---------------------------------------------------------------------------

create table public.hc_records (
  id uuid primary key default gen_random_uuid(),
  hc_type_id uuid not null references public.hc_types (id) on delete restrict,
  template_id uuid not null references public.hc_templates (id) on delete restrict,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hc_records_submit_consistency_ck check (
    (completed_at is null and status is null and score is null and template_version_snapshot is null)
    or
    (completed_at is not null and status is not null and score is not null and template_version_snapshot is not null)
  )
);

create index hc_records_cell_idx on public.hc_records (master_cell_id);
create index hc_records_completed_at_idx on public.hc_records (completed_at desc nulls last);

create table public.hc_answers (
  id uuid primary key default gen_random_uuid(),
  hc_record_id uuid not null references public.hc_records (id) on delete cascade,
  template_question_id uuid not null references public.hc_template_questions (id) on delete restrict,
  question_text_snapshot text,
  expected_standard_snapshot text,
  answer text check (answer is null or answer in ('pass', 'fail')),
  score_value int check (score_value is null or score_value in (0, 1)),
  comment text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hc_answers_one_per_question unique (hc_record_id, template_question_id)
);

create index hc_answers_record_idx on public.hc_answers (hc_record_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.hc_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists hc_types_updated_at on public.hc_types;
create trigger hc_types_updated_at before update on public.hc_types for each row execute function public.hc_touch_updated_at();

drop trigger if exists hc_templates_updated_at on public.hc_templates;
create trigger hc_templates_updated_at before update on public.hc_templates for each row execute function public.hc_touch_updated_at();

drop trigger if exists hc_template_questions_updated_at on public.hc_template_questions;
create trigger hc_template_questions_updated_at before update on public.hc_template_questions for each row execute function public.hc_touch_updated_at();

drop trigger if exists hc_records_updated_at on public.hc_records;
create trigger hc_records_updated_at before update on public.hc_records for each row execute function public.hc_touch_updated_at();

drop trigger if exists hc_answers_updated_at on public.hc_answers;
create trigger hc_answers_updated_at before update on public.hc_answers for each row execute function public.hc_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.hc_types to authenticated;
grant select, insert, update, delete on public.hc_templates to authenticated;
grant select, insert, update, delete on public.hc_template_questions to authenticated;
grant select, insert, update, delete on public.hc_records to authenticated;
grant select, insert, update, delete on public.hc_answers to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.hc_types enable row level security;
alter table public.hc_templates enable row level security;
alter table public.hc_template_questions enable row level security;
alter table public.hc_records enable row level security;
alter table public.hc_answers enable row level security;

-- hc_types: read for LDR; write for app admin
drop policy if exists "hc_types_select_ldr" on public.hc_types;
create policy "hc_types_select_ldr"
  on public.hc_types for select to authenticated
  using (public.can_access_ldr_tools());

drop policy if exists "hc_types_write_admin" on public.hc_types;
create policy "hc_types_write_admin"
  on public.hc_types for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

-- hc_templates: read active + own type names; admins read/write all
drop policy if exists "hc_templates_select_ldr" on public.hc_templates;
create policy "hc_templates_select_ldr"
  on public.hc_templates for select to authenticated
  using (
    public.can_access_ldr_tools()
    and (active or public.is_app_admin())
  );

drop policy if exists "hc_templates_write_admin" on public.hc_templates;
create policy "hc_templates_write_admin"
  on public.hc_templates for insert to authenticated
  with check (public.is_app_admin());

drop policy if exists "hc_templates_update_admin" on public.hc_templates;
create policy "hc_templates_update_admin"
  on public.hc_templates for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "hc_templates_delete_admin" on public.hc_templates;
create policy "hc_templates_delete_admin"
  on public.hc_templates for delete to authenticated
  using (public.is_app_admin());

-- Questions: LDR may read questions for active templates; admins all
drop policy if exists "hc_template_questions_select_ldr" on public.hc_template_questions;
create policy "hc_template_questions_select_ldr"
  on public.hc_template_questions for select to authenticated
  using (
    public.is_app_admin()
    or (
      public.can_access_ldr_tools()
      and exists (
        select 1 from public.hc_templates t
        where t.id = hc_template_questions.template_id and t.active = true
      )
    )
  );

drop policy if exists "hc_template_questions_write_admin" on public.hc_template_questions;
create policy "hc_template_questions_write_admin"
  on public.hc_template_questions for insert to authenticated
  with check (public.is_app_admin());

drop policy if exists "hc_template_questions_update_admin" on public.hc_template_questions;
create policy "hc_template_questions_update_admin"
  on public.hc_template_questions for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "hc_template_questions_delete_admin" on public.hc_template_questions;
create policy "hc_template_questions_delete_admin"
  on public.hc_template_questions for delete to authenticated
  using (public.is_app_admin());

-- Records
drop policy if exists "hc_records_select_ldr" on public.hc_records;
create policy "hc_records_select_ldr"
  on public.hc_records for select to authenticated
  using (public.can_access_ldr_tools());

drop policy if exists "hc_records_insert_ldr" on public.hc_records;
create policy "hc_records_insert_ldr"
  on public.hc_records for insert to authenticated
  with check (
    public.can_access_ldr_tools()
    and completed_by_user_id = auth.uid()
    and completed_at is null
    and status is null
    and score is null
    and template_version_snapshot is null
  );

drop policy if exists "hc_records_update_draft_owner" on public.hc_records;
create policy "hc_records_update_draft_owner"
  on public.hc_records for update to authenticated
  using (
    public.can_access_ldr_tools()
    and completed_by_user_id = auth.uid()
    and completed_at is null
  )
  with check (
    public.can_access_ldr_tools()
    and completed_by_user_id = auth.uid()
    and (
      (completed_at is null and status is null and score is null and template_version_snapshot is null)
      or (
        completed_at is not null
        and status is not null
        and score is not null
        and template_version_snapshot is not null
      )
    )
  );

drop policy if exists "hc_records_delete_draft_owner" on public.hc_records;
create policy "hc_records_delete_draft_owner"
  on public.hc_records for delete to authenticated
  using (
    public.can_access_ldr_tools()
    and completed_by_user_id = auth.uid()
    and completed_at is null
  );

-- Answers
drop policy if exists "hc_answers_select_ldr" on public.hc_answers;
create policy "hc_answers_select_ldr"
  on public.hc_answers for select to authenticated
  using (
    exists (
      select 1 from public.hc_records r
      where r.id = hc_answers.hc_record_id
        and public.can_access_ldr_tools()
    )
  );

drop policy if exists "hc_answers_insert_draft" on public.hc_answers;
create policy "hc_answers_insert_draft"
  on public.hc_answers for insert to authenticated
  with check (
    exists (
      select 1 from public.hc_records r
      where r.id = hc_answers.hc_record_id
        and public.can_access_ldr_tools()
        and r.completed_by_user_id = auth.uid()
        and r.completed_at is null
    )
  );

drop policy if exists "hc_answers_update_draft" on public.hc_answers;
create policy "hc_answers_update_draft"
  on public.hc_answers for update to authenticated
  using (
    exists (
      select 1 from public.hc_records r
      where r.id = hc_answers.hc_record_id
        and r.completed_by_user_id = auth.uid()
        and r.completed_at is null
    )
  )
  with check (
    exists (
      select 1 from public.hc_records r
      where r.id = hc_answers.hc_record_id
        and r.completed_by_user_id = auth.uid()
        and r.completed_at is null
    )
  );

drop policy if exists "hc_answers_delete_draft" on public.hc_answers;
create policy "hc_answers_delete_draft"
  on public.hc_answers for delete to authenticated
  using (
    exists (
      select 1 from public.hc_records r
      where r.id = hc_answers.hc_record_id
        and r.completed_by_user_id = auth.uid()
        and r.completed_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- Seed (idempotent): one type + active template + sample questions
-- ---------------------------------------------------------------------------

insert into public.hc_types (id, name, description, active, sort_order)
values (
  'c2000001-0000-4000-8000-000000000001',
  'Safety',
  'Sample health check type',
  true,
  0
)
on conflict (id) do nothing;

insert into public.hc_templates (id, hc_type_id, name, version, description, active, threshold_score)
values (
  'c2000002-0000-4000-8000-000000000001',
  'c2000001-0000-4000-8000-000000000001',
  'Safety baseline v1',
  1,
  'Starter template',
  true,
  80
)
on conflict (id) do nothing;

insert into public.hc_template_questions (id, template_id, question_text, expected_standard, sort_order, active, is_critical)
values
  (
    'c2000003-0000-4000-8000-000000000001',
    'c2000002-0000-4000-8000-000000000001',
    'PPE available and in use',
    'All team members have required PPE for the task.',
    0,
    true,
    true
  ),
  (
    'c2000003-0000-4000-8000-000000000002',
    'c2000002-0000-4000-8000-000000000001',
    'Guards and interlocks',
    'Machine guards are in place; interlocks tested where applicable.',
    1,
    true,
    false
  ),
  (
    'c2000003-0000-4000-8000-000000000003',
    'c2000002-0000-4000-8000-000000000001',
    'Housekeeping',
    'Walkways clear; no slip/trip hazards in the cell.',
    2,
    true,
    false
  )
on conflict (id) do nothing;
