export type LdrRag = 'none' | 'green' | 'yellow' | 'red'

export type LdrPersonStatus =
  | 'available'
  | 'leave'
  | 'training'
  | 'travel'
  | 'sick'
  | 'off_site'

export type LdrSite = {
  id: string
  code: string
  name: string
  is_active: boolean
}

export type LdrMasterCellJoin = {
  name: string
  master_plants?: { name: string } | { name: string }[] | null
}

export type LdrPersonRow = {
  id: string
  workspace_id?: string
  site_id: string | null
  /** @deprecated Use master_cell_id; kept for older rows. */
  location_id: string | null
  master_cell_id: string | null
  status: LdrPersonStatus
  first_name: string
  last_name: string | null
  initials: string
  avatar_variant: number
  master_cells?: LdrMasterCellJoin | LdrMasterCellJoin[] | null
}

export type LdrActivity = {
  id: string
  name: string
  sort_order: number
  workspace_id?: string
}

export type LdrEventRow = {
  id: string
  title: string
  site_id: string | null
  start_date: string
  end_date: string
  color: string
  notes: string
}

export type LdrAssignmentRow = {
  id: string
  ldr_person_id: string
  activity_id: string
  assignment_date: string
  workspace_id?: string
  /** @deprecated Use master_cell_id. */
  ldr_location_id: string | null
  master_cell_id: string | null
  rag_status: LdrRag
  comment: string
  master_cells?: LdrMasterCellJoin | LdrMasterCellJoin[] | null
}

export const LDR_PERSON_STATUS_OPTIONS: { value: LdrPersonStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'leave', label: 'Leave' },
  { value: 'training', label: 'Training' },
  { value: 'travel', label: 'Travel' },
  { value: 'sick', label: 'Sick' },
  { value: 'off_site', label: 'Off-site' },
]

export const EVENT_COLOR_PRESETS = [
  '#6366f1',
  '#0d9488',
  '#e11d48',
  '#f59e0b',
  '#22c55e',
  '#8b5cf6',
  '#64748b',
]

export const LDR_AVATAR_VARIANTS = [1, 2, 3, 4, 5, 6, 7, 8] as const

export function ldrPersonFullName(person: Pick<LdrPersonRow, 'first_name' | 'last_name'>): string {
  return [person.first_name, person.last_name ?? ''].join(' ').trim() || 'Person'
}

export function ldrInitialsFromNames(firstName: string, lastName: string): string {
  const a = firstName.trim().slice(0, 1)
  const b = lastName.trim().slice(0, 1)
  return (a + b).toUpperCase() || 'LD'
}

function firstJoinRow<T>(v: T | T[] | null | undefined): T | undefined {
  if (!v) return undefined
  return Array.isArray(v) ? v[0] : v
}

/** Cell name only (from embedded master_cells). */
export function ldrMasterCellName(
  v: LdrMasterCellJoin | LdrMasterCellJoin[] | null | undefined,
): string {
  const row = firstJoinRow(v)
  return row?.name?.trim() ?? ''
}

/** "Plant · Cell" for display. */
export function ldrMasterCellLabel(
  v: LdrMasterCellJoin | LdrMasterCellJoin[] | null | undefined,
): string {
  const row = firstJoinRow(v)
  if (!row) return ''
  const plant = firstJoinRow(row.master_plants)
  const pn = plant?.name?.trim()
  const cn = row.name?.trim() ?? ''
  return pn ? `${pn} · ${cn}` : cn
}

/** Resolve display join from master_cell_id using client-side master data (avoids PostgREST embed). */
export function ldrMasterCellJoinFromId(
  masterCellId: string | null | undefined,
  byId: ReadonlyMap<string, LdrMasterCellJoin>,
): LdrMasterCellJoin | undefined {
  if (!masterCellId) return undefined
  return byId.get(masterCellId)
}

export function isMissingMasterCellColumnError(message: string | null | undefined): boolean {
  return typeof message === 'string' && message.includes('master_cell_id')
}
