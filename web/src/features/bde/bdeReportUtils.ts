import type { BdeActionStatus, BdeCodeKind, BdeRecordRow, BdeStatus } from './bdeTypes'

export type BdeTimePreset =
  | '24h'
  | '3d'
  | '30d'
  | '90d'
  | 'prev_week'
  | 'curr_week'
  | 'all'

export const BDE_TIME_PRESETS: { id: BdeTimePreset; label: string }[] = [
  { id: '24h', label: 'Last 24h' },
  { id: '3d', label: 'Last 3 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: '90d', label: 'Last 90 Days' },
  { id: 'prev_week', label: 'Previous Week' },
  { id: 'curr_week', label: 'Current Week' },
  { id: 'all', label: 'All' },
]

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function mondayOfWeek(d: Date): Date {
  const x = startOfLocalDay(d)
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  return x
}

/** Inclusive range [from, to] as ISO strings; null from means unbounded. */
export function rangeForPreset(preset: BdeTimePreset, now = new Date()): { from: Date | null; to: Date } {
  const to = now
  if (preset === 'all') return { from: null, to }

  if (preset === '24h') {
    return { from: new Date(now.getTime() - 24 * 60 * 60 * 1000), to }
  }
  if (preset === '3d') {
    return { from: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), to }
  }
  if (preset === '30d') {
    return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to }
  }
  if (preset === '90d') {
    return { from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), to }
  }

  const thisMonday = mondayOfWeek(now)
  if (preset === 'curr_week') {
    return { from: thisMonday, to }
  }
  // previous week Mon 00:00 → Sun 23:59:59.999
  const prevMonday = new Date(thisMonday)
  prevMonday.setDate(prevMonday.getDate() - 7)
  const prevSundayEnd = new Date(thisMonday)
  prevSundayEnd.setMilliseconds(-1)
  return { from: prevMonday, to: prevSundayEnd }
}

export function inTimeRange(iso: string, from: Date | null, to: Date): boolean {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  if (from && t < from.getTime()) return false
  if (t > to.getTime()) return false
  return true
}

export type BdeEnrichedRecord = BdeRecordRow & {
  area_name: string | null
  equipment_name: string | null
  problem_type_label: string | null
  line_id: string | null
  line_name: string | null
}

export function matchesSearch(row: BdeEnrichedRecord, q: string): boolean {
  if (!q) return true
  const hay = [
    row.display_id,
    row.title,
    row.problem_statement,
    row.area_name,
    row.equipment_name,
    row.problem_type_label,
    row.created_by_name,
    row.functional_location,
    row.component_part,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

export function statusCounts(rows: { status: BdeStatus }[]) {
  let saved = 0
  let completed = 0
  for (const r of rows) {
    if (r.status === 'completed') completed += 1
    else saved += 1
  }
  return { saved, completed, total: rows.length }
}

export function problemTypeCounts(rows: BdeEnrichedRecord[]) {
  const map = new Map<string, number>()
  for (const r of rows) {
    const key = r.problem_type_label?.trim() || 'Unspecified'
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export function actionStatusCounts(rows: { status: BdeActionStatus }[]) {
  let open = 0
  let in_progress = 0
  let completed = 0
  for (const r of rows) {
    if (r.status === 'completed') completed += 1
    else if (r.status === 'in_progress') in_progress += 1
    else open += 1
  }
  return { open, in_progress, completed, total: rows.length }
}

export function localYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(ymd + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return localYmd(d)
}

/** AODC pattern key from selected code labels (first letter of each kind present). */
export function aodcPatternKey(kindsPresent: Set<BdeCodeKind>): string {
  let s = ''
  if (kindsPresent.has('activity')) s += 'A'
  if (kindsPresent.has('object_part')) s += 'O'
  if (kindsPresent.has('damage')) s += 'D'
  if (kindsPresent.has('cause')) s += 'C'
  return s || '—'
}

export function formatReportWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function formatReportDate(isoOrYmd: string) {
  try {
    const d = isoOrYmd.length <= 10 ? new Date(isoOrYmd + 'T12:00:00') : new Date(isoOrYmd)
    return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return isoOrYmd
  }
}

export type BdeReportFiltersState = {
  preset: BdeTimePreset
  search: string
  areaId: string
  equipmentId: string
  createdBy: string
  statusFilter: '' | 'saved' | 'completed'
  problemTypeLabel: string
}

export const defaultBdeReportFilters = (): BdeReportFiltersState => ({
  preset: 'all',
  search: '',
  areaId: '',
  equipmentId: '',
  createdBy: '',
  statusFilter: '',
  problemTypeLabel: '',
})
