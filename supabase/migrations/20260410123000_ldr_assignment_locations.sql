alter table public.ldr_assignments
  add column if not exists ldr_location_id uuid null references public.ldr_locations(id) on delete set null;

update public.ldr_assignments a
set ldr_location_id = p.location_id
from public.ldr_people p
where a.ldr_person_id = p.id
  and a.ldr_location_id is null
  and p.location_id is not null;
