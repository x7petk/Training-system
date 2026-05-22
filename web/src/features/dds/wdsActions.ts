import { compareYMD, localYMD } from '../../lib/dueDateUtils'

export const WDS_ACTION_KINDS = ['system', 'capability'] as const
export type WdsActionKind = (typeof WDS_ACTION_KINDS)[number]

export const WDS_ACTION_STATUSES = [
  'not_started',
  'in_progress',
  'off_track',
  'completed',
  'not_required',
] as const
export type WdsActionStatus = (typeof WDS_ACTION_STATUSES)[number]

export const WDS_ACTION_KIND_LABELS: Record<WdsActionKind, string> = {
  system: 'System',
  capability: 'Capability',
}

export const WDS_ACTION_STATUS_LABELS: Record<WdsActionStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  off_track: 'Off track',
  completed: 'Completed',
  not_required: 'Not required',
}

/** Open actions shown by default on WDS tiles and in the actions list. */
export const WDS_ACTION_ACTIVE_STATUSES: readonly WdsActionStatus[] = ['not_started', 'in_progress', 'off_track']

export type WdsActionListFilter = {
  showCompleted: boolean
  showNotRequired: boolean
}

export function wdsActionMatchesListFilter(action: WdsActionRow, filter: WdsActionListFilter): boolean {
  if (WDS_ACTION_ACTIVE_STATUSES.includes(action.status)) return true
  if (action.status === 'completed' && filter.showCompleted) return true
  if (action.status === 'not_required' && filter.showNotRequired) return true
  return false
}

export function wdsFilterActions(actions: WdsActionRow[], filter: WdsActionListFilter): WdsActionRow[] {
  return actions.filter((a) => wdsActionMatchesListFilter(a, filter))
}

export type WdsActionRow = {
  id: string
  dds_wds_column_id: string
  master_cell_id: string
  kind: WdsActionKind
  title: string
  owner_name: string
  target_date: string
  status: WdsActionStatus
  hc_type_id: string | null
  sort_order: number
}

export function parseWdsActionKind(raw: unknown): WdsActionKind {
  return raw === 'capability' ? 'capability' : 'system'
}

export function parseWdsActionStatus(raw: unknown): WdsActionStatus {
  const v = String(raw ?? '')
  if (WDS_ACTION_STATUSES.includes(v as WdsActionStatus)) return v as WdsActionStatus
  return 'not_started'
}

export function wdsActionCounts(actions: WdsActionRow[], todayYmd: string = localYMD(new Date())) {
  const total = actions.length
  const overdue = actions.filter((a) => wdsActionIsOverdue(a, todayYmd)).length
  return { total, overdue }
}

export function wdsActionIsOverdue(action: WdsActionRow, todayYmd: string): boolean {
  if (action.status === 'completed' || action.status === 'not_required') return false
  return compareYMD(action.target_date, todayYmd) < 0
}

export function wdsActionStatusClass(status: WdsActionStatus): string {
  if (status === 'completed') return 'border-emerald-500/50 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200'
  if (status === 'not_required') return 'border-zinc-500/50 bg-zinc-400/20 text-fg'
  if (status === 'off_track') return 'border-rose-500/50 bg-rose-500/15 text-rose-900 dark:text-rose-200'
  if (status === 'in_progress') return 'border-sky-500/50 bg-sky-500/15 text-sky-900 dark:text-sky-200'
  return 'border-border/80 bg-surface-raised/40 text-muted'
}

export function wdsActionKindClass(kind: WdsActionKind): string {
  if (kind === 'system') return 'border-violet-500/35 bg-violet-500/10 text-violet-900 dark:text-violet-200'
  return 'border-teal-500/35 bg-teal-500/10 text-teal-900 dark:text-teal-200'
}

export function wdsActionCardAccentClass(status: WdsActionStatus, overdue: boolean): string {
  if (overdue) return 'border-l-rose-500'
  if (status === 'completed') return 'border-l-emerald-500'
  if (status === 'off_track') return 'border-l-rose-400'
  if (status === 'in_progress') return 'border-l-sky-500'
  if (status === 'not_required') return 'border-l-zinc-400'
  return 'border-l-border-strong'
}
