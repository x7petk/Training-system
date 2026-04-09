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

export type LdrPersonRow = {
  id: string
  person_id: string | null
  site_id: string | null
  location_id: string | null
  status: LdrPersonStatus
  first_name: string
  last_name: string | null
  initials: string
  avatar_variant: number
  ldr_locations?: { name: string } | { name: string }[] | null
}

export type LdrActivity = {
  id: string
  name: string
  sort_order: number
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
  ldr_location_id: string | null
  rag_status: LdrRag
  comment: string
  ldr_locations?: { name: string } | { name: string }[] | null
}

export type LdrLocation = {
  id: string
  name: string
  sort_order: number
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

export function ldrLocationName(
  v: { name: string } | { name: string }[] | null | undefined,
): string {
  if (!v) return ''
  return Array.isArray(v) ? (v[0]?.name ?? '') : v.name
}
