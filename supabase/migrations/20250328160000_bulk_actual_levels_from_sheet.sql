-- Bulk actual skill levels from provided sheet.
-- Applies FE..RTT numeric levels to matching people by display name.
-- Rows with missing values are omitted (e.g. Alaina Little had no numbers provided).

with src(
  raw_name, fe, ci, cil, dh, ldds, sdds, ips, qual, boe, et, wds, sodp, ups, hc, co, rtt
) as (
  values
    ('Connie Searle', 4,4,4,3,4,4,3,4,2,4,4,4,3,3,4,4),
    ('Kieran Aynsley', 4,4,4,4,4,4,4,2,2,3,4,3,3,4,3,4),
    ('Darryn McIntosh', 4,3,3,4,4,4,4,3,3,3,4,3,3,4,2,4),
    ('Vance Burton', 4,3,4,3,4,4,3,3,2,2,3,3,3,3,2,4),
    ('Joby Nangini Jacob', 4,4,4,4,4,3,4,2,2,3,2,2,3,2,2,4),
    ('Jared Caldwell', 4,4,4,4,3,3,4,2,2,3,2,2,2,3,2,4),
    ('Daniel McCormick', 3,4,4,4,2,3,3,1,2,1,1,1,2,2,1,4),
    ('David Drummond (LB Supervisor - Processing)', 4,4,4,4,4,3,4,1,1,4,3,3,2,3,2,4),
    ('Riaan Gerber', 4,4,4,4,4,3,3,2,3,2,2,2,2,2,2,4),
    ('Adrian Mannering', 1,3,3,3,3,3,3,1,1,1,1,1,1,1,1,3),
    ('Jonathan Lovatt', 4,3,3,4,3,3,2,2,2,3,2,2,2,2,2,3),
    ('Joel Calnan', 2,3,3,4,2,2,2,2,2,2,2,2,2,2,2,3),
    ('Kurtis Ritani', 2,4,4,4,3,3,3,2,2,2,1,1,2,1,1,4),
    ('Steven Swan', 1,3,3,3,2,2,2,1,1,null,null,null,null,1,3,3),
    ('Paula Bavin', 1,3,3,3,2,2,2,1,1,null,null,null,null,2,1,3),
    ('Ashwin Ramakrishna', 1,3,3,3,1,2,2,2,2,null,null,null,null,2,1,1),
    ('Brodie Bensemann', 1,3,3,3,1,1,3,1,2,null,null,null,null,1,1,3),
    ('Denise Mullen', 1,3,3,3,1,2,2,1,1,null,null,null,null,1,1,3),
    ('Tim Wilson', 1,3,3,3,1,1,1,1,1,null,null,null,null,1,1,3),
    ('Rod Fewer', 1,3,3,3,1,1,1,1,1,null,null,null,null,2,1,1),
    ('Kevin Mills (L4 Forklift Driver - Stores)', 1,3,3,2,1,1,1,1,1,null,null,null,null,1,1,1),
    ('Abby Vinodh', 1,2,2,2,1,1,1,1,1,null,null,null,null,1,1,2),
    ('Amanda Kilgour', 1,2,2,2,1,1,1,1,1,null,null,null,null,1,1,2),
    ('Vash Chaudhary', 1,2,2,2,1,1,1,1,1,null,null,null,null,1,1,2),
    ('Jaydn Frost', 1,3,3,4,1,2,2,1,1,null,null,null,null,1,1,3),
    ('Matt Ingham', 1,3,3,3,2,2,2,1,1,null,null,null,null,1,1,3),
    ('Nevis Clark', 1,3,3,3,1,1,3,1,1,null,null,null,null,2,1,3),
    ('Soumya Antony', 1,3,3,3,1,1,3,1,1,null,null,null,null,1,1,3),
    ('Harish Pulukuzhy', 1,3,3,3,1,1,2,1,1,null,null,null,null,1,1,3),
    ('Brent Hastie', 1,3,3,3,1,2,2,1,1,null,null,null,null,1,1,1),
    ('Vesna Spinderk', 1,3,3,2,1,2,2,1,1,null,null,null,null,1,1,2),
    ('Christopher Scott', 1,2,2,2,1,2,2,1,1,null,null,null,null,1,1,2),
    ('David Cruickshank (L4 Junior Operator - Packing)', 1,3,3,2,1,1,1,1,1,null,null,null,null,1,1,2),
    ('Nancy Nancy', 1,3,3,2,1,1,1,1,1,null,null,null,null,1,1,2),
    ('Robert Jarman', 1,1,1,1,1,1,1,1,1,null,null,null,null,1,1,1),
    ('John Webb', 1,3,3,3,1,1,2,1,1,null,null,null,null,1,1,3),
    ('Mike O’Dea', 1,3,3,3,1,1,2,1,1,null,null,null,null,1,1,3),
    ('Allan Lesch', 1,3,3,3,1,1,1,1,1,null,null,null,null,1,1,3),
    ('Carlos Solarte', 1,3,3,3,1,1,1,1,1,null,null,null,null,1,1,3),
    ('Prateek Sharma', 1,3,2,3,1,1,2,1,1,null,null,null,null,1,1,3),
    ('Karyn Shaw', 1,2,2,3,1,1,1,1,1,null,null,null,null,1,1,2),
    ('Bikramjit Singh', 1,2,2,2,1,1,1,1,1,null,null,null,null,1,1,2),
    ('Bob Beukenholdt', 1,2,2,2,1,1,1,1,1,null,null,null,null,1,1,2),
    ('John Nguyen', 1,2,2,2,1,1,1,1,1,null,null,null,null,1,1,2),
    ('Sue Campbell', 1,2,2,2,1,1,1,1,1,null,null,null,null,1,1,2),
    ('Emma Champion', 1,1,1,1,1,1,1,1,1,null,null,null,null,1,1,1),
    ('Colin Hayes', 1,3,3,3,1,1,3,1,1,null,null,null,null,1,1,3),
    ('Jack Carter', 1,3,3,2,1,1,2,1,1,null,null,null,null,1,1,3),
    ('Nigel Yaxley', 1,3,3,3,1,1,3,1,1,null,null,null,null,1,1,1),
    ('Rhett Esmeralda', 1,2,2,2,1,2,3,1,1,null,null,null,null,1,1,2),
    ('Sharon Buchanan', 1,3,3,2,1,1,1,1,1,null,null,null,null,1,1,3),
    ('Simon Henley', 1,3,3,2,1,1,1,1,1,null,null,null,null,1,1,3),
    ('Sharon Morrison', 1,1,1,1,1,1,1,1,1,null,null,null,null,1,1,2),
    ('Hayley Luscombe', 1,1,1,1,1,1,1,1,1,null,null,null,null,1,1,1),
    ('Jarod Carey', 1,1,1,1,1,1,1,1,1,null,null,null,null,1,1,1),
    ('Marney Youngman', 1,1,1,1,1,1,1,1,1,null,null,null,null,1,1,1),
    ('Mandy Parke', 3,3,3,1,1,1,1,1,1,null,null,null,null,1,1,3),
    ('Heather Shaw', 1,1,1,1,1,1,1,1,1,null,null,null,null,1,1,1)
),
people_match as (
  select
    s.*,
    p.id as person_id
  from src s
  join public.people p
    on lower(p.display_name) = lower(regexp_replace(replace(s.raw_name, '’', ''''), '\s*\(.*\)$', ''))
),
long_levels as (
  select
    pm.person_id,
    kv.skill_name,
    kv.level
  from people_match pm
  cross join lateral (
    values
      ('FE', pm.fe),
      ('CI', pm.ci),
      ('CIL', pm.cil),
      ('DH', pm.dh),
      ('LDDS', pm.ldds),
      ('SDDS', pm.sdds),
      ('IPS', pm.ips),
      ('QUAL', pm.qual),
      ('BOE', pm.boe),
      ('ET', pm.et),
      ('WDS', pm.wds),
      ('SODP', pm.sodp),
      ('UPS', pm.ups),
      ('HC', pm.hc),
      ('CO', pm.co),
      ('RTT', pm.rtt)
  ) as kv(skill_name, level)
),
resolved as (
  select ll.person_id, s.id as skill_id, ll.level
  from long_levels ll
  join public.skills s on s.name = ll.skill_name
)
insert into public.person_skills (person_id, skill_id, actual_level)
select person_id, skill_id, level
from resolved
on conflict (person_id, skill_id) do update
set actual_level = excluded.actual_level;
