-- Ensure a job role named "Packing" exists and link every person to it (idempotent).

insert into public.roles (name, sort_order)
select 'Packing', coalesce((select max(sort_order) + 1 from public.roles), 1)
where not exists (select 1 from public.roles r where lower(trim(r.name)) = 'packing');

insert into public.person_roles (person_id, role_id)
select p.id, r.id
from public.people p
cross join public.roles r
where lower(trim(r.name)) = 'packing'
on conflict (person_id, role_id) do nothing;
