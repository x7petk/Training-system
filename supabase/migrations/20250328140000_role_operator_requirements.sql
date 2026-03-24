-- Operator job role + IE & operations requirements (UPS omitted = N/A).
-- New skills: FE, SODP (in IE & operations group).

insert into public.skills (skill_group_id, name, kind, sort_order)
select sg.id, v.name, 'numeric'::public.skill_kind, v.sort_order
from public.skill_groups sg
cross join (values
  ('FE', 17),
  ('SODP', 18)
) as v(name, sort_order)
where sg.name = 'IE & operations'
  and not exists (select 1 from public.skills s where s.name = v.name);

insert into public.roles (name, sort_order)
select 'Operator', 25
where not exists (select 1 from public.roles r where r.name = 'Operator');

insert into public.role_skill_requirements (role_id, skill_id, required_level)
select r.id, s.id, req.level::smallint
from public.roles r
cross join (values
  ('FE', 1),
  ('CI', 3),
  ('CIL', 3),
  ('DH', 3),
  ('LDDS', 1),
  ('SDDS', 1),
  ('IPS', 2),
  ('QUAL', 1),
  ('BOE', 1),
  ('ET', 1),
  ('WDS', 1),
  ('SODP', 1),
  ('HC', 1),
  ('CO', 2),
  ('RTT', 2)
) as req(skill_name, level)
join public.skills s on s.name = req.skill_name
where r.name = 'Operator'
on conflict (role_id, skill_id) do update
set required_level = excluded.required_level;
