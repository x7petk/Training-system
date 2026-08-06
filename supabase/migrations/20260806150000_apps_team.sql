-- Apps Team: multi-agent product delivery board (PM → Designer → Dev → Tester → DevOps).

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

create table if not exists public.apps_team_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  status text not null default 'intake'
    check (status in (
      'intake',
      'design',
      'pm_review_design',
      'build',
      'clarify',
      'test',
      'deploy',
      'done',
      'blocked'
    )),
  description text not null default '',
  value_proposition text not null default '',
  requirements jsonb not null default '[]'::jsonb,
  acceptance_criteria jsonb not null default '[]'::jsonb,
  design_brief jsonb,
  artifacts jsonb not null default '{}'::jsonb,
  active_agent text
    check (active_agent is null or active_agent in (
      'pm', 'designer', 'developer', 'tester', 'devops'
    )),
  cursor_agent_id text,
  cursor_run_id text,
  cursor_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists apps_team_tickets_user_updated_idx
  on public.apps_team_tickets (user_id, updated_at desc);

create index if not exists apps_team_tickets_user_status_idx
  on public.apps_team_tickets (user_id, status);

create or replace function public.apps_team_tickets_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists apps_team_tickets_touch_updated_at on public.apps_team_tickets;
create trigger apps_team_tickets_touch_updated_at
  before update on public.apps_team_tickets
  for each row execute function public.apps_team_tickets_touch_updated_at();

alter table public.apps_team_tickets enable row level security;

drop policy if exists "apps_team_tickets_select_own" on public.apps_team_tickets;
create policy "apps_team_tickets_select_own"
  on public.apps_team_tickets for select to authenticated
  using (public.app_user_can_access_agents() and user_id = auth.uid());

drop policy if exists "apps_team_tickets_insert_own" on public.apps_team_tickets;
create policy "apps_team_tickets_insert_own"
  on public.apps_team_tickets for insert to authenticated
  with check (public.app_user_can_access_agents() and user_id = auth.uid());

drop policy if exists "apps_team_tickets_update_own" on public.apps_team_tickets;
create policy "apps_team_tickets_update_own"
  on public.apps_team_tickets for update to authenticated
  using (public.app_user_can_access_agents() and user_id = auth.uid())
  with check (public.app_user_can_access_agents() and user_id = auth.uid());

drop policy if exists "apps_team_tickets_delete_own" on public.apps_team_tickets;
create policy "apps_team_tickets_delete_own"
  on public.apps_team_tickets for delete to authenticated
  using (public.app_user_can_access_agents() and user_id = auth.uid());

grant select, insert, update, delete on public.apps_team_tickets to authenticated;

create table if not exists public.apps_team_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ticket_id uuid references public.apps_team_tickets (id) on delete cascade,
  from_role text not null
    check (from_role in (
      'customer', 'pm', 'designer', 'developer', 'tester', 'devops', 'system'
    )),
  to_role text
    check (to_role is null or to_role in (
      'customer', 'pm', 'designer', 'developer', 'tester', 'devops', 'system'
    )),
  body text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists apps_team_messages_user_created_idx
  on public.apps_team_messages (user_id, created_at desc);

create index if not exists apps_team_messages_ticket_created_idx
  on public.apps_team_messages (ticket_id, created_at asc);

alter table public.apps_team_messages enable row level security;

drop policy if exists "apps_team_messages_select_own" on public.apps_team_messages;
create policy "apps_team_messages_select_own"
  on public.apps_team_messages for select to authenticated
  using (public.app_user_can_access_agents() and user_id = auth.uid());

drop policy if exists "apps_team_messages_insert_own" on public.apps_team_messages;
create policy "apps_team_messages_insert_own"
  on public.apps_team_messages for insert to authenticated
  with check (public.app_user_can_access_agents() and user_id = auth.uid());

drop policy if exists "apps_team_messages_delete_own" on public.apps_team_messages;
create policy "apps_team_messages_delete_own"
  on public.apps_team_messages for delete to authenticated
  using (public.app_user_can_access_agents() and user_id = auth.uid());

grant select, insert, delete on public.apps_team_messages to authenticated;

create table if not exists public.apps_team_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ticket_id uuid not null references public.apps_team_tickets (id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor_role text,
  summary text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists apps_team_events_ticket_created_idx
  on public.apps_team_events (ticket_id, created_at asc);

alter table public.apps_team_events enable row level security;

drop policy if exists "apps_team_events_select_own" on public.apps_team_events;
create policy "apps_team_events_select_own"
  on public.apps_team_events for select to authenticated
  using (public.app_user_can_access_agents() and user_id = auth.uid());

drop policy if exists "apps_team_events_insert_own" on public.apps_team_events;
create policy "apps_team_events_insert_own"
  on public.apps_team_events for insert to authenticated
  with check (public.app_user_can_access_agents() and user_id = auth.uid());

drop policy if exists "apps_team_events_delete_own" on public.apps_team_events;
create policy "apps_team_events_delete_own"
  on public.apps_team_events for delete to authenticated
  using (public.app_user_can_access_agents() and user_id = auth.uid());

grant select, insert, delete on public.apps_team_events to authenticated;

notify pgrst, 'reload schema';
