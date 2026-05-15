-- P2P summary matrix: allow any DDS user to read audits/answers (insert remains own-only).

drop policy if exists "dds_p2p_audits_select_dds" on public.dds_p2p_audits;

create policy "dds_p2p_audits_select_dds"
  on public.dds_p2p_audits for select to authenticated
  using (public.app_user_can_access_dds());

drop policy if exists "dds_p2p_audit_answers_select_dds" on public.dds_p2p_audit_answers;

create policy "dds_p2p_audit_answers_select_dds"
  on public.dds_p2p_audit_answers for select to authenticated
  using (
    exists (
      select 1
      from public.dds_p2p_audits a
      where a.id = audit_id
        and public.app_user_can_access_dds()
    )
  );

notify pgrst, 'reload schema';
