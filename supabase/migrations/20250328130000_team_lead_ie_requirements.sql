-- Team lead: IE & operations required levels (seed role name is "Team lead").

insert into public.role_skill_requirements (role_id, skill_id, required_level)
select r.id, s.id, req.level::smallint
from public.roles r
cross join (values
  ('IE', 3),
  ('CI', 3),
  ('CIL', 3),
  ('DH', 3),
  ('LDDS', 3),
  ('SDDS', 3),
  ('IPS', 2),
  ('QUAL', 2),
  ('BOE', 2),
  ('ET', 2),
  ('WDS', 2),
  ('90DP', 2),
  ('UPS', 2),
  ('HC', 2),
  ('CO', 2),
  ('RTT', 3)
) as req(skill_name, level)
join public.skills s on s.name = req.skill_name
where r.name in ('Team lead', 'Team Lead')
on conflict (role_id, skill_id) do update
set required_level = excluded.required_level;
