-- Skill assessment: per numeric skill instructions + assessor checklist; per-user checklist progress.

create table if not exists public.skill_assessment_settings (
  skill_id uuid primary key references public.skills on delete cascade,
  assessment_instructions text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create table if not exists public.skill_assessment_checklist_items (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills on delete cascade,
  item_text text not null,
  sort_order smallint not null check (sort_order >= 1 and sort_order <= 50),
  created_at timestamptz not null default now(),
  unique (skill_id, sort_order)
);

create index if not exists skill_assessment_checklist_items_skill_id_idx
  on public.skill_assessment_checklist_items (skill_id, sort_order);

create table if not exists public.skill_assessment_checklist_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.skill_assessment_checklist_items (id) on delete cascade,
  checked_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index if not exists skill_assessment_checklist_progress_user_idx
  on public.skill_assessment_checklist_progress (user_id);

comment on table public.skill_assessment_settings is 'Admin-configured assessment instructions text per numeric skill.';
comment on table public.skill_assessment_checklist_items is 'Ordered checklist lines for assessors; admin-managed.';
comment on table public.skill_assessment_checklist_progress is 'Which checklist rows an assessor has checked (persisted).';

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
  if k <> 'numeric' then
    raise exception 'Skill assessment is allowed only for numeric skills';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists skill_assessment_settings_numeric_trg on public.skill_assessment_settings;
create trigger skill_assessment_settings_numeric_trg
  before insert or update on public.skill_assessment_settings
  for each row
  execute function public.skill_assessment_settings_touch();

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
  if k <> 'numeric' then
    raise exception 'Skill assessment checklist is allowed only for numeric skills';
  end if;
  return new;
end;
$$;

drop trigger if exists skill_assessment_checklist_numeric_trg on public.skill_assessment_checklist_items;
create trigger skill_assessment_checklist_numeric_trg
  before insert or update on public.skill_assessment_checklist_items
  for each row
  execute function public.skill_assessment_checklist_numeric_only();

grant select, insert, update, delete on public.skill_assessment_settings to authenticated;
grant select, insert, update, delete on public.skill_assessment_checklist_items to authenticated;
grant select, insert, delete on public.skill_assessment_checklist_progress to authenticated;

alter table public.skill_assessment_settings enable row level security;
alter table public.skill_assessment_checklist_items enable row level security;
alter table public.skill_assessment_checklist_progress enable row level security;

create policy "skill_assessment_settings_select_auth"
  on public.skill_assessment_settings for select to authenticated using (true);

create policy "skill_assessment_settings_write_admin"
  on public.skill_assessment_settings for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "skill_assessment_checklist_items_select_auth"
  on public.skill_assessment_checklist_items for select to authenticated using (true);

create policy "skill_assessment_checklist_items_write_admin"
  on public.skill_assessment_checklist_items for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "skill_assessment_progress_select_own"
  on public.skill_assessment_checklist_progress for select to authenticated
  using (user_id = auth.uid());

create policy "skill_assessment_progress_insert_own"
  on public.skill_assessment_checklist_progress for insert to authenticated
  with check (user_id = auth.uid());

create policy "skill_assessment_progress_delete_own"
  on public.skill_assessment_checklist_progress for delete to authenticated
  using (user_id = auth.uid());
