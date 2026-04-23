import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FileBarChart, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLdrWorkspace } from '../features/ldr/LdrWorkspaceContext'
import { masterCellIdsForHcObsFilter } from '../features/ldr/ldrHcObsScope'
import { ldrMasterCellJoinFromId, ldrMasterCellLabel } from '../features/ldr/types'
import { hcRagBadgeClass, hcRagLabel, type HcRag } from '../features/health-checks/hcScore'
import { CompactCategoryBars } from '../features/report/CompactCategoryBars'
import { CompactPeriodBars } from '../features/report/CompactPeriodBars'
import { buildMonthBuckets, buildWeekBuckets, compareYMD, eventLocalDate, normalizeRange } from '../features/report/reportBucketUtils'

type Row = {
  id: string
  completed_at: string
  score: number
  status: HcRag
  completed_by_name: string
  completed_by_user_id: string
  master_site_id: string
  master_plant_id: string
  master_cell_id: string
  hc_type_id: string
  hc_types: { name: string } | { name: string }[] | null
}

type CompleterOpt = { id: string; name: string }

function typeLabel(t: Row['hc_types']): string {
  if (!t) return 'Unknown'
  return Array.isArray(t) ? (t[0]?.name ?? 'Unknown') : t.name
}

function dateInputValueFromNowMinus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

const HC_REP_IN_CHUNK = 90

export function HcReportPage() {
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

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [filterTypeId, setFilterTypeId] = useState('')
  const [filterUserId, setFilterUserId] = useState('')
  const [periodMode, setPeriodMode] = useState<'weeks' | 'months'>('weeks')
  const [insightPeriodKey, setInsightPeriodKey] = useState<string | null>(null)
  const [insightTypeId, setInsightTypeId] = useState<string | null>(null)
  const [insightUserId, setInsightUserId] = useState<string | null>(null)

  const scopedSelect = useCallback(
    (select: string) => {
      const fromIso = `${fromDate}T00:00:00.000Z`
      const toIso = `${toDate}T23:59:59.999Z`
      let q = supabase
        .from('hc_records')
        .select(select)
        .not('completed_at', 'is', null)
        .gte('completed_at', fromIso)
        .lte('completed_at', toIso)
      if (filterTypeId) q = q.eq('hc_type_id', filterTypeId)
      return q
    },
    [fromDate, toDate, filterTypeId],
  )

  const loadTypes = useCallback(async () => {
    if (!hcObsWorkspaceId) {
      setTypes([])
      return
    }
    const res = await supabase
      .from('hc_types')
      .select('id, name, ldr_activities!inner(workspace_id)')
      .eq('active', true)
      .eq('ldr_activities.workspace_id', hcObsWorkspaceId)
      .order('name')
    if (!res.error && res.data) setTypes(res.data as { id: string; name: string }[])
  }, [hcObsWorkspaceId])

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    if (allowedCellIds.length === 0) {
      setRows([])
      setCompleterOptions([])
      setLoading(false)
      return
    }
    const fullSelect =
      'id, completed_at, score, status, completed_by_name, completed_by_user_id, master_site_id, master_plant_id, master_cell_id, hc_type_id, hc_types(name)'

    const merged: Row[] = []
    const compMap = new Map<string, string>()

    for (let i = 0; i < allowedCellIds.length; i += HC_REP_IN_CHUNK) {
      const slice = allowedCellIds.slice(i, i + HC_REP_IN_CHUNK)
      let dataQ = scopedSelect(fullSelect).in('master_cell_id', slice).order('completed_at', { ascending: false }).limit(500)
      if (filterUserId) dataQ = dataQ.eq('completed_by_user_id', filterUserId)
      const dataRes = await dataQ
      if (dataRes.error) {
        setLoading(false)
        setError(dataRes.error.message)
        setRows([])
        setCompleterOptions([])
        return
      }
      merged.push(...((dataRes.data ?? []) as unknown as Row[]))

      const compQ = scopedSelect('completed_by_user_id, completed_by_name').in('master_cell_id', slice).limit(800)
      const compRes = await compQ
      if (!compRes.error && compRes.data) {
        for (const r of compRes.data as unknown as { completed_by_user_id: string; completed_by_name: string }[]) {
          const id = r.completed_by_user_id
          const name = r.completed_by_name?.trim() || id.slice(0, 8)
          if (!compMap.has(id)) compMap.set(id, name)
        }
      }
    }

    merged.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
    setRows(merged.slice(0, 500))
    setCompleterOptions([...compMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)))
    setLoading(false)
  }, [scopedSelect, filterUserId, allowedCellIds])

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

  const periodBuckets = useMemo(() => {
    const { start, end } = normalizeRange(fromDate, toDate)
    return periodMode === 'weeks' ? buildWeekBuckets(start, end) : buildMonthBuckets(start, end)
  }, [fromDate, toDate, periodMode])

  const selectedPeriodBucket = useMemo(
    () => periodBuckets.find((b) => b.key === insightPeriodKey) ?? null,
    [periodBuckets, insightPeriodKey],
  )

  const isInSelectedPeriod = useCallback(
    (r: Row) => {
      if (!selectedPeriodBucket) return true
      const d = eventLocalDate(r.completed_at)
      return compareYMD(d, selectedPeriodBucket.start) >= 0 && compareYMD(d, selectedPeriodBucket.end) <= 0
    },
    [selectedPeriodBucket],
  )

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (insightTypeId && r.hc_type_id !== insightTypeId) return false
      if (insightUserId && r.completed_by_user_id !== insightUserId) return false
      if (!isInSelectedPeriod(r)) return false
      return true
    })
  }, [rows, insightTypeId, insightUserId, isInSelectedPeriod])

  const summary = useMemo(() => {
    const n = filteredRows.length
    if (!n)
      return {
        n: 0,
        avg: 0,
        low: 0,
        mid: 0,
        high: 0,
        green: 0,
        amber: 0,
        red: 0,
      }
    const sum = filteredRows.reduce((a, r) => a + r.score, 0)
    const avg = Math.round((sum / n) * 10) / 10
    let green = 0
    let amber = 0
    let red = 0
    for (const r of filteredRows) {
      if (r.status === 'green') green += 1
      else if (r.status === 'amber') amber += 1
      else red += 1
    }
    return {
      n,
      avg,
      low: filteredRows.filter((r) => r.score < 60).length,
      mid: filteredRows.filter((r) => r.score >= 60 && r.score <= 80).length,
      high: filteredRows.filter((r) => r.score > 80).length,
      green,
      amber,
      red,
    }
  }, [filteredRows])

  /** By type: full split for this chart — ignore type insight; apply week + completer only. */
  const byType = useMemo(() => {
    const src = rows.filter((r) => {
      if (!isInSelectedPeriod(r)) return false
      if (insightUserId && r.completed_by_user_id !== insightUserId) return false
      return true
    })
    const m = new Map<string, { id: string; name: string; count: number; sum: number }>()
    for (const r of src) {
      const name = typeLabel(r.hc_types)
      const cur = m.get(r.hc_type_id) ?? { id: r.hc_type_id, name, count: 0, sum: 0 }
      cur.count += 1
      cur.sum += r.score
      m.set(r.hc_type_id, cur)
    }
    return [...m.values()]
      .map((v) => ({
        ...v,
        avg: v.count ? Math.round((v.sum / v.count) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count)
  }, [rows, insightUserId, isInSelectedPeriod])

  const byTypeItems = useMemo(
    () => byType.map((x) => ({ key: x.id || `type-${x.name}`, label: x.name, value: x.count })),
    [byType],
  )

  /** By completer: full split — ignore completer insight; apply week + type only. */
  const byCompleter = useMemo(() => {
    const src = rows.filter((r) => {
      if (!isInSelectedPeriod(r)) return false
      if (insightTypeId && r.hc_type_id !== insightTypeId) return false
      return true
    })
    const m = new Map<string, { id: string; name: string; count: number; sum: number }>()
    for (const r of src) {
      const id = r.completed_by_user_id
      const name = r.completed_by_name?.trim() || id.slice(0, 8)
      const cur = m.get(id) ?? { id, name, count: 0, sum: 0 }
      cur.count += 1
      cur.sum += r.score
      m.set(id, cur)
    }
    return [...m.values()]
      .map((v) => ({ ...v, avg: v.count ? Math.round((v.sum / v.count) * 10) / 10 : 0 }))
      .sort((a, b) => b.count - a.count)
  }, [rows, insightTypeId, isInSelectedPeriod])

  const byCompleterItems = useMemo(
    () => byCompleter.map((x) => ({ key: x.id, label: x.name, value: x.count })),
    [byCompleter],
  )

  const periodRows = useMemo(() => {
    return rows.filter((r) => {
      if (insightTypeId && r.hc_type_id !== insightTypeId) return false
      if (insightUserId && r.completed_by_user_id !== insightUserId) return false
      return true
    })
  }, [rows, insightTypeId, insightUserId])

  const periodValues = useMemo(() => {
    return periodBuckets.map((b) => {
      return periodRows.filter((r) => {
        const d = eventLocalDate(r.completed_at)
        return compareYMD(d, b.start) >= 0 && compareYMD(d, b.end) <= 0
      }).length
    })
  }, [periodBuckets, periodRows])

  const inp =
    'h-8 w-full min-w-0 rounded-md border border-border-strong bg-surface px-2 text-xs text-fg shadow-sm sm:max-w-[11rem]'
  const lbl = 'text-[10px] font-semibold uppercase tracking-wide text-muted'

  const ragTotal = summary.green + summary.amber + summary.red
  const ragPct = (n: number) => (ragTotal ? Math.round((100 * n) / ragTotal) : 0)
  const activeInsightCount = (selectedPeriodBucket ? 1 : 0) + (insightTypeId ? 1 : 0) + (insightUserId ? 1 : 0)
  const selectedTypeName = byType.find((t) => t.id === insightTypeId)?.name ?? 'Type'
  const selectedCompleterName = byCompleter.find((c) => c.id === insightUserId)?.name ?? 'Completer'
  const selectedPeriodLabel = selectedPeriodBucket ? `${selectedPeriodBucket.label}` : 'Period'

  function applyRangeDays(days: number) {
    setFromDate(dateInputValueFromNowMinus(days))
    setToDate(new Date().toISOString().slice(0, 10))
    setInsightPeriodKey(null)
  }

  function resetAllFilters() {
    setFromDate(dateInputValueFromNowMinus(30))
    setToDate(new Date().toISOString().slice(0, 10))
    setFilterTypeId('')
    setFilterUserId('')
    setInsightPeriodKey(null)
    setInsightTypeId(null)
    setInsightUserId(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <Link
          to="/ldr-tools/health-checks"
          className="mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted hover:bg-surface-raised"
          aria-label="Back to health checks"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-nowrap items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300">
            <FileBarChart className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">HC Report</h1>
            <p className="text-xs leading-snug text-muted sm:text-sm">
              Submitted checks only (RLS). Use date and dropdowns to scope data. Click a period column or a row in By
              type / By completer to cross-filter: that view stays full; summary, other breakdowns, and the record list
              follow your selection (same idea as the Skill Matrix report).
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-surface px-3 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <label className={`${lbl} flex min-w-[7.5rem] flex-1 flex-col gap-1 sm:min-w-0 sm:flex-initial`}>
            From
            <input type="date" className={inp} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className={`${lbl} flex min-w-[7.5rem] flex-1 flex-col gap-1 sm:min-w-0 sm:flex-initial`}>
            To
            <input type="date" className={inp} value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
          <label className={`${lbl} flex min-w-[10rem] flex-1 flex-col gap-1 sm:min-w-[9rem]`}>
            Type
            <select className={inp} value={filterTypeId} onChange={(e) => setFilterTypeId(e.target.value)}>
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className={`${lbl} flex min-w-[10rem] flex-1 flex-col gap-1 sm:min-w-[9rem]`}>
            Completed by
            <select className={inp} value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)}>
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
              className="h-8 rounded-md border border-border px-2 text-xs text-muted hover:bg-surface-raised"
              onClick={() => applyRangeDays(7)}
            >
              Last 7d
            </button>
            <button
              type="button"
              className="h-8 rounded-md border border-border px-2 text-xs text-muted hover:bg-surface-raised"
              onClick={() => applyRangeDays(30)}
            >
              Last 30d
            </button>
            <button
              type="button"
              className="h-8 rounded-md border border-border px-2 text-xs text-muted hover:bg-surface-raised"
              onClick={() => applyRangeDays(90)}
            >
              Last 90d
            </button>
            <button
              type="button"
              className="h-8 rounded-md border border-border bg-surface-raised px-2 text-xs font-semibold text-fg hover:bg-surface-raised/80"
              onClick={resetAllFilters}
            >
              Reset all
            </button>
          </div>
        </div>
      </div>

      {activeInsightCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-raised/40 px-3 py-2 text-xs">
          <span className="font-semibold text-muted">Cross-filter (charts stay full):</span>
          {selectedPeriodBucket ? (
            <button
              type="button"
              onClick={() => setInsightPeriodKey(null)}
              className="inline-flex items-center gap-1 rounded-full border border-sky-600/40 bg-sky-500/10 px-2 py-1 font-medium text-sky-900 dark:text-sky-100"
            >
              Period: {selectedPeriodLabel}
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
          {insightTypeId ? (
            <button
              type="button"
              onClick={() => setInsightTypeId(null)}
              className="inline-flex items-center gap-1 rounded-full border border-violet-600/40 bg-violet-500/10 px-2 py-1 font-medium text-violet-900 dark:text-violet-100"
            >
              Type: {selectedTypeName}
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
          {insightUserId ? (
            <button
              type="button"
              onClick={() => setInsightUserId(null)}
              className="inline-flex items-center gap-1 rounded-full border border-teal-600/40 bg-teal-500/10 px-2 py-1 font-medium text-teal-900 dark:text-teal-100"
            >
              Completer: {selectedCompleterName}
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Total completed</div>
          <div className="mt-0.5 text-xl font-semibold tabular-nums">{summary.n}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Average score</div>
          <div className="mt-0.5 text-xl font-semibold tabular-nums">{summary.n ? `${summary.avg}%` : '—'}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Band split</div>
          <div className="mt-0.5 text-xs tabular-nums text-fg/90">
            <span className="text-emerald-800 dark:text-emerald-200">&gt;80: {summary.high}</span>
            <span className="mx-1 text-muted">·</span>
            <span className="text-amber-900 dark:text-amber-100">60–80: {summary.mid}</span>
            <span className="mx-1 text-muted">·</span>
            <span className="text-rose-800 dark:text-rose-200">&lt;60: {summary.low}</span>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">RAG outcomes</div>
          <div className="mt-0.5 text-xs tabular-nums text-fg/90">
            G {summary.green} · A {summary.amber} · R {summary.red}
          </div>
        </div>
      </div>

      {summary.n > 0 ? (
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-fg">RAG distribution</h2>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-surface-raised ring-1 ring-border flex">
            {summary.green > 0 ? (
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${ragPct(summary.green)}%` }}
                title={`Green ${summary.green} (${ragPct(summary.green)}%)`}
              />
            ) : null}
            {summary.amber > 0 ? (
              <div
                className="h-full bg-amber-400"
                style={{ width: `${ragPct(summary.amber)}%` }}
                title={`Amber ${summary.amber} (${ragPct(summary.amber)}%)`}
              />
            ) : null}
            {summary.red > 0 ? (
              <div
                className="h-full bg-rose-500"
                style={{ width: `${ragPct(summary.red)}%` }}
                title={`Red ${summary.red} (${ragPct(summary.red)}%)`}
              />
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-sm bg-emerald-500" aria-hidden />
              Green {summary.green} ({ragPct(summary.green)}%)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-sm bg-amber-400" aria-hidden />
              Amber {summary.amber} ({ragPct(summary.amber)}%)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-sm bg-rose-500" aria-hidden />
              Red {summary.red} ({ragPct(summary.red)}%)
            </span>
          </div>
        </div>
      ) : null}

      <CompactPeriodBars
        title={`Volume by ${periodMode === 'weeks' ? 'week' : 'month'}`}
        subtitle="This chart stays full for period distribution; click a column to cross-filter other report blocks."
        buckets={periodBuckets}
        values={periodValues}
        selectedKey={insightPeriodKey}
        onToggleBucket={(key) => setInsightPeriodKey((cur) => (cur === key ? null : key))}
        controls={
          <div className="flex rounded-lg border border-border bg-surface p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setPeriodMode('weeks')
                setInsightPeriodKey(null)
              }}
              className={`rounded-md px-2 py-0.5 font-medium ${
                periodMode === 'weeks' ? 'bg-sky-600 text-white' : 'text-muted hover:text-fg'
              }`}
            >
              Weeks
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriodMode('months')
                setInsightPeriodKey(null)
              }}
              className={`rounded-md px-2 py-0.5 font-medium ${
                periodMode === 'months' ? 'bg-sky-600 text-white' : 'text-muted hover:text-fg'
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
          subtitle="Full type split; ignores type selection. Respects selected period and completer."
          items={byTypeItems}
          selectedKey={insightTypeId}
          onToggleKey={(key) => setInsightTypeId((cur) => (cur === key ? null : key))}
          barClassName="bg-indigo-500 hover:brightness-110"
          selectedBarClassName="bg-indigo-600"
        />
        <CompactCategoryBars
          title="By completer"
          subtitle="Full completer split; ignores completer selection. Respects selected period and type."
          items={byCompleterItems}
          selectedKey={insightUserId}
          onToggleKey={(key) => setInsightUserId((cur) => (cur === key ? null : key))}
          barClassName="bg-teal-500 hover:brightness-110"
          selectedBarClassName="bg-teal-600"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-3 py-2">
          <div className="text-sm font-semibold">Records</div>
          <p className="text-xs text-muted">
            Showing {filteredRows.length} of {rows.length} records in range
            {activeInsightCount ? ' (cross-filters applied)' : ''}.
          </p>
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-raised/60 text-[10px] font-semibold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">By</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">RAG</th>
              <th className="px-3 py-2 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted">
                  <span className="inline-block size-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted">
                  No submitted checks match these filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => {
                const j = ldrMasterCellJoinFromId(r.master_cell_id, masterCellJoinById)
                const loc = j ? ldrMasterCellLabel(j) : r.master_cell_id.slice(0, 8)
                return (
                  <tr key={r.id} className="border-b border-border/80">
                    <td className="whitespace-nowrap px-3 py-2 text-fg/90">
                      {new Date(r.completed_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-medium">{typeLabel(r.hc_types)}</td>
                    <td className="max-w-[12rem] truncate px-3 py-2 text-muted" title={loc}>
                      {loc}
                    </td>
                    <td className="px-3 py-2">{r.completed_by_name}</td>
                    <td className="px-3 py-2 tabular-nums">{r.score}%</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${hcRagBadgeClass(r.status)}`}
                      >
                        {hcRagLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to={`/ldr-tools/health-checks/${r.id}`}
                        className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
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
    </div>
  )
}
