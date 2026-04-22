alter table public.dh_defects
  add column if not exists area text,
  add column if not exists equipment text;

create index if not exists dh_defects_area_idx on public.dh_defects (area);
create index if not exists dh_defects_equipment_idx on public.dh_defects (equipment);
