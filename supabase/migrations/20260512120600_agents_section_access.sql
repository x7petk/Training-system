-- Add hub section access flag for Agents area.

alter table public.profiles
  add column if not exists can_access_agents boolean not null default false;

comment on column public.profiles.can_access_agents is 'Hub + Agents area.';

-- Keep non-super-admin users from changing section flags.
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
  return new;
end;
$$;

comment on function public.profiles_protect_section_access is 'Locks can_access_* columns unless updater is super_admin.';

-- Existing admins/super-admins keep full section access.
update public.profiles
set can_access_agents = true
where role in ('admin', 'super_admin');
