import { evaluateKpiBlock, parseDdsKpiScoring, type DdsKpiScoring, type KpiBlockTone } from './ddsKpiScoring'

export const WDS_AGGREGATION_OPTIONS = [
  { value: 'sum', label: 'Summary per column (sum)' },
  { value: 'avg', label: 'Average score per column' },
  { value: 'min', label: 'Minimum value' },
  { value: 'max', label: 'Maximum value' },
] as const

export type WdsAggregation = (typeof WDS_AGGREGATION_OPTIONS)[number]['value']

export const WDS_GLIDEPATH_MODE_OPTIONS = [
  { value: 'flat', label: 'Target flat' },
  { value: 'start_end', label: 'Start + end target' },
  { value: 'weekly', label: 'Target by each week' },
] as const

export type WdsGlidepathMode = (typeof WDS_GLIDEPATH_MODE_OPTIONS)[number]['value']

export type WdsTrendDefRow = {
  id: string
  master_cell_id: string
  kpi_id: string
  label: string
  aggregation: string
  glidepath_mode: string
  target_flat: number | null
  target_start: number | null
  target_end: number | null
  target_weekly: number[] | null
  sort_order: number
  is_active: boolean
}

export type WdsColumnRow = {
  id: string
  master_cell_id: string
  header: string
  sort_order: number
  output_trend_id: string | null
  in_process_a_trend_id: string | null
  in_process_b_trend_id: string | null
  hc_type_id: string | null
}

export function parseWdsAggregation(raw: unknown): WdsAggregation {
  const v = String(raw ?? '')
  if (v === 'sum' || v === 'avg' || v === 'min' || v === 'max') return v
  return 'sum'
}

export function parseWdsGlidepathMode(raw: unknown): WdsGlidepathMode {
  const v = String(raw ?? '')
  if (v === 'flat' || v === 'start_end' || v === 'weekly') return v
  return 'flat'
}

export type WdsWeekSlot = {
  index: number
  startYmd: string
  endYmd: string
  shortLabel: string
}

function localYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0)
}

function mondayOf(d: Date): Date {
  const atMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  const wd = atMidnight.getDay()
  const delta = (wd + 6) % 7
  atMidnight.setDate(atMidnight.getDate() - delta)
  return atMidnight
}

export function defaultWdsWeeks(): WdsWeekSlot[] {
  const now = new Date()
  const currentMonday = mondayOf(now)
  const start = new Date(currentMonday)
  start.setDate(start.getDate() - 10 * 7)
  const out: WdsWeekSlot[] = []
  for (let i = 0; i < 14; i += 1) {
    const ws = new Date(start)
    ws.setDate(start.getDate() + i * 7)
    const we = new Date(ws)
    we.setDate(ws.getDate() + 6)
    out.push({
      index: i,
      startYmd: localYmd(ws),
      endYmd: localYmd(we),
      shortLabel: `${String(ws.getDate()).padStart(2, '0')} ${ws.toLocaleDateString(undefined, { month: 'short' })}`,
    })
  }
  return out
}

export function weekIndexForDate(ymd: string, weeks: WdsWeekSlot[]): number {
  if (weeks.length === 0) return -1
  const d = parseYmd(ymd).getTime()
  for (const w of weeks) {
    const s = parseYmd(w.startYmd).getTime()
    const e = parseYmd(w.endYmd).getTime() + 24 * 60 * 60 * 1000 - 1
    if (d >= s && d <= e) return w.index
  }
  return -1
}

export function aggregateWds(values: number[], aggregation: WdsAggregation): number | null {
  if (values.length === 0) return null
  if (aggregation === 'sum') return values.reduce((a, b) => a + b, 0)
  if (aggregation === 'avg') return values.reduce((a, b) => a + b, 0) / values.length
  if (aggregation === 'min') return Math.min(...values)
  return Math.max(...values)
}

export function computeGlideTarget(trend: WdsTrendDefRow, weekIndex: number): number | null {
  const mode = parseWdsGlidepathMode(trend.glidepath_mode)
  if (mode === 'flat') return trend.target_flat
  if (mode === 'start_end') {
    if (trend.target_start == null || trend.target_end == null) return null
    const t = weekIndex / 13
    return trend.target_start + (trend.target_end - trend.target_start) * t
  }
  const arr = Array.isArray(trend.target_weekly) ? trend.target_weekly : []
  const v = arr[weekIndex]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function evaluateWdsAgainstTarget(
  value: number | null,
  kpiScoringRaw: unknown,
  glideTarget: number | null,
): KpiBlockTone {
  const scoring = parseDdsKpiScoring(kpiScoringRaw)
  if (value == null || !Number.isFinite(value)) return 'neutral'
  if (glideTarget == null || !Number.isFinite(glideTarget)) {
    return evaluateKpiBlock(value, scoring)
  }
  return evaluateByKind(value, glideTarget, scoring)
}

function evaluateByKind(value: number, target: number, scoring: DdsKpiScoring): KpiBlockTone {
  if (scoring.kind === 'no_target') return 'neutral'
  if (scoring.kind === 'pass_fail') return value >= target ? 'good' : 'bad'
  if (scoring.kind === 'min_red') return value >= target ? 'good' : 'bad'
  if (scoring.kind === 'max_red') return value <= target ? 'good' : 'bad'
  if (scoring.kind === 'range_green') {
    const half = Math.abs(scoring.max - scoring.min) / 2
    return value >= target - half && value <= target + half ? 'good' : 'bad'
  }
  if (scoring.kind === 'symmetric_abs') {
    return Math.abs(value - target) <= scoring.tolerance ? 'good' : 'bad'
  }
  const tol = Math.abs(target) * (scoring.tolerancePct / 100)
  return Math.abs(value - target) <= tol ? 'good' : 'bad'
}
