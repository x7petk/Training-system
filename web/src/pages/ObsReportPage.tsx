import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FileBarChart } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useLdrWorkspace } from '../features/ldr/LdrWorkspaceContext'
import { ldrMasterCellJoinFromId, ldrMasterCellLabel } from '../features/ldr/types'
import { hcRagBadgeClass, hcRagLabel, type HcRag } from '../features/health-checks/hcScore'
import { formatWeekTitle, startOfWeekMonday, toYMD } from '../features/ldr/ldrWeekUtils'
import type { ObsKind } from '../features/observations/obsKind'
import { obsBasePath, obsLabel, obsTitle } from '../features/observations/obsKind'

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
}

type CompleterOpt = { id: string; name: string }

function recTable(k: ObsKind) {
  return k === 'sos' ? 'sos_records' : k === 'qos' ? 'qos_records' : 'ppo_records'
}
function typeFk(k: ObsKind) {
  return k === 'sos' ? 'sos_type_id' : k === 'qos' ? 'qos_type_id' : 'ppo_type_id'
}
function typeRel(k: ObsKind) {
  return k === 'sos' ? 'sos_types(name)' : k === 'qos' ? 'qos_types(name)' : 'ppo_types(name)'
}

export function ObsReportPage({ kind }: { kind: ObsKind }) {
  const { masterCellJoinById, workspaceId } = useLdrWorkspace()
  const [rows, setRows] = useState<Row[]>([])
  const [types, setTypes] = useState<{ id: string; name: string }[]>([])
  const [completerOptions, setCompleterOptions] = useState<CompleterOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day')

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [filterTypeId, setFilterTypeId] = useState('')
  const [filterUserId, setFilterUserId] = useState('')

  const rt = recTable(kind)
  const fk = typeFk(kind)
  const rel = typeRel(kind)

  const scopedSelect = useCallback(
    (select: string) => {
      const fromIso = `${fromDate}T00:00:00.000Z`
      const toIso = `${toDate}T23:59:59.999Z`
      let q = supabase
        .from(rt)
        .select(select)
        .not('completed_at', 'is', null)
        .gte('completed_at', fromIso)
        .lte('completed_at', toIso)
      if (filterTypeId) q = q.eq(fk, filterTypeId)
      return q
    },
    [fromDate, toDate, filterTypeId, rt, fk],
  )

  const loadTypes = useCallback(async () => {
    if (!workspaceId) {
      setTypes([])
      return
    }
    const tbl = kind === 'sos' ? 'sos_types' : kind === 'qos' ? 'qos_types' : 'ppo_types'
    const res = await supabase
      .from(tbl)
      .select('id, name, ldr_activities!inner(workspace_id)')
      .eq('active', true)
      .eq('ldr_activities.workspace_id', workspaceId)
      .order('name')
    if (!res.error && res.data) setTypes(res.data as { id: string; name: string }[])
  }, [workspaceId, kind])

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    const fullSelect = `id, completed_at, score, status, completed_by_name, completed_by_user_id, master_cell_id, ${fk}, ${rel}`
    let dataQ = scopedSelect(fullSelect).order('completed_at', { ascending: false }).limit(800)
    if (filterUserId) dataQ = dataQ.eq('completed_by_user_id', filterUserId)
    const compQ = scopedSelect(`completed_by_user_id, completed_by_name`).limit(800)
    const [dataRes, compRes] = await Promise.all([dataQ, compQ])
    setLoading(false)
    if (dataRes.error) {
      setError(dataRes.error.message)
      setRows([])
      setCompleterOptions([])
      return
    }
    const raw = (dataRes.data ?? []) as unknown as Record<string, unknown>[]
    const mapped: Row[] = raw.map((r) => {
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
      }
    })
    setRows(mapped)
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
  }, [scopedSelect, filterUserId, fk, rel])

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

  const volumeSeries = useMemo(() => {
    const fmt = (d: Date) => {
      if (granularity === 'day') return toYMD(d)
      if (granularity === 'week') return formatWeekTitle(startOfWeekMonday(d))
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    }
    const bucket = new Map<string, number>()
    for (const r of rows) {
      const d = new Date(r.completed_at)
      const key = fmt(d)
      bucket.set(key, (bucket.get(key) ?? 0) + 1)
    }
    return [...bucket.entries()]
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => a.period.localeCompare(b.period))
  }, [rows, granularity])

  const byType = useMemo(() => {
    const m = new Map<string, { name: string; count: number; sumScore: number }>()
    for (const r of rows) {
      const cur = m.get(r.type_id) ?? { name: r.type_name, count: 0, sumScore: 0 }
      cur.count += 1
      cur.sumScore += r.score
      m.set(r.type_id, cur)
    }
    return [...m.values()].map((v) => ({
      name: v.name,
      count: v.count,
      avgScore: v.count ? Math.round((v.sumScore / v.count) * 10) / 10 : 0,
    }))
  }, [rows])

  const byPerson = useMemo(() => {
    const m = new Map<string, { name: string; count: number; sumScore: number }>()
    for (const r of rows) {
      const cur = m.get(r.completed_by_user_id) ?? { name: r.completed_by_name, count: 0, sumScore: 0 }
      cur.count += 1
      cur.sumScore += r.score
      m.set(r.completed_by_user_id, cur)
    }
    return [...m.entries()].map(([, v]) => ({
      name: v.name,
      count: v.count,
      avgScore: v.count ? Math.round((v.sumScore / v.count) * 10) / 10 : 0,
    }))
  }, [rows])

  const base = obsBasePath(kind)
  const title = obsTitle(kind)
  const short = obsLabel(kind)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            to={base}
            className="mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted hover:bg-surface-raised"
            aria-label="Back"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-800 dark:text-sky-200">
            <FileBarChart className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{short} Report</h1>
            <p className="text-sm text-muted">
              {title} — submitted records only. Data follows RLS (all locations you can access). Filters: date range,
              type, completer.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <label className="text-xs font-medium text-muted">
          From
          <input
            type="date"
            className="mt-1 block h-10 rounded-lg border border-border bg-surface px-3 text-sm"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-muted">
          To
          <input
            type="date"
            className="mt-1 block h-10 rounded-lg border border-border bg-surface px-3 text-sm"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
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
        <label className="text-xs font-medium text-muted">
          Volume bucket
          <select
            className="mt-1 block h-10 rounded-lg border border-border bg-surface px-3 text-sm"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as 'day' | 'week' | 'month')}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-fg">Volume ({granularity})</h2>
          <div className="mt-4 h-64">
            {loading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeSeries}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name={`${short} completed`} fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-fg">Summary</h2>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{rows.length}</p>
          <p className="text-xs text-muted">Records in range</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-fg">By type</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byType} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" name="Count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-fg">By completer</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byPerson} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" name="Count" fill="#14b8a6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-raised/60 text-xs font-semibold uppercase text-muted">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Completer</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">RAG</th>
              <th className="px-4 py-3 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  No records in this range.
                </td>
              </tr>
            ) : (
              rows.slice(0, 200).map((r) => {
                const j = ldrMasterCellJoinFromId(r.master_cell_id, masterCellJoinById)
                const loc = j ? ldrMasterCellLabel(j) : `${r.master_cell_id.slice(0, 8)}…`
                return (
                  <tr key={r.id} className="border-b border-border/80">
                    <td className="px-4 py-2 tabular-nums text-muted">{new Date(r.completed_at).toLocaleString()}</td>
                    <td className="px-4 py-2">{r.type_name}</td>
                    <td className="px-4 py-2">{loc}</td>
                    <td className="px-4 py-2">{r.completed_by_name}</td>
                    <td className="px-4 py-2 tabular-nums">{r.score}%</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${hcRagBadgeClass(r.status)}`}>
                        {hcRagLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link to={`${base}/${r.id}`} className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300">
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

export function SosReportPage() {
  return <ObsReportPage kind="sos" />
}
export function QosReportPage() {
  return <ObsReportPage kind="qos" />
}
export function PpoReportPage() {
  return <ObsReportPage kind="ppo" />
}
