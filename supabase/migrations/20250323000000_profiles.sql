-- Skill Matrix: user profiles + admin role (run in Supabase SQL editor or via CLI).

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'App user profile; role drives admin UI access.';

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_no_insert_authenticated" on public.profiles;

-- Users can read their own row.
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- Users can update their own row; role changes are blocked for non-admins by trigger below.
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admins can read all profiles (needed for future admin user list).
create policy "profiles_select_admin"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admins can update any profile (promote/demote, names).
create policy "profiles_update_admin"
  on public.profiles
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Insert only via trigger (or service role); end users cannot insert arbitrary rows.
create policy "profiles_no_insert_authenticated"
  on public.profiles
  for insert
  to authenticated
  with check (false);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profiles_updated_at();

create or replace function public.profiles_prevent_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role then
    if not exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    ) then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_escalation_trg on public.profiles;
create trigger profiles_prevent_role_escalation_trg
  before update on public.profiles
  for each row
  execute function public.profiles_prevent_role_escalation();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    ),
    'user'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Bootstrap: after first signup, run in SQL editor (replace email):
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com' limit 1);
