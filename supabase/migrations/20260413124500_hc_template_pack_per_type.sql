-- Create a fresh active HC template with 5 questions for every HC type.

do $$
declare
  r record;
  v_version int;
  v_tpl_id uuid;
begin
  for r in
    select t.id, t.name
    from public.hc_types t
  loop
    select coalesce(max(version), 0) + 1 into v_version
    from public.hc_templates
    where hc_type_id = r.id;

    update public.hc_templates
    set active = false
    where hc_type_id = r.id
      and active = true;

    insert into public.hc_templates (
      hc_type_id, name, version, description, active, threshold_score
    ) values (
      r.id,
      concat('Auto HC Template v', v_version),
      v_version,
      'Auto-generated HC template with 5 demo questions.',
      true,
      null
    )
    returning id into v_tpl_id;

    insert into public.hc_template_questions (
      template_id,
      question_text,
      expected_standard,
      sort_order,
      active,
      is_critical,
      help_text
    ) values
      (
        v_tpl_id,
        concat(r.name, ' - Pre-start safety check complete'),
        'Pre-start checks are completed and signed before operation.',
        1,
        true,
        true,
        'Confirm check sheet and visual status before shift start.'
      ),
      (
        v_tpl_id,
        concat(r.name, ' - Standard work followed'),
        'Operator follows the approved standard sequence.',
        2,
        true,
        true,
        'Observe one full cycle and compare with standard.'
      ),
      (
        v_tpl_id,
        concat(r.name, ' - Quality verification in place'),
        'In-process quality checks are performed at required intervals.',
        3,
        true,
        false,
        'Check logs and verify frequency is met.'
      ),
      (
        v_tpl_id,
        concat(r.name, ' - Abnormalities escalated promptly'),
        'Abnormal conditions are escalated per response process.',
        4,
        true,
        false,
        'Confirm response timing and escalation path.'
      ),
      (
        v_tpl_id,
        concat(r.name, ' - Area condition maintained'),
        'Work area remains organized, clean, and controlled.',
        5,
        true,
        false,
        'Use housekeeping standard and controls as reference.'
      );
  end loop;
end
$$;
