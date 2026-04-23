-- Backfill CIL template tasks with standard text, placeholder reference images (HTTPS),
-- check types, and when_condition where still empty. Safe to re-run: skips non-empty fields.
--
-- Run (linked remote):
--   node_modules/supabase/bin/supabase db query --linked --yes -f scripts/update-cil-template-tasks-standards-photos.sql

begin;

update public.plan24_cil_check_template_tasks t
set
  standard_description = case
    when trim(coalesce(t.standard_description, '')) <> '' then t.standard_description
    when lower(trim(t.label)) = 'product cleared from belt' then
      E'Standard\n• Belt, guides, and catch pans are visibly free of product, film, and debris.\n• Scrap removed to waste stream; no rework material left on line.\n• Guards closed after clearance; photo shows clean run path.'
    when lower(trim(t.label)) = 'drain ports opened' then
      E'Standard\n• Low-point drains opened per SOP sequence; verify flow to drain.\n• No standing fluid in dead legs after minimum drain time.\n• Caps tagged or staged for re-close after rinse.'
    when lower(trim(t.label)) = 'rinse flow rate in range' then
      E'Standard\n• Flow within band on local indicator or SCADA tag for this step.\n• No cavitation noise at pump; strainer differential within limit if applicable.\n• Logged value matches shift target for rinse phase.'
    when lower(trim(t.label)) = 'conductivity trend stable' then
      E'Standard\n• Conductivity curve flat or declining per SOP (no sudden spikes).\n• Sample point flushed before read if required.\n• Escalate if trend violates release criteria for end-of-rinse.'
    else
      trim(t.label)
        || E'\n\nStandard:\n• Complete per area SOP before sign-off.\n• Use Report defect for any gap versus this standard.\n• Replace this text in admin with the full work instruction when ready.'
  end,
  photo_path = case
    when trim(coalesce(t.photo_path, '')) <> '' then t.photo_path
    when lower(trim(t.label)) = 'product cleared from belt' then 'https://placehold.co/360x240/0f7668/ffffff/png?text=Product+cleared'
    when lower(trim(t.label)) = 'drain ports opened' then 'https://placehold.co/360x240/0e7490/ffffff/png?text=Drain+ports'
    when lower(trim(t.label)) = 'rinse flow rate in range' then 'https://placehold.co/360x240/155e75/ffffff/png?text=Flow+rate'
    when lower(trim(t.label)) = 'conductivity trend stable' then 'https://placehold.co/360x240/115e59/ffffff/png?text=Conductivity'
    else 'https://placehold.co/360x240/0d9488/ffffff/png?text=CIL+task'
  end,
  check_types = case
    when t.check_types is not null and cardinality(t.check_types) > 0 then t.check_types
    when lower(trim(t.label)) in ('rinse flow rate in range') then array['inspection']::text[]
    when lower(trim(t.label)) in ('conductivity trend stable') then array['inspection']::text[]
    else array['cleaning', 'inspection']::text[]
  end,
  when_condition = coalesce(t.when_condition, case
    when lower(trim(t.label)) = 'drain ports opened' then 'down'::text
    else 'running'::text
  end)
where true;

commit;
