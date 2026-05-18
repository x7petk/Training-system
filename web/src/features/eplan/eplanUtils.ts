import { addDays, addMonths, compareYMD, localYMD } from '../../lib/dueDateUtils'
import type { EPlanAction, EPlanActionStatus, EPlanAdminStore, EPlanDisplayRow, EPlanPageFilters } from './eplanTypes'

export function eplanFormatDisplayDate(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y.slice(-2)}`
}

export function eplanAddDaysYmd(ymd: string, n: number): string {
  return localYMD(addDays(new Date(ymd + 'T12:00:00'), n))
}

export function eplanDefaultDateRange(): { from: string; to: string } {
  const today = new Date()
  const from = `${today.getFullYear()}-01-01`
  const toY = new Date(today)
  toY.setMonth(toY.getMonth() + 12)
  return { from, to: localYMD(toY) }
}

export function eplanIsOverdue(action: EPlanAction, todayYmd: string): boolean {
  if (action.status === 'COMPLETED' || action.status === 'NOT_REQUIRED') return false
  return compareYMD(action.endDate, todayYmd) < 0
}

export function eplanActionProgress(
  action: EPlanAction,
  allInCell: EPlanAction[],
): number | null {
  const children = allInCell.filter((a) => a.parentActionId === action.id)
  if (children.length > 0) {
    const done = children.filter((c) => c.status === 'COMPLETED').length
    return Math.round((done / children.length) * 100)
  }
  if (action.status === 'COMPLETED') return 100
  if (action.status === 'NOT_STARTED') return 0
  if (typeof action.progress === 'number') return Math.min(100, Math.max(0, action.progress))
  return 0
}

export function eplanMatchesFilters(
  action: EPlanAction,
  filters: EPlanPageFilters,
  todayYmd: string,
): boolean {
  if (!filters.showNotRequired && action.status === 'NOT_REQUIRED') return false
  if (filters.status !== 'all' && action.status !== filters.status) return false
  if (filters.ogsmPillarId !== 'all' && action.ogsmPillarId !== filters.ogsmPillarId) return false
  if (filters.forumId !== 'all' && action.forumId !== filters.forumId) return false
  if (filters.actionOwnerId !== 'all' && action.actionOwnerId !== filters.actionOwnerId) return false
  if (filters.labelId !== 'all' && action.labelId !== filters.labelId) return false
  if (filters.lossTypeId !== 'all' && action.lossTypeId !== filters.lossTypeId) return false
  if (filters.raisedById !== 'all' && action.raisedById !== filters.raisedById) return false
  if (compareYMD(action.endDate, filters.dateFrom) < 0) return false
  if (compareYMD(action.startDate, filters.dateTo) > 0) return false
  void todayYmd
  return true
}

export function eplanBuildDisplayRows(
  actions: EPlanAction[],
  expandedIds: Set<string>,
): EPlanDisplayRow[] {
  const roots = actions.filter((a) => !a.parentActionId).sort((a, b) => a.title.localeCompare(b.title))
  const rows: EPlanDisplayRow[] = []
  for (const root of roots) {
    const children = actions.filter((a) => a.parentActionId === root.id).sort((a, b) => a.title.localeCompare(b.title))
    const hasChildren = children.length > 0
    const expanded = expandedIds.has(root.id)
    rows.push({ action: root, depth: 0, hasChildren, expanded })
    if (expanded && hasChildren) {
      for (const child of children) {
        rows.push({ action: child, depth: 1, hasChildren: false, expanded: false })
      }
    }
  }
  return rows
}

export function eplanLookupName(
  id: string | undefined,
  items: { id: string; name: string; isActive?: boolean }[],
): string {
  if (!id) return '—'
  return items.find((x) => x.id === id)?.name ?? '—'
}

export function eplanOwnerName(id: string, admin: EPlanAdminStore): string {
  return admin.owners.find((o) => o.id === id)?.name ?? '—'
}

export function eplanStatusCounts(actions: EPlanAction[]): Record<EPlanActionStatus, number> {
  const counts: Record<EPlanActionStatus, number> = {
    ON_TRACK: 0,
    NEED_HELP: 0,
    OFF_TRACK: 0,
    COMPLETED: 0,
    NOT_STARTED: 0,
    NOT_REQUIRED: 0,
  }
  for (const a of actions) counts[a.status] += 1
  return counts
}

/** Gantt window centered on today. Action date filtering uses filter From/To separately. */
export function eplanTimelineRange(mode: 'weeks' | 'months' | 'next12'): { from: string; to: string } {
  const today = localYMD(new Date())
  const anchor = new Date(today + 'T12:00:00')

  if (mode === 'weeks') {
    return {
      from: eplanAddDaysYmd(today, -7 * 7),
      to: eplanAddDaysYmd(today, 7 * 7),
    }
  }
  if (mode === 'months') {
    return {
      from: localYMD(addMonths(anchor, -3)),
      to: localYMD(addMonths(anchor, 3)),
    }
  }
  return {
    from: localYMD(addMonths(anchor, -6)),
    to: localYMD(addMonths(anchor, 6)),
  }
}

export function eplanDaysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(fromYmd + 'T12:00:00').getTime()
  const b = new Date(toYmd + 'T12:00:00').getTime()
  return Math.max(1, Math.round((b - a) / 86400000) + 1)
}

export function eplanBarLayout(
  action: EPlanAction,
  rangeFrom: string,
  rangeTo: string,
): { leftPct: number; widthPct: number } | null {
  const total = eplanDaysBetween(rangeFrom, rangeTo)
  const start = Math.max(0, eplanDaysBetween(rangeFrom, action.startDate) - 1)
  const end = Math.min(total, eplanDaysBetween(rangeFrom, action.endDate))
  if (end < start) return null
  const leftPct = (start / total) * 100
  const widthPct = Math.max(1.5, ((end - start + 1) / total) * 100)
  return { leftPct, widthPct }
}
