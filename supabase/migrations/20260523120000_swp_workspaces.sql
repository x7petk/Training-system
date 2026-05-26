-- Standard Work Process: per-user systems catalog as JSONB workspace.
-- Roles are shared with KPI Cascade (kpi_cascade_workspaces.workspace.roles).

create table if not exists public.swp_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint swp_workspaces_user_id_key unique (user_id)
);

create index if not exists swp_workspaces_user_id_idx
  on public.swp_workspaces (user_id, updated_at desc);

create or replace function public.swp_workspaces_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists swp_workspaces_touch_updated_at on public.swp_workspaces;
create trigger swp_workspaces_touch_updated_at
  before update on public.swp_workspaces
  for each row execute function public.swp_workspaces_touch_updated_at();

alter table public.swp_workspaces enable row level security;

drop policy if exists "swp_workspaces_select_own" on public.swp_workspaces;
create policy "swp_workspaces_select_own"
  on public.swp_workspaces for select to authenticated
  using (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  );

drop policy if exists "swp_workspaces_insert_own" on public.swp_workspaces;
create policy "swp_workspaces_insert_own"
  on public.swp_workspaces for insert to authenticated
  with check (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  );

drop policy if exists "swp_workspaces_update_own" on public.swp_workspaces;
create policy "swp_workspaces_update_own"
  on public.swp_workspaces for update to authenticated
  using (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  )
  with check (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  );

drop policy if exists "swp_workspaces_delete_own" on public.swp_workspaces;
create policy "swp_workspaces_delete_own"
  on public.swp_workspaces for delete to authenticated
  using (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  );

grant select, insert, update, delete on public.swp_workspaces to authenticated;

notify pgrst, 'reload schema';
