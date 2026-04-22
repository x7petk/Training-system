with target_cell as (
  select id
  from public.master_cells
  order by id
  limit 1
),
seed_rows as (
  select *
  from (
    values
      ('DH demo - Exposed cable near wash station', 'Cable not secured behind panel; risk during cleaning.', 'Packing', 'Line 1', 'safety', 'open', 'critical'),
      ('DH demo - Seal wear on hopper lid', 'Gasket has visible wear and can affect product protection.', 'Processing', 'Hopper 2', 'quality', 'in_progress', 'high'),
      ('DH demo - Floor drain missing grid', 'Drain cover missing; base condition needs correction.', 'Utilities', 'Drain A3', 'base_condition', 'open', 'high'),
      ('DH demo - Powder residue under conveyor', 'Source of contamination found below transfer point.', 'Processing', 'Conveyor 4', 'source_of_contamination', 'resolved', 'medium'),
      ('DH demo - No access for weekly clean', 'Clean-out point is hard to reach without temporary setup.', 'Packing', 'Top Deck Packer', 'hard_to_reach', 'in_progress', 'medium'),
      ('DH demo - Unnecessary spare hose stored in zone', 'Item is not required for operation and should be removed.', 'Warehouse', 'Zone B Rack', 'unnecessary_items', 'open', 'low')
  ) as v(title, description, area, equipment, type_slug, status, priority)
),
resolved_types as (
  select
    sr.*,
    dt.id as defect_type_id
  from seed_rows sr
  join public.dh_defect_types dt on dt.slug = sr.type_slug
)
insert into public.dh_defects (
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
  rt.defect_type_id,
  rt.title,
  rt.description,
  rt.area,
  rt.equipment,
  rt.status,
  rt.priority,
  concat(rt.area, ' / ', rt.equipment),
  null
from target_cell tc
join resolved_types rt on true
where not exists (
  select 1
  from public.dh_defects d
  where d.master_cell_id = tc.id
    and d.title = rt.title
    and d.deleted_at is null
);
