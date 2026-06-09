-- Hub section: BMS Brain

alter table public.profiles
  add column if not exists can_access_bms_brain boolean not null default false;

alter table public.profiles
  add column if not exists bms_brain_role text not null default 'viewer';

alter table public.profiles
  drop constraint if exists profiles_bms_brain_role_check;

alter table public.profiles
  add constraint profiles_bms_brain_role_check
  check (bms_brain_role in ('viewer', 'editor', 'admin'));

comment on column public.profiles.can_access_bms_brain is 'Hub + BMS Brain area.';
comment on column public.profiles.bms_brain_role is 'BMS Brain governance: viewer, editor, or admin (platform admin overrides).';

create or replace function public.app_user_can_access_bms_brain()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.can_access_bms_brain from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.bms_brain_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.bms_brain_role from public.profiles p where p.id = auth.uid()),
    'viewer'
  );
$$;

create or replace function public.bms_brain_can_view()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.app_user_can_access_bms_brain()
    and (
      public.is_app_admin()
      or public.bms_brain_user_role() in ('viewer', 'editor', 'admin')
    );
$$;

create or replace function public.bms_brain_can_edit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.app_user_can_access_bms_brain()
    and (
      public.is_app_admin()
      or public.bms_brain_user_role() in ('editor', 'admin')
    );
$$;

create or replace function public.bms_brain_can_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.app_user_can_access_bms_brain()
    and (
      public.is_app_admin()
      or public.bms_brain_user_role() = 'admin'
    );
$$;

create or replace function public.profiles_protect_section_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select public.is_app_super_admin()) then
    return new;
  end if;
  new.can_access_skill_matrix := old.can_access_skill_matrix;
  new.can_access_ldr_tools := old.can_access_ldr_tools;
  new.can_access_rtt_systems := old.can_access_rtt_systems;
  new.can_access_agents := old.can_access_agents;
  new.can_access_dds_process := old.can_access_dds_process;
  new.can_access_problem_solve := old.can_access_problem_solve;
  new.can_access_bms_brain := old.can_access_bms_brain;
  new.bms_brain_role := old.bms_brain_role;
  return new;
end;
$$;

update public.profiles
set can_access_bms_brain = true,
    bms_brain_role = 'admin'
where role in ('super_admin', 'admin');

notify pgrst, 'reload schema';
