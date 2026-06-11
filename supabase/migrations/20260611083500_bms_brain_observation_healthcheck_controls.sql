-- BMS Brain: OS, HC, CC, IC, 90 Day, and Sick system standards.
-- Adds standard roles requested by the business and publishes one process per system.

begin;

insert into public.bms_brain_roles (slug, name, description, color, icon, sort_order) values
  ('operator', 'Operator', 'Front-line team member executing standard work on the line.', '#64748b', 'user', 1),
  ('team-lead', 'Team Lead', 'First-line leadership supervising operators, shift forums, and team execution.', '#475569', 'user-cog', 2),
  ('cell', 'Cell Lead', 'Cell-level leadership coordinating line review, escalation and closure.', '#6366f1', 'users', 3),
  ('plant', 'Plant', 'Plant leadership reviewing performance and enabling resources.', '#8b5cf6', 'factory', 4),
  ('site', 'Site', 'Site leadership aligning forums and cross-plant priorities.', '#a855f7', 'building-2', 5),
  ('support', 'Support', 'Support functions enabling line performance, standards and specialist input.', '#0ea5e9', 'life-buoy', 6),
  ('maintenance', 'Maintenance', 'Maintenance and reliability support for equipment and standards.', '#f59e0b', 'wrench', 7),
  ('action-owner', 'Action Owner', 'Named owner accountable for completing assigned actions and updates.', '#16a34a', 'check-circle-2', 8)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  color = excluded.color,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into public.bms_brain_forums (slug, name, description, color, icon, sort_order) values
  ('ips-review', 'IPS Review', 'Integrated production system review and structured problem-solving checkpoint.', '#7c3aed', 'shield-check', 8)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  color = excluded.color,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into public.bms_brain_systems (slug, name, description, integrations, color, icon, sort_order) values
  ('os', 'OS', 'Observation System — capture safety, quality, process, behavioural and standard-work observations.', 'Shift DDS, Line DDS, IPS, WDS, PDCA', '#0891b2', 'eye', 12),
  ('hc', 'HC', 'Health Checks — confirm standards, routines, controls and system behaviours are followed.', 'Plan 24, Shift DDS, Line DDS, Site DDS, IPS, WDS, PDCA', '#16a34a', 'clipboard-check', 13),
  ('cc', 'CC', 'Composition Control — monitor composition against target and escalate quality or process risks.', 'Quality, Shift DDS, Line DDS, IPS, WDS, PDCA', '#0f766e', 'flask-conical', 14),
  ('ic', 'IC', 'Interventions Control — manage planned or unplanned interventions into equipment, process or product flow.', 'Shift DDS, Line DDS, MP&S, IPS, WDS, PDCA', '#ea580c', 'settings-2', 15),
  ('90-day', '90 Day', '90 Day Action Plan — manage priority site, plant or line improvement actions over a 90-day horizon.', 'PDCA, WDS, Line DDS, Shift DDS, IPS, BDE', '#2563eb', 'calendar-clock', 16),
  ('sick', 'Sick', 'On-call and sick leave management — manage absence notifications, coverage and escalation.', 'Shift DDS, Line DDS, Site DDS, WDS, PDCA', '#be123c', 'heart-pulse', 17)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  integrations = excluded.integrations,
  color = excluded.color,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

create or replace function public.bms_brain_seed_additional_system_standards()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  proc record;
  next_ver int;
begin
  create temp table if not exists pg_temp.bms_seed_processes (
    process_id uuid primary key,
    process_key text not null unique,
    process_name text not null,
    description text not null,
    owner_role_slug text not null,
    catalog_system_slug text not null
  ) on commit drop;

  create temp table if not exists pg_temp.bms_seed_nodes (
    process_key text not null,
    sort_order int not null,
    node_id text not null,
    kind text not null,
    label text not null,
    description text not null default '',
    role_slug text not null,
    forum_slug text not null,
    system_slugs text[] not null,
    owner text,
    inputs text,
    outputs text,
    x int not null,
    y int not null,
    primary key (process_key, node_id)
  ) on commit drop;

  create temp table if not exists pg_temp.bms_seed_edges (
    process_key text not null,
    edge_id text not null,
    source_id text not null,
    target_id text not null,
    label text,
    primary key (process_key, edge_id)
  ) on commit drop;

  truncate table pg_temp.bms_seed_processes;
  truncate table pg_temp.bms_seed_nodes;
  truncate table pg_temp.bms_seed_edges;

  insert into pg_temp.bms_seed_processes values
    ('a1000004-0001-4000-8000-000000000001', 'os', 'OS — Observation System', 'Capture observations, assign actions, verify closure, and escalate repeated or high-risk findings.', 'team-lead', 'os'),
    ('a1000004-0001-4000-8000-000000000002', 'hc', 'HC — Health Checks', 'Confirm standards and controls are followed, then create and escalate actions for failed checks.', 'team-lead', 'hc'),
    ('a1000004-0001-4000-8000-000000000003', 'cc', 'CC — Composition Control', 'Monitor product or process composition against target and escalate quality or process risks.', 'plant', 'cc'),
    ('a1000004-0001-4000-8000-000000000004', 'ic', 'IC — Interventions Control', 'Approve, risk assess, execute, record and review process or equipment interventions.', 'team-lead', 'ic'),
    ('a1000004-0001-4000-8000-000000000005', '90-day', '90 Day — Action Plan', 'Manage priority improvement actions over a 90-day horizon with owners, status and escalation.', 'plant', '90-day'),
    ('a1000004-0001-4000-8000-000000000006', 'sick', 'Sick — On-call and Sick Leave Management', 'Manage absence notifications, shift coverage, on-call escalation and operational continuity.', 'team-lead', 'sick');

  insert into pg_temp.bms_seed_nodes values
    -- OS — Observation System
    ('os', 10, 'os-1', 'start', 'Observation required or identified', 'Trigger to capture a safety, quality, process, behavioural or standard-work observation.', 'operator', 'swp', array['os'], 'Operator', null, 'Observation identified', 40, 40),
    ('os', 20, 'os-2', 'process', 'Record observation', 'Capture observation type, location, description, photo, risk level and comments.', 'operator', 'swp', array['os'], 'Operator', 'Observation details', 'Observation record created', 40, 150),
    ('os', 30, 'os-3', 'review', 'Review observation quality', 'Review the observation for completeness, quality and risk clarity.', 'team-lead', 'shift-dds', array['os'], 'Team Lead', 'Observation record', 'Observation accepted or corrected', 40, 260),
    ('os', 40, 'os-4', 'decision', 'Is action required?', 'Decide whether the observation requires a tracked action.', 'team-lead', 'shift-dds', array['os'], 'Team Lead', null, null, 40, 370),
    ('os', 50, 'os-5n', 'end', 'Provide feedback and close observation', 'No action required: provide feedback and close the observation.', 'team-lead', 'shift-dds', array['os'], 'Team Lead', null, 'Observation closed', 40, 500),
    ('os', 60, 'os-5y', 'process', 'Assign action owner and due date', 'Create action with owner, due date and expected closure outcome.', 'team-lead', 'shift-dds', array['os'], 'Team Lead', 'Accepted observation', 'Action assigned', 280, 370),
    ('os', 70, 'os-6', 'process', 'Complete assigned action', 'Action owner completes the assigned corrective or improvement action.', 'action-owner', 'swp', array['os'], 'Action Owner', 'Assigned action', 'Action completed', 280, 500),
    ('os', 80, 'os-7', 'review', 'Verify action completion', 'Verify that the action was completed as expected.', 'team-lead', 'shift-dds', array['os'], 'Team Lead', 'Completed action', 'Verification result', 280, 620),
    ('os', 90, 'os-8', 'decision', 'Was the action effective?', 'Confirm whether the action addressed the observation.', 'team-lead', 'shift-dds', array['os'], 'Team Lead', null, null, 280, 740),
    ('os', 100, 'os-9y', 'end', 'Close observation', 'Effective action: close the observation.', 'team-lead', 'shift-dds', array['os'], 'Team Lead', null, 'Observation closed', 280, 870),
    ('os', 110, 'os-9n', 'process', 'Reassign action or escalate', 'Ineffective action: reassign, adjust scope or escalate to line review.', 'cell', 'line-dds', array['os'], 'Cell Lead', 'Failed verification', 'Escalated or reassigned action', 520, 740),
    ('os', 120, 'os-10', 'decision', 'Is the issue recurring, high risk or overdue?', 'Plant determines if the issue needs structured problem solving.', 'plant', 'line-dds', array['os','ips'], 'Plant', null, null, 520, 870),
    ('os', 130, 'os-11y', 'subprocess', 'Create linked IPS', 'Open linked IPS for recurring, high-risk or overdue observation themes.', 'plant', 'ips-review', array['os','ips'], 'Plant', 'Escalated observation', 'Linked IPS created', 760, 760),
    ('os', 140, 'os-11n', 'review', 'Monitor to closure', 'Monitor the reassigned action through Line DDS until closed.', 'cell', 'line-dds', array['os'], 'Cell Lead', 'Reassigned action', 'Action monitored to closure', 520, 1000),
    ('os', 150, 'os-12', 'review', 'Review observation completion and action closure', 'Periodic review of observation completion and open action closure.', 'plant', 'wds', array['os'], 'Plant', 'Observation dashboard', 'WDS actions updated', 40, 1020),
    ('os', 160, 'os-13', 'review', 'Review trends, repeat themes and system losses', 'Site reviews repeat observation themes and system losses.', 'site', 'pdca', array['os','ips'], 'Site', 'Trend data, IPS links', 'System priorities updated', 40, 1140),

    -- HC — Health Checks
    ('hc', 10, 'hc-1', 'start', 'Health check becomes due', 'Trigger: daily, weekly, monthly or ad hoc health check schedule.', 'operator', 'swp', array['hc'], 'Operator', 'Health check schedule', 'Check due', 40, 40),
    ('hc', 20, 'hc-2', 'process', 'Complete health check', 'Capture responses, evidence, comments and completion time.', 'operator', 'swp', array['hc'], 'Operator', 'Health check standard', 'Health check submitted', 40, 150),
    ('hc', 30, 'hc-3', 'review', 'Review missed or failed health checks', 'Review missed checks and failures during Shift DDS.', 'team-lead', 'shift-dds', array['hc'], 'Team Lead', 'Health check results', 'Failures reviewed', 40, 260),
    ('hc', 40, 'hc-4', 'decision', 'Did the health check pass?', 'Determine whether the check was compliant.', 'team-lead', 'shift-dds', array['hc'], 'Team Lead', null, null, 40, 370),
    ('hc', 50, 'hc-5y', 'end', 'Record compliant result', 'Pass: record compliant result and close the check.', 'team-lead', 'shift-dds', array['hc'], 'Team Lead', null, 'Compliant result recorded', 40, 500),
    ('hc', 60, 'hc-5n', 'process', 'Create health check failure action', 'Create failure action for non-compliant health check.', 'team-lead', 'shift-dds', array['hc'], 'Team Lead', 'Failed check', 'Failure action created', 280, 370),
    ('hc', 70, 'hc-6', 'decision', 'Is the failure safety, quality or compliance critical?', 'Decide whether the failure needs critical escalation.', 'team-lead', 'shift-dds', array['hc'], 'Team Lead', null, null, 280, 500),
    ('hc', 80, 'hc-7y', 'process', 'Escalate critical failure', 'Escalation step for critical safety, quality or compliance failure.', 'plant', 'site-dds', array['hc'], 'Plant', 'Critical failure', 'Escalation raised', 520, 430),
    ('hc', 90, 'hc-8y', 'process', 'Assign containment and corrective action', 'Plant defines containment and corrective action with IPS linkage if needed.', 'plant', 'site-dds', array['hc','ips'], 'Plant', 'Critical failure', 'Containment assigned', 520, 550),
    ('hc', 100, 'hc-7n', 'process', 'Assign action owner and due date', 'Assign owner and due date for non-critical failure.', 'team-lead', 'shift-dds', array['hc'], 'Team Lead', 'Failure action', 'Owner assigned', 280, 620),
    ('hc', 110, 'hc-8', 'process', 'Complete corrective action', 'Action owner completes corrective action.', 'action-owner', 'swp', array['hc'], 'Action Owner', 'Assigned action', 'Corrective action completed', 280, 740),
    ('hc', 120, 'hc-9', 'review', 'Verify action effectiveness', 'Verify whether the corrective action fixed the failure.', 'team-lead', 'shift-dds', array['hc'], 'Team Lead', 'Completed action', 'Effectiveness verified', 280, 860),
    ('hc', 130, 'hc-10', 'decision', 'Is the issue resolved?', 'Decide whether the health check failure can be closed.', 'team-lead', 'shift-dds', array['hc'], 'Team Lead', null, null, 280, 980),
    ('hc', 140, 'hc-11y', 'end', 'Close health check failure', 'Resolved: close health check failure.', 'team-lead', 'shift-dds', array['hc'], 'Team Lead', null, 'Failure closed', 280, 1100),
    ('hc', 150, 'hc-11n', 'decision', 'Is the failure recurring or overdue?', 'Cell Lead decides if unresolved failure needs IPS escalation.', 'cell', 'line-dds', array['hc','ips'], 'Cell Lead', null, null, 520, 980),
    ('hc', 160, 'hc-12y', 'subprocess', 'Create linked IPS', 'Create IPS for recurring or overdue health check failure.', 'plant', 'ips-review', array['hc','ips'], 'Plant', 'Recurring failure', 'Linked IPS created', 760, 900),
    ('hc', 170, 'hc-12n', 'process', 'Reassign action and monitor', 'Reassign the action and monitor through Line DDS.', 'cell', 'line-dds', array['hc'], 'Cell Lead', 'Unresolved failure', 'Action reassigned', 520, 1120),
    ('hc', 180, 'hc-13', 'review', 'Review health check completion and failures', 'Periodic review of completion, missed checks and failures.', 'plant', 'wds', array['hc'], 'Plant', 'Health check trend', 'WDS priorities updated', 40, 1240),
    ('hc', 190, 'hc-14', 'review', 'Review repeat failures and standard gaps', 'Site reviews repeat failures and standard gaps.', 'site', 'pdca', array['hc','ips'], 'Site', 'Repeat failure trend', 'System gaps prioritised', 40, 1360),

    -- CC — Composition Control
    ('cc', 10, 'cc-1', 'start', 'Composition check becomes due', 'Trigger: scheduled sample, changeover, recipe change or quality requirement.', 'operator', 'swp', array['cc'], 'Operator', 'Sample schedule or requirement', 'Check due', 40, 40),
    ('cc', 20, 'cc-2', 'process', 'Capture composition result', 'Capture actual result, target, tolerance, sample time and comments.', 'operator', 'swp', array['cc'], 'Operator', 'Sample, target and tolerance', 'Composition result recorded', 40, 150),
    ('cc', 30, 'cc-3', 'decision', 'Is composition within specification?', 'Compare composition result to target and tolerance.', 'operator', 'swp', array['cc'], 'Operator', null, null, 40, 260),
    ('cc', 40, 'cc-4y', 'end', 'Record compliant result', 'Composition is within specification and result is closed.', 'operator', 'swp', array['cc'], 'Operator', null, 'Compliant result recorded', 40, 390),
    ('cc', 50, 'cc-4n', 'process', 'Notify Team Lead and record deviation', 'Record composition deviation and notify Team Lead.', 'operator', 'shift-dds', array['cc'], 'Operator', 'Out of spec result', 'Deviation recorded', 280, 260),
    ('cc', 60, 'cc-5', 'review', 'Review deviation impact', 'Team Lead reviews product, quality and process impact.', 'team-lead', 'shift-dds', array['cc'], 'Team Lead', 'Deviation detail', 'Impact understood', 280, 380),
    ('cc', 70, 'cc-6', 'decision', 'Can approved adjustment be made now?', 'Decide whether approved adjustment can be safely made now.', 'team-lead', 'shift-dds', array['cc'], 'Team Lead', null, null, 280, 500),
    ('cc', 80, 'cc-7y', 'process', 'Apply approved adjustment', 'Operator applies the approved adjustment.', 'operator', 'swp', array['cc'], 'Operator', 'Approved adjustment', 'Adjustment applied', 280, 630),
    ('cc', 90, 'cc-8y', 'process', 'Repeat composition check', 'Repeat composition check after adjustment.', 'operator', 'swp', array['cc'], 'Operator', 'Adjusted process', 'New result captured', 280, 750),
    ('cc', 100, 'cc-7n', 'process', 'Escalate to Plant and Support', 'Escalation step when approved adjustment cannot be made immediately.', 'plant', 'line-dds', array['cc'], 'Plant', 'Deviation impact', 'Escalation raised', 520, 500),
    ('cc', 110, 'cc-8n', 'process', 'Define containment and disposition action', 'Define containment, product disposition and corrective action.', 'plant', 'line-dds', array['cc','ips'], 'Plant', 'Escalated deviation', 'Containment defined', 520, 630),
    ('cc', 120, 'cc-9', 'decision', 'Is structured problem solving required?', 'Decide if a linked IPS is required.', 'plant', 'line-dds', array['cc','ips'], 'Plant', null, null, 520, 760),
    ('cc', 130, 'cc-10y', 'subprocess', 'Create linked IPS', 'Create linked IPS for structured composition problem solving.', 'plant', 'ips-review', array['cc','ips'], 'Plant', 'Problem solving trigger', 'Linked IPS created', 760, 680),
    ('cc', 140, 'cc-10n', 'process', 'Assign corrective action', 'Assign corrective action without IPS.', 'team-lead', 'line-dds', array['cc'], 'Team Lead', 'Containment action', 'Corrective action assigned', 520, 900),
    ('cc', 150, 'cc-11', 'review', 'Verify composition stability', 'Verify composition stability after adjustment or corrective action.', 'team-lead', 'shift-dds', array['cc'], 'Team Lead', 'Follow-up results', 'Stability verified', 520, 1020),
    ('cc', 160, 'cc-12', 'end', 'Close composition deviation', 'Close composition deviation after stability is verified.', 'team-lead', 'shift-dds', array['cc'], 'Team Lead', null, 'Deviation closed', 520, 1140),
    ('cc', 170, 'cc-13', 'review', 'Review composition trends and deviations', 'Periodic review of composition trends and deviations.', 'plant', 'wds', array['cc'], 'Plant', 'Trend data', 'WDS priorities updated', 40, 860),
    ('cc', 180, 'cc-14', 'review', 'Review repeat composition losses', 'Site reviews repeat composition losses and IPS links.', 'site', 'pdca', array['cc','ips'], 'Site', 'Repeat losses', 'System losses prioritised', 40, 980),

    -- IC — Interventions Control
    ('ic', 10, 'ic-1', 'start', 'Intervention required', 'Trigger: process issue, quality risk, equipment condition, planned stop or operational need.', 'operator', 'swp', array['ic'], 'Operator', 'Intervention need', 'Request required', 40, 40),
    ('ic', 20, 'ic-2', 'process', 'Record intervention request', 'Capture reason, equipment, impact, requested action and urgency.', 'operator', 'swp', array['ic'], 'Operator', 'Request detail', 'Intervention request recorded', 40, 150),
    ('ic', 30, 'ic-3', 'review', 'Review intervention request', 'Team Lead reviews the intervention request.', 'team-lead', 'shift-dds', array['ic'], 'Team Lead', 'Intervention request', 'Approval decision ready', 40, 260),
    ('ic', 40, 'ic-4', 'decision', 'Is intervention approved?', 'Approve, reject or defer intervention.', 'team-lead', 'shift-dds', array['ic'], 'Team Lead', null, null, 40, 370),
    ('ic', 50, 'ic-5n', 'end', 'Reject or defer intervention with reason', 'Intervention not approved: record reason and close.', 'team-lead', 'shift-dds', array['ic'], 'Team Lead', null, 'Request closed', 40, 500),
    ('ic', 60, 'ic-5y', 'process', 'Assess risk and define controls', 'Define intervention risks, approvals and controls.', 'team-lead', 'shift-dds', array['ic'], 'Team Lead', 'Approved request', 'Controls defined', 280, 370),
    ('ic', 70, 'ic-6', 'decision', 'Is maintenance or technical support required?', 'Decide whether maintenance or technical support is required.', 'team-lead', 'shift-dds', array['ic','mps'], 'Team Lead', null, null, 280, 500),
    ('ic', 80, 'ic-7y', 'process', 'Assign support and confirm readiness', 'Maintenance confirms support and readiness for the intervention.', 'maintenance', 'line-dds', array['ic','mps'], 'Maintenance', 'Support request', 'Readiness confirmed', 520, 430),
    ('ic', 90, 'ic-7n', 'process', 'Prepare intervention', 'Operator prepares intervention according to controls.', 'operator', 'swp', array['ic'], 'Operator', 'Defined controls', 'Intervention ready', 280, 630),
    ('ic', 100, 'ic-8', 'process', 'Execute intervention', 'Execute intervention safely under defined controls.', 'operator', 'swp', array['ic'], 'Operator', 'Approved intervention', 'Intervention executed', 280, 750),
    ('ic', 110, 'ic-9', 'process', 'Record outcome and evidence', 'Record intervention outcome, evidence and comments.', 'operator', 'swp', array['ic'], 'Operator', 'Intervention outcome', 'Outcome recorded', 280, 870),
    ('ic', 120, 'ic-10', 'review', 'Verify process returned to standard', 'Team Lead verifies the process returned to standard.', 'team-lead', 'shift-dds', array['ic'], 'Team Lead', 'Outcome evidence', 'Return-to-standard verified', 280, 990),
    ('ic', 130, 'ic-11', 'decision', 'Was the intervention successful?', 'Decide whether the intervention can be closed.', 'team-lead', 'shift-dds', array['ic'], 'Team Lead', null, null, 280, 1110),
    ('ic', 140, 'ic-12y', 'end', 'Close intervention', 'Successful intervention is closed.', 'team-lead', 'shift-dds', array['ic'], 'Team Lead', null, 'Intervention closed', 280, 1240),
    ('ic', 150, 'ic-12n', 'process', 'Escalate failed intervention', 'Escalation step for failed intervention.', 'plant', 'line-dds', array['ic','ips'], 'Plant', 'Failed intervention', 'Escalation raised', 520, 1110),
    ('ic', 160, 'ic-13', 'decision', 'Is recurring intervention or loss pattern identified?', 'Determine if recurring intervention pattern requires IPS.', 'plant', 'line-dds', array['ic','ips'], 'Plant', null, null, 520, 1240),
    ('ic', 170, 'ic-14y', 'subprocess', 'Create linked IPS', 'Create linked IPS for recurring intervention or loss pattern.', 'plant', 'ips-review', array['ic','ips'], 'Plant', 'Recurring pattern', 'Linked IPS created', 760, 1160),
    ('ic', 180, 'ic-14n', 'process', 'Assign follow-up action', 'Assign follow-up action without IPS.', 'team-lead', 'line-dds', array['ic'], 'Team Lead', 'Failed intervention', 'Follow-up assigned', 520, 1370),
    ('ic', 190, 'ic-15', 'review', 'Review intervention frequency and open actions', 'Periodic review of intervention frequency and open actions.', 'plant', 'wds', array['ic'], 'Plant', 'Intervention dashboard', 'WDS priorities updated', 40, 1360),
    ('ic', 200, 'ic-16', 'review', 'Review systemic intervention losses', 'Site reviews systemic intervention losses.', 'site', 'pdca', array['ic','ips'], 'Site', 'System losses', 'PDCA priorities updated', 40, 1480),

    -- 90 Day — Action Plan
    ('90-day', 10, 'd90-1', 'start', 'Priority action identified', 'Trigger: loss review, audit, PDCA, WDS, IPS, BDE or leadership priority.', 'plant', 'pdca', array['90-day'], 'Plant', 'Priority source', 'Action need identified', 40, 40),
    ('90-day', 20, 'd90-2', 'process', 'Create 90 Day action', 'Capture action, owner, due date, expected benefit, priority and linked source.', 'plant', 'pdca', array['90-day'], 'Plant', 'Priority action', '90 Day action created', 40, 150),
    ('90-day', 30, 'd90-3', 'process', 'Assign action owner', 'Assign named owner for the 90 Day action.', 'plant', 'pdca', array['90-day'], 'Plant', '90 Day action', 'Owner assigned', 40, 260),
    ('90-day', 40, 'd90-4', 'review', 'Review action plan with Team Lead or owner', 'Review clarity, ownership and readiness to execute.', 'team-lead', 'line-dds', array['90-day'], 'Team Lead', 'Action plan', 'Action reviewed', 40, 370),
    ('90-day', 50, 'd90-5', 'decision', 'Is the action clear and executable?', 'Decide if the action is ready to execute.', 'team-lead', 'line-dds', array['90-day'], 'Team Lead', null, null, 40, 500),
    ('90-day', 60, 'd90-6n', 'process', 'Clarify scope, support and success criteria', 'Clarify scope, required support and success criteria.', 'plant', 'line-dds', array['90-day'], 'Plant', 'Unclear action', 'Action clarified', 280, 500),
    ('90-day', 70, 'd90-6y', 'process', 'Execute action', 'Action owner executes the agreed action.', 'action-owner', 'swp', array['90-day'], 'Action Owner', 'Clear action', 'Action in progress', 40, 630),
    ('90-day', 80, 'd90-7', 'process', 'Update progress', 'Action owner updates progress status.', 'action-owner', 'shift-dds', array['90-day'], 'Action Owner', 'Action progress', 'Status updated', 40, 750),
    ('90-day', 90, 'd90-8', 'review', 'Review progress and blockers', 'Team Lead reviews progress and blockers.', 'team-lead', 'shift-dds', array['90-day'], 'Team Lead', 'Progress update', 'Blockers reviewed', 40, 870),
    ('90-day', 100, 'd90-9', 'decision', 'Is action on track?', 'Decide whether action is on track.', 'team-lead', 'shift-dds', array['90-day'], 'Team Lead', null, null, 40, 990),
    ('90-day', 110, 'd90-10y', 'process', 'Continue execution', 'Continue action execution.', 'action-owner', 'swp', array['90-day'], 'Action Owner', 'On-track action', 'Execution continued', 40, 1120),
    ('90-day', 120, 'd90-10n', 'process', 'Escalate blocker', 'Escalation step for action blocker.', 'plant', 'line-dds', array['90-day'], 'Plant', 'Blocked action', 'Blocker escalated', 280, 990),
    ('90-day', 130, 'd90-11', 'decision', 'Is site support required?', 'Plant decides if site support is required.', 'plant', 'wds', array['90-day'], 'Plant', null, null, 280, 1120),
    ('90-day', 140, 'd90-12y', 'process', 'Escalate to Site', 'Escalation step to Site for support.', 'site', 'wds', array['90-day'], 'Site', 'Site support request', 'Site escalation raised', 520, 1040),
    ('90-day', 150, 'd90-12n', 'process', 'Replan action and due date', 'Replan action scope, support and due date.', 'plant', 'line-dds', array['90-day'], 'Plant', 'Blocked action', 'Action replanned', 280, 1250),
    ('90-day', 160, 'd90-13', 'process', 'Complete action', 'Action owner completes the 90 Day action.', 'action-owner', 'swp', array['90-day'], 'Action Owner', 'Action plan', 'Action complete', 40, 1240),
    ('90-day', 170, 'd90-14', 'review', 'Verify outcome and benefit', 'Plant verifies outcome and expected benefit.', 'plant', 'wds', array['90-day'], 'Plant', 'Completed action', 'Benefit verified', 40, 1360),
    ('90-day', 180, 'd90-15', 'decision', 'Was the action effective?', 'Decide whether action achieved the intended outcome.', 'plant', 'wds', array['90-day'], 'Plant', null, null, 40, 1480),
    ('90-day', 190, 'd90-16y', 'end', 'Close 90 Day action', 'Effective action is closed.', 'plant', 'wds', array['90-day'], 'Plant', null, 'Action closed', 40, 1610),
    ('90-day', 200, 'd90-16n', 'subprocess', 'Convert to IPS or new 90 Day action', 'Ineffective action converts to IPS or a new 90 Day action.', 'plant', 'pdca', array['90-day','ips'], 'Plant', 'Ineffective action', 'IPS or new action created', 280, 1480),
    ('90-day', 210, 'd90-17', 'review', 'Review 90 Day plan completion and overdue actions', 'Site periodically reviews 90 Day completion and overdue actions.', 'site', 'pdca', array['90-day'], 'Site', '90 Day portfolio', 'Portfolio priorities updated', 520, 1480),

    -- Sick — On-call and Sick Leave Management
    ('sick', 10, 'sick-1', 'start', 'Employee reports sick leave or absence', 'Employee reports sick leave or absence for a shift.', 'operator', 'swp', array['sick'], 'Operator', 'Absence notification', 'Notification received', 40, 40),
    ('sick', 20, 'sick-2', 'process', 'Record sick leave notification', 'Capture employee, shift, role, reason category, expected duration and notification time.', 'team-lead', 'swp', array['sick'], 'Team Lead', 'Absence details', 'Absence recorded', 40, 150),
    ('sick', 30, 'sick-3', 'review', 'Assess shift coverage impact', 'Assess the impact of absence on shift coverage.', 'team-lead', 'shift-dds', array['sick'], 'Team Lead', 'Roster and skills', 'Coverage impact understood', 40, 260),
    ('sick', 40, 'sick-4', 'decision', 'Is shift coverage affected?', 'Decide whether coverage is affected.', 'team-lead', 'shift-dds', array['sick'], 'Team Lead', null, null, 40, 370),
    ('sick', 50, 'sick-5n', 'end', 'Record absence and close coverage review', 'Coverage not affected: record absence and close review.', 'team-lead', 'shift-dds', array['sick'], 'Team Lead', null, 'Coverage review closed', 40, 500),
    ('sick', 60, 'sick-5y', 'process', 'Check available internal cover', 'Check internal cover options.', 'team-lead', 'shift-dds', array['sick'], 'Team Lead', 'Coverage gap', 'Internal cover checked', 280, 370),
    ('sick', 70, 'sick-6', 'decision', 'Is internal cover available?', 'Decide if internal cover is available.', 'team-lead', 'shift-dds', array['sick'], 'Team Lead', null, null, 280, 500),
    ('sick', 80, 'sick-7y', 'process', 'Assign replacement and confirm coverage', 'Assign replacement and confirm coverage.', 'team-lead', 'shift-dds', array['sick'], 'Team Lead', 'Available cover', 'Coverage confirmed', 280, 630),
    ('sick', 90, 'sick-8y', 'process', 'Notify affected team', 'Notify affected team of replacement and changes.', 'team-lead', 'shift-dds', array['sick'], 'Team Lead', 'Coverage update', 'Team notified', 280, 750),
    ('sick', 100, 'sick-9y', 'end', 'Close coverage action', 'Internal cover confirmed and action closed.', 'team-lead', 'shift-dds', array['sick'], 'Team Lead', null, 'Coverage action closed', 280, 870),
    ('sick', 110, 'sick-7n', 'process', 'Start on-call ladder', 'Start the on-call ladder.', 'team-lead', 'shift-dds', array['sick'], 'Team Lead', 'No internal cover', 'On-call ladder started', 520, 500),
    ('sick', 120, 'sick-8n', 'process', 'Contact first on-call person', 'Contact first on-call person.', 'action-owner', 'swp', array['sick'], 'Action Owner', 'On-call ladder', 'On-call contacted', 520, 630),
    ('sick', 130, 'sick-9n', 'decision', 'Did on-call person accept?', 'Confirm if on-call person accepts coverage.', 'action-owner', 'swp', array['sick'], 'Action Owner', null, null, 520, 750),
    ('sick', 140, 'sick-10y', 'process', 'Confirm replacement and update roster', 'Confirm replacement and update roster.', 'team-lead', 'shift-dds', array['sick'], 'Team Lead', 'Accepted on-call', 'Roster updated', 520, 880),
    ('sick', 150, 'sick-11y', 'process', 'Notify Plant if required', 'Notify Plant if operational impact remains.', 'team-lead', 'line-dds', array['sick'], 'Team Lead', 'Coverage update', 'Plant notified if needed', 520, 1000),
    ('sick', 160, 'sick-12y', 'end', 'Close coverage action', 'On-call coverage confirmed and action closed.', 'team-lead', 'shift-dds', array['sick'], 'Team Lead', null, 'Coverage action closed', 520, 1120),
    ('sick', 170, 'sick-10n', 'process', 'Escalate to next on-call level', 'Escalation step to the next on-call level.', 'team-lead', 'shift-dds', array['sick'], 'Team Lead', 'Declined on-call', 'Next level escalated', 760, 750),
    ('sick', 180, 'sick-11n', 'decision', 'Is coverage still unresolved?', 'Decide whether coverage remains unresolved.', 'team-lead', 'shift-dds', array['sick'], 'Team Lead', null, null, 760, 880),
    ('sick', 190, 'sick-12n', 'process', 'Escalate to Plant', 'Escalation step to Plant.', 'plant', 'line-dds', array['sick'], 'Plant', 'Unresolved coverage', 'Plant escalation raised', 760, 1010),
    ('sick', 200, 'sick-13', 'review', 'Confirm operational risk and mitigation', 'Plant confirms operational risk and mitigation.', 'plant', 'line-dds', array['sick'], 'Plant', 'Coverage risk', 'Mitigation defined', 760, 1130),
    ('sick', 210, 'sick-14', 'decision', 'Is minimum safe staffing confirmed?', 'Decide if minimum safe staffing is confirmed.', 'plant', 'line-dds', array['sick'], 'Plant', null, null, 760, 1250),
    ('sick', 220, 'sick-15y', 'process', 'Approve mitigation and operate with controls', 'Approve mitigation and operate with controls.', 'plant', 'line-dds', array['sick'], 'Plant', 'Safe staffing confirmed', 'Controls approved', 760, 1380),
    ('sick', 230, 'sick-15n', 'process', 'Escalate to Site', 'Escalation step to Site for business continuity response.', 'site', 'site-dds', array['sick'], 'Site', 'Unsafe staffing risk', 'Site escalation raised', 1000, 1250),
    ('sick', 240, 'sick-16', 'review', 'Decide business continuity response', 'Site decides business continuity response.', 'site', 'site-dds', array['sick'], 'Site', 'Staffing risk', 'Continuity decision made', 1000, 1380),
    ('sick', 250, 'sick-17', 'review', 'Review sick leave trends and coverage issues', 'Plant reviews sick leave trends and coverage issues.', 'plant', 'wds', array['sick'], 'Plant', 'Absence trend', 'Coverage priorities updated', 40, 1280),
    ('sick', 260, 'sick-18', 'review', 'Review repeat absence impact and on-call effectiveness', 'Site reviews repeat absence impact and on-call effectiveness.', 'site', 'pdca', array['sick'], 'Site', 'Absence and on-call trend', 'System improvements identified', 40, 1400);

  insert into pg_temp.bms_seed_edges values
    ('os','os-e1','os-1','os-2',null), ('os','os-e2','os-2','os-3',null), ('os','os-e3','os-3','os-4',null), ('os','os-e4','os-4','os-5n','No'), ('os','os-e5','os-4','os-5y','Yes'), ('os','os-e6','os-5y','os-6',null), ('os','os-e7','os-6','os-7',null), ('os','os-e8','os-7','os-8',null), ('os','os-e9','os-8','os-9y','Yes'), ('os','os-e10','os-8','os-9n','No'), ('os','os-e11','os-9n','os-10',null), ('os','os-e12','os-10','os-11y','Yes'), ('os','os-e13','os-10','os-11n','No'), ('os','os-e14','os-12','os-13',null),
    ('hc','hc-e1','hc-1','hc-2',null), ('hc','hc-e2','hc-2','hc-3',null), ('hc','hc-e3','hc-3','hc-4',null), ('hc','hc-e4','hc-4','hc-5y','Yes'), ('hc','hc-e5','hc-4','hc-5n','No'), ('hc','hc-e6','hc-5n','hc-6',null), ('hc','hc-e7','hc-6','hc-7y','Yes'), ('hc','hc-e8','hc-7y','hc-8y',null), ('hc','hc-e9','hc-6','hc-7n','No'), ('hc','hc-e10','hc-7n','hc-8',null), ('hc','hc-e11','hc-8','hc-9',null), ('hc','hc-e12','hc-9','hc-10',null), ('hc','hc-e13','hc-10','hc-11y','Yes'), ('hc','hc-e14','hc-10','hc-11n','No'), ('hc','hc-e15','hc-11n','hc-12y','Yes'), ('hc','hc-e16','hc-11n','hc-12n','No'), ('hc','hc-e17','hc-13','hc-14',null),
    ('cc','cc-e1','cc-1','cc-2',null), ('cc','cc-e2','cc-2','cc-3',null), ('cc','cc-e3','cc-3','cc-4y','Yes'), ('cc','cc-e4','cc-3','cc-4n','No'), ('cc','cc-e5','cc-4n','cc-5',null), ('cc','cc-e6','cc-5','cc-6',null), ('cc','cc-e7','cc-6','cc-7y','Yes'), ('cc','cc-e8','cc-7y','cc-8y',null), ('cc','cc-e9','cc-8y','cc-3','Return'), ('cc','cc-e10','cc-6','cc-7n','No'), ('cc','cc-e11','cc-7n','cc-8n',null), ('cc','cc-e12','cc-8n','cc-9',null), ('cc','cc-e13','cc-9','cc-10y','Yes'), ('cc','cc-e14','cc-9','cc-10n','No'), ('cc','cc-e15','cc-10n','cc-11',null), ('cc','cc-e16','cc-11','cc-12',null), ('cc','cc-e17','cc-13','cc-14',null),
    ('ic','ic-e1','ic-1','ic-2',null), ('ic','ic-e2','ic-2','ic-3',null), ('ic','ic-e3','ic-3','ic-4',null), ('ic','ic-e4','ic-4','ic-5n','No'), ('ic','ic-e5','ic-4','ic-5y','Yes'), ('ic','ic-e6','ic-5y','ic-6',null), ('ic','ic-e7','ic-6','ic-7y','Yes'), ('ic','ic-e8','ic-7y','ic-8',null), ('ic','ic-e9','ic-6','ic-7n','No'), ('ic','ic-e10','ic-7n','ic-8',null), ('ic','ic-e11','ic-8','ic-9',null), ('ic','ic-e12','ic-9','ic-10',null), ('ic','ic-e13','ic-10','ic-11',null), ('ic','ic-e14','ic-11','ic-12y','Yes'), ('ic','ic-e15','ic-11','ic-12n','No'), ('ic','ic-e16','ic-12n','ic-13',null), ('ic','ic-e17','ic-13','ic-14y','Yes'), ('ic','ic-e18','ic-13','ic-14n','No'), ('ic','ic-e19','ic-15','ic-16',null),
    ('90-day','d90-e1','d90-1','d90-2',null), ('90-day','d90-e2','d90-2','d90-3',null), ('90-day','d90-e3','d90-3','d90-4',null), ('90-day','d90-e4','d90-4','d90-5',null), ('90-day','d90-e5','d90-5','d90-6n','No'), ('90-day','d90-e6','d90-6n','d90-4','Return'), ('90-day','d90-e7','d90-5','d90-6y','Yes'), ('90-day','d90-e8','d90-6y','d90-7',null), ('90-day','d90-e9','d90-7','d90-8',null), ('90-day','d90-e10','d90-8','d90-9',null), ('90-day','d90-e11','d90-9','d90-10y','Yes'), ('90-day','d90-e12','d90-9','d90-10n','No'), ('90-day','d90-e13','d90-10n','d90-11',null), ('90-day','d90-e14','d90-11','d90-12y','Yes'), ('90-day','d90-e15','d90-11','d90-12n','No'), ('90-day','d90-e16','d90-10y','d90-13',null), ('90-day','d90-e17','d90-12n','d90-13',null), ('90-day','d90-e18','d90-13','d90-14',null), ('90-day','d90-e19','d90-14','d90-15',null), ('90-day','d90-e20','d90-15','d90-16y','Yes'), ('90-day','d90-e21','d90-15','d90-16n','No'), ('90-day','d90-e22','d90-17','d90-1','Review input'),
    ('sick','sick-e1','sick-1','sick-2',null), ('sick','sick-e2','sick-2','sick-3',null), ('sick','sick-e3','sick-3','sick-4',null), ('sick','sick-e4','sick-4','sick-5n','No'), ('sick','sick-e5','sick-4','sick-5y','Yes'), ('sick','sick-e6','sick-5y','sick-6',null), ('sick','sick-e7','sick-6','sick-7y','Yes'), ('sick','sick-e8','sick-7y','sick-8y',null), ('sick','sick-e9','sick-8y','sick-9y',null), ('sick','sick-e10','sick-6','sick-7n','No'), ('sick','sick-e11','sick-7n','sick-8n',null), ('sick','sick-e12','sick-8n','sick-9n',null), ('sick','sick-e13','sick-9n','sick-10y','Yes'), ('sick','sick-e14','sick-10y','sick-11y',null), ('sick','sick-e15','sick-11y','sick-12y',null), ('sick','sick-e16','sick-9n','sick-10n','No'), ('sick','sick-e17','sick-10n','sick-11n',null), ('sick','sick-e18','sick-11n','sick-12n','Yes'), ('sick','sick-e19','sick-12n','sick-13',null), ('sick','sick-e20','sick-13','sick-14',null), ('sick','sick-e21','sick-14','sick-15y','Yes'), ('sick','sick-e22','sick-14','sick-15n','No'), ('sick','sick-e23','sick-15n','sick-16',null), ('sick','sick-e24','sick-17','sick-18',null);

  with flows as (
    select
      p.process_id,
      jsonb_build_object(
        'nodes',
        coalesce(
          (
            select jsonb_agg(
              jsonb_strip_nulls(
                jsonb_build_object(
                  'id', n.node_id,
                  'kind', n.kind,
                  'label', n.label,
                  'description', nullif(n.description, ''),
                  'roleId', r.id,
                  'forumId', f.id,
                  'systemIds', (
                    select coalesce(jsonb_agg(s.id order by u.ord), '[]'::jsonb)
                    from unnest(n.system_slugs) with ordinality as u(slug, ord)
                    join public.bms_brain_systems s on s.slug = u.slug
                  ),
                  'owner', n.owner,
                  'inputs', n.inputs,
                  'outputs', n.outputs,
                  'position', jsonb_build_object('x', n.x, 'y', n.y)
                )
              )
              order by n.sort_order
            )
            from pg_temp.bms_seed_nodes n
            join public.bms_brain_roles r on r.slug = n.role_slug
            join public.bms_brain_forums f on f.slug = n.forum_slug
            where n.process_key = p.process_key
          ),
          '[]'::jsonb
        ),
        'edges',
        coalesce(
          (
            select jsonb_agg(
              jsonb_strip_nulls(jsonb_build_object('id', e.edge_id, 'source', e.source_id, 'target', e.target_id, 'label', e.label))
              order by e.edge_id
            )
            from pg_temp.bms_seed_edges e
            where e.process_key = p.process_key
          ),
          '[]'::jsonb
        )
      ) as flow
    from pg_temp.bms_seed_processes p
  )
  insert into public.bms_brain_processes (id, name, description, status, flow, owner_role_id, catalog_system_id)
  select
    p.process_id,
    p.process_name,
    p.description,
    'published',
    f.flow,
    r.id,
    s.id
  from pg_temp.bms_seed_processes p
  join flows f on f.process_id = p.process_id
  join public.bms_brain_roles r on r.slug = p.owner_role_slug
  join public.bms_brain_systems s on s.slug = p.catalog_system_slug
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    status = excluded.status,
    flow = excluded.flow,
    owner_role_id = excluded.owner_role_id,
    catalog_system_id = excluded.catalog_system_id,
    updated_at = now();

  for proc in
    select process_id
    from pg_temp.bms_seed_processes
  loop
    select coalesce(max(version_no), 0) + 1 into next_ver
    from public.bms_brain_process_versions
    where process_id = proc.process_id;

    insert into public.bms_brain_process_versions (process_id, version_no, snapshot, note)
    select proc.process_id, next_ver, to_jsonb(p.*), 'Additional system standards seed'
    from public.bms_brain_processes p
    where p.id = proc.process_id;
  end loop;
end;
$$;

select public.bms_brain_seed_additional_system_standards();

revoke all on function public.bms_brain_seed_additional_system_standards() from public;

notify pgrst, 'reload schema';

commit;
