import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FileBarChart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLdrWorkspace } from '../features/ldr/LdrWorkspaceContext'
import { ldrMasterCellJoinFromId, ldrMasterCellLabel } from '../features/ldr/types'
import { hcRagBadgeClass, hcRagLabel, type HcRag } from '../features/health-checks/hcScore'
import { formatWeekTitle, startOfWeekMonday, toYMD } from '../features/ldr/ldrWeekUtils'

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

export function HcReportPage() {
  const { masterCellJoinById, workspaceId } = useLdrWorkspace()

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
    if (!workspaceId) {
      setTypes([])
      return
    }
    const res = await supabase
      .from('hc_types')
      .select('id, name, ldr_activities!inner(workspace_id)')
      .eq('active', true)
      .eq('ldr_activities.workspace_id', workspaceId)
      .order('name')
    if (!res.error && res.data) setTypes(res.data as { id: string; name: string }[])
  }, [workspaceId])

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    const fullSelect =
      'id, completed_at, score, status, completed_by_name, completed_by_user_id, master_site_id, master_plant_id, master_cell_id, hc_type_id, hc_types(name)'

    let dataQ = scopedSelect(fullSelect).order('completed_at', { ascending: false }).limit(500)
    if (filterUserId) dataQ = dataQ.eq('completed_by_user_id', filterUserId)

    const compQ = scopedSelect('completed_by_user_id, completed_by_name').limit(800)

    const [dataRes, compRes] = await Promise.all([dataQ, compQ])
    setLoading(false)

    if (dataRes.error) {
      setError(dataRes.error.message)
      setRows([])
      setCompleterOptions([])
      return
    }

    setRows((dataRes.data ?? []) as unknown as Row[])

    if (!compRes.error && compRes.data) {
      const m = new Map<string, string>()
      for (const r of compRes.data as unknown as { completed_by_user_id: string; completed_by_name: string }[]) {
        const id = r.completed_by_user_id
        const name = r.completed_by_name?.trim() || id.slice(0, 8)
        if (!m.has(id)) m.set(id, name)
      }
      setCompleterOptions([...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)))
    } else {
      setCompleterOptions([])
    }
  }, [scopedSelect, filterUserId])

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

  const summary = useMemo(() => {
    const n = rows.length
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
    const sum = rows.reduce((a, r) => a + r.score, 0)
    const avg = Math.round((sum / n) * 10) / 10
    let green = 0
    let amber = 0
    let red = 0
    for (const r of rows) {
      if (r.status === 'green') green += 1
      else if (r.status === 'amber') amber += 1
      else red += 1
    }
    return {
      n,
      avg,
      low: rows.filter((r) => r.score < 60).length,
      mid: rows.filter((r) => r.score >= 60 && r.score <= 80).length,
      high: rows.filter((r) => r.score > 80).length,
      green,
      amber,
      red,
    }
  }, [rows])

  const byType = useMemo(() => {
    const m = new Map<string, { id: string; name: string; count: number; sum: number }>()
    for (const r of rows) {
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
  }, [rows])

  const byWeek = useMemo(() => {
    const m = new Map<string, { key: string; weekStart: Date; count: number; sum: number }>()
    for (const r of rows) {
      const d = new Date(r.completed_at)
      const mon = startOfWeekMonday(d)
      const key = toYMD(mon)
      const cur = m.get(key) ?? { key, weekStart: mon, count: 0, sum: 0 }
      cur.count += 1
      cur.sum += r.score
      m.set(key, cur)
    }
    return [...m.values()]
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
      .map((w) => ({
        ...w,
        label: formatWeekTitle(w.weekStart),
        avg: w.count ? Math.round((w.sum / w.count) * 10) / 10 : 0,
      }))
  }, [rows])

  const byCompleter = useMemo(() => {
    const m = new Map<string, { id: string; name: string; count: number; sum: number }>()
    for (const r of rows) {
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
  }, [rows])

  const maxWeekCount = useMemo(() => byWeek.reduce((m, w) => Math.max(m, w.count), 0), [byWeek])

  const inp =
    'h-8 w-full min-w-0 rounded-md border border-border-strong bg-surface px-2 text-xs text-fg shadow-sm sm:max-w-[11rem]'
  const lbl = 'text-[10px] font-semibold uppercase tracking-wide text-muted'

  const ragTotal = summary.green + summary.amber + summary.red
  const ragPct = (n: number) => (ragTotal ? Math.round((100 * n) / ragTotal) : 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/ldr-tools/health-checks"
          className="inline-flex size-10 items-center justify-center rounded-xl border border-border text-muted hover:bg-surface-raised"
          aria-label="Back to health checks"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300">
          <FileBarChart className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">HC Report</h1>
          <p className="text-xs text-muted sm:text-sm">
            Submitted checks only. All locations you can access under LDR (RLS); filter by date, type, and completer. No
            export in this version.
          </p>
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
        </div>
      </div>

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

      {byWeek.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-fg">Trends by week (Mon–Sun)</h2>
          <p className="mt-1 text-xs text-muted">Bar height = number of completed checks; label shows average score that week.</p>
          <div className="mt-4 flex items-end gap-1 overflow-x-auto pb-1 pt-2">
            {byWeek.map((w) => (
              <div key={w.key} className="flex min-w-[3rem] flex-1 flex-col items-center gap-1">
                <div
                  className="w-full max-w-[2.75rem] rounded-t bg-teal-500/80 dark:bg-teal-500/60"
                  style={{
                    height: `${maxWeekCount ? Math.max(8, Math.round((40 * w.count) / maxWeekCount)) : 8}px`,
                  }}
                  title={`${w.label}: ${w.count} check(s), avg ${w.avg}%`}
                />
                <div className="text-center text-[10px] font-medium tabular-nums text-muted">{w.avg}%</div>
                <div className="line-clamp-2 text-center text-[9px] leading-tight text-muted">{w.count}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1 border-t border-border/80 pt-3 text-xs">
            {byWeek.map((w) => (
              <div key={`${w.key}-row`} className="flex justify-between gap-2">
                <span className="min-w-0 truncate text-muted" title={w.label}>
                  {w.label}
                </span>
                <span className="shrink-0 tabular-nums text-fg">
                  {w.count} · avg {w.avg}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {byCompleter.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-3 py-2 text-sm font-semibold">By completer</div>
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface-raised/90 text-[10px] uppercase text-muted backdrop-blur-sm">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Count</th>
                  <th className="px-3 py-2">Avg</th>
                </tr>
              </thead>
              <tbody>
                {byCompleter.map((c) => (
                  <tr key={c.id} className="border-t border-border/80">
                    <td className="px-3 py-1.5 font-medium">{c.name}</td>
                    <td className="px-3 py-1.5 tabular-nums">{c.count}</td>
                    <td className="px-3 py-1.5 tabular-nums">{c.avg}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {byType.length ? (
        <div className="rounded-xl border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-3 py-2 text-sm font-semibold">By type</div>
          <table className="w-full text-left text-sm">
            <thead className="text-[10px] uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Count</th>
                <th className="px-3 py-2">Avg</th>
              </tr>
            </thead>
            <tbody>
              {byType.map((b) => (
                <tr key={b.id} className="border-t border-border/80">
                  <td className="px-3 py-1.5 font-medium">{b.name}</td>
                  <td className="px-3 py-1.5 tabular-nums">{b.count}</td>
                  <td className="px-3 py-1.5 tabular-nums">{b.avg}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-3 py-2 text-sm font-semibold">Records</div>
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
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted">
                  No submitted checks match these filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
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
