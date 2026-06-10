-- BMS Brain core schema: catalog, processes, versions, views, attachments

-- ---------------------------------------------------------------------------
-- Catalog: roles, forums, systems
-- ---------------------------------------------------------------------------
create table public.bms_brain_roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  color text not null default '#6366f1',
  icon text not null default 'user',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bms_brain_forums (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  color text not null default '#0ea5e9',
  icon text not null default 'messages-square',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bms_brain_systems (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  integrations text not null default '',
  color text not null default '#10b981',
  icon text not null default 'box',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bms_brain_roles_sort_idx on public.bms_brain_roles (sort_order, name);
create index bms_brain_forums_sort_idx on public.bms_brain_forums (sort_order, name);
create index bms_brain_systems_sort_idx on public.bms_brain_systems (sort_order, name);

-- ---------------------------------------------------------------------------
-- Processes + versions
-- ---------------------------------------------------------------------------
create table public.bms_brain_processes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  flow jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  owner_role_id uuid references public.bms_brain_roles (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bms_brain_processes_status_idx on public.bms_brain_processes (status, updated_at desc);

create table public.bms_brain_process_versions (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.bms_brain_processes (id) on delete cascade,
  version_no int not null,
  snapshot jsonb not null,
  published_by uuid references auth.users (id) on delete set null,
  published_at timestamptz not null default now(),
  note text not null default '',
  unique (process_id, version_no)
);

create index bms_brain_process_versions_process_idx
  on public.bms_brain_process_versions (process_id, version_no desc);

-- Per-user saved matrix/flow view (filters + viewport)
create table public.bms_brain_user_views (
  user_id uuid not null references auth.users (id) on delete cascade,
  view_key text not null default 'matrix',
  filters jsonb not null default '{}'::jsonb,
  viewport jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, view_key)
);

-- Step file attachments (storage paths)
create table public.bms_brain_attachments (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.bms_brain_processes (id) on delete cascade,
  step_id text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  byte_size bigint,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index bms_brain_attachments_process_step_idx
  on public.bms_brain_attachments (process_id, step_id);

-- ---------------------------------------------------------------------------
-- Updated-at triggers
-- ---------------------------------------------------------------------------
create or replace function public.bms_brain_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger bms_brain_roles_updated_at
  before update on public.bms_brain_roles
  for each row execute function public.bms_brain_touch_updated_at();

create trigger bms_brain_forums_updated_at
  before update on public.bms_brain_forums
  for each row execute function public.bms_brain_touch_updated_at();

create trigger bms_brain_systems_updated_at
  before update on public.bms_brain_systems
  for each row execute function public.bms_brain_touch_updated_at();

create trigger bms_brain_processes_updated_at
  before update on public.bms_brain_processes
  for each row execute function public.bms_brain_touch_updated_at();

-- Prevent hard delete of catalog rows referenced by published processes
create or replace function public.bms_brain_prevent_catalog_delete()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  used boolean;
begin
  if tg_table_name = 'bms_brain_roles' then
    select exists (
      select 1
      from public.bms_brain_processes p
      where p.status = 'published'
        and (
          p.owner_role_id = old.id
          or exists (
            select 1
            from jsonb_array_elements(coalesce(p.flow -> 'nodes', '[]'::jsonb)) n
            where n ->> 'roleId' = old.id::text
          )
        )
    ) into used;
  elsif tg_table_name = 'bms_brain_forums' then
    select exists (
      select 1
      from public.bms_brain_processes p
      where p.status = 'published'
        and exists (
          select 1
          from jsonb_array_elements(coalesce(p.flow -> 'nodes', '[]'::jsonb)) n
          where n ->> 'forumId' = old.id::text
        )
    ) into used;
  elsif tg_table_name = 'bms_brain_systems' then
    select exists (
      select 1
      from public.bms_brain_processes p
      where p.status = 'published'
        and exists (
          select 1
          from jsonb_array_elements(coalesce(p.flow -> 'nodes', '[]'::jsonb)) n
          cross join lateral jsonb_array_elements_text(coalesce(n -> 'systemIds', '[]'::jsonb)) sid
          where sid = old.id::text
        )
    ) into used;
  end if;

  if used then
    raise exception 'Cannot delete: item is referenced by a published process. Deactivate it instead.';
  end if;
  return old;
end;
$$;

create trigger bms_brain_roles_prevent_delete
  before delete on public.bms_brain_roles
  for each row execute function public.bms_brain_prevent_catalog_delete();

create trigger bms_brain_forums_prevent_delete
  before delete on public.bms_brain_forums
  for each row execute function public.bms_brain_prevent_catalog_delete();

create trigger bms_brain_systems_prevent_delete
  before delete on public.bms_brain_systems
  for each row execute function public.bms_brain_prevent_catalog_delete();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.bms_brain_roles enable row level security;
alter table public.bms_brain_forums enable row level security;
alter table public.bms_brain_systems enable row level security;
alter table public.bms_brain_processes enable row level security;
alter table public.bms_brain_process_versions enable row level security;
alter table public.bms_brain_user_views enable row level security;
alter table public.bms_brain_attachments enable row level security;

create policy "bms_brain_roles_select"
  on public.bms_brain_roles for select to authenticated
  using (public.bms_brain_can_view());

create policy "bms_brain_roles_write_admin"
  on public.bms_brain_roles for all to authenticated
  using (public.bms_brain_can_admin())
  with check (public.bms_brain_can_admin());

create policy "bms_brain_forums_select"
  on public.bms_brain_forums for select to authenticated
  using (public.bms_brain_can_view());

create policy "bms_brain_forums_write_admin"
  on public.bms_brain_forums for all to authenticated
  using (public.bms_brain_can_admin())
  with check (public.bms_brain_can_admin());

create policy "bms_brain_systems_select"
  on public.bms_brain_systems for select to authenticated
  using (public.bms_brain_can_view());

create policy "bms_brain_systems_write_admin"
  on public.bms_brain_systems for all to authenticated
  using (public.bms_brain_can_admin())
  with check (public.bms_brain_can_admin());

create policy "bms_brain_processes_select"
  on public.bms_brain_processes for select to authenticated
  using (
    public.bms_brain_can_view()
    and (
      status = 'published'
      or public.bms_brain_can_edit()
    )
  );

create policy "bms_brain_processes_insert"
  on public.bms_brain_processes for insert to authenticated
  with check (public.bms_brain_can_edit());

create policy "bms_brain_processes_update"
  on public.bms_brain_processes for update to authenticated
  using (public.bms_brain_can_edit())
  with check (public.bms_brain_can_edit());

create policy "bms_brain_processes_delete"
  on public.bms_brain_processes for delete to authenticated
  using (public.bms_brain_can_edit() and status <> 'published');

create policy "bms_brain_versions_select"
  on public.bms_brain_process_versions for select to authenticated
  using (public.bms_brain_can_view());

create policy "bms_brain_versions_insert"
  on public.bms_brain_process_versions for insert to authenticated
  with check (public.bms_brain_can_edit());

create policy "bms_brain_user_views_own"
  on public.bms_brain_user_views for all to authenticated
  using (user_id = auth.uid() and public.bms_brain_can_view())
  with check (user_id = auth.uid() and public.bms_brain_can_view());

create policy "bms_brain_attachments_select"
  on public.bms_brain_attachments for select to authenticated
  using (public.bms_brain_can_view());

create policy "bms_brain_attachments_write"
  on public.bms_brain_attachments for all to authenticated
  using (public.bms_brain_can_edit())
  with check (public.bms_brain_can_edit());

grant select on public.bms_brain_roles to authenticated;
grant select on public.bms_brain_forums to authenticated;
grant select on public.bms_brain_systems to authenticated;
grant select, insert, update, delete on public.bms_brain_processes to authenticated;
grant select, insert on public.bms_brain_process_versions to authenticated;
grant select, insert, update, delete on public.bms_brain_user_views to authenticated;
grant select, insert, update, delete on public.bms_brain_attachments to authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket for step attachments
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('bms-brain-attachments', 'bms-brain-attachments', false)
on conflict (id) do nothing;

drop policy if exists "bms_brain_attachments_storage_select" on storage.objects;
create policy "bms_brain_attachments_storage_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'bms-brain-attachments' and public.bms_brain_can_view());

drop policy if exists "bms_brain_attachments_storage_write" on storage.objects;
create policy "bms_brain_attachments_storage_write"
  on storage.objects for all to authenticated
  using (bucket_id = 'bms-brain-attachments' and public.bms_brain_can_edit())
  with check (bucket_id = 'bms-brain-attachments' and public.bms_brain_can_edit());

-- ---------------------------------------------------------------------------
-- Seed catalog (provided defaults)
-- ---------------------------------------------------------------------------
insert into public.bms_brain_roles (slug, name, description, color, icon, sort_order) values
  ('operator', 'Operator', 'Front-line team member executing standard work on the line.', '#64748b', 'user', 1),
  ('team-lead', 'Team Lead', 'First-line leadership supervising operators, shift forums, and team execution.', '#475569', 'user-cog', 2),
  ('cell', 'Cell', 'Cell-level leadership coordinating shift execution and escalation.', '#6366f1', 'users', 3),
  ('plant', 'Plant', 'Plant leadership reviewing performance and enabling resources.', '#8b5cf6', 'factory', 4),
  ('site', 'Site', 'Site leadership aligning forums and cross-plant priorities.', '#a855f7', 'building-2', 5),
  ('support', 'Support', 'Support functions enabling line performance (HR, planning, etc.).', '#0ea5e9', 'life-buoy', 6),
  ('maintenance', 'Maintenance', 'Maintenance and reliability support for equipment and standards.', '#f59e0b', 'wrench', 7)
on conflict (slug) do nothing;

insert into public.bms_brain_forums (slug, name, description, color, icon, sort_order) values
  ('swp', 'SWP', 'Standard Work Process — define and improve how work is done.', '#6366f1', 'clipboard-list', 1),
  ('p2p', 'P2P', 'People & Process — audit behaviours and process adherence.', '#ec4899', 'users-round', 2),
  ('shift-dds', 'Shift DDS', 'Shift Daily Direction Setting meeting.', '#14b8a6', 'clock', 3),
  ('line-dds', 'Line DDS', 'Line-level DDS review and actions.', '#10b981', 'list-tree', 4),
  ('site-dds', 'Site DDS', 'Site-level DDS cascade and recognition.', '#0d9488', 'building-2', 5),
  ('wds', 'WDS', 'Weekly Direction Setting — priorities for the week ahead.', '#3b82f6', 'layout-grid', 6),
  ('pdca', 'PDCA', 'Problem solving loop — plan, do, check, act.', '#f97316', 'refresh-cw', 7)
on conflict (slug) do nothing;

insert into public.bms_brain_systems (slug, name, description, integrations, color, icon, sort_order) values
  ('cl', 'CL', 'Centreline checks and standards execution.', 'Plan 24, Line DDS, SWP', '#3b82f6', 'ruler', 1),
  ('cil', 'CIL', 'Clean, Inspect, Lubricate tasks and routes.', 'Plan 24, DH, Maintenance', '#06b6d4', 'sparkles', 2),
  ('dh', 'DH', 'Defect handling and escalation.', 'Plan 24, PDCA, Line DDS', '#ef4444', 'bug', 3),
  ('ips', 'IPS', 'Integrated production system checks.', 'Shift DDS, WDS', '#8b5cf6', 'shield-check', 4),
  ('plan24', 'Plan 24', 'Shift planning and task execution grid.', 'CL, CIL, Quality, DDS actions', '#10b981', 'calendar-days', 5),
  ('wds-sys', 'WDS', 'Weekly direction board and actions.', 'WDS forum, e-plan', '#2563eb', 'layout-grid', 6),
  ('pdca-sys', 'PDCA', 'Structured problem-solving boards.', 'PDCA forum, Top losses', '#f97316', 'refresh-cw', 7),
  ('p2p-sys', 'P2P', 'People & process audit tooling.', 'P2P forum, Shift DDS', '#ec4899', 'users-round', 8)
on conflict (slug) do nothing;

notify pgrst, 'reload schema';

grant execute on function public.app_user_can_access_bms_brain() to authenticated;
grant execute on function public.bms_brain_user_role() to authenticated;
grant execute on function public.bms_brain_can_view() to authenticated;
grant execute on function public.bms_brain_can_edit() to authenticated;
grant execute on function public.bms_brain_can_admin() to authenticated;
