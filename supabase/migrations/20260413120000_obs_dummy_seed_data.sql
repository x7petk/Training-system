-- Seed dummy SOS/QOS/PPO types, templates, and questions for each LDR workspace.

-- ---------------------------------------------------------------------------
-- SOS
-- ---------------------------------------------------------------------------

with ws as (
  select id as workspace_id from public.ldr_workspaces
),
sos_type_seed(name, sort_order, description) as (
  values
    ('SOS Housekeeping Walk', 10, 'Demo type for housekeeping and visual safety checks.'),
    ('SOS PPE Compliance', 20, 'Demo type for PPE and behavior observation.')
),
ins_types as (
  insert into public.sos_types (workspace_id, name, description, active, sort_order, ldr_activity_id)
  select ws.workspace_id, s.name, s.description, true, s.sort_order, null
  from ws
  cross join sos_type_seed s
  where not exists (
    select 1
    from public.sos_types t
    where t.workspace_id = ws.workspace_id and lower(t.name) = lower(s.name)
  )
  returning id
),
target_types as (
  select t.id, t.workspace_id, t.name
  from public.sos_types t
  where lower(t.name) in ('sos housekeeping walk', 'sos ppe compliance')
),
ins_templates as (
  insert into public.sos_templates (sos_type_id, name, version, description, active)
  select tt.id, 'Template v1', 1, 'Seeded demo template.', true
  from target_types tt
  where not exists (
    select 1 from public.sos_templates st where st.sos_type_id = tt.id and st.version = 1
  )
  returning id
),
target_templates as (
  select st.id, st.sos_type_id
  from public.sos_templates st
  join target_types tt on tt.id = st.sos_type_id
  where st.version = 1
)
insert into public.sos_template_questions (
  template_id,
  question_text,
  expected_standard,
  sort_order,
  active,
  is_critical,
  help_text,
  good_image_path,
  bad_image_path
)
select
  tpl.id,
  q.question_text,
  q.expected_standard,
  q.sort_order,
  true,
  q.is_critical,
  q.help_text,
  q.good_image_path,
  q.bad_image_path
from target_templates tpl
cross join (
  values
    (
      'Are walkways and exits clear from obstructions?',
      'Walkways and emergency exits are fully clear and marked.',
      1,
      true,
      'Remove temporary materials immediately and mark dedicated storage zones.',
      'https://picsum.photos/seed/sos_good_1/800/600',
      'https://picsum.photos/seed/sos_bad_1/800/600'
    ),
    (
      'Are operators wearing required PPE correctly?',
      'Helmet, eye protection, and gloves are worn according to standard.',
      2,
      true,
      'Confirm signage and PPE station stock before shift start.',
      'https://picsum.photos/seed/sos_good_2/800/600',
      'https://picsum.photos/seed/sos_bad_2/800/600'
    ),
    (
      'Is the area clean and free of spill risks?',
      'No spills, leaks, or waste accumulation in work area.',
      3,
      false,
      'Use 5S checks at shift handover.',
      'https://picsum.photos/seed/sos_good_3/800/600',
      'https://picsum.photos/seed/sos_bad_3/800/600'
    )
) as q(question_text, expected_standard, sort_order, is_critical, help_text, good_image_path, bad_image_path)
where not exists (
  select 1
  from public.sos_template_questions sq
  where sq.template_id = tpl.id and lower(sq.question_text) = lower(q.question_text)
);

-- ---------------------------------------------------------------------------
-- QOS
-- ---------------------------------------------------------------------------

with ws as (
  select id as workspace_id from public.ldr_workspaces
),
qos_type_seed(name, sort_order, description) as (
  values
    ('QOS Label Accuracy', 10, 'Demo type for product labeling and identification quality checks.'),
    ('QOS Changeover Quality', 20, 'Demo type for setup and first-piece verification.')
),
ins_types as (
  insert into public.qos_types (workspace_id, name, description, active, sort_order, ldr_activity_id)
  select ws.workspace_id, s.name, s.description, true, s.sort_order, null
  from ws
  cross join qos_type_seed s
  where not exists (
    select 1
    from public.qos_types t
    where t.workspace_id = ws.workspace_id and lower(t.name) = lower(s.name)
  )
  returning id
),
target_types as (
  select t.id, t.workspace_id, t.name
  from public.qos_types t
  where lower(t.name) in ('qos label accuracy', 'qos changeover quality')
),
ins_templates as (
  insert into public.qos_templates (qos_type_id, name, version, description, active)
  select tt.id, 'Template v1', 1, 'Seeded demo template.', true
  from target_types tt
  where not exists (
    select 1 from public.qos_templates qt where qt.qos_type_id = tt.id and qt.version = 1
  )
  returning id
),
target_templates as (
  select qt.id, qt.qos_type_id
  from public.qos_templates qt
  join target_types tt on tt.id = qt.qos_type_id
  where qt.version = 1
)
insert into public.qos_template_questions (
  template_id,
  question_text,
  expected_standard,
  sort_order,
  active,
  is_critical,
  help_text,
  good_image_path,
  bad_image_path
)
select
  tpl.id,
  q.question_text,
  q.expected_standard,
  q.sort_order,
  true,
  q.is_critical,
  q.help_text,
  q.good_image_path,
  q.bad_image_path
from target_templates tpl
cross join (
  values
    (
      'Does the label match batch and product code?',
      'All printed labels match work order and product specification.',
      1,
      true,
      'Cross-check sample label against ERP order before run.',
      'https://picsum.photos/seed/qos_good_1/800/600',
      'https://picsum.photos/seed/qos_bad_1/800/600'
    ),
    (
      'Is first-piece inspection signed and within tolerance?',
      'First-piece dimensions are recorded and approved within limits.',
      2,
      true,
      'Use calibrated gauge and capture result in startup sheet.',
      'https://picsum.photos/seed/qos_good_2/800/600',
      'https://picsum.photos/seed/qos_bad_2/800/600'
    ),
    (
      'Are reject bins identified and separated?',
      'Reject material is clearly tagged and isolated from good product.',
      3,
      false,
      'Apply red-tag at source and verify route to QA hold area.',
      'https://picsum.photos/seed/qos_good_3/800/600',
      'https://picsum.photos/seed/qos_bad_3/800/600'
    )
) as q(question_text, expected_standard, sort_order, is_critical, help_text, good_image_path, bad_image_path)
where not exists (
  select 1
  from public.qos_template_questions qq
  where qq.template_id = tpl.id and lower(qq.question_text) = lower(q.question_text)
);

-- ---------------------------------------------------------------------------
-- PPO
-- ---------------------------------------------------------------------------

with ws as (
  select id as workspace_id from public.ldr_workspaces
),
ppo_type_seed(name, sort_order, description) as (
  values
    ('PPO Cycle Time Discipline', 10, 'Demo type for flow and cycle-time adherence checks.'),
    ('PPO Changeover Efficiency', 20, 'Demo type for setup-loss and handoff checks.')
),
ins_types as (
  insert into public.ppo_types (workspace_id, name, description, active, sort_order, ldr_activity_id)
  select ws.workspace_id, s.name, s.description, true, s.sort_order, null
  from ws
  cross join ppo_type_seed s
  where not exists (
    select 1
    from public.ppo_types t
    where t.workspace_id = ws.workspace_id and lower(t.name) = lower(s.name)
  )
  returning id
),
target_types as (
  select t.id, t.workspace_id, t.name
  from public.ppo_types t
  where lower(t.name) in ('ppo cycle time discipline', 'ppo changeover efficiency')
),
ins_templates as (
  insert into public.ppo_templates (ppo_type_id, name, version, description, active)
  select tt.id, 'Template v1', 1, 'Seeded demo template.', true
  from target_types tt
  where not exists (
    select 1 from public.ppo_templates pt where pt.ppo_type_id = tt.id and pt.version = 1
  )
  returning id
),
target_templates as (
  select pt.id, pt.ppo_type_id
  from public.ppo_templates pt
  join target_types tt on tt.id = pt.ppo_type_id
  where pt.version = 1
)
insert into public.ppo_template_questions (
  template_id,
  question_text,
  expected_standard,
  sort_order,
  active,
  is_critical,
  help_text,
  good_image_path,
  bad_image_path
)
select
  tpl.id,
  q.question_text,
  q.expected_standard,
  q.sort_order,
  true,
  q.is_critical,
  q.help_text,
  q.good_image_path,
  q.bad_image_path
from target_templates tpl
cross join (
  values
    (
      'Is operator following the standard work sequence?',
      'Task sequence and timing match posted standard work.',
      1,
      true,
      'Observe at least one full cycle and compare to takt breakdown.',
      'https://picsum.photos/seed/ppo_good_1/800/600',
      'https://picsum.photos/seed/ppo_bad_1/800/600'
    ),
    (
      'Are changeover tools staged before machine stop?',
      'Required tools and materials are prepared before changeover starts.',
      2,
      false,
      'Use staging checklist and visual kit board.',
      'https://picsum.photos/seed/ppo_good_2/800/600',
      'https://picsum.photos/seed/ppo_bad_2/800/600'
    ),
    (
      'Is downtime reason captured immediately?',
      'Any stop >1 min has reason logged in real time.',
      3,
      false,
      'Use andon/downtime log at point of occurrence.',
      'https://picsum.photos/seed/ppo_good_3/800/600',
      'https://picsum.photos/seed/ppo_bad_3/800/600'
    )
) as q(question_text, expected_standard, sort_order, is_critical, help_text, good_image_path, bad_image_path)
where not exists (
  select 1
  from public.ppo_template_questions pq
  where pq.template_id = tpl.id and lower(pq.question_text) = lower(q.question_text)
);
