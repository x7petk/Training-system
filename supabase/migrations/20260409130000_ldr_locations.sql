-- LDR locations master data + person location link.

create table if not exists public.ldr_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users on delete set null,
  updated_by uuid references auth.users on delete set null
);

alter table public.ldr_people
  add column if not exists location_id uuid references public.ldr_locations on delete set null;

create index if not exists ldr_people_location_id_idx on public.ldr_people (location_id);

grant select, insert, update, delete on public.ldr_locations to authenticated;
alter table public.ldr_locations enable row level security;

drop policy if exists "ldr_locations_select" on public.ldr_locations;
create policy "ldr_locations_select"
  on public.ldr_locations for select to authenticated
  using (public.can_access_ldr_tools());

drop policy if exists "ldr_locations_write_admin" on public.ldr_locations;
create policy "ldr_locations_write_admin"
  on public.ldr_locations for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

drop trigger if exists ldr_locations_touch_audit on public.ldr_locations;
create trigger ldr_locations_touch_audit
  before insert or update on public.ldr_locations
  for each row execute function public.ldr_touch_audit();
