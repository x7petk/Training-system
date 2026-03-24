-- Bulk roster load: people, teams, and job-role links.

insert into public.teams (name, sort_order)
select 'BI Team', 55
where not exists (select 1 from public.teams t where t.name = 'BI Team');

with src(display_name, team_label, role_name) as (
  values
    ('Connie Searle', 'CellTeam', 'Line Manager'),
    ('Kieran Aynsley', 'CellTeam', 'Line Manager'),
    ('Darryn McIntosh', 'CellTeam', 'Maintenance Lead'),
    ('Vance Burton', 'BITeam', 'Line Manager'),
    ('Joby Nangini Jacob', 'Cell Team', 'Team Lead'),
    ('Jared Caldwell', 'A', 'Operator'),
    ('Daniel McCormick', 'B', 'Operator'),
    ('David Drummond', 'B', 'Team Lead'),
    ('Riaan Gerber', 'B', 'Operator'),
    ('Adrian Mannering', 'C', 'Operator'),
    ('Jonathan Lovatt', 'C', 'Operator'),
    ('Joel Calnan', 'C', 'Operator'),
    ('Kurtis Ritani', 'D', 'Operator'),
    ('Steven Swan', 'A', 'Operator'),
    ('Paula Bavin', 'A', 'Operator'),
    ('Ashwin Ramakrishna', 'A', 'Operator'),
    ('Brodie Bensemann', 'A', 'Operator'),
    ('Denise Mullen', 'A', 'Operator'),
    ('Tim Wilson', 'A', 'Operator'),
    ('Rod Fewer', 'A', 'Operator'),
    ('Kevin Mills', 'A', 'Operator'),
    ('Abby Vinodh', 'A', 'Operator'),
    ('Amanda Kilgour', 'A', 'Operator'),
    ('Vash Chaudhary', 'A', 'Operator'),
    ('Jaydn Frost', 'C', 'Operator'),
    ('Matt Ingham', 'C', 'Operator'),
    ('Nevis Clark', 'C', 'Operator'),
    ('Soumya Antony', 'C', 'Operator'),
    ('Harish Pulukuzhy', 'C', 'Operator'),
    ('Brent Hastie', 'C', 'Operator'),
    ('Vesna Spinderk', 'C', 'Operator'),
    ('Christopher Scott', 'C', 'Operator'),
    ('David Cruickshank', 'C', 'Operator'),
    ('Nancy Nancy', 'C', 'Operator'),
    ('Robert Jarman', 'B', 'Operator'),
    ('John Webb', 'B', 'Operator'),
    ('Mike O''Dea', 'B', 'Operator'),
    ('Allan Lesch', 'B', 'Operator'),
    ('Carlos Solarte', 'B', 'Operator'),
    ('Prateek Sharma', 'B', 'Operator'),
    ('Karyn Shaw', 'B', 'Operator'),
    ('Bikramjit Singh', 'B', 'Operator'),
    ('Bob Beukenholdt', 'B', 'Operator'),
    ('John Nguyen', 'B', 'Operator'),
    ('Sue Campbell', 'B', 'Operator'),
    ('Emma Champion', 'B', 'Operator'),
    ('Colin Hayes', 'D', 'Operator'),
    ('Jack Carter', 'D', 'Operator'),
    ('Nigel Yaxley', 'D', 'Operator'),
    ('Rhett Esmeralda', 'D', 'Operator'),
    ('Sharon Buchanan', 'D', 'Operator'),
    ('Simon Henley', 'D', 'Operator'),
    ('Sharon Morrison', 'D', 'Operator'),
    ('Hayley Luscombe', 'D', 'Operator'),
    ('Jarod Carey', 'D', 'Operator'),
    ('Marney Youngman', 'A', 'Operator'),
    ('Mandy Parke', 'A', 'Operator'),
    ('Heather Shaw', 'A', 'Operator'),
    ('Alaina Little', 'Cell Team', 'Operator')
),
resolved as (
  select
    s.display_name,
    s.role_name,
    t.id as team_id,
    r.id as role_id
  from src s
  left join public.teams t on t.name = case lower(replace(s.team_label, ' ', ''))
    when 'a' then 'Shift A'
    when 'b' then 'Shift B'
    when 'c' then 'Shift C'
    when 'd' then 'Shift D'
    when 'cellteam' then 'Cell Team'
    when 'biteam' then 'BI Team'
    else s.team_label
  end
  left join public.roles r on lower(r.name) = lower(s.role_name)
)
update public.people p
set team_id = x.team_id
from resolved x
where p.display_name = x.display_name
  and x.team_id is not null;

with src(display_name, team_label, role_name) as (
  values
    ('Connie Searle', 'CellTeam', 'Line Manager'),
    ('Kieran Aynsley', 'CellTeam', 'Line Manager'),
    ('Darryn McIntosh', 'CellTeam', 'Maintenance Lead'),
    ('Vance Burton', 'BITeam', 'Line Manager'),
    ('Joby Nangini Jacob', 'Cell Team', 'Team Lead'),
    ('Jared Caldwell', 'A', 'Operator'),
    ('Daniel McCormick', 'B', 'Operator'),
    ('David Drummond', 'B', 'Team Lead'),
    ('Riaan Gerber', 'B', 'Operator'),
    ('Adrian Mannering', 'C', 'Operator'),
    ('Jonathan Lovatt', 'C', 'Operator'),
    ('Joel Calnan', 'C', 'Operator'),
    ('Kurtis Ritani', 'D', 'Operator'),
    ('Steven Swan', 'A', 'Operator'),
    ('Paula Bavin', 'A', 'Operator'),
    ('Ashwin Ramakrishna', 'A', 'Operator'),
    ('Brodie Bensemann', 'A', 'Operator'),
    ('Denise Mullen', 'A', 'Operator'),
    ('Tim Wilson', 'A', 'Operator'),
    ('Rod Fewer', 'A', 'Operator'),
    ('Kevin Mills', 'A', 'Operator'),
    ('Abby Vinodh', 'A', 'Operator'),
    ('Amanda Kilgour', 'A', 'Operator'),
    ('Vash Chaudhary', 'A', 'Operator'),
    ('Jaydn Frost', 'C', 'Operator'),
    ('Matt Ingham', 'C', 'Operator'),
    ('Nevis Clark', 'C', 'Operator'),
    ('Soumya Antony', 'C', 'Operator'),
    ('Harish Pulukuzhy', 'C', 'Operator'),
    ('Brent Hastie', 'C', 'Operator'),
    ('Vesna Spinderk', 'C', 'Operator'),
    ('Christopher Scott', 'C', 'Operator'),
    ('David Cruickshank', 'C', 'Operator'),
    ('Nancy Nancy', 'C', 'Operator'),
    ('Robert Jarman', 'B', 'Operator'),
    ('John Webb', 'B', 'Operator'),
    ('Mike O''Dea', 'B', 'Operator'),
    ('Allan Lesch', 'B', 'Operator'),
    ('Carlos Solarte', 'B', 'Operator'),
    ('Prateek Sharma', 'B', 'Operator'),
    ('Karyn Shaw', 'B', 'Operator'),
    ('Bikramjit Singh', 'B', 'Operator'),
    ('Bob Beukenholdt', 'B', 'Operator'),
    ('John Nguyen', 'B', 'Operator'),
    ('Sue Campbell', 'B', 'Operator'),
    ('Emma Champion', 'B', 'Operator'),
    ('Colin Hayes', 'D', 'Operator'),
    ('Jack Carter', 'D', 'Operator'),
    ('Nigel Yaxley', 'D', 'Operator'),
    ('Rhett Esmeralda', 'D', 'Operator'),
    ('Sharon Buchanan', 'D', 'Operator'),
    ('Simon Henley', 'D', 'Operator'),
    ('Sharon Morrison', 'D', 'Operator'),
    ('Hayley Luscombe', 'D', 'Operator'),
    ('Jarod Carey', 'D', 'Operator'),
    ('Marney Youngman', 'A', 'Operator'),
    ('Mandy Parke', 'A', 'Operator'),
    ('Heather Shaw', 'A', 'Operator'),
    ('Alaina Little', 'Cell Team', 'Operator')
),
resolved as (
  select
    s.display_name,
    t.id as team_id,
    r.id as role_id
  from src s
  left join public.teams t on t.name = case lower(replace(s.team_label, ' ', ''))
    when 'a' then 'Shift A'
    when 'b' then 'Shift B'
    when 'c' then 'Shift C'
    when 'd' then 'Shift D'
    when 'cellteam' then 'Cell Team'
    when 'biteam' then 'BI Team'
    else s.team_label
  end
  left join public.roles r on lower(r.name) = lower(s.role_name)
)
insert into public.people (display_name, team_id)
select x.display_name, x.team_id
from resolved x
where not exists (
  select 1 from public.people p where p.display_name = x.display_name
);

with src(display_name, role_name) as (
  values
    ('Connie Searle', 'Line Manager'),
    ('Kieran Aynsley', 'Line Manager'),
    ('Darryn McIntosh', 'Maintenance Lead'),
    ('Vance Burton', 'Line Manager'),
    ('Joby Nangini Jacob', 'Team Lead'),
    ('Jared Caldwell', 'Operator'),
    ('Daniel McCormick', 'Operator'),
    ('David Drummond', 'Team Lead'),
    ('Riaan Gerber', 'Operator'),
    ('Adrian Mannering', 'Operator'),
    ('Jonathan Lovatt', 'Operator'),
    ('Joel Calnan', 'Operator'),
    ('Kurtis Ritani', 'Operator'),
    ('Steven Swan', 'Operator'),
    ('Paula Bavin', 'Operator'),
    ('Ashwin Ramakrishna', 'Operator'),
    ('Brodie Bensemann', 'Operator'),
    ('Denise Mullen', 'Operator'),
    ('Tim Wilson', 'Operator'),
    ('Rod Fewer', 'Operator'),
    ('Kevin Mills', 'Operator'),
    ('Abby Vinodh', 'Operator'),
    ('Amanda Kilgour', 'Operator'),
    ('Vash Chaudhary', 'Operator'),
    ('Jaydn Frost', 'Operator'),
    ('Matt Ingham', 'Operator'),
    ('Nevis Clark', 'Operator'),
    ('Soumya Antony', 'Operator'),
    ('Harish Pulukuzhy', 'Operator'),
    ('Brent Hastie', 'Operator'),
    ('Vesna Spinderk', 'Operator'),
    ('Christopher Scott', 'Operator'),
    ('David Cruickshank', 'Operator'),
    ('Nancy Nancy', 'Operator'),
    ('Robert Jarman', 'Operator'),
    ('John Webb', 'Operator'),
    ('Mike O''Dea', 'Operator'),
    ('Allan Lesch', 'Operator'),
    ('Carlos Solarte', 'Operator'),
    ('Prateek Sharma', 'Operator'),
    ('Karyn Shaw', 'Operator'),
    ('Bikramjit Singh', 'Operator'),
    ('Bob Beukenholdt', 'Operator'),
    ('John Nguyen', 'Operator'),
    ('Sue Campbell', 'Operator'),
    ('Emma Champion', 'Operator'),
    ('Colin Hayes', 'Operator'),
    ('Jack Carter', 'Operator'),
    ('Nigel Yaxley', 'Operator'),
    ('Rhett Esmeralda', 'Operator'),
    ('Sharon Buchanan', 'Operator'),
    ('Simon Henley', 'Operator'),
    ('Sharon Morrison', 'Operator'),
    ('Hayley Luscombe', 'Operator'),
    ('Jarod Carey', 'Operator'),
    ('Marney Youngman', 'Operator'),
    ('Mandy Parke', 'Operator'),
    ('Heather Shaw', 'Operator'),
    ('Alaina Little', 'Operator')
),
resolved as (
  select
    s.display_name,
    r.id as role_id
  from src s
  join public.roles r on lower(r.name) = lower(s.role_name)
)
insert into public.person_roles (person_id, role_id)
select p.id, x.role_id
from resolved x
join public.people p on p.display_name = x.display_name
where x.role_id is not null
  and not exists (
    select 1
    from public.person_roles pr
    where pr.person_id = p.id
      and pr.role_id = x.role_id
  );
