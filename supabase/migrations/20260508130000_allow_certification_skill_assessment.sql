-- Allow skill assessment settings/checklists for certification skills as well.
-- Keeps plan skills excluded.

create or replace function public.skill_assessment_settings_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.skill_kind;
begin
  select s.kind into k from public.skills s where s.id = new.skill_id;
  if k is null then
    raise exception 'Skill not found for skill assessment settings';
  end if;
  if k not in ('numeric', 'certification') then
    raise exception 'Skill assessment is allowed only for numeric or certification skills';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.skill_assessment_checklist_numeric_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.skill_kind;
begin
  select s.kind into k from public.skills s where s.id = new.skill_id;
  if k is null then
    raise exception 'Skill not found for skill assessment checklist';
  end if;
  if k not in ('numeric', 'certification') then
    raise exception 'Skill assessment checklist is allowed only for numeric or certification skills';
  end if;
  return new;
end;
$$;

comment on table public.skill_assessment_settings is
  'Admin-configured assessment instructions text per numeric/certification skill.';
