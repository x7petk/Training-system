-- Fix infinite recursion on profiles RLS: admin policies used EXISTS (SELECT FROM profiles),
-- which re-entered RLS. Use SECURITY DEFINER is_app_admin() so the inner read bypasses RLS.

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_app_admin() to authenticated;

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles
  for select
  to authenticated
  using ((select public.is_app_admin()));

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles
  for update
  to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

-- Trigger: avoid self-query on profiles under RLS (same pattern).
create or replace function public.profiles_prevent_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.role is distinct from old.role then
    if not (select public.is_app_admin()) then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;
