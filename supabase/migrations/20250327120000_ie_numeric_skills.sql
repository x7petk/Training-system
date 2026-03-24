-- Numeric skills (IE / operations). Idempotent by skill name.

insert into public.skill_groups (name, sort_order)
select 'IE & operations', 3
where not exists (select 1 from public.skill_groups sg where sg.name = 'IE & operations');

insert into public.skills (skill_group_id, name, kind, sort_order)
select sg.id, v.name, 'numeric'::public.skill_kind, v.sort_order
from public.skill_groups sg
cross join (values
  ('IE', 1),
  ('CI', 2),
  ('CIL', 3),
  ('DH', 4),
  ('LDDS', 5),
  ('SDDS', 6),
  ('IPS', 7),
  ('QUAL', 8),
  ('BOE', 9),
  ('ET', 10),
  ('WDS', 11),
  ('90DP', 12),
  ('UPS', 13),
  ('HC', 14),
  ('CO', 15),
  ('RTT', 16)
) as v(name, sort_order)
where sg.name = 'IE & operations'
  and not exists (select 1 from public.skills s where s.name = v.name);
