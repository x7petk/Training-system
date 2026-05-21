-- Road Map Builder: per-user roadmap drafts persisted in Supabase. Inputs and AI-generated
-- result are stored as JSONB so we can evolve the schema without further migrations.

create or replace function public.app_user_can_access_agents()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.can_access_agents from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

grant execute on function public.app_user_can_access_agents() to authenticated;

create table if not exists public.road_maps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  inputs jsonb not null default '{}'::jsonb,
  result jsonb,
  view_mode text not null default 'auto' check (view_mode in ('auto', 'quarterly', 'now_next_later', 'gantt')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists road_maps_user_id_idx on public.road_maps (user_id, updated_at desc);

create or replace function public.road_maps_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists road_maps_touch_updated_at on public.road_maps;
create trigger road_maps_touch_updated_at
  before update on public.road_maps
  for each row execute function public.road_maps_touch_updated_at();

alter table public.road_maps enable row level security;

drop policy if exists "road_maps_select_own" on public.road_maps;
create policy "road_maps_select_own"
  on public.road_maps for select to authenticated
  using (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  );

drop policy if exists "road_maps_insert_own" on public.road_maps;
create policy "road_maps_insert_own"
  on public.road_maps for insert to authenticated
  with check (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  );

drop policy if exists "road_maps_update_own" on public.road_maps;
create policy "road_maps_update_own"
  on public.road_maps for update to authenticated
  using (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  )
  with check (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  );

drop policy if exists "road_maps_delete_own" on public.road_maps;
create policy "road_maps_delete_own"
  on public.road_maps for delete to authenticated
  using (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  );

grant select, insert, update, delete on public.road_maps to authenticated;

notify pgrst, 'reload schema';
