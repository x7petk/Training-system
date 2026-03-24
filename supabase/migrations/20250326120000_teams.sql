-- Work teams (shifts, cell team). Each person may belong to one team.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint teams_name_unique unique (name)
);

alter table public.people
  add column if not exists team_id uuid references public.teams (id) on delete set null;

create index if not exists people_team_id_idx on public.people (team_id);

grant select, insert, update, delete on public.teams to authenticated;

alter table public.teams enable row level security;

create policy "teams_select_auth"
  on public.teams for select to authenticated using (true);

create policy "teams_write_admin"
  on public.teams for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

insert into public.teams (name, sort_order)
select v.name, v.sort_order
from (values
  ('Shift A', 10),
  ('Shift B', 20),
  ('Shift C', 30),
  ('Shift D', 40),
  ('Cell Team', 50)
) as v(name, sort_order)
where not exists (select 1 from public.teams t where t.name = v.name);
