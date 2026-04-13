-- Allow saving draft SOS with a chosen sos_level before submit (scores/status still null until submit).

alter table public.sos_records drop constraint if exists sos_records_submit_consistency_ck;

alter table public.sos_records
  add constraint sos_records_submit_consistency_ck check (
    (completed_at is null and status is null and score is null and template_version_snapshot is null)
    or
    (completed_at is not null and status is not null and score is not null and template_version_snapshot is not null and sos_level is not null)
  );

drop policy if exists "sos_records_insert_ldr" on public.sos_records;
create policy "sos_records_insert_ldr" on public.sos_records for insert to authenticated with check (
  public.can_access_ldr_tools() and completed_by_user_id = auth.uid() and completed_at is null and status is null and score is null and template_version_snapshot is null
);

drop policy if exists "sos_records_update_draft_owner" on public.sos_records;
create policy "sos_records_update_draft_owner" on public.sos_records for update to authenticated using (
  public.can_access_ldr_tools() and completed_by_user_id = auth.uid() and completed_at is null
) with check (
  public.can_access_ldr_tools() and completed_by_user_id = auth.uid()
  and ((completed_at is null and status is null and score is null and template_version_snapshot is null)
    or (completed_at is not null and status is not null and score is not null and template_version_snapshot is not null and sos_level is not null))
);
