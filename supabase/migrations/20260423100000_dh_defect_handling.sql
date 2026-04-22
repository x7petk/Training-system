-- Defect Handling (DH): defect types (super_admin catalogue) + defects per cell (RTT users).

create table public.dh_defect_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dh_defect_types_slug_unique unique (slug)
);

create index dh_defect_types_active_sort_idx on public.dh_defect_types (is_active, sort_order, label);

insert into public.dh_defect_types (slug, label, sort_order) values
  ('safety', 'Safety', 0),
  ('quality', 'Quality', 1),
  ('base_condition', 'Base Condition', 2),
  ('source_of_contamination', 'Source of Contamination', 3),
  ('hard_to_reach', 'Hard to Reach', 4),
  ('minor', 'Minor', 5),
  ('unnecessary_items', 'Unnecessary items', 6);

create trigger dh_defect_types_touch_updated_at
  before update on public.dh_defect_types
  for each row execute function public.master_data_touch_updated_at();

create table public.dh_defects (
  id uuid primary key default gen_random_uuid(),
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  defect_type_id uuid not null references public.dh_defect_types (id) on delete restrict,
  title text not null,
  description text,
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

create index dh_defects_cell_idx on public.dh_defects (master_cell_id, created_at desc)
  where deleted_at is null;

create trigger dh_defects_touch_updated_at
  before update on public.dh_defects
  for each row execute function public.master_data_touch_updated_at();

grant select, insert, update, delete on public.dh_defect_types to authenticated;
grant select, insert, update, delete on public.dh_defects to authenticated;

alter table public.dh_defect_types enable row level security;
alter table public.dh_defects enable row level security;

-- Types: RTT users read active types only; super_admin reads all rows (inactive for DH types UI).
create policy "dh_defect_types_select_rtt"
  on public.dh_defect_types for select to authenticated
  using (
    public.is_app_super_admin()
    or (public.app_user_can_access_rtt() and is_active = true)
  );

create policy "dh_defect_types_insert_super"
  on public.dh_defect_types for insert to authenticated
  with check (public.is_app_super_admin());

create policy "dh_defect_types_update_super"
  on public.dh_defect_types for update to authenticated
  using (public.is_app_super_admin()) with check (public.is_app_super_admin());

create policy "dh_defect_types_delete_super"
  on public.dh_defect_types for delete to authenticated
  using (public.is_app_super_admin());

-- Defects: same RTT gate as Plan 24 events.
create policy "dh_defects_select_rtt"
  on public.dh_defects for select to authenticated
  using (public.app_user_can_access_rtt());

create policy "dh_defects_insert_rtt"
  on public.dh_defects for insert to authenticated
  with check (public.app_user_can_access_rtt());

create policy "dh_defects_update_rtt"
  on public.dh_defects for update to authenticated
  using (public.app_user_can_access_rtt()) with check (public.app_user_can_access_rtt());

create policy "dh_defects_delete_rtt"
  on public.dh_defects for delete to authenticated
  using (public.app_user_can_access_rtt());

comment on table public.dh_defect_types is 'Defect Handling type catalogue; CRUD restricted to super_admin.';
comment on table public.dh_defects is 'Defect Handling records per master cell; RTT users with section access.';
