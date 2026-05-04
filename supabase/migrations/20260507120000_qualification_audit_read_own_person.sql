-- Let roster subjects read their own qualification audit rows (plus checklist lines).

create policy "skill_progression_events_select_own_person"
  on public.skill_progression_events for select to authenticated
  using (
    exists (
      select 1 from public.people p
      where p.id = skill_progression_events.person_id
        and p.user_id = auth.uid()
    )
  );

create policy "skill_assessment_verifications_select_own_person"
  on public.skill_assessment_verifications for select to authenticated
  using (
    exists (
      select 1 from public.people p
      where p.id = skill_assessment_verifications.person_id
        and p.user_id = auth.uid()
    )
  );

create policy "skill_assessment_progress_select_own_subject"
  on public.skill_assessment_checklist_progress for select to authenticated
  using (
    exists (
      select 1 from public.people p
      where p.id = skill_assessment_checklist_progress.subject_person_id
        and p.user_id = auth.uid()
    )
  );
