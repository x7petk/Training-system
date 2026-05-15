-- DDS actions: optional comment, extended status, keep role_name aligned with roster assignment.

alter table public.plan24_events
  add column if not exists comment text;

alter table public.plan24_events
  drop constraint if exists plan24_events_status_check;

alter table public.plan24_events
  add constraint plan24_events_status_check
  check (status in ('scheduled', 'in_progress', 'complete', 'not_required'));

-- When day/shift role assignments change, move dds_action rows to the column for that person.
create or replace function public.plan24_sync_dds_action_roles_for_shift()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  pd date;
  sk text;
begin
  rid := coalesce(new.roster_id, old.roster_id);
  pd := coalesce(new.plan_date, old.plan_date);
  sk := coalesce(new.shift_kind, old.shift_kind);
  if rid is null or pd is null or sk is null then
    return coalesce(new, old);
  end if;

  update public.plan24_events e
  set role_name = (
    select a.role_name
    from public.plan24_role_day_assignments a
    where a.roster_id = e.roster_id
      and a.plan_date = e.plan_date
      and a.shift_kind = e.shift_kind
      and a.person_id = e.assigned_person_id
    order by a.role_name
    limit 1
  )
  where e.roster_id = rid
    and e.plan_date = pd
    and e.shift_kind = sk
    and e.deleted_at is null
    and lower(coalesce(e.event_type, '')) = 'dds_action'
    and e.assigned_person_id is not null;

  return coalesce(new, old);
end;
$$;

drop trigger if exists plan24_role_day_assignments_sync_dds_roles on public.plan24_role_day_assignments;
create trigger plan24_role_day_assignments_sync_dds_roles
  after insert or update or delete on public.plan24_role_day_assignments
  for each row execute function public.plan24_sync_dds_action_roles_for_shift();
