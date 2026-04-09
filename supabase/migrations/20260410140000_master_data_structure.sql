-- Master data: Site > Plant > Cell > Area > Equipment. Super admin only (RLS).

create table public.master_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.master_plants (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.master_sites (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index master_plants_site_id_idx on public.master_plants (site_id);

create table public.master_cells (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.master_plants (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index master_cells_plant_id_idx on public.master_cells (plant_id);

create table public.master_areas (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.master_cells (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index master_areas_cell_id_idx on public.master_areas (cell_id);

create table public.master_equipment (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.master_areas (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index master_equipment_area_id_idx on public.master_equipment (area_id);

create or replace function public.master_data_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists master_sites_updated_at on public.master_sites;
create trigger master_sites_updated_at before update on public.master_sites for each row execute function public.master_data_touch_updated_at();

drop trigger if exists master_plants_updated_at on public.master_plants;
create trigger master_plants_updated_at before update on public.master_plants for each row execute function public.master_data_touch_updated_at();

drop trigger if exists master_cells_updated_at on public.master_cells;
create trigger master_cells_updated_at before update on public.master_cells for each row execute function public.master_data_touch_updated_at();

drop trigger if exists master_areas_updated_at on public.master_areas;
create trigger master_areas_updated_at before update on public.master_areas for each row execute function public.master_data_touch_updated_at();

drop trigger if exists master_equipment_updated_at on public.master_equipment;
create trigger master_equipment_updated_at before update on public.master_equipment for each row execute function public.master_data_touch_updated_at();

grant select, insert, update, delete on public.master_sites to authenticated;
grant select, insert, update, delete on public.master_plants to authenticated;
grant select, insert, update, delete on public.master_cells to authenticated;
grant select, insert, update, delete on public.master_areas to authenticated;
grant select, insert, update, delete on public.master_equipment to authenticated;

alter table public.master_sites enable row level security;
alter table public.master_plants enable row level security;
alter table public.master_cells enable row level security;
alter table public.master_areas enable row level security;
alter table public.master_equipment enable row level security;

drop policy if exists "master_sites_super_admin" on public.master_sites;
create policy "master_sites_super_admin"
  on public.master_sites for all to authenticated
  using (public.is_app_super_admin()) with check (public.is_app_super_admin());

drop policy if exists "master_plants_super_admin" on public.master_plants;
create policy "master_plants_super_admin"
  on public.master_plants for all to authenticated
  using (public.is_app_super_admin()) with check (public.is_app_super_admin());

drop policy if exists "master_cells_super_admin" on public.master_cells;
create policy "master_cells_super_admin"
  on public.master_cells for all to authenticated
  using (public.is_app_super_admin()) with check (public.is_app_super_admin());

drop policy if exists "master_areas_super_admin" on public.master_areas;
create policy "master_areas_super_admin"
  on public.master_areas for all to authenticated
  using (public.is_app_super_admin()) with check (public.is_app_super_admin());

drop policy if exists "master_equipment_super_admin" on public.master_equipment;
create policy "master_equipment_super_admin"
  on public.master_equipment for all to authenticated
  using (public.is_app_super_admin()) with check (public.is_app_super_admin());

-- Seed (idempotent): Darfield & Clandeboye, Powder/Cheese plants, one cell/area per plant, sample equipment.
insert into public.master_sites (id, name, sort_order)
values
  ('b1000001-0000-4000-8000-000000000001', 'Darfield', 0),
  ('b1000001-0000-4000-8000-000000000002', 'Clandeboye', 1)
on conflict (id) do nothing;

insert into public.master_plants (id, site_id, name, sort_order)
values
  ('b2000001-0000-4000-8000-000000000001', 'b1000001-0000-4000-8000-000000000001', 'Powder', 0),
  ('b2000001-0000-4000-8000-000000000002', 'b1000001-0000-4000-8000-000000000001', 'Cheese', 1),
  ('b2000001-0000-4000-8000-000000000003', 'b1000001-0000-4000-8000-000000000002', 'Powder', 0),
  ('b2000001-0000-4000-8000-000000000004', 'b1000001-0000-4000-8000-000000000002', 'Cheese', 1)
on conflict (id) do nothing;

insert into public.master_cells (id, plant_id, name, sort_order)
values
  ('b3000001-0000-4000-8000-000000000001', 'b2000001-0000-4000-8000-000000000001', 'Powder cell', 0),
  ('b3000001-0000-4000-8000-000000000002', 'b2000001-0000-4000-8000-000000000002', 'Cheese cell', 0),
  ('b3000001-0000-4000-8000-000000000003', 'b2000001-0000-4000-8000-000000000003', 'Powder cell', 0),
  ('b3000001-0000-4000-8000-000000000004', 'b2000001-0000-4000-8000-000000000004', 'Cheese cell', 0)
on conflict (id) do nothing;

insert into public.master_areas (id, cell_id, name, sort_order)
values
  ('b4000001-0000-4000-8000-000000000001', 'b3000001-0000-4000-8000-000000000001', 'Production', 0),
  ('b4000001-0000-4000-8000-000000000002', 'b3000001-0000-4000-8000-000000000002', 'Production', 0),
  ('b4000001-0000-4000-8000-000000000003', 'b3000001-0000-4000-8000-000000000003', 'Production', 0),
  ('b4000001-0000-4000-8000-000000000004', 'b3000001-0000-4000-8000-000000000004', 'Production', 0)
on conflict (id) do nothing;

insert into public.master_equipment (id, area_id, name, sort_order)
values
  ('b5000001-0000-4000-8000-000000000001', 'b4000001-0000-4000-8000-000000000001', 'Dryer line A', 0),
  ('b5000001-0000-4000-8000-000000000002', 'b4000001-0000-4000-8000-000000000001', 'Pack line 1', 1),
  ('b5000001-0000-4000-8000-000000000003', 'b4000001-0000-4000-8000-000000000002', 'Vat hall', 0),
  ('b5000001-0000-4000-8000-000000000004', 'b4000001-0000-4000-8000-000000000003', 'Spray dryer', 0),
  ('b5000001-0000-4000-8000-000000000005', 'b4000001-0000-4000-8000-000000000004', 'Curd mill', 0)
on conflict (id) do nothing;
