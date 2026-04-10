-- Keep roster feedback text simple: comments only, one comment per line.
-- No prefixes/metadata in ldr_assignments.comment from HC submit sync.

create or replace function public.hc_records_sync_assignment_rag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ldr_rag public.ldr_rag_status;
  v_ok boolean;
  v_answer_feedback text;
  v_feedback text;
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
  )
  into v_ok;

  if not v_ok then
    return new;
  end if;

  select string_agg(btrim(answer.comment), E'\n' order by answer.sort_order, answer.id)
  into v_answer_feedback
  from public.hc_answers answer
  where answer.hc_record_id = new.id
    and btrim(answer.comment) <> '';

  v_feedback := concat_ws(
    E'\n',
    case when btrim(coalesce(new.overall_comment, '')) <> '' then btrim(new.overall_comment) else null end,
    case when btrim(coalesce(v_answer_feedback, '')) <> '' then btrim(v_answer_feedback) else null end
  );

  update public.ldr_assignments
  set
    rag_status = v_ldr_rag,
    comment = case
      when btrim(coalesce(v_feedback, '')) = '' then comment
      when btrim(coalesce(comment, '')) = '' then v_feedback
      else concat_ws(E'\n', btrim(comment), v_feedback)
    end
  where id = new.ldr_assignment_id;

  return new;
end;
$$;
