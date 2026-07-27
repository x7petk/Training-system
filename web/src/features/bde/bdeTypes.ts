export type BdeStatus = 'saved' | 'completed'
export type BdeActionStatus = 'open' | 'in_progress' | 'completed'
export type BdeCodeKind = 'activity' | 'object_part' | 'damage' | 'cause'

export type BdeCatalogOption = {
  id: string
  label: string
  sort_order: number
  is_active: boolean
}

export type BdeRecordRow = {
  id: string
  display_id: string
  master_cell_id: string
  area_id: string | null
  equipment_id: string | null
  problem_type_id: string | null
  status: BdeStatus
  title: string
  problem_statement: string | null
  functional_location: string | null
  component_part: string | null
  what_was_checked: string | null
  notification_number: string | null
  work_order_number: string | null
  what_happened: string | null
  what_were_the_results: string | null
  created_by: string | null
  updated_by: string | null
  created_by_name: string | null
  updated_by_name: string | null
  plan24_event_id: string | null
  plan24_event_label: string | null
  dds_tl_entry_id: string | null
  dds_tl_label: string | null
  ips_reference: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type BdeRecordListRow = BdeRecordRow & {
  area_name?: string | null
  equipment_name?: string | null
  problem_type_label?: string | null
}

export type BdePhotoRow = {
  id: string
  bde_id: string
  storage_path: string
  file_name: string | null
  sort_order: number
  created_at: string
}

export type BdeActionRow = {
  id: string
  display_id: string
  bde_id: string
  title: string
  status: BdeActionStatus
  due_date: string | null
  owner_person_id: string | null
  system_text: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type BdePersonMini = {
  id: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
}

export function personLabel(p: BdePersonMini): string {
  const a = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  return a || p.display_name || p.id.slice(0, 8)
}

export function bdeStatusLabel(s: BdeStatus): string {
  return s === 'completed' ? 'Completed' : 'Saved'
}

export function bdeActionStatusLabel(s: BdeActionStatus): string {
  if (s === 'completed') return 'Completed'
  if (s === 'in_progress') return 'In Progress'
  return 'Open'
}

export const BDE_CODE_KIND_META: Record<
  BdeCodeKind,
  { label: string; letter: string; table: string }
> = {
  activity: { label: 'Activity Code', letter: 'A', table: 'bde_activity_codes' },
  object_part: { label: 'Object Part', letter: 'O', table: 'bde_object_part_codes' },
  damage: { label: 'Damage Code', letter: 'D', table: 'bde_damage_codes' },
  cause: { label: 'Cause Code', letter: 'C', table: 'bde_cause_codes' },
}

export const BDE_MAX_PHOTOS = 8
export const BDE_PHOTO_BUCKET = 'bde-photos'
export const BDE_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const BDE_MAX_PHOTO_BYTES = 8 * 1024 * 1024
