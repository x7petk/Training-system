-- HC types must map 1:1 to an LDR activity (same workspace). Name stays in sync with activity name.

alter table public.hc_types
  add column if not exists ldr_activity_id uuid references public.ldr_activities (id) on delete restrict;

create unique index if not exists hc_types_one_per_ldr_activity
  on public.hc_types (ldr_activity_id)
  where ldr_activity_id is not null;

-- Remove demo seed rows (standalone type not tied to an activity)
delete from public.hc_answers
where hc_record_id in (
  select id from public.hc_records where hc_type_id = 'c2000001-0000-4000-8000-000000000001'
);
delete from public.hc_records where hc_type_id = 'c2000001-0000-4000-8000-000000000001';
delete from public.hc_template_questions where template_id = 'c2000002-0000-4000-8000-000000000001';
delete from public.hc_templates where id = 'c2000002-0000-4000-8000-000000000001';
delete from public.hc_types where id = 'c2000001-0000-4000-8000-000000000001';

-- Keep hc_types.name aligned with ldr_activities.name
create or replace function public.hc_types_set_name_from_activity()
returns trigger
language plpgsql
as $$
begin
  if new.ldr_activity_id is not null then
    select a.name into strict new.name from public.ldr_activities a where a.id = new.ldr_activity_id;
  end if;
  return new;
end;
$$;

drop trigger if exists hc_types_set_name_from_activity_trg on public.hc_types;
create trigger hc_types_set_name_from_activity_trg
  before insert or update on public.hc_types
  for each row
  execute function public.hc_types_set_name_from_activity();

create or replace function public.ldr_activities_propagate_name_to_hc_types()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'update' and new.name is distinct from old.name then
    update public.hc_types set name = new.name, updated_at = now() where ldr_activity_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists ldr_activities_name_to_hc_types_trg on public.ldr_activities;
create trigger ldr_activities_name_to_hc_types_trg
  after update of name on public.ldr_activities
  for each row
  execute function public.ldr_activities_propagate_name_to_hc_types();

-- Require activity link when table has no legacy null rows (fresh or fully migrated)
do $m$
declare
  n int;
  nnull int;
begin
  select count(*) into n from public.hc_types;
  select count(*) into nnull from public.hc_types where ldr_activity_id is null;
  if n = 0 or nnull = 0 then
    alter table public.hc_types alter column ldr_activity_id set not null;
  end if;
end $m$;
