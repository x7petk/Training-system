-- At most one submitted HC per (completer, type, cell, UTC calendar day).
-- Drafts (completed_at is null) are not counted.

create or replace function public.hc_records_enforce_one_submit_per_day()
returns trigger
language plpgsql
as $$
begin
  if new.completed_at is null then
    return new;
  end if;

  if exists (
    select 1
    from public.hc_records r
    where r.id is distinct from new.id
      and r.completed_at is not null
      and r.completed_by_user_id = new.completed_by_user_id
      and r.hc_type_id = new.hc_type_id
      and r.master_cell_id = new.master_cell_id
      and ((r.completed_at at time zone 'utc')::date) = ((new.completed_at at time zone 'utc')::date)
  ) then
    raise exception 'hc_duplicate_submit: %'
      , 'You already completed this health check for this cell and type today.';
  end if;

  return new;
end;
$$;

drop trigger if exists hc_records_enforce_one_submit_per_day_trg on public.hc_records;
create trigger hc_records_enforce_one_submit_per_day_trg
  before insert or update on public.hc_records
  for each row
  execute function public.hc_records_enforce_one_submit_per_day();
