-- Assessors need to read other users' profile rows (e.g. display_name) for Report joins
-- on skill_progression_events.assessed_by → profiles.

create policy "profiles_select_assessor_all"
  on public.profiles
  for select
  to authenticated
  using (public.is_app_assessor());
