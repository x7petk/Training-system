-- Allow HC deletion only for app admins.
-- Operators/users must not be able to delete HC records.

drop policy if exists "hc_records_delete_draft_owner" on public.hc_records;
drop policy if exists "hc_records_delete_admin" on public.hc_records;
create policy "hc_records_delete_admin"
  on public.hc_records for delete to authenticated
  using (public.is_app_admin());
