-- LDR workspaces: scope LDR data to master-data site OR cell. Existing rows → Darfield site workspace.

-- ---------------------------------------------------------------------------
-- Master data: allow LDR users to read sites / plants / cells (for filters only)
-- ---------------------------------------------------------------------------

drop policy if exists "master_sites_super_admin" on public.master_sites;
create policy "master_sites_select_ldr"
  on public.master_sites for select to authenticated
  using (public.is_app_super_admin() or public.can_access_ldr_tools());
create policy "master_sites_write_super"
  on public.master_sites for all to authenticated
  using (public.is_app_super_admin()) with check (public.is_app_super_admin());

drop policy if exists "master_plants_super_admin" on public.master_plants;
create policy "master_plants_select_ldr"
  on public.master_plants for select to authenticated
  using (public.is_app_super_admin() or public.can_access_ldr_tools());
create policy "master_plants_write_super"
  on public.master_plants for all to authenticated
  using (public.is_app_super_admin()) with check (public.is_app_super_admin());

drop policy if exists "master_cells_super_admin" on public.master_cells;
create policy "master_cells_select_ldr"
  on public.master_cells for select to authenticated
  using (public.is_app_super_admin() or public.can_access_ldr_tools());
create policy "master_cells_write_super"
  on public.master_cells for all to authenticated
  using (public.is_app_super_admin()) with check (public.is_app_super_admin());

-- ---------------------------------------------------------------------------
-- Workspaces
-- ---------------------------------------------------------------------------

create table public.ldr_workspaces (
  id uuid primary key default gen_random_uuid(),
  scope_kind text not null check (scope_kind in ('site', 'cell')),
  master_site_id uuid references public.master_sites (id) on delete cascade,
  master_cell_id uuid references public.master_cells (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint ldr_workspaces_scope_site_ck check (
    scope_kind = 'site' and master_site_id is not null and master_cell_id is null
    or scope_kind = 'cell' and master_cell_id is not null
  )
);

create unique index ldr_workspaces_one_per_site on public.ldr_workspaces (master_site_id)
  where scope_kind = 'site';

create unique index ldr_workspaces_one_per_cell on public.ldr_workspaces (master_cell_id)
  where scope_kind = 'cell';

comment on table public.ldr_workspaces is 'LDR tools data scope: one row per master site (site-level roster) or per master cell (cell-level roster).';

-- Default workspace for migrated data (Darfield site–level)
insert into public.ldr_workspaces (id, scope_kind, master_site_id, master_cell_id)
values (
  'e1100001-0000-4000-8000-000000000001',
  'site',
  'b1000001-0000-4000-8000-000000000001',
  null
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Add workspace_id to LDR tables
-- ---------------------------------------------------------------------------

alter table public.ldr_activities add column if not exists workspace_id uuid references public.ldr_workspaces (id) on delete cascade;
alter table public.ldr_locations add column if not exists workspace_id uuid references public.ldr_workspaces (id) on delete cascade;
alter table public.ldr_people add column if not exists workspace_id uuid references public.ldr_workspaces (id) on delete cascade;
alter table public.ldr_events add column if not exists workspace_id uuid references public.ldr_workspaces (id) on delete cascade;
alter table public.ldr_assignments add column if not exists workspace_id uuid references public.ldr_workspaces (id) on delete cascade;

update public.ldr_activities set workspace_id = 'e1100001-0000-4000-8000-000000000001' where workspace_id is null;
update public.ldr_locations set workspace_id = 'e1100001-0000-4000-8000-000000000001' where workspace_id is null;
update public.ldr_people set workspace_id = 'e1100001-0000-4000-8000-000000000001' where workspace_id is null;
update public.ldr_events set workspace_id = 'e1100001-0000-4000-8000-000000000001' where workspace_id is null;
update public.ldr_assignments a
set workspace_id = coalesce(a.workspace_id, act.workspace_id)
from public.ldr_activities act
where a.activity_id = act.id and a.workspace_id is null;

update public.ldr_assignments set workspace_id = 'e1100001-0000-4000-8000-000000000001' where workspace_id is null;

alter table public.ldr_activities alter column workspace_id set not null;
alter table public.ldr_locations alter column workspace_id set not null;
alter table public.ldr_people alter column workspace_id set not null;
alter table public.ldr_events alter column workspace_id set not null;
alter table public.ldr_assignments alter column workspace_id set not null;

create index if not exists ldr_activities_workspace_id_idx on public.ldr_activities (workspace_id);
create index if not exists ldr_locations_workspace_id_idx on public.ldr_locations (workspace_id);
create index if not exists ldr_people_workspace_id_idx on public.ldr_people (workspace_id);
create index if not exists ldr_events_workspace_id_idx on public.ldr_events (workspace_id);
create index if not exists ldr_assignments_workspace_id_idx on public.ldr_assignments (workspace_id);

-- Unique name per workspace (not global)
alter table public.ldr_activities drop constraint if exists ldr_activities_name_unique;
create unique index if not exists ldr_activities_workspace_name_uid on public.ldr_activities (workspace_id, name);

alter table public.ldr_locations drop constraint if exists ldr_locations_name_key;
create unique index if not exists ldr_locations_workspace_name_uid on public.ldr_locations (workspace_id, name);

-- ---------------------------------------------------------------------------
-- Ensure workspace RPCs (security definer; callable by anyone with LDR access)
-- ---------------------------------------------------------------------------

create or replace function public.ldr_ensure_workspace_site(p_master_site_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  w_id uuid;
begin
  if not (select public.can_access_ldr_tools()) then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.master_sites s where s.id = p_master_site_id) then
    raise exception 'invalid site';
  end if;
  select lw.id into w_id
  from public.ldr_workspaces lw
  where lw.scope_kind = 'site' and lw.master_site_id = p_master_site_id and lw.master_cell_id is null;
  if w_id is not null then
    return w_id;
  end if;
  insert into public.ldr_workspaces (scope_kind, master_site_id, master_cell_id)
  values ('site', p_master_site_id, null)
  returning id into w_id;
  return w_id;
exception
  when unique_violation then
    select lw.id into w_id
    from public.ldr_workspaces lw
    where lw.scope_kind = 'site' and lw.master_site_id = p_master_site_id and lw.master_cell_id is null;
    return w_id;
end;
$$;

create or replace function public.ldr_ensure_workspace_cell(p_master_cell_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  w_id uuid;
begin
  if not (select public.can_access_ldr_tools()) then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.master_cells c where c.id = p_master_cell_id) then
    raise exception 'invalid cell';
  end if;
  select lw.id into w_id
  from public.ldr_workspaces lw
  where lw.scope_kind = 'cell' and lw.master_cell_id = p_master_cell_id;
  if w_id is not null then
    return w_id;
  end if;
  insert into public.ldr_workspaces (scope_kind, master_site_id, master_cell_id)
  values ('cell', null, p_master_cell_id)
  returning id into w_id;
  return w_id;
exception
  when unique_violation then
    select lw.id into w_id
    from public.ldr_workspaces lw
    where lw.scope_kind = 'cell' and lw.master_cell_id = p_master_cell_id;
    return w_id;
end;
$$;

grant execute on function public.ldr_ensure_workspace_site(uuid) to authenticated;
grant execute on function public.ldr_ensure_workspace_cell(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Grants + RLS for ldr_workspaces
-- ---------------------------------------------------------------------------

grant select on public.ldr_workspaces to authenticated;
grant insert, update, delete on public.ldr_workspaces to authenticated;

alter table public.ldr_workspaces enable row level security;

drop policy if exists "ldr_workspaces_select" on public.ldr_workspaces;
create policy "ldr_workspaces_select"
  on public.ldr_workspaces for select to authenticated
  using (public.can_access_ldr_tools());

drop policy if exists "ldr_workspaces_write_admin" on public.ldr_workspaces;
create policy "ldr_workspaces_write_admin"
  on public.ldr_workspaces for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());
