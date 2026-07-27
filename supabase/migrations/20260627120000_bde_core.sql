-- BDE (Breakdown Elimination) — Problem Solve module.
-- Records, AODC codes, actions, photos, team members.

-- ---------------------------------------------------------------------------
-- Access helper
-- ---------------------------------------------------------------------------

create or replace function public.app_user_can_access_problem_solve()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.role in ('admin', 'super_admin') or p.can_access_problem_solve
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

grant execute on function public.app_user_can_access_problem_solve() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin-managed catalogues
-- ---------------------------------------------------------------------------

create table public.bde_problem_types (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bde_problem_types_active_sort_idx
  on public.bde_problem_types (is_active, sort_order, label);

create table public.bde_activity_codes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bde_object_part_codes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bde_damage_codes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bde_cause_codes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bde_activity_codes_active_sort_idx on public.bde_activity_codes (is_active, sort_order, label);
create index bde_object_part_codes_active_sort_idx on public.bde_object_part_codes (is_active, sort_order, label);
create index bde_damage_codes_active_sort_idx on public.bde_damage_codes (is_active, sort_order, label);
create index bde_cause_codes_active_sort_idx on public.bde_cause_codes (is_active, sort_order, label);

create trigger bde_problem_types_touch before update on public.bde_problem_types
  for each row execute function public.master_data_touch_updated_at();
create trigger bde_activity_codes_touch before update on public.bde_activity_codes
  for each row execute function public.master_data_touch_updated_at();
create trigger bde_object_part_codes_touch before update on public.bde_object_part_codes
  for each row execute function public.master_data_touch_updated_at();
create trigger bde_damage_codes_touch before update on public.bde_damage_codes
  for each row execute function public.master_data_touch_updated_at();
create trigger bde_cause_codes_touch before update on public.bde_cause_codes
  for each row execute function public.master_data_touch_updated_at();

insert into public.bde_problem_types (label, sort_order) values
  ('Mechanical', 0),
  ('Electrical', 1),
  ('Process Failure', 2);

insert into public.bde_activity_codes (label, sort_order) values
  ('Adjusted', 0), ('Cleaned', 1), ('Repaired', 2), ('Replaced', 3);

insert into public.bde_object_part_codes (label, sort_order) values
  ('Frame', 0), ('Pump', 1), ('Switch', 2), ('Valve', 3);

insert into public.bde_damage_codes (label, sort_order) values
  ('Crack detected', 0), ('Displacement', 1), ('Leakage', 2), ('Misalignment', 3), ('Wiring damage', 4);

insert into public.bde_cause_codes (label, sort_order) values
  ('Incorrect setup', 0), ('Material defect', 1), ('Misalignment', 2), ('Overload', 3), ('Overuse', 4);

-- ---------------------------------------------------------------------------
-- Display ID sequences
-- ---------------------------------------------------------------------------

create sequence if not exists public.bde_record_display_seq start 1000;
create sequence if not exists public.bde_action_display_seq start 1000;

-- ---------------------------------------------------------------------------
-- BDE records
-- ---------------------------------------------------------------------------

create table public.bde_records (
  id uuid primary key default gen_random_uuid(),
  display_id text not null,
  master_cell_id uuid not null references public.master_cells (id) on delete restrict,
  area_id uuid references public.master_areas (id) on delete set null,
  equipment_id uuid references public.master_equipment (id) on delete set null,
  problem_type_id uuid references public.bde_problem_types (id) on delete set null,
  status text not null default 'saved'
    check (status in ('saved', 'completed')),
  title text not null,
  problem_statement text,
  functional_location text,
  component_part text,
  what_was_checked text,
  notification_number text,
  work_order_number text,
  what_happened text,
  what_were_the_results text,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_by_name text,
  updated_by_name text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bde_records_display_id_unique unique (display_id),
  constraint bde_records_title_nonempty check (length(trim(title)) > 0)
);

create index bde_records_cell_idx
  on public.bde_records (master_cell_id, created_at desc)
  where deleted_at is null;

create index bde_records_status_idx
  on public.bde_records (master_cell_id, status)
  where deleted_at is null;

create trigger bde_records_touch before update on public.bde_records
  for each row execute function public.master_data_touch_updated_at();

create or replace function public.bde_records_assign_display_id()
returns trigger
language plpgsql
as $$
begin
  if new.display_id is null or trim(new.display_id) = '' then
    new.display_id := 'BDE-' || lpad(nextval('public.bde_record_display_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger bde_records_assign_display_id
  before insert on public.bde_records
  for each row execute function public.bde_records_assign_display_id();

-- ---------------------------------------------------------------------------
-- Multi-select AODC codes on a record
-- ---------------------------------------------------------------------------

create table public.bde_record_codes (
  id uuid primary key default gen_random_uuid(),
  bde_id uuid not null references public.bde_records (id) on delete cascade,
  code_kind text not null check (code_kind in ('activity', 'object_part', 'damage', 'cause')),
  code_id uuid not null,
  created_at timestamptz not null default now(),
  constraint bde_record_codes_unique unique (bde_id, code_kind, code_id)
);

create index bde_record_codes_bde_idx on public.bde_record_codes (bde_id, code_kind);

-- ---------------------------------------------------------------------------
-- Team members (people directory)
-- ---------------------------------------------------------------------------

create table public.bde_record_team_members (
  id uuid primary key default gen_random_uuid(),
  bde_id uuid not null references public.bde_records (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint bde_record_team_members_unique unique (bde_id, person_id)
);

create index bde_record_team_members_bde_idx on public.bde_record_team_members (bde_id);

-- ---------------------------------------------------------------------------
-- Photos (up to 8 enforced in app; storage path stored)
-- ---------------------------------------------------------------------------

create table public.bde_record_photos (
  id uuid primary key default gen_random_uuid(),
  bde_id uuid not null references public.bde_records (id) on delete cascade,
  storage_path text not null,
  file_name text,
  sort_order int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index bde_record_photos_bde_idx on public.bde_record_photos (bde_id, sort_order);

-- ---------------------------------------------------------------------------
-- BDE actions (separate from DDS)
-- ---------------------------------------------------------------------------

create table public.bde_actions (
  id uuid primary key default gen_random_uuid(),
  display_id text not null,
  bde_id uuid not null references public.bde_records (id) on delete cascade,
  title text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'completed')),
  due_date date,
  owner_person_id uuid references public.people (id) on delete set null,
  system_text text,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bde_actions_display_id_unique unique (display_id),
  constraint bde_actions_title_nonempty check (length(trim(title)) > 0)
);

create index bde_actions_bde_idx
  on public.bde_actions (bde_id, created_at desc)
  where deleted_at is null;

create trigger bde_actions_touch before update on public.bde_actions
  for each row execute function public.master_data_touch_updated_at();

create or replace function public.bde_actions_assign_display_id()
returns trigger
language plpgsql
as $$
begin
  if new.display_id is null or trim(new.display_id) = '' then
    new.display_id := 'PSACT-' || lpad(nextval('public.bde_action_display_seq')::text, 9, '0');
  end if;
  return new;
end;
$$;

create trigger bde_actions_assign_display_id
  before insert on public.bde_actions
  for each row execute function public.bde_actions_assign_display_id();

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.bde_problem_types to authenticated;
grant select, insert, update, delete on public.bde_activity_codes to authenticated;
grant select, insert, update, delete on public.bde_object_part_codes to authenticated;
grant select, insert, update, delete on public.bde_damage_codes to authenticated;
grant select, insert, update, delete on public.bde_cause_codes to authenticated;
grant select, insert, update, delete on public.bde_records to authenticated;
grant select, insert, update, delete on public.bde_record_codes to authenticated;
grant select, insert, update, delete on public.bde_record_team_members to authenticated;
grant select, insert, update, delete on public.bde_record_photos to authenticated;
grant select, insert, update, delete on public.bde_actions to authenticated;
grant usage, select on sequence public.bde_record_display_seq to authenticated;
grant usage, select on sequence public.bde_action_display_seq to authenticated;

alter table public.bde_problem_types enable row level security;
alter table public.bde_activity_codes enable row level security;
alter table public.bde_object_part_codes enable row level security;
alter table public.bde_damage_codes enable row level security;
alter table public.bde_cause_codes enable row level security;
alter table public.bde_records enable row level security;
alter table public.bde_record_codes enable row level security;
alter table public.bde_record_team_members enable row level security;
alter table public.bde_record_photos enable row level security;
alter table public.bde_actions enable row level security;

-- Catalogues: PS users read active; admins manage all
do $$
declare
  t text;
begin
  foreach t in array array[
    'bde_problem_types',
    'bde_activity_codes',
    'bde_object_part_codes',
    'bde_damage_codes',
    'bde_cause_codes'
  ]
  loop
    execute format(
      'create policy "%s_select_ps" on public.%I for select to authenticated
       using (public.app_user_can_access_problem_solve() and (is_active = true or public.is_app_admin()))',
      t, t
    );
    execute format(
      'create policy "%s_admin_all" on public.%I for all to authenticated
       using (public.is_app_admin()) with check (public.is_app_admin())',
      t, t
    );
  end loop;
end $$;

create policy "bde_records_select_ps"
  on public.bde_records for select to authenticated
  using (public.app_user_can_access_problem_solve());

create policy "bde_records_insert_ps"
  on public.bde_records for insert to authenticated
  with check (public.app_user_can_access_problem_solve());

create policy "bde_records_update_ps"
  on public.bde_records for update to authenticated
  using (public.app_user_can_access_problem_solve())
  with check (public.app_user_can_access_problem_solve());

create policy "bde_records_delete_ps"
  on public.bde_records for delete to authenticated
  using (public.app_user_can_access_problem_solve());

create policy "bde_record_codes_all_ps"
  on public.bde_record_codes for all to authenticated
  using (public.app_user_can_access_problem_solve())
  with check (public.app_user_can_access_problem_solve());

create policy "bde_record_team_members_all_ps"
  on public.bde_record_team_members for all to authenticated
  using (public.app_user_can_access_problem_solve())
  with check (public.app_user_can_access_problem_solve());

create policy "bde_record_photos_all_ps"
  on public.bde_record_photos for all to authenticated
  using (public.app_user_can_access_problem_solve())
  with check (public.app_user_can_access_problem_solve());

create policy "bde_actions_select_ps"
  on public.bde_actions for select to authenticated
  using (public.app_user_can_access_problem_solve());

create policy "bde_actions_insert_ps"
  on public.bde_actions for insert to authenticated
  with check (public.app_user_can_access_problem_solve());

create policy "bde_actions_update_ps"
  on public.bde_actions for update to authenticated
  using (public.app_user_can_access_problem_solve())
  with check (public.app_user_can_access_problem_solve());

create policy "bde_actions_delete_ps"
  on public.bde_actions for delete to authenticated
  using (public.app_user_can_access_problem_solve());

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('bde-photos', 'bde-photos', false)
on conflict (id) do nothing;

drop policy if exists "bde_photos_storage_select" on storage.objects;
create policy "bde_photos_storage_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'bde-photos' and public.app_user_can_access_problem_solve());

drop policy if exists "bde_photos_storage_write" on storage.objects;
create policy "bde_photos_storage_write"
  on storage.objects for all to authenticated
  using (bucket_id = 'bde-photos' and public.app_user_can_access_problem_solve())
  with check (bucket_id = 'bde-photos' and public.app_user_can_access_problem_solve());

comment on table public.bde_records is 'Breakdown Elimination records (Problem Solve).';
comment on table public.bde_actions is 'BDE-linked problem solve actions (separate from DDS).';
