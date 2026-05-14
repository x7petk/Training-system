-- Hub section: DDS Process (own area; Plan 24 workspace on web).

alter table public.profiles
  add column if not exists can_access_dds_process boolean not null default false;

comment on column public.profiles.can_access_dds_process is 'Hub + DDS Process area.';

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
  return new;
end;
$$;

comment on function public.profiles_protect_section_access is 'Locks can_access_* columns unless updater is super_admin.';

-- Super admins only (admins stay unchecked until enabled in Section access).
update public.profiles
set can_access_dds_process = true
where role = 'super_admin';
