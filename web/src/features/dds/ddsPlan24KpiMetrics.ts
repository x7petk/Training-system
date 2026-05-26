import { planDateUtcBounds } from './ddsP2pPlanDayStats'
import type { DdsPlan24ValueSource } from './ddsPlan24ValueSource'

export type Plan24KpiEventRow = {
  shift_kind: string
  event_type: string
  status: string
  linked_issue_kind: string | null
  linked_issue_id: string | null
}

export type Plan24KpiDefectRow = {
  status: string
  created_at: string
  resolved_at: string | null
  closed_at: string | null
}

export type Plan24KpiMetrics = {
  cl_completion_pct: number
  cil_completion_pct: number
  quality_completion_pct: number
  check_completion_pct: number
  deviations_count: number
  defects_new_count: number
  defects_fixed_count: number
  defects_open_count: number
  quality_fails_count: number
}

function isDoneStatus(status: string): boolean {
  return status === 'complete' || status === 'not_required'
}

function pct(done: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((done / total) * 100)
}

function completionPct(events: Plan24KpiEventRow[], eventType: string): number {
  const rows = events.filter((e) => e.event_type === eventType)
  const done = rows.filter((e) => isDoneStatus(e.status)).length
  return pct(done, rows.length)
}

const OPEN_DEFECT_STATUSES = new Set(['open', 'in_progress'])

export function computePlan24KpiMetrics(args: {
  planDate: string
  events: Plan24KpiEventRow[]
  defects: Plan24KpiDefectRow[]
}): Plan24KpiMetrics {
  const { planDate, events, defects } = args
  const { start, end } = planDateUtcBounds(planDate)

  const linked = events.filter((e) => e.linked_issue_id || (e.linked_issue_kind ?? '').trim())
  const kind = (e: Plan24KpiEventRow) => String(e.linked_issue_kind ?? '').toLowerCase()
  const deviations = linked.filter((e) => kind(e) === 'deviation').length
  const quality_fails = linked.filter((e) => kind(e) === 'quality_fail').length

  const newDefects = defects.filter((d) => d.created_at >= start && d.created_at < end).length
  const fixedDefects = defects.filter((d) => {
    const t = d.resolved_at ?? d.closed_at
    return t != null && t >= start && t < end
  }).length
  const openDefects = defects.filter((d) => OPEN_DEFECT_STATUSES.has(String(d.status ?? '').toLowerCase())).length

  return {
    cl_completion_pct: completionPct(events, 'cl_check'),
    cil_completion_pct: completionPct(events, 'cil_check'),
    quality_completion_pct: completionPct(events, 'quality_check'),
    check_completion_pct: completionPct(events, 'check'),
    deviations_count: deviations,
    defects_new_count: newDefects,
    defects_fixed_count: fixedDefects,
    defects_open_count: openDefects,
    quality_fails_count: quality_fails,
  }
}

export function plan24MetricValue(metrics: Plan24KpiMetrics, source: DdsPlan24ValueSource): number {
  return metrics[source]
}
