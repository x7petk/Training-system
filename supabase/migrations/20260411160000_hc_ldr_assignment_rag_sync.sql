-- Optional link from HC to roster assignment; on first submit, mirror HC RAG onto ldr_assignments.
-- HC uses amber; LDR roster uses yellow for the same band.

alter table public.hc_records
  add column if not exists ldr_assignment_id uuid null references public.ldr_assignments (id) on delete set null;

create index if not exists hc_records_ldr_assignment_id_idx
  on public.hc_records (ldr_assignment_id)
  where ldr_assignment_id is not null;

create or replace function public.hc_records_sync_assignment_rag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ldr_rag public.ldr_rag_status;
  v_ok boolean;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if old.completed_at is not null then
    return new;
  end if;
  if new.completed_at is null or new.ldr_assignment_id is null or new.status is null then
    return new;
  end if;

  case new.status::text
    when 'green' then v_ldr_rag := 'green';
    when 'amber' then v_ldr_rag := 'yellow';
    when 'red' then v_ldr_rag := 'red';
    else return new;
  end case;

  select exists (
    select 1
    from public.ldr_assignments a
    inner join public.hc_types t on t.id = new.hc_type_id and a.activity_id = t.ldr_activity_id
    where a.id = new.ldr_assignment_id
      and a.assignment_date = ((new.completed_at at time zone 'utc')::date)
  )
  into v_ok;

  if not v_ok then
    return new;
  end if;

  update public.ldr_assignments
  set rag_status = v_ldr_rag
  where id = new.ldr_assignment_id;

  return new;
end;
$$;

drop trigger if exists hc_records_sync_assignment_rag_trg on public.hc_records;
create trigger hc_records_sync_assignment_rag_trg
  after update on public.hc_records
  for each row
  execute function public.hc_records_sync_assignment_rag();
