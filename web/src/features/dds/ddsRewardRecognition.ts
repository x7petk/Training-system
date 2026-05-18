/** DDS surfaces where Reward & Recognition rows can appear. */
export const DDS_RR_SURFACE_KEYS = ['shift-dds', 'line-dds', 'site-dds'] as const

export type DdsRrSurfaceKey = (typeof DDS_RR_SURFACE_KEYS)[number]

export const DDS_RR_SURFACE_LABELS: Record<DdsRrSurfaceKey, string> = {
  'shift-dds': 'Shift',
  'line-dds': 'Line',
  'site-dds': 'Site',
}

export type DdsRrNameMode = 'one_person' | 'multiple_people' | 'free_text'

export const DDS_RR_NAME_MODE_OPTIONS: { value: DdsRrNameMode; label: string }[] = [
  { value: 'one_person', label: 'One person' },
  { value: 'multiple_people', label: 'Multiple people' },
  { value: 'free_text', label: 'Guest (not in directory)' },
]

export type DdsRrValueOption = { id: string; sort_order: number; label: string }

export type DdsRrBehaviourOption = {
  id: string
  value_option_id: string
  sort_order: number
  label: string
}

export type DdsRrEntryRow = {
  id: string
  root_entry_id: string | null
  master_cell_id: string
  plan_date: string
  shift_kind: string
  visible_surface: DdsRrSurfaceKey
  created_on_surface: DdsRrSurfaceKey
  name_mode: DdsRrNameMode
  free_text_names: string | null
  reason: string
  value_option_id: string
  behaviour_option_id: string
  promoted_from_entry_id: string | null
  promoted_from_surface: DdsRrSurfaceKey | null
  promoted_from_cell_id: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  person_ids: string[]
}

/** Show promoted-from cell name on badge (Site / Plant roll-up only). */
export function ddsRrShowPromotedCellName(surface: DdsRrSurfaceKey | 'plant-dds'): boolean {
  return surface === 'site-dds' || surface === 'plant-dds'
}

/** Next promotion target: Shift → Line → Site (no Plant). */
export function ddsRrPromoteTarget(surface: DdsRrSurfaceKey): DdsRrSurfaceKey | null {
  if (surface === 'shift-dds') return 'line-dds'
  if (surface === 'line-dds') return 'site-dds'
  return null
}

export function isDdsRrSurfaceKey(s: string): s is DdsRrSurfaceKey {
  return (DDS_RR_SURFACE_KEYS as readonly string[]).includes(s)
}
