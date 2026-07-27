-- Per-role visibility of soft-point sub-questions (parent soft Q stays shared; checklist items can differ by role).

create table public.dds_p2p_cell_soft_sub_question_role_assignments (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  roster_role_id uuid not null references public.plan24_roster_roles (id) on delete cascade,
  soft_question_id uuid not null
    references public.dds_p2p_cell_soft_point_questions (id) on delete cascade,
  sub_question_id uuid not null
    references public.dds_p2p_cell_soft_point_sub_questions (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index dds_p2p_soft_sub_qr_assign_unique
  on public.dds_p2p_cell_soft_sub_question_role_assignments
  (master_cell_id, roster_role_id, sub_question_id);

create index dds_p2p_soft_sub_qr_assign_cell_idx
  on public.dds_p2p_cell_soft_sub_question_role_assignments (master_cell_id);

create index dds_p2p_soft_sub_qr_assign_role_idx
  on public.dds_p2p_cell_soft_sub_question_role_assignments (roster_role_id);

create index dds_p2p_soft_sub_qr_assign_soft_idx
  on public.dds_p2p_cell_soft_sub_question_role_assignments (soft_question_id);

create or replace function public.dds_p2p_soft_sub_qr_assignments_enforce_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r_cell uuid;
  soft_cell uuid;
  parent_of_sub uuid;
  parent_assigned boolean;
begin
  select r.master_cell_id
  into r_cell
  from public.plan24_roster_roles rr
  join public.plan24_rosters r on r.id = rr.roster_id
  where rr.id = new.roster_role_id;

  if r_cell is null then
    raise exception 'dds_p2p_cell_soft_sub_question_role_assignments: invalid roster_role_id';
  end if;

  if r_cell <> new.master_cell_id then
    raise exception 'dds_p2p_cell_soft_sub_question_role_assignments: roster role does not belong to this cell';
  end if;

  select q.master_cell_id
  into soft_cell
  from public.dds_p2p_cell_soft_point_questions q
  where q.id = new.soft_question_id;

  if soft_cell is distinct from new.master_cell_id then
    raise exception 'dds_p2p_cell_soft_sub_question_role_assignments: soft question does not belong to this cell';
  end if;

  select sq.soft_question_id
  into parent_of_sub
  from public.dds_p2p_cell_soft_point_sub_questions sq
  where sq.id = new.sub_question_id;

  if parent_of_sub is distinct from new.soft_question_id then
    raise exception 'dds_p2p_cell_soft_sub_question_role_assignments: sub-question does not belong to soft question';
  end if;

  select exists (
    select 1
    from public.dds_p2p_cell_question_role_assignments a
    where a.master_cell_id = new.master_cell_id
      and a.roster_role_id = new.roster_role_id
      and a.question_kind = 'soft'
      and a.soft_question_id = new.soft_question_id
  )
  into parent_assigned;

  if not parent_assigned then
    raise exception 'dds_p2p_cell_soft_sub_question_role_assignments: soft question must be assigned to the role first';
  end if;

  return new;
end;
$$;

create trigger dds_p2p_soft_sub_qr_assignments_enforce_scope
  before insert or update on public.dds_p2p_cell_soft_sub_question_role_assignments
  for each row execute function public.dds_p2p_soft_sub_qr_assignments_enforce_scope();

alter table public.dds_p2p_cell_soft_sub_question_role_assignments enable row level security;

create policy "dds_p2p_soft_sub_qr_assignments_select_dds"
  on public.dds_p2p_cell_soft_sub_question_role_assignments for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_p2p_soft_sub_qr_assignments_insert_admin"
  on public.dds_p2p_cell_soft_sub_question_role_assignments for insert to authenticated
  with check (public.is_app_admin());

create policy "dds_p2p_soft_sub_qr_assignments_update_admin"
  on public.dds_p2p_cell_soft_sub_question_role_assignments for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_p2p_soft_sub_qr_assignments_delete_admin"
  on public.dds_p2p_cell_soft_sub_question_role_assignments for delete to authenticated
  using (public.is_app_admin());

grant select, insert, update, delete on public.dds_p2p_cell_soft_sub_question_role_assignments to authenticated;

-- Backfill: every role that already has a soft parent gets all of that parent's sub-questions.
insert into public.dds_p2p_cell_soft_sub_question_role_assignments (
  master_cell_id,
  roster_role_id,
  soft_question_id,
  sub_question_id
)
select
  a.master_cell_id,
  a.roster_role_id,
  a.soft_question_id,
  sq.id
from public.dds_p2p_cell_question_role_assignments a
join public.dds_p2p_cell_soft_point_sub_questions sq
  on sq.soft_question_id = a.soft_question_id
where a.question_kind = 'soft'
  and a.soft_question_id is not null
on conflict do nothing;

notify pgrst, 'reload schema';
