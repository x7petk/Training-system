import { addDays, localYMD } from '../../lib/dueDateUtils'

export function planDateUtcBounds(planDate: string): { start: string; end: string } {
  const start = new Date(`${planDate}T00:00:00`)
  const end = addDays(start, 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

export const P2P_PLAN_TREND_DAYS = 7

export type P2pPlanCheckFamilyKey = 'cl' | 'cil' | 'quality' | 'check'

export const P2P_PLAN_CHECK_FAMILIES: {
  key: P2pPlanCheckFamilyKey
  eventType: string
  label: string
  strokeClass: string
}[] = [
  { key: 'cl', eventType: 'cl_check', label: 'CL', strokeClass: 'text-green-700 dark:text-green-400' },
  { key: 'cil', eventType: 'cil_check', label: 'CIL', strokeClass: 'text-teal-700 dark:text-teal-400' },
  { key: 'quality', eventType: 'quality_check', label: 'Quality', strokeClass: 'text-violet-700 dark:text-violet-400' },
  { key: 'check', eventType: 'check', label: 'Checks', strokeClass: 'text-sky-800 dark:text-sky-400' },
]

export type P2pPlanEventRow = {
  id?: string
  plan_date: string
  event_type: string
  status: string
  role_name: string | null
  linked_issue_kind: string | null
  linked_issue_id?: string | null
  cil_template_id?: string | null
}

export type P2pPlanCilDefectRow = {
  id: string
  cil_template_id: string | null
  cil_template_task_id: string | null
  plan24_event_id?: string | null
  role_name?: string | null
}

/** Task-level CL deviation or quality fail (not linked on plan24_events). */
export type P2pPlanTaskIssueRow = {
  id: string
  plan24_event_id?: string | null
  role_name?: string | null
  plan24_sub_task_id?: string | null
}

function isLinkedPlanIssue(issueId: string, events: P2pPlanEventRow[]): boolean {
  const linkedIds = new Set(
    events.filter((e) => e.linked_issue_id).map((e) => e.linked_issue_id as string),
  )
  return linkedIds.has(issueId)
}

/** Task-level plan issue belongs to this role (deviation / quality fail from CL or Quality steps). */
export function planTaskIssueBelongsToRole(
  issue: P2pPlanTaskIssueRow,
  events: P2pPlanEventRow[],
  planDate: string,
  roleName: string,
  expectedEventType: 'cl_check' | 'quality_check',
): boolean {
  if (isLinkedPlanIssue(issue.id, events)) return false
  if (!issue.plan24_sub_task_id && !issue.plan24_event_id) return false

  if (issue.plan24_event_id) {
    return events.some(
      (e) =>
        e.id === issue.plan24_event_id &&
        e.plan_date === planDate &&
        String(e.event_type ?? '').toLowerCase() === expectedEventType &&
        p2pPlanEventMatchesRole(e.role_name, roleName),
    )
  }
  if (issue.role_name?.trim()) {
    return p2pPlanEventMatchesRole(issue.role_name, roleName)
  }
  return false
}

export function countUnlinkedTaskIssuesForRole(
  issues: P2pPlanTaskIssueRow[],
  events: P2pPlanEventRow[],
  planDate: string,
  roleName: string,
  expectedEventType: 'cl_check' | 'quality_check',
): number {
  let n = 0
  for (const issue of issues) {
    if (planTaskIssueBelongsToRole(issue, events, planDate, roleName, expectedEventType)) n += 1
  }
  return n
}

export type P2pPlanFamilyTrend = {
  key: P2pPlanCheckFamilyKey
  label: string
  strokeClass: string
  todayPct: number
  trendPct: number[]
}

export type P2pPlanRoleIssueCounts = {
  roleName: string
  deviations: number
  defects: number
  qualityFails: number
}

function isDoneStatus(status: string): boolean {
  return status === 'complete' || status === 'not_required'
}

function pct(done: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((done / total) * 100)
}

/** Match plan panel: same role column (case-insensitive). */
export function p2pPlanEventMatchesRole(roleName: string | null | undefined, filterRole: string): boolean {
  const f = filterRole.trim().toLowerCase()
  if (!f) return true
  return (roleName ?? '').trim().toLowerCase() === f
}

function filterEventsForRole(events: P2pPlanEventRow[], roleName: string): P2pPlanEventRow[] {
  const f = roleName.trim()
  if (!f) return events
  return events.filter((e) => p2pPlanEventMatchesRole(e.role_name, f))
}

export function trendDateRange(planDate: string, days = P2P_PLAN_TREND_DAYS): string[] {
  const end = new Date(`${planDate}T12:00:00`)
  const start = addDays(end, -(days - 1))
  const out: string[] = []
  for (let i = 0; i < days; i++) {
    out.push(localYMD(addDays(start, i)))
  }
  return out
}

export function buildP2pPlanFamilyTrends(
  events: P2pPlanEventRow[],
  planDate: string,
  roleName: string,
): P2pPlanFamilyTrend[] {
  const scoped = filterEventsForRole(events, roleName)
  const dates = trendDateRange(planDate)
  return P2P_PLAN_CHECK_FAMILIES.map((fam) => {
    const trendPct = dates.map((d) => {
      const dayRows = scoped.filter((e) => e.plan_date === d && e.event_type === fam.eventType)
      const done = dayRows.filter((e) => isDoneStatus(e.status)).length
      return pct(done, dayRows.length)
    })
    const todayIdx = dates.length - 1
    return {
      key: fam.key,
      label: fam.label,
      strokeClass: fam.strokeClass,
      todayPct: trendPct[todayIdx] ?? 0,
      trendPct,
    }
  })
}

function planEventHasLinkedIssue(ev: P2pPlanEventRow): boolean {
  return Boolean((ev.linked_issue_kind ?? '').trim() || ev.linked_issue_id)
}

function planEventLinkedIssueKind(ev: P2pPlanEventRow): 'deviation' | 'dh_defect' | 'quality_fail' | null {
  const k = (ev.linked_issue_kind ?? '').trim().toLowerCase()
  if (k === 'deviation' || k === 'dh_defect' || k === 'quality_fail') return k
  if (!ev.linked_issue_id) return null
  const t = (ev.event_type ?? '').toLowerCase()
  if (t === 'cl_check') return 'deviation'
  if (t === 'cil_check') return 'dh_defect'
  if (t === 'quality_check') return 'quality_fail'
  return null
}

export function buildP2pPlanRoleIssueCounts(
  events: P2pPlanEventRow[],
  planDate: string,
  roleNames: string[],
): P2pPlanRoleIssueCounts[] {
  const dayShift = events.filter((e) => e.plan_date === planDate && planEventHasLinkedIssue(e))
  const byRole = new Map<string, P2pPlanRoleIssueCounts>()
  for (const name of roleNames) {
    byRole.set(name, { roleName: name, deviations: 0, defects: 0, qualityFails: 0 })
  }
  for (const ev of dayShift) {
    const roleKey = roleNames.find((name) => p2pPlanEventMatchesRole(ev.role_name, name))
    if (!roleKey) continue
    const row = byRole.get(roleKey)!
    const kind = planEventLinkedIssueKind(ev)
    if (kind === 'deviation') row.deviations += 1
    else if (kind === 'dh_defect') row.defects += 1
    else if (kind === 'quality_fail') row.qualityFails += 1
  }
  return roleNames.map((name) => byRole.get(name)!)
}

/** Task-level CIL defect belongs to this role (not linked on plan24_events). */
export function cilDefectBelongsToRole(
  defect: P2pPlanCilDefectRow,
  events: P2pPlanEventRow[],
  planDate: string,
  roleName: string,
): boolean {
  if (isLinkedPlanIssue(defect.id, events)) return false
  if (!defect.cil_template_task_id || !defect.cil_template_id) return false

  if (defect.plan24_event_id) {
    return events.some(
      (e) =>
        e.id === defect.plan24_event_id &&
        e.plan_date === planDate &&
        p2pPlanEventMatchesRole(e.role_name, roleName),
    )
  }
  if (defect.role_name?.trim()) {
    return p2pPlanEventMatchesRole(defect.role_name, roleName)
  }

  // Legacy template-only defects: attribute only when one role has this template on the day.
  const rolesWithTpl = [
    ...new Set(
      events
        .filter(
          (e) =>
            e.plan_date === planDate &&
            e.event_type === 'cil_check' &&
            e.cil_template_id === defect.cil_template_id,
        )
        .map((e) => (e.role_name ?? '').trim().toLowerCase())
        .filter(Boolean),
    ),
  ]
  if (rolesWithTpl.length !== 1) return false
  return p2pPlanEventMatchesRole(rolesWithTpl[0], roleName)
}

/** CIL task-level defects (no event link) attributed to the raising role / plan event. */
export function countUnlinkedCilDefectsForRole(
  defects: P2pPlanCilDefectRow[],
  events: P2pPlanEventRow[],
  planDate: string,
  roleName: string,
): number {
  let n = 0
  for (const d of defects) {
    if (cilDefectBelongsToRole(d, events, planDate, roleName)) n += 1
  }
  return n
}

/** Completion % bar and label colours: 0–39 red, 40–79 yellow, 80–99 orange, 100 green. */
/** Raised issue counts: 0 = foreground (readable on strip), >0 = red. */
export function p2pPlanRaisedCountClass(count: number): string {
  return count > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-fg'
}

export function p2pPlanCompletionTone(pct: number): { bar: string; text: string } {
  const p = Math.min(100, Math.max(0, Math.round(pct)))
  if (p >= 100) {
    return { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' }
  }
  if (p >= 80) {
    return { bar: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-400' }
  }
  if (p >= 40) {
    return { bar: 'bg-amber-400', text: 'text-amber-800 dark:text-amber-300' }
  }
  return { bar: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400' }
}

export function shortP2pRoleLabel(name: string): string {
  const n = name.trim()
  if (/^packing\s*(\d+)$/i.test(n)) {
    const m = n.match(/\d+/)
    return m ? `P${m[0]}` : n
  }
  if (/team\s*lead/i.test(n)) return 'TL'
  if (n.length <= 4) return n
  return n.slice(0, 3)
}
