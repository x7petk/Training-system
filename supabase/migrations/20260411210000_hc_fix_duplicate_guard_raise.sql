-- Fix PL/pgSQL: RAISE EXCEPTION 'text' USING message = '...' duplicates MESSAGE (parse error at runtime).

create or replace function public.hc_records_enforce_one_submit_per_day()
returns trigger
language plpgsql
as $$
declare
  v_new_day date;
begin
  if new.completed_at is null then
    return new;
  end if;

  if new.ldr_assignment_id is not null then
    select a.assignment_date into v_new_day
    from public.ldr_assignments a
    where a.id = new.ldr_assignment_id;
  end if;

  v_new_day := coalesce(v_new_day, (new.completed_at at time zone 'utc')::date);

  if exists (
    select 1
    from public.hc_records r
    left join public.ldr_assignments ra on ra.id = r.ldr_assignment_id
    where r.id is distinct from new.id
      and r.completed_at is not null
      and r.completed_by_user_id = new.completed_by_user_id
      and r.hc_type_id = new.hc_type_id
      and r.master_cell_id = new.master_cell_id
      and coalesce(ra.assignment_date, (r.completed_at at time zone 'utc')::date) = v_new_day
  ) then
    raise exception 'hc_duplicate_submit: %'
      , 'You already completed this health check for this cell and type on this scheduled day.';
  end if;

  return new;
end;
$$;
