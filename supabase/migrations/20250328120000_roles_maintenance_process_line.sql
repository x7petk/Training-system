-- Job roles: Maintenance Lead, Process Engineer, Line Manager — same IE & operations requirements.

insert into public.roles (name, sort_order)
select v.name, v.sort_order
from (values
  ('Maintenance Lead', 40),
  ('Process Engineer', 50),
  ('Line Manager', 60)
) as v(name, sort_order)
where not exists (select 1 from public.roles r where r.name = v.name);

insert into public.role_skill_requirements (role_id, skill_id, required_level)
select r.id, s.id, req.level::smallint
from public.roles r
cross join (values
  ('IE', 4),
  ('CI', 4),
  ('CIL', 4),
  ('DH', 4),
  ('LDDS', 4),
  ('SDDS', 4),
  ('IPS', 3),
  ('QUAL', 3),
  ('BOE', 2),
  ('ET', 3),
  ('WDS', 3),
  ('90DP', 3),
  ('UPS', 3),
  ('HC', 3),
  ('CO', 3),
  ('RTT', 4)
) as req(skill_name, level)
join public.skills s on s.name = req.skill_name
where r.name in ('Maintenance Lead', 'Process Engineer', 'Line Manager')
on conflict (role_id, skill_id) do update
set required_level = excluded.required_level;
