-- Idempotent demo seed: Safety & Quality trigger questions (hard = all cells, soft = per cell).
-- Run after migration 20260522120000_dds_triggers.sql:
--   npx supabase db query --linked --yes -f scripts/seed-dds-triggers-demo.sql

begin;

-- ---------------------------------------------------------------------------
-- Safety — hard points (all cells)
-- ---------------------------------------------------------------------------
insert into public.dds_trigger_questions (domain, point_kind, risk_points, prompt, sort_order, master_cell_id)
select 'safety'::public.dds_trigger_domain, 'hard_point'::public.dds_trigger_point_kind, v.risk, v.prompt, v.ord, null
from (values
  ('Are walkways and exits clear of obstructions?'::text, '3'::public.dds_trigger_risk_points, 10),
  ('Is required PPE available and worn correctly?'::text, '6'::public.dds_trigger_risk_points, 20),
  ('Are emergency stops and pull cords accessible?'::text, '9'::public.dds_trigger_risk_points, 30),
  ('Is forklift / pedestrian segregation respected?'::text, '6'::public.dds_trigger_risk_points, 40),
  ('Are safety guards in place on running equipment?'::text, '3'::public.dds_trigger_risk_points, 50)
) as v(prompt, risk, ord)
where not exists (
  select 1 from public.dds_trigger_questions q
  where q.domain = 'safety' and q.point_kind = 'hard_point' and lower(q.prompt) = lower(v.prompt)
);

-- ---------------------------------------------------------------------------
-- Quality — hard points (all cells)
-- ---------------------------------------------------------------------------
insert into public.dds_trigger_questions (domain, point_kind, risk_points, prompt, sort_order, master_cell_id)
select 'quality'::public.dds_trigger_domain, 'hard_point'::public.dds_trigger_point_kind, v.risk, v.prompt, v.ord, null
from (values
  ('Is product within specification limits?'::text, '6'::public.dds_trigger_risk_points, 10),
  ('Are CCP monitors in range and calibrated?'::text, '9'::public.dds_trigger_risk_points, 20),
  ('Are labels / codes correct for the SKU?'::text, '3'::public.dds_trigger_risk_points, 30),
  ('Is line clearance completed before start?'::text, '6'::public.dds_trigger_risk_points, 40),
  ('Are holds / quarantine areas respected?'::text, '3'::public.dds_trigger_risk_points, 50)
) as v(prompt, risk, ord)
where not exists (
  select 1 from public.dds_trigger_questions q
  where q.domain = 'quality' and q.point_kind = 'hard_point' and lower(q.prompt) = lower(v.prompt)
);

-- ---------------------------------------------------------------------------
-- Safety & Quality — soft points (one set per cell)
-- ---------------------------------------------------------------------------
do $$
declare
  c record;
  s1 text;
  s2 text;
  s3 text;
  q1 text;
  q2 text;
  q3 text;
begin
  for c in select id, name from public.master_cells order by sort_order, name loop
    s1 := format('[%s] Local lockout / isolation verified before intervention?', c.name);
    s2 := format('[%s] Spill kit and absorbent stocked at line?', c.name);
    s3 := format('[%s] Near-miss or hazard reported in last 24h reviewed?', c.name);

    insert into public.dds_trigger_questions (domain, point_kind, risk_points, prompt, sort_order, master_cell_id)
    select 'safety'::public.dds_trigger_domain, 'soft_point'::public.dds_trigger_point_kind, v.risk, v.prompt, v.ord, c.id
    from (values
      (s1, '3'::public.dds_trigger_risk_points, 110),
      (s2, '6'::public.dds_trigger_risk_points, 120),
      (s3, '9'::public.dds_trigger_risk_points, 130)
    ) as v(prompt, risk, ord)
    where not exists (
      select 1 from public.dds_trigger_questions q
      where q.master_cell_id = c.id and q.domain = 'safety' and q.point_kind = 'soft_point' and lower(q.prompt) = lower(v.prompt)
    );

    q1 := format('[%s] First-off / startup check completed?', c.name);
    q2 := format('[%s] Retention samples taken per procedure?', c.name);
    q3 := format('[%s] Foreign body controls (screens, magnets) checked?', c.name);

    insert into public.dds_trigger_questions (domain, point_kind, risk_points, prompt, sort_order, master_cell_id)
    select 'quality'::public.dds_trigger_domain, 'soft_point'::public.dds_trigger_point_kind, v.risk, v.prompt, v.ord, c.id
    from (values
      (q1, '3'::public.dds_trigger_risk_points, 210),
      (q2, '6'::public.dds_trigger_risk_points, 220),
      (q3, '9'::public.dds_trigger_risk_points, 230)
    ) as v(prompt, risk, ord)
    where not exists (
      select 1 from public.dds_trigger_questions q
      where q.master_cell_id = c.id and q.domain = 'quality' and q.point_kind = 'soft_point' and lower(q.prompt) = lower(v.prompt)
    );
  end loop;
end $$;

commit;

notify pgrst, 'reload schema';
