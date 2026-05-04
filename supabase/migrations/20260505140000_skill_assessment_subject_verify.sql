-- Scope assessor checklist to the person being assessed; audit who checked each line.
-- Record formal L2→3 verification events (separate from skill_progression_events trigger).

drop table if exists public.skill_assessment_checklist_progress cascade;

create table public.skill_assessment_checklist_progress (
  subject_person_id uuid not null references public.people (id) on delete cascade,
  item_id uuid not null references public.skill_assessment_checklist_items (id) on delete cascade,
  checked_by uuid not null references public.profiles (id) on delete cascade,
  checked_at timestamptz not null default now(),
  primary key (subject_person_id, item_id)
);

create index skill_assessment_checklist_progress_subject_idx
  on public.skill_assessment_checklist_progress (subject_person_id);

comment on table public.skill_assessment_checklist_progress is
  'Per subject on the roster: one row per checklist item — who ticked it and when.';

create table public.skill_assessment_verifications (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  verified_by uuid not null references public.profiles (id) on delete restrict,
  verified_at timestamptz not null default now()
);

create index skill_assessment_verifications_person_skill_idx
  on public.skill_assessment_verifications (person_id, skill_id, verified_at desc);

comment on table public.skill_assessment_verifications is
  'Assessor confirmed checklist and promoted numeric skill 2→3; complements skill_progression_events.';

grant select, insert, update, delete on public.skill_assessment_checklist_progress to authenticated;
grant select, insert on public.skill_assessment_verifications to authenticated;

alter table public.skill_assessment_checklist_progress enable row level security;
alter table public.skill_assessment_verifications enable row level security;

create policy "skill_assessment_progress_select_staff"
  on public.skill_assessment_checklist_progress for select to authenticated
  using (
    public.is_app_admin()
    or public.is_app_assessor()
    or checked_by = auth.uid()
  );

create policy "skill_assessment_progress_insert_staff"
  on public.skill_assessment_checklist_progress for insert to authenticated
  with check (
    checked_by = auth.uid()
    and (public.is_app_admin() or public.is_app_assessor())
  );

create policy "skill_assessment_progress_update_staff"
  on public.skill_assessment_checklist_progress for update to authenticated
  using (public.is_app_admin() or public.is_app_assessor())
  with check (checked_by = auth.uid());

create policy "skill_assessment_progress_delete_staff"
  on public.skill_assessment_checklist_progress for delete to authenticated
  using (
    public.is_app_admin()
    or (
      public.is_app_assessor()
      and checked_by = auth.uid()
    )
  );

create policy "skill_assessment_verifications_select_staff"
  on public.skill_assessment_verifications for select to authenticated
  using (public.is_app_admin() or public.is_app_assessor());

create policy "skill_assessment_verifications_insert_staff"
  on public.skill_assessment_verifications for insert to authenticated
  with check (
    verified_by = auth.uid()
    and (public.is_app_admin() or public.is_app_assessor())
  );
