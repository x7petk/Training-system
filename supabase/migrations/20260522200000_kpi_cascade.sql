-- KPI Cascade: per-user admin catalog (roles, forums, levels, KPIs) as JSONB workspace.

create table if not exists public.kpi_cascade_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kpi_cascade_workspaces_user_id_key unique (user_id)
);

create index if not exists kpi_cascade_workspaces_user_id_idx
  on public.kpi_cascade_workspaces (user_id, updated_at desc);

create or replace function public.kpi_cascade_workspaces_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists kpi_cascade_workspaces_touch_updated_at on public.kpi_cascade_workspaces;
create trigger kpi_cascade_workspaces_touch_updated_at
  before update on public.kpi_cascade_workspaces
  for each row execute function public.kpi_cascade_workspaces_touch_updated_at();

alter table public.kpi_cascade_workspaces enable row level security;

drop policy if exists "kpi_cascade_workspaces_select_own" on public.kpi_cascade_workspaces;
create policy "kpi_cascade_workspaces_select_own"
  on public.kpi_cascade_workspaces for select to authenticated
  using (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  );

drop policy if exists "kpi_cascade_workspaces_insert_own" on public.kpi_cascade_workspaces;
create policy "kpi_cascade_workspaces_insert_own"
  on public.kpi_cascade_workspaces for insert to authenticated
  with check (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  );

drop policy if exists "kpi_cascade_workspaces_update_own" on public.kpi_cascade_workspaces;
create policy "kpi_cascade_workspaces_update_own"
  on public.kpi_cascade_workspaces for update to authenticated
  using (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  )
  with check (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  );

drop policy if exists "kpi_cascade_workspaces_delete_own" on public.kpi_cascade_workspaces;
create policy "kpi_cascade_workspaces_delete_own"
  on public.kpi_cascade_workspaces for delete to authenticated
  using (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  );

grant select, insert, update, delete on public.kpi_cascade_workspaces to authenticated;

notify pgrst, 'reload schema';
