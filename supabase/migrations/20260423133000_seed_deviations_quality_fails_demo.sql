with target_cell as (
  select id
  from public.master_cells
  order by id
  limit 1
),
deviation_seed as (
  select *
  from (
    values
      ('DEV demo - Parameter drift on filler', 'Filler speed exceeds validated range during second shift.', 'Packaging', 'Filler 2', 'parameter_out_of_range', 'open', 'high'),
      ('DEV demo - Checklist signed late', 'Line startup checklist was completed after production started.', 'Processing', 'Line 3', 'documentation_deviation', 'in_progress', 'medium'),
      ('DEV demo - Missing step in changeover', 'Required flush step skipped in changeover SOP.', 'Processing', 'Mixer 1', 'procedure_not_followed', 'open', 'critical'),
      ('DEV demo - Verification entry missing', 'Operator completed setup but verification record not captured.', 'Packing', 'Top Deck', 'missing_verification', 'resolved', 'medium'),
      ('DEV demo - Temporary workaround used', 'Unapproved temporary sequence used to recover throughput.', 'Utilities', 'Conveyor 2', 'process_deviation', 'in_progress', 'high'),
      ('DEV demo - Other deviation note', 'Observed non-standard execution requiring follow-up.', 'Warehouse', 'Gate A', 'other', 'open', 'low')
  ) as v(title, description, area, equipment, type_slug, status, priority)
),
resolved_deviation_types as (
  select
    ds.*,
    dt.id as defect_type_id
  from deviation_seed ds
  join public.deviation_types dt on dt.slug = ds.type_slug
)
insert into public.deviations (
  master_cell_id,
  defect_type_id,
  title,
  description,
  area,
  equipment,
  status,
  priority,
  location_summary,
  created_by
)
select
  tc.id,
  rd.defect_type_id,
  rd.title,
  rd.description,
  rd.area,
  rd.equipment,
  rd.status,
  rd.priority,
  concat(rd.area, ' / ', rd.equipment),
  null
from target_cell tc
join resolved_deviation_types rd on true
where not exists (
  select 1
  from public.deviations d
  where d.master_cell_id = tc.id
    and d.title = rd.title
    and d.deleted_at is null
);

insert into public.quality_fails (
  master_cell_id,
  defect_type_id,
  title,
  description,
  area,
  equipment,
  status,
  priority,
  location_summary,
  created_by
)
with target_cell as (
  select id
  from public.master_cells
  order by id
  limit 1
),
quality_fail_seed as (
  select *
  from (
    values
      ('QF demo - Incorrect back label', 'Back label template mismatch found on finished goods.', 'Packaging', 'Labeler 1', 'labeling_error', 'open', 'high'),
      ('QF demo - Seal wrinkle detected', 'Seal line wrinkle seen on random sample from lot.', 'Packaging', 'Sealer 3', 'seal_integrity', 'in_progress', 'high'),
      ('QF demo - Foreign particle in sample', 'Small foreign particle detected during inspection.', 'Processing', 'Sifter 2', 'foreign_material', 'open', 'critical'),
      ('QF demo - Underweight pouches', 'Average pouch weight below lower spec limit.', 'Packing', 'Weigher 1', 'weight_volume', 'resolved', 'medium'),
      ('QF demo - Cosmetic print defect', 'Batch print clarity below visual acceptance criteria.', 'Packaging', 'Coder 2', 'visual_defect', 'in_progress', 'medium'),
      ('QF demo - Other quality fail', 'Quality event requiring investigation and closure evidence.', 'Warehouse', 'Dispatch Bay', 'other', 'open', 'low')
  ) as v(title, description, area, equipment, type_slug, status, priority)
),
resolved_quality_fail_types as (
  select
    qs.*,
    qt.id as defect_type_id
  from quality_fail_seed qs
  join public.quality_fail_types qt on qt.slug = qs.type_slug
)
select
  tc.id,
  rq.defect_type_id,
  rq.title,
  rq.description,
  rq.area,
  rq.equipment,
  rq.status,
  rq.priority,
  concat(rq.area, ' / ', rq.equipment),
  null
from target_cell tc
join resolved_quality_fail_types rq on true
where not exists (
  select 1
  from public.quality_fails q
  where q.master_cell_id = tc.id
    and q.title = rq.title
    and q.deleted_at is null
);
