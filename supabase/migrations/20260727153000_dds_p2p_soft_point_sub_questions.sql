-- P2P soft-point sub-questions: checklist items under a cell soft-point question.

create table public.dds_p2p_cell_soft_point_sub_questions (
  id uuid primary key default gen_random_uuid(),
  soft_question_id uuid not null references public.dds_p2p_cell_soft_point_questions (id) on delete cascade,
  prompt text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index dds_p2p_cell_soft_point_sub_questions_prompt_lower_idx
  on public.dds_p2p_cell_soft_point_sub_questions (soft_question_id, lower(prompt));

create index dds_p2p_cell_soft_point_sub_questions_soft_question_id_idx
  on public.dds_p2p_cell_soft_point_sub_questions (soft_question_id);

alter table public.dds_p2p_cell_soft_point_sub_questions enable row level security;

create policy "dds_p2p_cell_soft_point_sub_questions_select_dds"
  on public.dds_p2p_cell_soft_point_sub_questions for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_p2p_cell_soft_point_sub_questions_insert_admin"
  on public.dds_p2p_cell_soft_point_sub_questions for insert to authenticated
  with check (public.is_app_admin());

create policy "dds_p2p_cell_soft_point_sub_questions_update_admin"
  on public.dds_p2p_cell_soft_point_sub_questions for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_p2p_cell_soft_point_sub_questions_delete_admin"
  on public.dds_p2p_cell_soft_point_sub_questions for delete to authenticated
  using (public.is_app_admin());

grant select, insert, update, delete on public.dds_p2p_cell_soft_point_sub_questions to authenticated;

-- Answers for sub-questions on each audit revision.

create table public.dds_p2p_audit_sub_answers (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.dds_p2p_audits (id) on delete cascade,
  sub_question_id uuid not null references public.dds_p2p_cell_soft_point_sub_questions (id) on delete cascade,
  answer_yes_no boolean not null,
  question_comment text,
  constraint dds_p2p_audit_sub_answers_unique_per_audit unique (audit_id, sub_question_id)
);

create index dds_p2p_audit_sub_answers_audit_idx on public.dds_p2p_audit_sub_answers (audit_id);

create index dds_p2p_audit_sub_answers_sub_question_id_idx
  on public.dds_p2p_audit_sub_answers (sub_question_id);

create or replace function public.dds_p2p_audit_sub_answers_enforce_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cell uuid;
  soft_cell uuid;
begin
  select a.master_cell_id into cell from public.dds_p2p_audits a where a.id = new.audit_id;

  if cell is null then
    raise exception 'dds_p2p_audit_sub_answers: invalid audit_id';
  end if;

  select q.master_cell_id
  into soft_cell
  from public.dds_p2p_cell_soft_point_sub_questions sq
  join public.dds_p2p_cell_soft_point_questions q on q.id = sq.soft_question_id
  where sq.id = new.sub_question_id;

  if soft_cell is distinct from cell then
    raise exception 'dds_p2p_audit_sub_answers: sub-question does not belong to audit cell';
  end if;

  return new;
end;
$$;

create trigger dds_p2p_audit_sub_answers_enforce_scope
  before insert on public.dds_p2p_audit_sub_answers
  for each row execute function public.dds_p2p_audit_sub_answers_enforce_scope();

alter table public.dds_p2p_audit_sub_answers enable row level security;

create policy "dds_p2p_audit_sub_answers_select_dds"
  on public.dds_p2p_audit_sub_answers for select to authenticated
  using (
    exists (
      select 1
      from public.dds_p2p_audits a
      where a.id = audit_id
        and public.app_user_can_access_dds()
    )
  );

create policy "dds_p2p_audit_sub_answers_insert_own"
  on public.dds_p2p_audit_sub_answers for insert to authenticated
  with check (
    exists (
      select 1
      from public.dds_p2p_audits a
      where a.id = audit_id
        and public.app_user_can_access_dds()
        and a.submitted_by = auth.uid()
    )
  );

grant select, insert on public.dds_p2p_audit_sub_answers to authenticated;

notify pgrst, 'reload schema';
