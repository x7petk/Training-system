-- Which P2P questions (global standard vs cell soft) are shown per Plan 24 roster role for a cell.

create table public.dds_p2p_cell_question_role_assignments (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  roster_role_id uuid not null references public.plan24_roster_roles (id) on delete cascade,
  question_kind text not null check (question_kind in ('standard', 'soft')),
  standard_question_id uuid references public.dds_p2p_standard_questions (id) on delete cascade,
  soft_question_id uuid references public.dds_p2p_cell_soft_point_questions (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint dds_p2p_qr_assign_one_question check (
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

create unique index dds_p2p_qr_assign_std_unique
  on public.dds_p2p_cell_question_role_assignments (master_cell_id, roster_role_id, standard_question_id)
  where (standard_question_id is not null);

create unique index dds_p2p_qr_assign_soft_unique
  on public.dds_p2p_cell_question_role_assignments (master_cell_id, roster_role_id, soft_question_id)
  where (soft_question_id is not null);

create index dds_p2p_qr_assign_cell_idx
  on public.dds_p2p_cell_question_role_assignments (master_cell_id);

create index dds_p2p_qr_assign_role_idx
  on public.dds_p2p_cell_question_role_assignments (roster_role_id);

create or replace function public.dds_p2p_qr_assignments_enforce_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r_cell uuid;
  soft_cell uuid;
begin
  select r.master_cell_id
  into r_cell
  from public.plan24_roster_roles rr
  join public.plan24_rosters r on r.id = rr.roster_id
  where rr.id = new.roster_role_id;

  if r_cell is null then
    raise exception 'dds_p2p_cell_question_role_assignments: invalid roster_role_id';
  end if;

  if r_cell <> new.master_cell_id then
    raise exception 'dds_p2p_cell_question_role_assignments: roster role does not belong to this cell';
  end if;

  if new.question_kind = 'soft' then
    select q.master_cell_id
    into soft_cell
    from public.dds_p2p_cell_soft_point_questions q
    where q.id = new.soft_question_id;

    if soft_cell is distinct from new.master_cell_id then
      raise exception 'dds_p2p_cell_question_role_assignments: soft question does not belong to this cell';
    end if;
  end if;

  return new;
end;
$$;

create trigger dds_p2p_qr_assignments_enforce_scope
  before insert or update on public.dds_p2p_cell_question_role_assignments
  for each row execute function public.dds_p2p_qr_assignments_enforce_scope();

alter table public.dds_p2p_cell_question_role_assignments enable row level security;

create policy "dds_p2p_qr_assignments_select_dds"
  on public.dds_p2p_cell_question_role_assignments for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_p2p_qr_assignments_insert_admin"
  on public.dds_p2p_cell_question_role_assignments for insert to authenticated
  with check (public.is_app_admin());

create policy "dds_p2p_qr_assignments_update_admin"
  on public.dds_p2p_cell_question_role_assignments for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_p2p_qr_assignments_delete_admin"
  on public.dds_p2p_cell_question_role_assignments for delete to authenticated
  using (public.is_app_admin());

grant select, insert, update, delete on public.dds_p2p_cell_question_role_assignments to authenticated;

notify pgrst, 'reload schema';
