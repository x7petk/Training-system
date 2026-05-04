-- One-time data adjustment: shift existing matrix target dates by 30 days, and set
-- missing due_date values to 6 months from the day this migration runs (DB current_date).
-- Bypass plan-stage lock trigger (due_date-only bulk updates for knowledge skills).
select set_config('app.bypass_plan_lock', 'on', true);

update public.person_skills
set due_date = (due_date + interval '30 days')::date
where due_date is not null;

update public.person_skills
set due_date = (current_date + interval '6 months')::date
where due_date is null;
