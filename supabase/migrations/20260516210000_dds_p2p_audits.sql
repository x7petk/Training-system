-- P2P peer checks: immutable audit rows per submit (answers + comments). One user can have many revisions per cell/date/shift/role.

create table public.dds_p2p_audits (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  plan_date date not null,
  shift_kind text not null,
  roster_role_id uuid not null references public.plan24_roster_roles (id) on delete restrict,
  submitted_by uuid not null references auth.users (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  sheet_comment text
);

create index dds_p2p_audits_cell_date_shift_idx
  on public.dds_p2p_audits (master_cell_id, plan_date, shift_kind);

create index dds_p2p_audits_submitted_by_idx
  on public.dds_p2p_audits (submitted_by, submitted_at desc);

create table public.dds_p2p_audit_answers (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.dds_p2p_audits (id) on delete cascade,
  question_kind text not null check (question_kind in ('standard', 'soft')),
  standard_question_id uuid references public.dds_p2p_standard_questions (id) on delete cascade,
  soft_question_id uuid references public.dds_p2p_cell_soft_point_questions (id) on delete cascade,
  answer_yes_no boolean,
  answer_number numeric,
  question_comment text,
  constraint dds_p2p_audit_ans_one_question check (
    (
      question_kind = 'standard'
      and standard_question_id is not null
      and soft_question_id is null
    )
    or (
      question_kind = 'soft'
      and soft_question_id is not null
      and standard_question_id is null
    )
  )
);

create index dds_p2p_audit_answers_audit_idx on public.dds_p2p_audit_answers (audit_id);

create or replace function public.dds_p2p_audits_enforce_roster_cell()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r_cell uuid;
begin
  select r.master_cell_id
  into r_cell
  from public.plan24_roster_roles rr
  join public.plan24_rosters r on r.id = rr.roster_id
  where rr.id = new.roster_role_id;

  if r_cell is null then
    raise exception 'dds_p2p_audits: invalid roster_role_id';
  end if;

  if r_cell <> new.master_cell_id then
    raise exception 'dds_p2p_audits: roster role does not belong to this cell';
  end if;

  return new;
end;
$$;

create trigger dds_p2p_audits_enforce_roster_cell
  before insert on public.dds_p2p_audits
  for each row execute function public.dds_p2p_audits_enforce_roster_cell();

create or replace function public.dds_p2p_audit_answers_enforce_scope()
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
    raise exception 'dds_p2p_audit_answers: invalid audit_id';
  end if;

  if new.question_kind = 'soft' then
    select q.master_cell_id
    into soft_cell
    from public.dds_p2p_cell_soft_point_questions q
    where q.id = new.soft_question_id;

    if soft_cell is distinct from cell then
      raise exception 'dds_p2p_audit_answers: soft question does not belong to audit cell';
    end if;
  end if;

  return new;
end;
$$;

create trigger dds_p2p_audit_answers_enforce_scope
  before insert on public.dds_p2p_audit_answers
  for each row execute function public.dds_p2p_audit_answers_enforce_scope();

alter table public.dds_p2p_audits enable row level security;
alter table public.dds_p2p_audit_answers enable row level security;

create policy "dds_p2p_audits_select_dds"
  on public.dds_p2p_audits for select to authenticated
  using (
    public.app_user_can_access_dds()
    and (submitted_by = auth.uid() or public.is_app_admin())
  );

create policy "dds_p2p_audits_insert_own"
  on public.dds_p2p_audits for insert to authenticated
  with check (
    public.app_user_can_access_dds()
    and submitted_by = auth.uid()
  );

create policy "dds_p2p_audit_answers_select_dds"
  on public.dds_p2p_audit_answers for select to authenticated
  using (
    exists (
      select 1
      from public.dds_p2p_audits a
      where a.id = audit_id
        and public.app_user_can_access_dds()
        and (a.submitted_by = auth.uid() or public.is_app_admin())
    )
  );

create policy "dds_p2p_audit_answers_insert_own"
  on public.dds_p2p_audit_answers for insert to authenticated
  with check (
    exists (
      select 1
      from public.dds_p2p_audits a
      where a.id = audit_id
        and public.app_user_can_access_dds()
        and a.submitted_by = auth.uid()
    )
  );

grant select, insert on public.dds_p2p_audits to authenticated;
grant select, insert on public.dds_p2p_audit_answers to authenticated;

notify pgrst, 'reload schema';
