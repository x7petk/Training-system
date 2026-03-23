-- App access roles: admin (full), assessor (edit anyone's skill scores), operator (read-only own view).
-- Migrates legacy role 'user' → 'operator'.

update public.profiles set role = 'operator' where role = 'user';

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'assessor', 'operator'));

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
    'operator'
  );
  return new;
end;
$$;

-- Assessors may insert/update/delete person_skills for any person (matrix scoring).
create or replace function public.is_app_assessor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'assessor'
  );
$$;

grant execute on function public.is_app_assessor() to authenticated;

drop policy if exists "person_skills_write_assessor" on public.person_skills;

create policy "person_skills_write_assessor"
  on public.person_skills
  for all
  to authenticated
  using (public.is_app_assessor())
  with check (public.is_app_assessor());
