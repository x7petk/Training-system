-- LDR: use master data cells (per site) instead of workspace-scoped ldr_locations for people/assignments.

alter table public.ldr_people
  add column if not exists master_cell_id uuid null references public.master_cells (id) on delete set null;

alter table public.ldr_assignments
  add column if not exists master_cell_id uuid null references public.master_cells (id) on delete set null;

create index if not exists ldr_people_master_cell_id_idx on public.ldr_people (master_cell_id);
create index if not exists ldr_assignments_master_cell_id_idx on public.ldr_assignments (master_cell_id);

-- Backfill from legacy ldr_locations when a cell name matches under the workspace's site.
update public.ldr_people p
set master_cell_id = mc.id
from public.ldr_locations loc,
public.ldr_workspaces ws,
public.master_plants mp,
public.master_cells mc
where p.location_id = loc.id
  and p.workspace_id = ws.id
  and p.master_cell_id is null
  and mp.site_id = (
    case
      when ws.scope_kind = 'site' then ws.master_site_id
      else (
        select mp2.site_id
        from public.master_cells c2
        join public.master_plants mp2 on mp2.id = c2.plant_id
        where c2.id = ws.master_cell_id
      )
    end
  )
  and mc.plant_id = mp.id
  and lower(trim(mc.name)) = lower(trim(loc.name));

update public.ldr_assignments a
set master_cell_id = mc.id
from public.ldr_locations loc,
public.ldr_people p,
public.ldr_workspaces ws,
public.master_plants mp,
public.master_cells mc
where a.ldr_location_id = loc.id
  and a.ldr_person_id = p.id
  and p.workspace_id = ws.id
  and a.master_cell_id is null
  and mp.site_id = (
    case
      when ws.scope_kind = 'site' then ws.master_site_id
      else (
        select mp2.site_id
        from public.master_cells c2
        join public.master_plants mp2 on mp2.id = c2.plant_id
        where c2.id = ws.master_cell_id
      )
    end
  )
  and mc.plant_id = mp.id
  and lower(trim(mc.name)) = lower(trim(loc.name));
