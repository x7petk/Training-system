-- WDS Health check line: read submitted health checks for the scoped cell (same data as LDR HC report).

drop policy if exists "hc_records_select_dds" on public.hc_records;

create policy "hc_records_select_dds"
  on public.hc_records for select to authenticated
  using (
    public.app_user_can_access_dds()
    and completed_at is not null
    and score is not null
  );

notify pgrst, 'reload schema';
