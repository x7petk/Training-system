-- Safety & Quality triggers: admin questions + per cell/date/shift submissions.

create type public.dds_trigger_domain as enum ('safety', 'quality');

create type public.dds_trigger_point_kind as enum ('hard_point', 'soft_point');

create type public.dds_trigger_risk_points as enum ('3', '6', '9');

create table public.dds_trigger_questions (
  id uuid primary key default gen_random_uuid(),
  domain public.dds_trigger_domain not null,
  point_kind public.dds_trigger_point_kind not null,
  risk_points public.dds_trigger_risk_points not null,
  prompt text not null,
  sort_order integer not null default 0,
  /** null = hard point (all cells); set = soft point for one cell only */
  master_cell_id uuid references public.master_cells (id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dds_trigger_questions_hard_no_cell check (
    (point_kind = 'hard_point'::public.dds_trigger_point_kind and master_cell_id is null)
    or (point_kind = 'soft_point'::public.dds_trigger_point_kind and master_cell_id is not null)
  )
);

create unique index dds_trigger_questions_hard_prompt_idx
  on public.dds_trigger_questions (domain, lower(prompt))
  where point_kind = 'hard_point'::public.dds_trigger_point_kind;

create unique index dds_trigger_questions_soft_prompt_idx
  on public.dds_trigger_questions (master_cell_id, domain, lower(prompt))
  where point_kind = 'soft_point'::public.dds_trigger_point_kind;

create index dds_trigger_questions_domain_idx on public.dds_trigger_questions (domain, sort_order);

create table public.dds_trigger_submissions (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  plan_date date not null,
  shift_kind text not null,
  domain public.dds_trigger_domain not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (master_cell_id, plan_date, shift_kind, domain)
);

create index dds_trigger_submissions_cell_date_idx
  on public.dds_trigger_submissions (master_cell_id, plan_date, shift_kind);

create table public.dds_trigger_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.dds_trigger_submissions (id) on delete cascade,
  question_id uuid not null references public.dds_trigger_questions (id) on delete restrict,
  answer_yes_no boolean,
  comment text,
  unique (submission_id, question_id)
);

create index dds_trigger_answers_submission_idx on public.dds_trigger_answers (submission_id);

create or replace function public.dds_trigger_questions_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger dds_trigger_questions_touch_updated_at
  before update on public.dds_trigger_questions
  for each row execute function public.dds_trigger_questions_touch_updated_at();

create or replace function public.dds_trigger_answers_enforce_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sub_cell uuid;
  q_cell uuid;
  q_domain public.dds_trigger_domain;
begin
  select s.master_cell_id, s.domain
  into sub_cell, q_domain
  from public.dds_trigger_submissions s
  where s.id = new.submission_id;

  select q.master_cell_id, q.domain
  into q_cell, q_domain
  from public.dds_trigger_questions q
  where q.id = new.question_id;

  if sub_cell is null then
    raise exception 'dds_trigger_answers: invalid submission_id';
  end if;

  if q_cell is not null and q_cell <> sub_cell then
    raise exception 'dds_trigger_answers: soft question does not belong to submission cell';
  end if;

  return new;
end;
$$;

create trigger dds_trigger_answers_enforce_scope
  before insert or update on public.dds_trigger_answers
  for each row execute function public.dds_trigger_answers_enforce_scope();

alter table public.dds_trigger_questions enable row level security;
alter table public.dds_trigger_submissions enable row level security;
alter table public.dds_trigger_answers enable row level security;

create policy "dds_trigger_questions_select_dds"
  on public.dds_trigger_questions for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_trigger_questions_mutate_admin"
  on public.dds_trigger_questions for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_trigger_submissions_select_dds"
  on public.dds_trigger_submissions for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_trigger_submissions_mutate_dds"
  on public.dds_trigger_submissions for insert to authenticated
  with check (public.app_user_can_access_dds());

create policy "dds_trigger_submissions_update_dds"
  on public.dds_trigger_submissions for update to authenticated
  using (public.app_user_can_access_dds()) with check (public.app_user_can_access_dds());

create policy "dds_trigger_answers_select_dds"
  on public.dds_trigger_answers for select to authenticated
  using (
    exists (
      select 1 from public.dds_trigger_submissions s
      where s.id = submission_id and public.app_user_can_access_dds()
    )
  );

create policy "dds_trigger_answers_mutate_dds"
  on public.dds_trigger_answers for all to authenticated
  using (
    exists (
      select 1 from public.dds_trigger_submissions s
      where s.id = submission_id and public.app_user_can_access_dds()
    )
  )
  with check (
    exists (
      select 1 from public.dds_trigger_submissions s
      where s.id = submission_id and public.app_user_can_access_dds()
    )
  );

grant select, insert, update, delete on public.dds_trigger_questions to authenticated;
grant select, insert, update, delete on public.dds_trigger_submissions to authenticated;
grant select, insert, update, delete on public.dds_trigger_answers to authenticated;

notify pgrst, 'reload schema';
