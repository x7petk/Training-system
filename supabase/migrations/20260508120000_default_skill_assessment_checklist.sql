-- Default assessor checklist line when none exists (L2→3 path).

insert into public.skill_assessment_checklist_items (skill_id, item_text, sort_order)
select s.id, 'The person passed qualification.', 1
from public.skills s
where s.kind = 'numeric'
  and not exists (
    select 1 from public.skill_assessment_checklist_items i where i.skill_id = s.id
  );

create or replace function public.ensure_default_skill_assessment_checklist(p_skill_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.skill_kind;
  n int;
begin
  if not (public.is_app_admin() or public.is_app_assessor()) then
    raise exception 'Only admins and assessors can ensure default checklist';
  end if;

  select s.kind into k from public.skills s where s.id = p_skill_id;
  if k is null or k <> 'numeric' then
    return;
  end if;

  select count(*)::int into n from public.skill_assessment_checklist_items where skill_id = p_skill_id;
  if n > 0 then
    return;
  end if;

  insert into public.skill_assessment_checklist_items (skill_id, item_text, sort_order)
  values (p_skill_id, 'The person passed qualification.', 1);
end;
$$;

comment on function public.ensure_default_skill_assessment_checklist(uuid) is
  'If a numeric skill has no assessor checklist rows, insert the default single line (assessor/admin only).';

grant execute on function public.ensure_default_skill_assessment_checklist(uuid) to authenticated;

create or replace function public.skills_default_assessment_checklist_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'numeric' and not exists (
    select 1 from public.skill_assessment_checklist_items i where i.skill_id = new.id
  ) then
    insert into public.skill_assessment_checklist_items (skill_id, item_text, sort_order)
    values (new.id, 'The person passed qualification.', 1);
  end if;
  return new;
end;
$$;

drop trigger if exists skills_default_assessment_checklist_after_ins on public.skills;
create trigger skills_default_assessment_checklist_after_ins
  after insert on public.skills
  for each row
  execute function public.skills_default_assessment_checklist_trg();

notify pgrst, 'reload schema';
