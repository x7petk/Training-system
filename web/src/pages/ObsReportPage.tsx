import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileBarChart, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLdrWorkspace } from '../features/ldr/LdrWorkspaceContext'
import { ldrMasterCellJoinFromId, ldrMasterCellLabel } from '../features/ldr/types'
import { hcRagBadgeClass, hcRagLabel, type HcRag } from '../features/health-checks/hcScore'
import type { ObsKind } from '../features/observations/obsKind'
import { obsBasePath, obsLabel, obsTitle } from '../features/observations/obsKind'
import { masterCellIdsForHcObsFilter } from '../features/ldr/ldrHcObsScope'

const OBS_REP_IN_CHUNK = 90
import { CompactCategoryBars } from '../features/report/CompactCategoryBars'
import { CompactPeriodBars } from '../features/report/CompactPeriodBars'
import {
  buildMonthBuckets,
  buildWeekBuckets,
  compareYMD,
  eventLocalDate,
  localYMD,
  normalizeRange,
  parseYMD,
  type ReportBucket,
} from '../features/report/reportBucketUtils'

type Row = {
  id: string
  completed_at: string
  score: number
  status: HcRag
  completed_by_name: string
  completed_by_user_id: string
  master_cell_id: string
  type_id: string
  type_name: string
  overall_comment: string | null
}

type CompleterOpt = { id: string; name: string }

type AnswerBreakdown = { pass: number; fail: number; na: number }

function recTable(k: ObsKind) {
  return k === 'sos' ? 'sos_records' : k === 'qos' ? 'qos_records' : 'ppo_records'
}
function typeFk(k: ObsKind) {
  return k === 'sos' ? 'sos_type_id' : k === 'qos' ? 'qos_type_id' : 'ppo_type_id'
}
function typeRel(k: ObsKind) {
  return k === 'sos' ? 'sos_types(name)' : k === 'qos' ? 'qos_types(name)' : 'ppo_types(name)'
}

function formatForDatetimeLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

function dateTimeInputValueFromNowMinusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return formatForDatetimeLocal(d)
}

function defaultRangeForGranularity(g: 'day' | 'week' | 'month'): { from: string; to: string } {
  const end = new Date()
  const start = new Date(end)
  if (g === 'day') {
    start.setDate(start.getDate() - 30)
    start.setHours(0, 0, 0, 0)
  } else if (g === 'week') {
    start.setMonth(start.getMonth() - 3)
    start.setHours(0, 0, 0, 0)
  } else {
    start.setFullYear(start.getFullYear() - 12)
    start.setHours(0, 0, 0, 0)
  }
  return { from: formatForDatetimeLocal(start), to: formatForDatetimeLocal(end) }
}

function toIsoBounds(fromLocal: string, toLocal: string): { fromIso: string; toIso: string } {
  const from = new Date(fromLocal)
  const to = new Date(toLocal)
  return { fromIso: from.toISOString(), toIso: to.toISOString() }
}

function buildDayBuckets(rangeStart: string, rangeEnd: string): ReportBucket[] {
  const { start, end } = normalizeRange(rangeStart, rangeEnd)
  const buckets: ReportBucket[] = []
  const endD = parseYMD(end)
  let cur = parseYMD(start)
  let i = 0
  while (cur.getTime() <= endD.getTime()) {
    const ymd = localYMD(cur)
    buckets.push({
      key: `d${i}`,
      label: cur.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      start: ymd,
      end: ymd,
    })
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)
    i += 1
    if (i > 400) break
  }
  return buckets
}

function rowIsInBucket(r: Row, b: ReportBucket): boolean {
  const d = eventLocalDate(r.completed_at)
  return compareYMD(d, b.start) >= 0 && compareYMD(d, b.end) <= 0
}

type BrushState = {
  period: string | null
  typeId: string | null
  userId: string | null
  qp: 'pass' | 'fail' | 'na' | null
}

type ChartWhich = 'volume' | 'type' | 'person' | 'answers' | 'table'

function rowMatchesQpFilter(
  r: Row,
  qp: 'pass' | 'fail' | 'na' | null,
  recordAnswerCounts: Map<string, AnswerBreakdown>,
  kind: ObsKind,
): boolean {
  if (!qp || (kind !== 'qos' && kind !== 'ppo')) return true
  const c = recordAnswerCounts.get(r.id)
  if (!c) return false
  if (qp === 'pass') return c.pass > 0
  if (qp === 'fail') return c.fail > 0
  return c.na > 0
}

/** Cross-filter like Skill Matrix report: `which` chart ignores its own brush so its columns stay the same. */
function rowsForCrossFilter(
  rs: Row[],
  brush: BrushState,
  periodBuckets: ReportBucket[],
  which: ChartWhich,
  recordAnswerCounts: Map<string, AnswerBreakdown>,
  kind: ObsKind,
): Row[] {
  const selectedPeriod = brush.period ? (periodBuckets.find((b) => b.key === brush.period) ?? null) : null
  const skipPeriod = which === 'volume'
  const skipType = which === 'type'
  const skipUser = which === 'person'
  const skipQp = which === 'answers'
  return rs.filter((r) => {
    if (!skipPeriod && selectedPeriod && !rowIsInBucket(r, selectedPeriod)) {
      return false
    }
    if (!skipType && brush.typeId && r.type_id !== brush.typeId) return false
    if (!skipUser && brush.userId && r.completed_by_user_id !== brush.userId) return false
    if (!skipQp && !rowMatchesQpFilter(r, brush.qp, recordAnswerCounts, kind)) return false
    return true
  })
}

function ObsReportPage({ kind, hidePageHeader }: { kind: ObsKind; hidePageHeader?: boolean }) {
  const { masterCellJoinById, hcObsWorkspaceId, hcObsSiteId, hcObsPlantId, hcObsCellId, allPlants, allCells } =
    useLdrWorkspace()

  const allowedCellIds = useMemo(
    () => masterCellIdsForHcObsFilter(hcObsSiteId, hcObsPlantId, hcObsCellId, allPlants, allCells),
    [hcObsSiteId, hcObsPlantId, hcObsCellId, allPlants, allCells],
  )
  const [rows, setRows] = useState<Row[]>([])
  const [types, setTypes] = useState<{ id: string; name: string }[]>([])
  const [completerOptions, setCompleterOptions] = useState<CompleterOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day')

  const [fromDateTime, setFromDateTime] = useState(() => defaultRangeForGranularity('day').from)
  const [toDateTime, setToDateTime] = useState(() => defaultRangeForGranularity('day').to)
  const prevGranularityRef = useRef<'day' | 'week' | 'month'>('day')

  const [filterTypeId, setFilterTypeId] = useState('')
  const [filterUserId, setFilterUserId] = useState('')

  /** Client-side chart selections (do not change the clicked chart’s distribution). */
  const [brushPeriod, setBrushPeriod] = useState<string | null>(null)
  const [brushTypeId, setBrushTypeId] = useState<string | null>(null)
  const [brushUserId, setBrushUserId] = useState<string | null>(null)
  const [brushQp, setBrushQp] = useState<'pass' | 'fail' | 'na' | null>(null)
  const [recordAnswerCounts, setRecordAnswerCounts] = useState<Map<string, AnswerBreakdown>>(() => new Map())
  const [answerTotals, setAnswerTotals] = useState<{ pass: number; fail: number; na: number }>({
    pass: 0,
    fail: 0,
    na: 0,
  })

  const rt = recTable(kind)
  const fk = typeFk(kind)
  const rel = typeRel(kind)

  useEffect(() => {
    if (prevGranularityRef.current === granularity) return
    prevGranularityRef.current = granularity
    const r = defaultRangeForGranularity(granularity)
    setFromDateTime(r.from)
    setToDateTime(r.to)
    setBrushPeriod(null)
    setBrushTypeId(null)
    setBrushUserId(null)
    setBrushQp(null)
  }, [granularity])

  const scopedSelect = useCallback(
    (select: string) => {
      const { fromIso, toIso } = toIsoBounds(fromDateTime, toDateTime)
      let q = supabase
        .from(rt)
        .select(select)
        .not('completed_at', 'is', null)
        .gte('completed_at', fromIso)
        .lte('completed_at', toIso)
      if (filterTypeId) q = q.eq(fk, filterTypeId)
      return q
    },
    [fromDateTime, toDateTime, filterTypeId, rt, fk],
  )

  const loadTypes = useCallback(async () => {
    if (!hcObsWorkspaceId) {
      setTypes([])
      return
    }
    const tbl = kind === 'sos' ? 'sos_types' : kind === 'qos' ? 'qos_types' : 'ppo_types'
    const res = await supabase
      .from(tbl)
      .select('id, name, ldr_activities!inner(workspace_id)')
      .eq('active', true)
      .eq('ldr_activities.workspace_id', hcObsWorkspaceId)
      .order('name')
    if (!res.error && res.data) setTypes(res.data as { id: string; name: string }[])
  }, [hcObsWorkspaceId, kind])

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    setBrushQp(null)
    if (allowedCellIds.length === 0) {
      setRows([])
      setCompleterOptions([])
      setRecordAnswerCounts(new Map())
      setAnswerTotals({ pass: 0, fail: 0, na: 0 })
      setLoading(false)
      return
    }
    const fullSelect = `id, completed_at, score, status, completed_by_name, completed_by_user_id, master_cell_id, overall_comment, ${fk}, ${rel}`
    const mapped: Row[] = []
    const compMap = new Map<string, string>()

    for (let i = 0; i < allowedCellIds.length; i += OBS_REP_IN_CHUNK) {
      const slice = allowedCellIds.slice(i, i + OBS_REP_IN_CHUNK)
      let dataQ = scopedSelect(fullSelect).in('master_cell_id', slice).order('completed_at', { ascending: false }).limit(800)
      if (filterUserId) dataQ = dataQ.eq('completed_by_user_id', filterUserId)
      const dataRes = await dataQ
      if (dataRes.error) {
        setLoading(false)
        setError(dataRes.error.message)
        setRows([])
        setCompleterOptions([])
        setRecordAnswerCounts(new Map())
        setAnswerTotals({ pass: 0, fail: 0, na: 0 })
        return
      }
      const raw = (dataRes.data ?? []) as unknown as Record<string, unknown>[]
      mapped.push(
        ...raw.map((r) => {
      const tj = (r.sos_types ?? r.qos_types ?? r.ppo_types) as { name: string } | { name: string }[] | null
      const tn = !tj ? 'Unknown' : Array.isArray(tj) ? (tj[0]?.name ?? 'Unknown') : tj.name
      return {
        id: r.id as string,
        completed_at: r.completed_at as string,
        score: r.score as number,
        status: r.status as HcRag,
        completed_by_name: r.completed_by_name as string,
        completed_by_user_id: r.completed_by_user_id as string,
        master_cell_id: r.master_cell_id as string,
        type_id: (r[fk] as string) ?? '',
        type_name: tn,
        overall_comment: (r.overall_comment as string | null) ?? null,
      }
        }),
      )

      let compQ = scopedSelect(`completed_by_user_id, completed_by_name`).in('master_cell_id', slice).limit(800)
      const compRes = await compQ
      if (!compRes.error && compRes.data) {
        for (const r of compRes.data as unknown as { completed_by_user_id: string; completed_by_name: string }[]) {
          const id = r.completed_by_user_id
          const name = r.completed_by_name?.trim() || id.slice(0, 8)
          if (!compMap.has(id)) compMap.set(id, name)
        }
      }
    }

    mapped.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
    const mergedRows = mapped.slice(0, 800)
    setRows(mergedRows)

    if (kind === 'qos' || kind === 'ppo') {
      const tbl = kind === 'qos' ? 'qos_answers' : 'ppo_answers'
      const col = kind === 'qos' ? 'qos_record_id' : 'ppo_record_id'
      const counts = new Map<string, AnswerBreakdown>()
      let tp = 0
      let tf = 0
      let tn = 0
      const ids = mergedRows.map((r) => r.id)
      const chunk = 120
      for (let i = 0; i < ids.length; i += chunk) {
        const slice = ids.slice(i, i + chunk)
        if (!slice.length) break
        const ansRes = await supabase.from(tbl).select(`answer, ${col}`).in(col, slice)
        if (ansRes.error) {
          setError(ansRes.error.message)
          break
        }
        for (const a of (ansRes.data ?? []) as { answer: string; [k: string]: string }[]) {
          const rid = a[col] as string
          const ans = (a.answer as string) ?? ''
          const cur = counts.get(rid) ?? { pass: 0, fail: 0, na: 0 }
          if (ans === 'pass') {
            cur.pass += 1
            tp += 1
          } else if (ans === 'fail') {
            cur.fail += 1
            tf += 1
          } else if (ans === 'na') {
            cur.na += 1
            tn += 1
          }
          counts.set(rid, cur)
        }
      }
      setRecordAnswerCounts(counts)
      setAnswerTotals({ pass: tp, fail: tf, na: tn })
    } else {
      setRecordAnswerCounts(new Map())
      setAnswerTotals({ pass: 0, fail: 0, na: 0 })
    }

    setLoading(false)
    setCompleterOptions([...compMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)))
  }, [scopedSelect, filterUserId, fk, rel, kind, allowedCellIds])

  useEffect(() => {
    queueMicrotask(() => {
      void loadTypes()
    })
  }, [loadTypes])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const brush = useMemo<BrushState>(
    () => ({ period: brushPeriod, typeId: brushTypeId, userId: brushUserId, qp: brushQp }),
    [brushPeriod, brushTypeId, brushUserId, brushQp],
  )

  const rangeStartYmd = fromDateTime.slice(0, 10)
  const rangeEndYmd = toDateTime.slice(0, 10)
  const periodBuckets = useMemo(() => {
    if (!rangeStartYmd || !rangeEndYmd) return []
    const { start, end } = normalizeRange(rangeStartYmd, rangeEndYmd)
    if (granularity === 'day') return buildDayBuckets(start, end)
    if (granularity === 'week') return buildWeekBuckets(start, end)
    return buildMonthBuckets(start, end)
  }, [rangeStartYmd, rangeEndYmd, granularity])

  const selectedPeriodBucket = useMemo(
    () => (brushPeriod ? periodBuckets.find((b) => b.key === brushPeriod) ?? null : null),
    [brushPeriod, periodBuckets],
  )

  const volumeRows = useMemo(
    () => rowsForCrossFilter(rows, brush, periodBuckets, 'volume', recordAnswerCounts, kind),
    [rows, brush, periodBuckets, recordAnswerCounts, kind],
  )

  const periodValues = useMemo(() => {
    return periodBuckets.map((b) => volumeRows.filter((r) => rowIsInBucket(r, b)).length)
  }, [periodBuckets, volumeRows])

  const byType = useMemo(() => {
    const src = rowsForCrossFilter(rows, brush, periodBuckets, 'type', recordAnswerCounts, kind)
    const m = new Map<string, { typeId: string; name: string; count: number; sumScore: number }>()
    for (const r of src) {
      const cur = m.get(r.type_id) ?? { typeId: r.type_id, name: r.type_name, count: 0, sumScore: 0 }
      cur.count += 1
      cur.sumScore += r.score
      m.set(r.type_id, cur)
    }
    return [...m.values()].map((v) => ({
      typeId: v.typeId,
      name: v.name,
      count: v.count,
      avgScore: v.count ? Math.round((v.sumScore / v.count) * 10) / 10 : 0,
    }))
  }, [rows, brush, periodBuckets, recordAnswerCounts, kind])

  const byTypeItems = useMemo(
    () => byType.map((x) => ({ key: x.typeId || `type-${x.name}`, label: x.name, value: x.count })),
    [byType],
  )

  const byPerson = useMemo(() => {
    const src = rowsForCrossFilter(rows, brush, periodBuckets, 'person', recordAnswerCounts, kind)
    const m = new Map<string, { userId: string; name: string; count: number; sumScore: number }>()
    for (const r of src) {
      const cur =
        m.get(r.completed_by_user_id) ?? {
          userId: r.completed_by_user_id,
          name: r.completed_by_name,
          count: 0,
          sumScore: 0,
        }
      cur.count += 1
      cur.sumScore += r.score
      m.set(r.completed_by_user_id, cur)
    }
    return [...m.values()].map((v) => ({
      userId: v.userId,
      name: v.name,
      count: v.count,
      avgScore: v.count ? Math.round((v.sumScore / v.count) * 10) / 10 : 0,
    }))
  }, [rows, brush, periodBuckets, recordAnswerCounts, kind])

  const byPersonItems = useMemo(
    () => byPerson.map((x) => ({ key: x.userId, label: x.name, value: x.count })),
    [byPerson],
  )

  const qpQuestionChartData = useMemo(
    () => [
      { outcome: 'Pass', count: answerTotals.pass, key: 'pass' as const },
      { outcome: 'Fail', count: answerTotals.fail, key: 'fail' as const },
      { outcome: 'N/A', count: answerTotals.na, key: 'na' as const },
    ],
    [answerTotals],
  )

  const qpItems = useMemo(
    () => qpQuestionChartData.map((x) => ({ key: x.key, label: x.outcome, value: x.count })),
    [qpQuestionChartData],
  )

  const filteredRows = useMemo(
    () => rowsForCrossFilter(rows, brush, periodBuckets, 'table', recordAnswerCounts, kind),
    [rows, brush, periodBuckets, recordAnswerCounts, kind],
  )

  const base = obsBasePath(kind)
  const title = obsTitle(kind)
  const short = obsLabel(kind)
  const numberLabel = kind === 'sos' ? 'Number of SOS' : kind === 'qos' ? 'Number of QOS' : 'Number of PPOS'
  const activeFilters =
    (selectedPeriodBucket ? 1 : 0) +
    (brushTypeId ? 1 : 0) +
    (brushUserId ? 1 : 0) +
    (brushQp ? 1 : 0) +
    (filterTypeId ? 1 : 0) +
    (filterUserId ? 1 : 0)

  function applyRangePreset(days: number) {
    setFromDateTime(dateTimeInputValueFromNowMinusDays(days))
    setToDateTime(formatForDatetimeLocal(new Date()))
    setBrushPeriod(null)
    setBrushTypeId(null)
    setBrushUserId(null)
    setBrushQp(null)
  }

  function clearAllFilters() {
    const r = defaultRangeForGranularity(granularity)
    setFromDateTime(r.from)
    setToDateTime(r.to)
    setFilterTypeId('')
    setFilterUserId('')
    setBrushPeriod(null)
    setBrushTypeId(null)
    setBrushUserId(null)
    setBrushQp(null)
  }

  return (
    <div className="space-y-6">
      {hidePageHeader ? null : (
        <div className="flex flex-wrap items-start gap-3">
          <Link
            to={base}
            className="mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted hover:bg-surface-raised"
            aria-label="Back"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex min-w-0 flex-1 flex-nowrap items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-800 dark:text-sky-200">
              <FileBarChart className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{short} Report</h1>
              <p className="text-xs leading-snug text-muted sm:text-sm">
                {title} — submitted records only (RLS). Scope the fetch with type/completer dropdowns if needed. Click a
                chart bar to cross-filter: that chart stays the same; other charts and the table follow the selection
                (like the Skill Matrix report).
              </p>
            </div>
          </div>
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-muted">
            Start (date and time)
            <input
              type="datetime-local"
              className="mt-1 block min-h-10 min-w-[11rem] rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              value={fromDateTime}
              onChange={(e) => setFromDateTime(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-muted">
            End (date and time)
            <input
              type="datetime-local"
              className="mt-1 block min-h-10 min-w-[11rem] rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              value={toDateTime}
              onChange={(e) => setToDateTime(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-muted">
            Type
            <select
              className="mt-1 block h-10 min-w-[10rem] rounded-lg border border-border bg-surface px-3 text-sm"
              value={filterTypeId}
              onChange={(e) => setFilterTypeId(e.target.value)}
            >
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted">
            Completer
            <select
              className="mt-1 block h-10 min-w-[10rem] rounded-lg border border-border bg-surface px-3 text-sm"
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
            >
              <option value="">All</option>
              {completerOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="h-10 rounded-lg border border-border px-3 text-xs text-muted hover:bg-surface-raised"
              onClick={() => applyRangePreset(7)}
            >
              Last 7d
            </button>
            <button
              type="button"
              className="h-10 rounded-lg border border-border px-3 text-xs text-muted hover:bg-surface-raised"
              onClick={() => applyRangePreset(30)}
            >
              Last 30d
            </button>
            <button
              type="button"
              className="h-10 rounded-lg border border-border px-3 text-xs text-muted hover:bg-surface-raised"
              onClick={() => applyRangePreset(90)}
            >
              Last 90d
            </button>
            <button
              type="button"
              className="h-10 rounded-lg border border-border bg-surface-raised px-3 text-xs font-semibold text-fg hover:bg-surface-raised/80"
              onClick={clearAllFilters}
            >
              Reset all
            </button>
          </div>
        </div>
        <p className="text-xs text-muted">
          Day/Week/Month is controlled on the volume chart header. Changing it resets the date range to its default
          (day: 30 days, week: 3 months, month: 12 months) and clears chart selections.
        </p>
      </div>

      {activeFilters > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-raised/40 px-3 py-2 text-xs">
          <span className="font-semibold text-muted">Active filters:</span>
          {selectedPeriodBucket ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-sky-600/40 bg-sky-500/10 px-2 py-1 font-medium text-sky-900 dark:text-sky-100"
              onClick={() => setBrushPeriod(null)}
            >
              Period: {selectedPeriodBucket.label}
              <X className="size-3.5 shrink-0" aria-hidden />
            </button>
          ) : null}
          {brushTypeId ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-violet-600/40 bg-violet-500/10 px-2 py-1 font-medium text-violet-900 dark:text-violet-100"
              onClick={() => setBrushTypeId(null)}
            >
              Type: {types.find((t) => t.id === brushTypeId)?.name ?? brushTypeId.slice(0, 8)}
              <X className="size-3.5 shrink-0" aria-hidden />
            </button>
          ) : null}
          {brushUserId ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-teal-600/40 bg-teal-500/10 px-2 py-1 font-medium text-teal-900 dark:text-teal-100"
              onClick={() => setBrushUserId(null)}
            >
              Completer: {completerOptions.find((c) => c.id === brushUserId)?.name ?? brushUserId.slice(0, 8)}
              <X className="size-3.5 shrink-0" aria-hidden />
            </button>
          ) : null}
          {brushQp ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-amber-600/40 bg-amber-500/10 px-2 py-1 font-medium text-amber-950 dark:text-amber-100"
              onClick={() => setBrushQp(null)}
            >
              Answers: {brushQp.toUpperCase()}
              <X className="size-3.5 shrink-0" aria-hidden />
            </button>
          ) : null}
          {filterTypeId ? (
            <span className="rounded-full border border-border px-2 py-1 text-muted">
              Fetch scope · type: {types.find((t) => t.id === filterTypeId)?.name ?? filterTypeId.slice(0, 8)}
            </span>
          ) : null}
          {filterUserId ? (
            <span className="rounded-full border border-border px-2 py-1 text-muted">
              Fetch scope · completer:{' '}
              {completerOptions.find((c) => c.id === filterUserId)?.name ?? filterUserId.slice(0, 8)}
            </span>
          ) : null}
          {(selectedPeriodBucket || brushTypeId || brushUserId || brushQp) && (
            <button
              type="button"
              onClick={() => {
                setBrushPeriod(null)
                setBrushTypeId(null)
                setBrushUserId(null)
                setBrushQp(null)
              }}
              className="ml-auto rounded-full border border-border px-2 py-1 font-medium text-muted hover:bg-surface-raised"
            >
              Clear chart selections
            </button>
          )}
        </div>
      ) : null}

      <CompactPeriodBars
        title={`${numberLabel} by ${granularity}`}
        subtitle="This chart stays full for period distribution; click a column to cross-filter other charts and the table."
        buckets={periodBuckets}
        values={periodValues}
        selectedKey={brushPeriod}
        onToggleBucket={(key) => setBrushPeriod((cur) => (cur === key ? null : key))}
        controls={
          <div className="flex rounded-lg border border-border bg-surface p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setGranularity('day')}
              className={`rounded-md px-2 py-0.5 font-medium ${
                granularity === 'day' ? 'bg-sky-600 text-white' : 'text-muted hover:text-fg'
              }`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setGranularity('week')}
              className={`rounded-md px-2 py-0.5 font-medium ${
                granularity === 'week' ? 'bg-sky-600 text-white' : 'text-muted hover:text-fg'
              }`}
            >
              Weeks
            </button>
            <button
              type="button"
              onClick={() => setGranularity('month')}
              className={`rounded-md px-2 py-0.5 font-medium ${
                granularity === 'month' ? 'bg-sky-600 text-white' : 'text-muted hover:text-fg'
              }`}
            >
              Months
            </button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CompactCategoryBars
          title="By type"
          subtitle="Full type split; click a column to cross-filter volume/completer and the table."
          items={byTypeItems}
          selectedKey={brushTypeId}
          onToggleKey={(key) => setBrushTypeId((cur) => (cur === key ? null : key))}
          barClassName="bg-indigo-500 hover:brightness-110"
          selectedBarClassName="bg-indigo-600"
        />
        <CompactCategoryBars
          title="By completer"
          subtitle="Full completer split; click a column to cross-filter volume/type and the table."
          items={byPersonItems}
          selectedKey={brushUserId}
          onToggleKey={(key) => setBrushUserId((cur) => (cur === key ? null : key))}
          barClassName="bg-teal-500 hover:brightness-110"
          selectedBarClassName="bg-teal-600"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border bg-surface-raised/60 px-4 py-2">
          <h2 className="text-sm font-semibold text-fg">Records</h2>
          <p className="text-xs text-muted">
            Showing {filteredRows.length} of {rows.length} loaded in range
            {filteredRows.length < rows.length ? ' (cross-filters applied)' : ''}.
          </p>
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-raised/60 text-xs font-semibold uppercase text-muted">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Completer</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">RAG</th>
              <th className="min-w-[12rem] px-4 py-3">Comments</th>
              <th className="px-4 py-3 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  No records match the current filters.
                </td>
              </tr>
            ) : (
              filteredRows.slice(0, 200).map((r) => {
                const j = ldrMasterCellJoinFromId(r.master_cell_id, masterCellJoinById)
                const loc = j ? ldrMasterCellLabel(j) : `${r.master_cell_id.slice(0, 8)}…`
                const comment = (r.overall_comment ?? '').trim()
                return (
                  <tr key={r.id} className="border-b border-border/80">
                    <td className="px-4 py-2 tabular-nums text-muted">{new Date(r.completed_at).toLocaleString()}</td>
                    <td className="px-4 py-2">{r.type_name}</td>
                    <td className="px-4 py-2">{loc}</td>
                    <td className="px-4 py-2">{r.completed_by_name}</td>
                    <td className="px-4 py-2 tabular-nums">{r.score}%</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${hcRagBadgeClass(r.status)}`}
                      >
                        {hcRagLabel(r.status)}
                      </span>
                    </td>
                    <td className="max-w-[20rem] px-4 py-2 text-xs text-fg/90">
                      {comment ? (
                        <span className="line-clamp-3 whitespace-pre-wrap" title={comment}>
                          {comment}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        to={`${base}/${r.id}`}
                        className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {kind === 'qos' || kind === 'ppo' ? (
        <CompactCategoryBars
          title="Question answers (all loaded records)"
          subtitle={`Pass / Fail / N/A totals stay full; click a column to cross-filter volume, type, completer and the table to ${short}s that include that answer kind.`}
          items={qpItems}
          selectedKey={brushQp}
          onToggleKey={(key) => {
            if (key === 'pass' || key === 'fail' || key === 'na') {
              setBrushQp((cur) => (cur === key ? null : key))
            }
          }}
          barClassByKey={{
            pass: 'bg-emerald-500 hover:brightness-110',
            fail: 'bg-rose-500 hover:brightness-110',
            na: 'bg-slate-500 hover:brightness-110',
          }}
          selectedBarClassByKey={{
            pass: 'bg-emerald-700',
            fail: 'bg-rose-700',
            na: 'bg-slate-700',
          }}
        />
      ) : null}
    </div>
  )
}

type ObsSummaryRow = {
  id: string
  kind: ObsKind
  completed_at: string
  completed_by_name: string
  score: number
}

function tabButtonClass(active: boolean): string {
  return active
    ? 'rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white'
    : 'rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:bg-surface-raised'
}

function ObsAllReportPage() {
  const { hcObsSiteId, hcObsPlantId, hcObsCellId, allPlants, allCells } = useLdrWorkspace()
  const allowedCellIds = useMemo(
    () => masterCellIdsForHcObsFilter(hcObsSiteId, hcObsPlantId, hcObsCellId, allPlants, allCells),
    [hcObsSiteId, hcObsPlantId, hcObsCellId, allPlants, allCells],
  )
  const [rows, setRows] = useState<ObsSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const counts = useMemo(
    () => ({
      sos: rows.filter((r) => r.kind === 'sos').length,
      qos: rows.filter((r) => r.kind === 'qos').length,
      ppo: rows.filter((r) => r.kind === 'ppo').length,
    }),
    [rows],
  )

  useEffect(() => {
    queueMicrotask(() => {
      void (async () => {
        setLoading(true)
        setError(null)
        try {
          if (allowedCellIds.length === 0) {
            setRows([])
            setLoading(false)
            return
          }
          const loadTable = async (table: 'sos_records' | 'qos_records' | 'ppo_records', k: ObsKind) => {
            const mergedChunk: ObsSummaryRow[] = []
            for (let i = 0; i < allowedCellIds.length; i += OBS_REP_IN_CHUNK) {
              const slice = allowedCellIds.slice(i, i + OBS_REP_IN_CHUNK)
              const res = await supabase
                .from(table)
                .select('id, completed_at, completed_by_name, score')
                .not('completed_at', 'is', null)
                .in('master_cell_id', slice)
                .limit(300)
              if (res.error) throw new Error(res.error.message)
              mergedChunk.push(
                ...((res.data ?? []) as Omit<ObsSummaryRow, 'kind'>[]).map((r) => ({ ...r, kind: k })),
              )
            }
            return mergedChunk
          }
          const [sosRows, qosRows, ppoRows] = await Promise.all([
            loadTable('sos_records', 'sos'),
            loadTable('qos_records', 'qos'),
            loadTable('ppo_records', 'ppo'),
          ])
          const merged = [...sosRows, ...qosRows, ...ppoRows].sort(
            (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime(),
          )
          setRows(merged)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to load summary report.')
        } finally {
          setLoading(false)
        }
      })()
    })
  }, [allowedCellIds])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4 text-sm">
          <div className="text-xs text-muted">SOS done</div>
          <div className="mt-1 text-2xl font-semibold">{counts.sos}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 text-sm">
          <div className="text-xs text-muted">QOS done</div>
          <div className="mt-1 text-2xl font-semibold">{counts.qos}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 text-sm">
          <div className="text-xs text-muted">PPOS done</div>
          <div className="mt-1 text-2xl font-semibold">{counts.ppo}</div>
        </div>
      </div>
      {error ? (
        <div className="rounded-2xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-raised/60 text-xs font-semibold uppercase text-muted">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">System</th>
              <th className="px-4 py-3">Completer</th>
              <th className="px-4 py-3">Score</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  No submitted records.
                </td>
              </tr>
            ) : (
              rows.slice(0, 200).map((r) => (
                <tr key={`${r.kind}-${r.id}`} className="border-b border-border/80">
                  <td className="px-4 py-2 tabular-nums text-muted">{new Date(r.completed_at).toLocaleString()}</td>
                  <td className="px-4 py-2">{r.kind === 'sos' ? 'S' : r.kind === 'qos' ? 'Q' : 'PP'}</td>
                  <td className="px-4 py-2">{r.completed_by_name}</td>
                  <td className="px-4 py-2">{r.score}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function SosReportPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab')
  const activeTab: 'all' | ObsKind = tab === 'qos' || tab === 'ppo' || tab === 'sos' ? tab : 'all'
  function setTab(next: 'all' | ObsKind) {
    const qp = new URLSearchParams(searchParams)
    if (next === 'all') qp.set('tab', 'all')
    else qp.set('tab', next)
    setSearchParams(qp, { replace: true })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Link
            to="/ldr-tools/sos"
            className="mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted hover:bg-surface-raised"
            aria-label="Back to observation list"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex min-w-0 flex-1 flex-nowrap items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-800 dark:text-sky-200">
              <FileBarChart className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">OS Report</h1>
              <p className="text-xs leading-snug text-muted sm:text-sm">
                Submitted records only (RLS). Use the All / S / Q / PP controls on the right to switch views. In each
                view, use date/time and dropdowns to scope data. Click a chart bar to cross-filter: that chart stays the
                same; other charts and the table follow your selection (same idea as the Skill Matrix report).
              </p>
            </div>
          </div>
        </div>
        <div
          className="inline-flex shrink-0 flex-wrap items-center gap-1 rounded-xl border border-border bg-surface p-1 shadow-sm"
          role="tablist"
          aria-label="Report scope"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            onClick={() => setTab('all')}
            className={tabButtonClass(activeTab === 'all')}
          >
            All
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sos'}
            onClick={() => setTab('sos')}
            className={tabButtonClass(activeTab === 'sos')}
          >
            S
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'qos'}
            onClick={() => setTab('qos')}
            className={tabButtonClass(activeTab === 'qos')}
          >
            Q
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ppo'}
            onClick={() => setTab('ppo')}
            className={tabButtonClass(activeTab === 'ppo')}
          >
            PP
          </button>
        </div>
      </div>
      {activeTab === 'all' ? <ObsAllReportPage /> : <ObsReportPage kind={activeTab} hidePageHeader />}
    </div>
  )
}

export function QosReportPage() {
  return <ObsReportPage kind="qos" />
}
export function PpoReportPage() {
  return <ObsReportPage kind="ppo" />
}
