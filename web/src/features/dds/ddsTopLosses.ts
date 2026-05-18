/** DDS surfaces where Top Losses rows can appear (starts at Line DDS). */
export const DDS_TL_SURFACE_KEYS = ['line-dds', 'site-dds'] as const

export type DdsTlSurfaceKey = (typeof DDS_TL_SURFACE_KEYS)[number]

export const DDS_TL_SURFACE_LABELS: Record<DdsTlSurfaceKey, string> = {
  'line-dds': 'Line',
  'site-dds': 'Site',
}

export type DdsTlConfigOption = { id: string; sort_order: number; label: string }

export type DdsTlEntryRow = {
  id: string
  root_entry_id: string | null
  master_cell_id: string
  plan_date: string
  shift_kind: string
  visible_surface: DdsTlSurfaceKey
  created_on_surface: DdsTlSurfaceKey
  top_loss: string
  amount: string
  type_option_id: string
  immediate_cause: string
  immediate_action: string
  root_cause_option_id: string
  problem_solve_option_id: string
  promoted_from_entry_id: string | null
  promoted_from_surface: DdsTlSurfaceKey | null
  promoted_from_cell_id: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export function ddsTlShowPromotedCellName(surface: DdsTlSurfaceKey | 'plant-dds'): boolean {
  return surface === 'site-dds' || surface === 'plant-dds'
}

/** Line → Site (no Shift level for Top Losses). */
export function ddsTlPromoteTarget(surface: DdsTlSurfaceKey): DdsTlSurfaceKey | null {
  if (surface === 'line-dds') return 'site-dds'
  return null
}
