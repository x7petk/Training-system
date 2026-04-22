-- Deviations + Quality Fails: type catalogues (super_admin) and records per cell (RTT users).

create table if not exists public.deviation_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deviation_types_slug_unique unique (slug)
);

create index if not exists deviation_types_active_sort_idx on public.deviation_types (is_active, sort_order, label);

insert into public.deviation_types (slug, label, sort_order)
values
  ('process_deviation', 'Process Deviation', 0),
  ('documentation_deviation', 'Documentation Deviation', 1),
  ('parameter_out_of_range', 'Parameter Out of Range', 2),
  ('procedure_not_followed', 'Procedure Not Followed', 3),
  ('missing_verification', 'Missing Verification', 4),
  ('other', 'Other', 5)
on conflict (slug) do nothing;

drop trigger if exists deviation_types_touch_updated_at on public.deviation_types;
create trigger deviation_types_touch_updated_at
  before update on public.deviation_types
  for each row execute function public.master_data_touch_updated_at();

create table if not exists public.deviations (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  defect_type_id uuid not null references public.deviation_types (id) on delete restrict,
  title text not null,
  description text,
  area text,
  equipment text,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),
  location_summary text,
  owner_person_id uuid references public.people (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deviations_cell_idx on public.deviations (master_cell_id, created_at desc)
  where deleted_at is null;
create index if not exists deviations_area_idx on public.deviations (area);
create index if not exists deviations_equipment_idx on public.deviations (equipment);

drop trigger if exists deviations_touch_updated_at on public.deviations;
create trigger deviations_touch_updated_at
  before update on public.deviations
  for each row execute function public.master_data_touch_updated_at();

create table if not exists public.quality_fail_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quality_fail_types_slug_unique unique (slug)
);

create index if not exists quality_fail_types_active_sort_idx on public.quality_fail_types (is_active, sort_order, label);

insert into public.quality_fail_types (slug, label, sort_order)
values
  ('labeling_error', 'Labeling Error', 0),
  ('seal_integrity', 'Seal Integrity', 1),
  ('foreign_material', 'Foreign Material', 2),
  ('weight_volume', 'Weight / Volume', 3),
  ('visual_defect', 'Visual Defect', 4),
  ('other', 'Other', 5)
on conflict (slug) do nothing;

drop trigger if exists quality_fail_types_touch_updated_at on public.quality_fail_types;
create trigger quality_fail_types_touch_updated_at
  before update on public.quality_fail_types
  for each row execute function public.master_data_touch_updated_at();

create table if not exists public.quality_fails (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  defect_type_id uuid not null references public.quality_fail_types (id) on delete restrict,
  title text not null,
  description text,
  area text,
  equipment text,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),
  location_summary text,
  owner_person_id uuid references public.people (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quality_fails_cell_idx on public.quality_fails (master_cell_id, created_at desc)
  where deleted_at is null;
create index if not exists quality_fails_area_idx on public.quality_fails (area);
create index if not exists quality_fails_equipment_idx on public.quality_fails (equipment);

drop trigger if exists quality_fails_touch_updated_at on public.quality_fails;
create trigger quality_fails_touch_updated_at
  before update on public.quality_fails
  for each row execute function public.master_data_touch_updated_at();

grant select, insert, update, delete on public.deviation_types to authenticated;
grant select, insert, update, delete on public.deviations to authenticated;
grant select, insert, update, delete on public.quality_fail_types to authenticated;
grant select, insert, update, delete on public.quality_fails to authenticated;

alter table public.deviation_types enable row level security;
alter table public.deviations enable row level security;
alter table public.quality_fail_types enable row level security;
alter table public.quality_fails enable row level security;

drop policy if exists "deviation_types_select_rtt" on public.deviation_types;
create policy "deviation_types_select_rtt"
  on public.deviation_types for select to authenticated
  using (
    public.is_app_super_admin()
    or (public.app_user_can_access_rtt() and is_active = true)
  );

drop policy if exists "deviation_types_insert_super" on public.deviation_types;
create policy "deviation_types_insert_super"
  on public.deviation_types for insert to authenticated
  with check (public.is_app_super_admin());

drop policy if exists "deviation_types_update_super" on public.deviation_types;
create policy "deviation_types_update_super"
  on public.deviation_types for update to authenticated
  using (public.is_app_super_admin()) with check (public.is_app_super_admin());

drop policy if exists "deviation_types_delete_super" on public.deviation_types;
create policy "deviation_types_delete_super"
  on public.deviation_types for delete to authenticated
  using (public.is_app_super_admin());

drop policy if exists "deviations_select_rtt" on public.deviations;
create policy "deviations_select_rtt"
  on public.deviations for select to authenticated
  using (public.app_user_can_access_rtt());

drop policy if exists "deviations_insert_rtt" on public.deviations;
create policy "deviations_insert_rtt"
  on public.deviations for insert to authenticated
  with check (public.app_user_can_access_rtt());

drop policy if exists "deviations_update_rtt" on public.deviations;
create policy "deviations_update_rtt"
  on public.deviations for update to authenticated
  using (public.app_user_can_access_rtt()) with check (public.app_user_can_access_rtt());

drop policy if exists "deviations_delete_rtt" on public.deviations;
create policy "deviations_delete_rtt"
  on public.deviations for delete to authenticated
  using (public.app_user_can_access_rtt());

drop policy if exists "quality_fail_types_select_rtt" on public.quality_fail_types;
create policy "quality_fail_types_select_rtt"
  on public.quality_fail_types for select to authenticated
  using (
    public.is_app_super_admin()
    or (public.app_user_can_access_rtt() and is_active = true)
  );

drop policy if exists "quality_fail_types_insert_super" on public.quality_fail_types;
create policy "quality_fail_types_insert_super"
  on public.quality_fail_types for insert to authenticated
  with check (public.is_app_super_admin());

drop policy if exists "quality_fail_types_update_super" on public.quality_fail_types;
create policy "quality_fail_types_update_super"
  on public.quality_fail_types for update to authenticated
  using (public.is_app_super_admin()) with check (public.is_app_super_admin());

drop policy if exists "quality_fail_types_delete_super" on public.quality_fail_types;
create policy "quality_fail_types_delete_super"
  on public.quality_fail_types for delete to authenticated
  using (public.is_app_super_admin());

drop policy if exists "quality_fails_select_rtt" on public.quality_fails;
create policy "quality_fails_select_rtt"
  on public.quality_fails for select to authenticated
  using (public.app_user_can_access_rtt());

drop policy if exists "quality_fails_insert_rtt" on public.quality_fails;
create policy "quality_fails_insert_rtt"
  on public.quality_fails for insert to authenticated
  with check (public.app_user_can_access_rtt());

drop policy if exists "quality_fails_update_rtt" on public.quality_fails;
create policy "quality_fails_update_rtt"
  on public.quality_fails for update to authenticated
  using (public.app_user_can_access_rtt()) with check (public.app_user_can_access_rtt());

drop policy if exists "quality_fails_delete_rtt" on public.quality_fails;
create policy "quality_fails_delete_rtt"
  on public.quality_fails for delete to authenticated
  using (public.app_user_can_access_rtt());
