-- Section visibility (hub) + super_admin role. New users: all section flags false until granted.

alter table public.profiles
  add column if not exists can_access_skill_matrix boolean not null default false,
  add column if not exists can_access_ldr_tools boolean not null default false,
  add column if not exists can_access_rtt_systems boolean not null default false;

comment on column public.profiles.can_access_skill_matrix is 'Hub + Skill Matrix app shell (matrix, dashboard, report, my-skills, admin catalog).';
comment on column public.profiles.can_access_ldr_tools is 'Hub + LDR tools area.';
comment on column public.profiles.can_access_rtt_systems is 'Hub + RTT systems area.';

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('super_admin', 'admin', 'assessor', 'operator'));

-- Admins (and super_admin) retain full app RLS via is_app_admin.
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_app_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

grant execute on function public.is_app_super_admin() to authenticated;

-- Only super_admin may change section flags; others' updates keep previous values.
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
  return new;
end;
$$;

drop trigger if exists profiles_protect_section_access_trg on public.profiles;
create trigger profiles_protect_section_access_trg
  before update on public.profiles
  for each row
  execute function public.profiles_protect_section_access();

comment on function public.profiles_protect_section_access is 'Locks can_access_* columns unless updater is super_admin.';

-- Only super_admin can assign super_admin role.
create or replace function public.profiles_prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.role is distinct from old.role then
    if not (select public.is_app_admin()) then
      new.role := old.role;
    elsif new.role = 'super_admin' and not (select public.is_app_super_admin()) then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

-- Existing admins: full section access (current behaviour).
update public.profiles
set
  can_access_skill_matrix = true,
  can_access_ldr_tools = true,
  can_access_rtt_systems = true
where role = 'admin';

-- Assessors / operators: keep Skill Matrix (as before); LDR/RTT stay off until granted.
update public.profiles
set can_access_skill_matrix = true
where role in ('assessor', 'operator');

-- Bootstrap super admin (by auth user id).
update public.profiles
set
  role = 'super_admin',
  can_access_skill_matrix = true,
  can_access_ldr_tools = true,
  can_access_rtt_systems = true
where id = 'e1253b96-1e8f-4ce9-8b69-62a1d8790f5c';

-- Fallback if profile id differs but email matches (run once).
update public.profiles p
set
  role = 'super_admin',
  can_access_skill_matrix = true,
  can_access_ldr_tools = true,
  can_access_rtt_systems = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('x7petk@gmail.com')
  and p.id <> 'e1253b96-1e8f-4ce9-8b69-62a1d8790f5c';
