-- Core Skill Matrix entities (see skill_matrix.md §2–6).
-- Skill scale: numeric 1–4 per spec; certification-style skills use 0/1 (no/yes).

do $e$
begin
  create type public.skill_kind as enum ('numeric', 'certification');
exception
  when duplicate_object then null;
end $e$;

grant usage on type public.skill_kind to authenticated;

create table if not exists public.skill_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint skill_groups_name_unique unique (name)
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  skill_group_id uuid references public.skill_groups on delete set null,
  name text not null,
  kind public.skill_kind not null default 'numeric',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint skills_name_unique unique (name)
);

create index if not exists skills_skill_group_id_idx on public.skills (skill_group_id);

-- Job / roster role (not app admin).
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint roles_name_unique unique (name)
);

create table if not exists public.role_skill_requirements (
  role_id uuid not null references public.roles on delete cascade,
  skill_id uuid not null references public.skills on delete cascade,
  required_level smallint not null,
  primary key (role_id, skill_id),
  constraint rsr_level_range check (required_level >= 0 and required_level <= 4)
);

create index if not exists rsr_skill_id_idx on public.role_skill_requirements (skill_id);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists people_user_id_idx on public.people (user_id);

create table if not exists public.person_roles (
  person_id uuid not null references public.people on delete cascade,
  role_id uuid not null references public.roles on delete cascade,
  primary key (person_id, role_id)
);

create index if not exists person_roles_role_id_idx on public.person_roles (role_id);

create table if not exists public.person_skills (
  person_id uuid not null references public.people on delete cascade,
  skill_id uuid not null references public.skills on delete cascade,
  actual_level smallint,
  due_date date,
  is_extra boolean not null default false,
  primary key (person_id, skill_id),
  constraint ps_level_range check (actual_level is null or (actual_level >= 0 and actual_level <= 4))
);

create index if not exists person_skills_skill_id_idx on public.person_skills (skill_id);

-- ---------------------------------------------------------------------------
-- RLS helper (uses profiles from prior migration)
-- ---------------------------------------------------------------------------

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_app_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Grants (API + RLS)
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.skill_groups to authenticated;
grant select, insert, update, delete on public.skills to authenticated;
grant select, insert, update, delete on public.roles to authenticated;
grant select, insert, update, delete on public.role_skill_requirements to authenticated;
grant select, insert, update, delete on public.people to authenticated;
grant select, insert, update, delete on public.person_roles to authenticated;
grant select, insert, update, delete on public.person_skills to authenticated;

alter table public.skill_groups enable row level security;
alter table public.skills enable row level security;
alter table public.roles enable row level security;
alter table public.role_skill_requirements enable row level security;
alter table public.people enable row level security;
alter table public.person_roles enable row level security;
alter table public.person_skills enable row level security;

-- Catalog: all signed-in users read; admins write.
create policy "skill_groups_select_auth"
  on public.skill_groups for select to authenticated using (true);

create policy "skill_groups_write_admin"
  on public.skill_groups for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "skills_select_auth"
  on public.skills for select to authenticated using (true);

create policy "skills_write_admin"
  on public.skills for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "roles_select_auth"
  on public.roles for select to authenticated using (true);

create policy "roles_write_admin"
  on public.roles for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "rsr_select_auth"
  on public.role_skill_requirements for select to authenticated using (true);

create policy "rsr_write_admin"
  on public.role_skill_requirements for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

-- People: visible to org; admins manage; users update their own person row if linked.
create policy "people_select_auth"
  on public.people for select to authenticated using (true);

create policy "people_insert_admin"
  on public.people for insert to authenticated
  with check (public.is_app_admin());

create policy "people_update_admin"
  on public.people for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "people_update_own"
  on public.people for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "people_delete_admin"
  on public.people for delete to authenticated
  using (public.is_app_admin());

create policy "person_roles_select_auth"
  on public.person_roles for select to authenticated using (true);

create policy "person_roles_write_admin"
  on public.person_roles for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "person_skills_select_auth"
  on public.person_skills for select to authenticated using (true);

create policy "person_skills_write_admin"
  on public.person_skills for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "person_skills_insert_own"
  on public.person_skills for insert to authenticated
  with check (
    exists (select 1 from public.people p where p.id = person_id and p.user_id = auth.uid())
  );

create policy "person_skills_update_own"
  on public.person_skills for update to authenticated
  using (
    exists (select 1 from public.people p where p.id = person_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.people p where p.id = person_id and p.user_id = auth.uid())
  );

create policy "person_skills_delete_own"
  on public.person_skills for delete to authenticated
  using (
    exists (select 1 from public.people p where p.id = person_id and p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Demo seed (idempotent by name)
-- ---------------------------------------------------------------------------

insert into public.skill_groups (name, sort_order)
select v.name, v.sort_order
from (values
  ('Technical', 1),
  ('Safety & compliance', 2)
) as v(name, sort_order)
where not exists (select 1 from public.skill_groups sg where sg.name = v.name);

insert into public.skills (skill_group_id, name, kind, sort_order)
select sg.id, v.name, v.kind::public.skill_kind, v.sort_order
from public.skill_groups sg
cross join (values
  ('Technical', 'CNC operation', 'numeric', 1),
  ('Technical', 'Quality inspection', 'numeric', 2),
  ('Safety & compliance', 'Forklift license', 'certification', 1),
  ('Safety & compliance', 'Permit to work', 'certification', 2)
) as v(gname, name, kind, sort_order)
where sg.name = v.gname
  and not exists (select 1 from public.skills s where s.name = v.name);

insert into public.roles (name, sort_order)
select v.name, v.sort_order
from (values
  ('Production operator', 1),
  ('Team lead', 2)
) as v(name, sort_order)
where not exists (select 1 from public.roles r where r.name = v.name);

insert into public.role_skill_requirements (role_id, skill_id, required_level)
select r.id, s.id, req.level::smallint
from (values
  ('Production operator', 'CNC operation', 3),
  ('Production operator', 'Quality inspection', 2),
  ('Production operator', 'Forklift license', 1),
  ('Team lead', 'CNC operation', 4),
  ('Team lead', 'Quality inspection', 3),
  ('Team lead', 'Forklift license', 1),
  ('Team lead', 'Permit to work', 1)
) as req(role_name, skill_name, level)
join public.roles r on r.name = req.role_name
join public.skills s on s.name = req.skill_name
on conflict (role_id, skill_id) do nothing;
