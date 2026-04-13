-- Create a fresh active demo template pack for every SOS/QOS/PPO type.
-- Each new template gets 3 questions with simple external image URLs.

-- ---------------------------------------------------------------------------
-- SOS
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_version int;
  v_tpl_id uuid;
begin
  for r in
    select t.id, t.name
    from public.sos_types t
  loop
    select coalesce(max(version), 0) + 1 into v_version
    from public.sos_templates
    where sos_type_id = r.id;

    update public.sos_templates
    set active = false
    where sos_type_id = r.id
      and active = true;

    insert into public.sos_templates (
      sos_type_id, name, version, description, active, threshold_score
    ) values (
      r.id,
      concat('Auto Template v', v_version),
      v_version,
      'Auto-generated template with 3 demo questions and simple images.',
      true,
      null
    )
    returning id into v_tpl_id;

    insert into public.sos_template_questions (
      template_id, question_text, expected_standard, sort_order, active, is_critical, help_text, good_image_path, bad_image_path
    ) values
      (
        v_tpl_id,
        concat(r.name, ' - Safe setup and area condition'),
        'Work area is clean, hazards are removed, and setup is controlled.',
        1,
        true,
        true,
        'Quick visual condition check before operation.',
        concat('https://picsum.photos/seed/sos_', replace(r.id::text, '-', ''), '_good_1/800/600'),
        concat('https://picsum.photos/seed/sos_', replace(r.id::text, '-', ''), '_bad_1/800/600')
      ),
      (
        v_tpl_id,
        concat(r.name, ' - PPE and behavior'),
        'PPE is worn correctly and safe behavior is demonstrated.',
        2,
        true,
        true,
        'Confirm PPE and safe behavior compliance.',
        concat('https://picsum.photos/seed/sos_', replace(r.id::text, '-', ''), '_good_2/800/600'),
        concat('https://picsum.photos/seed/sos_', replace(r.id::text, '-', ''), '_bad_2/800/600')
      ),
      (
        v_tpl_id,
        concat(r.name, ' - Controls and housekeeping'),
        'Controls are in place and housekeeping standards are maintained.',
        3,
        true,
        false,
        'Check controls, access, and housekeeping.',
        concat('https://picsum.photos/seed/sos_', replace(r.id::text, '-', ''), '_good_3/800/600'),
        concat('https://picsum.photos/seed/sos_', replace(r.id::text, '-', ''), '_bad_3/800/600')
      );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- QOS
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_version int;
  v_tpl_id uuid;
begin
  for r in
    select t.id, t.name
    from public.qos_types t
  loop
    select coalesce(max(version), 0) + 1 into v_version
    from public.qos_templates
    where qos_type_id = r.id;

    update public.qos_templates
    set active = false
    where qos_type_id = r.id
      and active = true;

    insert into public.qos_templates (
      qos_type_id, name, version, description, active, threshold_score
    ) values (
      r.id,
      concat('Auto Template v', v_version),
      v_version,
      'Auto-generated template with 3 demo questions and simple images.',
      true,
      null
    )
    returning id into v_tpl_id;

    insert into public.qos_template_questions (
      template_id, question_text, expected_standard, sort_order, active, is_critical, help_text, good_image_path, bad_image_path
    ) values
      (
        v_tpl_id,
        concat(r.name, ' - Label and identification'),
        'Labels and identifiers match product and process requirements.',
        1,
        true,
        true,
        'Compare labels against required spec.',
        concat('https://picsum.photos/seed/qos_', replace(r.id::text, '-', ''), '_good_1/800/600'),
        concat('https://picsum.photos/seed/qos_', replace(r.id::text, '-', ''), '_bad_1/800/600')
      ),
      (
        v_tpl_id,
        concat(r.name, ' - First-piece and tolerance'),
        'First-piece checks are complete and within tolerance.',
        2,
        true,
        true,
        'Validate first-piece confirmation process.',
        concat('https://picsum.photos/seed/qos_', replace(r.id::text, '-', ''), '_good_2/800/600'),
        concat('https://picsum.photos/seed/qos_', replace(r.id::text, '-', ''), '_bad_2/800/600')
      ),
      (
        v_tpl_id,
        concat(r.name, ' - Defect separation and handling'),
        'Defects are identified, isolated, and handled correctly.',
        3,
        true,
        false,
        'Check segregation and visual controls.',
        concat('https://picsum.photos/seed/qos_', replace(r.id::text, '-', ''), '_good_3/800/600'),
        concat('https://picsum.photos/seed/qos_', replace(r.id::text, '-', ''), '_bad_3/800/600')
      );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- PPO
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_version int;
  v_tpl_id uuid;
begin
  for r in
    select t.id, t.name
    from public.ppo_types t
  loop
    select coalesce(max(version), 0) + 1 into v_version
    from public.ppo_templates
    where ppo_type_id = r.id;

    update public.ppo_templates
    set active = false
    where ppo_type_id = r.id
      and active = true;

    insert into public.ppo_templates (
      ppo_type_id, name, version, description, active, threshold_score
    ) values (
      r.id,
      concat('Auto Template v', v_version),
      v_version,
      'Auto-generated template with 3 demo questions and simple images.',
      true,
      null
    )
    returning id into v_tpl_id;

    insert into public.ppo_template_questions (
      template_id, question_text, expected_standard, sort_order, active, is_critical, help_text, good_image_path, bad_image_path
    ) values
      (
        v_tpl_id,
        concat(r.name, ' - Standard work flow'),
        'Work sequence follows the standard process with minimal variation.',
        1,
        true,
        true,
        'Observe one full sequence against standard work.',
        concat('https://picsum.photos/seed/ppo_', replace(r.id::text, '-', ''), '_good_1/800/600'),
        concat('https://picsum.photos/seed/ppo_', replace(r.id::text, '-', ''), '_bad_1/800/600')
      ),
      (
        v_tpl_id,
        concat(r.name, ' - Setup and readiness'),
        'Setup is prepared in advance and transition losses are minimized.',
        2,
        true,
        false,
        'Confirm pre-staging and readiness.',
        concat('https://picsum.photos/seed/ppo_', replace(r.id::text, '-', ''), '_good_2/800/600'),
        concat('https://picsum.photos/seed/ppo_', replace(r.id::text, '-', ''), '_bad_2/800/600')
      ),
      (
        v_tpl_id,
        concat(r.name, ' - Downtime and interruption response'),
        'Stops are reacted to quickly with clear reason capture.',
        3,
        true,
        false,
        'Verify response speed and downtime reason tracking.',
        concat('https://picsum.photos/seed/ppo_', replace(r.id::text, '-', ''), '_good_3/800/600'),
        concat('https://picsum.photos/seed/ppo_', replace(r.id::text, '-', ''), '_bad_3/800/600')
      );
  end loop;
end
$$;
