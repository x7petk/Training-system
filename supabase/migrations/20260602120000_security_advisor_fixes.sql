-- Security Advisor: fix ERROR-level views, search_path warnings, RPC exposure, storage listing.

-- ---------------------------------------------------------------------------
-- 0010: Security definer views → security invoker (RLS applies as caller)
-- ---------------------------------------------------------------------------
alter view public.v_person_plan_stage_progress set (security_invoker = true);
alter view public.v_person_plan_stage_knowledges set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- 0011: Pin search_path on trigger/helper functions flagged by the linter
-- ---------------------------------------------------------------------------
do $$
declare
  fn_names text[] := array[
    'master_data_touch_updated_at',
    'ppo_records_enforce_one_submit_per_day',
    'plan24_check_schedule_matches_day',
    'hc_touch_updated_at',
    'hc_types_set_name_from_activity',
    'ldr_activities_propagate_name_to_hc_types',
    'obs_system_activity_links_validate_workspace',
    'road_maps_touch_updated_at',
    'dds_trigger_questions_touch_updated_at',
    'kpi_cascade_workspaces_touch_updated_at',
    'swp_workspaces_touch_updated_at',
    'hc_records_enforce_one_submit_per_day',
    'compute_stage_target_date',
    'enforce_plan_skill_group_on_write_trg',
    'obs_touch_updated_at',
    'sos_types_set_name_from_activity',
    'qos_types_set_name_from_activity',
    'ppo_types_set_name_from_activity',
    'ldr_activities_propagate_name_to_sos_types',
    'ldr_activities_propagate_name_to_qos_types',
    'ldr_activities_propagate_name_to_ppo_types',
    'sos_records_enforce_one_submit_per_day',
    'qos_records_enforce_one_submit_per_day',
    'set_profiles_updated_at'
  ];
  fn_name text;
  r record;
begin
  foreach fn_name in array fn_names loop
    for r in
      select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = fn_name
    loop
      execute format('alter function %s set search_path = public', r.sig);
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 0025: Public bucket — drop broad SELECT (listing); public URLs still work
-- ---------------------------------------------------------------------------
drop policy if exists "cil_task_photos_select_auth" on storage.objects;

-- ---------------------------------------------------------------------------
-- 0028/0029: Revoke RPC execute from PUBLIC/anon; keep only intentional RPCs
-- ---------------------------------------------------------------------------
do $$
declare
  rpc_flagged text[] := array[
    'app_user_can_access_agents',
    'app_user_can_access_dds',
    'app_user_can_access_rtt',
    'assign_plan_on_role_link',
    'can_access_ldr_tools',
    'cleanup_orphan_plan_knowledge_person_skills',
    'dds_p2p_audit_answers_enforce_scope',
    'dds_p2p_audits_enforce_roster_cell',
    'dds_p2p_qr_assignments_enforce_scope',
    'dds_trigger_answers_enforce_scope',
    'enforce_non_plan_knowledge_trg',
    'enforce_plan_knowledge_rules_trg',
    'ensure_default_skill_assessment_checklist',
    'ensure_default_stage_for_plan_skill_trg',
    'ensure_person_plan_stage_rows',
    'handle_new_user',
    'hc_records_sync_assignment_rag',
    'is_app_admin',
    'is_app_assessor',
    'is_app_super_admin',
    'ldr_ensure_workspace_cell',
    'ldr_ensure_workspace_site',
    'ldr_touch_audit',
    'log_person_skill_level_progression',
    'person_roles_plan_assign_trg',
    'plan24_materialize_check_schedules',
    'plan24_materialize_cil_check_schedules',
    'plan24_materialize_cl_check_schedules',
    'plan24_materialize_quality_check_schedules',
    'plan24_publish_cil_check_template_version',
    'plan24_publish_cl_check_template_version',
    'plan24_publish_quality_check_template_version',
    'plan24_publish_template_version',
    'plan24_reset_cil_check_schedule_future_events',
    'plan24_reset_cl_check_schedule_future_events',
    'plan24_reset_quality_check_schedule_future_events',
    'plan24_reset_schedule_future_events',
    'plan24_sync_dds_action_roles_for_shift',
    'ppo_records_sync_assignment_rag',
    'profiles_prevent_role_escalation',
    'profiles_protect_section_access',
    'qos_records_sync_assignment_rag',
    'rebuild_on_knowledge_change_trg',
    'rebuild_on_stage_change_trg',
    'rebuild_person_plan_after_config_change',
    'recompute_person_plan_progress',
    'recompute_plan_on_person_skill_change_trg',
    'recompute_targets_on_stage_duration_change_trg',
    'role_skill_requirements_plan_sync_trg',
    'seed_unlocked_stage_knowledges',
    'skill_assessment_checklist_numeric_only',
    'skill_assessment_settings_touch',
    'skills_default_assessment_checklist_trg',
    'sos_records_sync_assignment_rag',
    'sync_person_plan_enrollment',
    'training_pack_numeric_only',
    'training_standards_touch_updated_at'
  ];
  fn_name text;
  r record;
begin
  foreach fn_name in array rpc_flagged loop
    for r in
      select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = fn_name
    loop
      execute format('revoke all on function %s from public', r.sig);
      execute format('revoke all on function %s from anon', r.sig);
      execute format('revoke all on function %s from authenticated', r.sig);
    end loop;
  end loop;
end;
$$;

-- RLS helpers (needed in policies; not exposed as client RPC)
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.is_app_assessor() to authenticated;
grant execute on function public.is_app_super_admin() to authenticated;
grant execute on function public.app_user_can_access_agents() to authenticated;
grant execute on function public.app_user_can_access_dds() to authenticated;
grant execute on function public.app_user_can_access_rtt() to authenticated;
grant execute on function public.can_access_ldr_tools() to authenticated;

-- Intentional authenticated RPCs used by the app
grant execute on function public.ldr_ensure_workspace_site(uuid) to authenticated;
grant execute on function public.ldr_ensure_workspace_cell(uuid) to authenticated;
grant execute on function public.plan24_materialize_check_schedules(uuid, date, date) to authenticated;
grant execute on function public.plan24_materialize_cl_check_schedules(uuid, date, date) to authenticated;
grant execute on function public.plan24_materialize_cil_check_schedules(uuid, date, date) to authenticated;
grant execute on function public.plan24_materialize_quality_check_schedules(uuid, date, date) to authenticated;
grant execute on function public.plan24_publish_template_version(uuid) to authenticated;
grant execute on function public.plan24_publish_cl_check_template_version(uuid) to authenticated;
grant execute on function public.plan24_publish_cil_check_template_version(uuid) to authenticated;
grant execute on function public.plan24_publish_quality_check_template_version(uuid) to authenticated;
grant execute on function public.plan24_reset_schedule_future_events(uuid, date) to authenticated;
grant execute on function public.plan24_reset_cl_check_schedule_future_events(uuid, date) to authenticated;
grant execute on function public.plan24_reset_cil_check_schedule_future_events(uuid, date) to authenticated;
grant execute on function public.plan24_reset_quality_check_schedule_future_events(uuid, date) to authenticated;
grant execute on function public.ensure_default_skill_assessment_checklist(uuid) to authenticated;
