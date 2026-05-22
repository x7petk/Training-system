-- WDS HC zoom: read fail answers (and comments) on submitted checks visible to DDS.

drop policy if exists "hc_answers_select_dds" on public.hc_answers;

create policy "hc_answers_select_dds"
  on public.hc_answers for select to authenticated
  using (
    answer = 'fail'
    and exists (
      select 1
      from public.hc_records r
      where r.id = hc_answers.hc_record_id
        and public.app_user_can_access_dds()
        and r.completed_at is not null
        and r.score is not null
    )
  );

notify pgrst, 'reload schema';
