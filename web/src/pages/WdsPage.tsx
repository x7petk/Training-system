import { useCallback, useEffect, useMemo, useState } from 'react'
import { ListFilter, MessageSquare, Trash2 } from 'lucide-react'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import { supabase } from '../lib/supabase'
import {
  aggregateWds,
  computeGlideTarget,
  defaultWdsWeeks,
  evaluateWdsAgainstTarget,
  parseWdsAggregation,
  type WdsColumnRow,
  type WdsTrendDefRow,
  type WdsWeekSlot,
} from '../features/dds/ddsWds'
import { WdsTrendChart, wdsToneTextClass, type WdsTrendSeries } from '../features/dds/WdsTrendChart'
import { buildWdsHcTrendSeries, type WdsHcRecordLite } from '../features/dds/wdsHcTrend'
import { WdsHcTrendCell } from '../features/dds/WdsHcTrendCell'
import { hcRagFromPercent, type HcRag } from '../features/health-checks/hcScore'
import { ddsBtnDanger, ddsErr, ddsHint, ddsInput, ddsSelect, ddsStack } from '../features/dds/ddsAdminCompactClasses'

type KpiDef = { id: string; scoring: unknown }

const ROWS = [
  { key: 'output', label: 'Output measure' },
  { key: 'in_a', label: 'In-process measure' },
  { key: 'in_b', label: 'In-process measure' },
  { key: 'hc', label: 'Health check' },
  { key: 'actions', label: 'Actions (placeholder)' },
] as const

const compactFmt = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const tickFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

type KpiEntry = {
  id: string
  kpi_id: string
  plan_date: string
  shift_kind: string
  value_numeric: number | null
  comment: string | null
  updated_at: string
}

export function WdsPage() {
  const { status, cellId } = usePlan24Workspace()
  const [columns, setColumns] = useState<WdsColumnRow[]>([])
  const [trends, setTrends] = useState<WdsTrendDefRow[]>([])
  const [kpis, setKpis] = useState<KpiDef[]>([])
  const [entries, setEntries] = useState<KpiEntry[]>([])
  const [hcRecords, setHcRecords] = useState<WdsHcRecordLite[]>([])
  const [weeks, setWeeks] = useState<WdsWeekSlot[]>(() => defaultWdsWeeks())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickerFor, setPickerFor] = useState<{ columnId: string; rowKey: 'output' | 'in_a' | 'in_b' } | null>(null)
  const [zoomFor, setZoomFor] = useState<{ trendId: string; rowLabel: string; columnHeader: string } | null>(null)
  const [commentFor, setCommentFor] = useState<{ trendId: string; weekIndex: number; rowLabel: string; columnHeader: string } | null>(null)

  const scoringByKpiId = useMemo(() => {
    const m = new Map<string, unknown>()
    for (const k of kpis) m.set(k.id, k.scoring)
    return m
  }, [kpis])

  const trendById = useMemo(() => {
    const m = new Map<string, WdsTrendDefRow>()
    for (const t of trends) m.set(t.id, t)
    return m
  }, [trends])

  const load = useCallback(async () => {
    if (!cellId) {
      setColumns([])
      setTrends([])
      setKpis([])
      setEntries([])
      setHcRecords([])
      setLoading(false)
      return
    }
    const windowWeeks = defaultWdsWeeks()
    setWeeks(windowWeeks)
    const fromDate = windowWeeks[0]?.startYmd ?? '2000-01-01'
    const toDate = windowWeeks[windowWeeks.length - 1]?.endYmd ?? '2100-01-01'
    const fromIso = `${fromDate}T00:00:00.000Z`
    const toIso = `${toDate}T23:59:59.999Z`
    setLoading(true)
    setError(null)
    const [cRes, tRes, kRes, eRes, hcRes] = await Promise.all([
      supabase
        .from('dds_wds_columns')
        .select('id, master_cell_id, header, sort_order, output_trend_id, in_process_a_trend_id, in_process_b_trend_id')
        .eq('master_cell_id', cellId)
        .order('sort_order')
        .order('created_at'),
      supabase
        .from('dds_wds_trends')
        .select(
          'id, master_cell_id, kpi_id, label, aggregation, glidepath_mode, target_flat, target_start, target_end, target_weekly, sort_order, is_active',
        )
        .eq('master_cell_id', cellId)
        .eq('is_active', true)
        .order('sort_order')
        .order('created_at'),
      supabase.from('dds_kpis').select('id, scoring').eq('metric_scope', 'cell'),
      supabase
        .from('dds_kpi_cell_entries')
        .select('id, kpi_id, plan_date, shift_kind, value_numeric, comment, updated_at')
        .eq('master_cell_id', cellId)
        .gte('plan_date', fromDate)
        .lte('plan_date', toDate),
      supabase
        .from('hc_records')
        .select('id, completed_at, score, status, hc_type_id, hc_types(name)')
        .eq('master_cell_id', cellId)
        .not('completed_at', 'is', null)
        .gte('completed_at', fromIso)
        .lte('completed_at', toIso)
        .order('completed_at'),
    ])
    setLoading(false)
    if (cRes.error || tRes.error || kRes.error || eRes.error || hcRes.error) {
      setError(
        cRes.error?.message ??
          tRes.error?.message ??
          kRes.error?.message ??
          eRes.error?.message ??
          hcRes.error?.message ??
          'Load failed',
      )
      return
    }
    setColumns((cRes.data ?? []) as WdsColumnRow[])
    setTrends((tRes.data ?? []) as WdsTrendDefRow[])
    setKpis((kRes.data ?? []) as KpiDef[])
    setEntries((eRes.data ?? []) as KpiEntry[])
    const hcRows = (hcRes.data ?? []) as {
      id: string
      completed_at: string
      score: number
      status: string
      hc_type_id: string
      hc_types: { name: string } | { name: string }[] | null
    }[]
    setHcRecords(
      hcRows.map((r) => {
        const t = r.hc_types
        const type_name = Array.isArray(t) ? (t[0]?.name ?? 'Health check') : (t?.name ?? 'Health check')
        const status = (r.status === 'green' || r.status === 'amber' || r.status === 'red' ? r.status : hcRagFromPercent(r.score)) as HcRag
        return {
          id: r.id,
          completed_at: r.completed_at,
          score: r.score,
          status,
          hc_type_id: r.hc_type_id,
          type_name,
        }
      }),
    )
  }, [cellId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    function onAddColumn() {
      void addColumn()
    }
    window.addEventListener('dds-wds-add-column', onAddColumn as EventListener)
    return () => {
      window.removeEventListener('dds-wds-add-column', onAddColumn as EventListener)
    }
  }, [columns.length, cellId])

  const hcTrendSeries = useMemo(() => buildWdsHcTrendSeries(hcRecords, weeks), [hcRecords, weeks])

  const seriesByTrendId = useMemo(() => {
    const map = new Map<string, WdsTrendSeries>()
    for (const t of trends) {
      const valueByWeek: (number | null)[] = Array.from({ length: 14 }, () => null)
      const grouped: number[][] = Array.from({ length: 14 }, () => [])
      const commentCountByWeek: number[] = Array.from({ length: 14 }, () => 0)
      for (const e of entries) {
        if (e.kpi_id !== t.kpi_id || e.value_numeric == null) continue
        const ix = weeks.findIndex((w) => e.plan_date >= w.startYmd && e.plan_date <= w.endYmd)
        if (ix < 0) continue
        grouped[ix]!.push(Number(e.value_numeric))
        if (e.comment?.trim()) commentCountByWeek[ix] = (commentCountByWeek[ix] ?? 0) + 1
      }
      for (let i = 0; i < 14; i += 1) {
        valueByWeek[i] = aggregateWds(grouped[i] ?? [], parseWdsAggregation(t.aggregation))
      }
      const targetByWeek = valueByWeek.map((_, i) => computeGlideTarget(t, i))
      const scoring = scoringByKpiId.get(t.kpi_id) ?? { kind: 'no_target' }
      const toneByWeek = valueByWeek.map((v, i) => evaluateWdsAgainstTarget(v, scoring, targetByWeek[i] ?? null))
      map.set(t.id, { valueByWeek, targetByWeek, toneByWeek, commentCountByWeek })
    }
    return map
  }, [entries, trends, weeks, scoringByKpiId])

  async function addColumn() {
    if (!cellId) return
    const nextOrder = columns.length
    const { error: insErr } = await supabase.from('dds_wds_columns').insert({
      master_cell_id: cellId,
      header: `Column ${nextOrder + 1}`,
      sort_order: nextOrder,
      output_trend_id: null,
      in_process_a_trend_id: null,
      in_process_b_trend_id: null,
    })
    if (insErr) {
      setError(insErr.message)
      return
    }
    void load()
  }

  async function saveColumn(row: WdsColumnRow) {
    if (!cellId) return
    setSaving(true)
    setError(null)
    const { error: upErr } = await supabase
      .from('dds_wds_columns')
      .update({
        header: row.header.trim() || 'Untitled',
        output_trend_id: row.output_trend_id,
        in_process_a_trend_id: row.in_process_a_trend_id,
        in_process_b_trend_id: row.in_process_b_trend_id,
      })
      .eq('id', row.id)
      .eq('master_cell_id', cellId)
    setSaving(false)
    if (upErr) {
      setError(upErr.message)
      return
    }
  }

  async function removeColumn(id: string) {
    if (!cellId) return
    const { error: delErr } = await supabase.from('dds_wds_columns').delete().eq('id', id).eq('master_cell_id', cellId)
    if (delErr) {
      setError(delErr.message)
      return
    }
    void load()
  }

  if (status === 'loading' || loading) return <p className="text-xs text-muted">Loading…</p>
  if (!cellId) return <p className={ddsHint}>Select a cell in the scope bar to use WDS.</p>

  return (
    <div className={ddsStack}>
      {error ? <p className={ddsErr}>{error}</p> : null}

      <div className="max-h-[calc(100dvh-10.25rem)] overflow-auto rounded-lg border border-border bg-surface">
        <table className="min-w-[980px] table-fixed border-collapse text-[10px] leading-tight">
          <thead>
            <tr>
              <th className="w-8 border-b border-r border-border bg-surface-raised/50 px-0.5 py-1 text-center text-muted">
                <span className="inline-block [writing-mode:vertical-rl] [text-orientation:mixed] rotate-180 text-[9px] font-semibold">
                  Line
                </span>
              </th>
              {columns.map((c) => (
                <th key={c.id} className="border-b border-r border-border bg-surface-raised/50 px-1.5 py-1 align-top">
                  <div className="flex items-center gap-1">
                    <input
                      className={`${ddsInput} mt-0 h-7 min-w-0 flex-1 px-1.5 text-[10px]`}
                      value={c.header}
                      onChange={(e) =>
                        setColumns((prev) => prev.map((p) => (p.id === c.id ? { ...p, header: e.target.value } : p)))
                      }
                      onBlur={() => void saveColumn(c)}
                    />
                    <button type="button" className={`${ddsBtnDanger} h-7 w-7`} onClick={() => void removeColumn(c.id)}>
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key} className="align-top">
                <td className="border-r border-b border-border px-0.5 py-1 text-center text-muted">
                  <span className="inline-block [writing-mode:vertical-rl] [text-orientation:mixed] rotate-180 text-[9px] font-semibold">
                    {row.label}
                  </span>
                </td>
                {columns.map((c) => {
                  if (row.key === 'hc') {
                    return (
                      <td key={`${row.key}-${c.id}`} className="relative border-r border-b border-border px-1.5 py-1 align-top">
                        <WdsHcTrendCell
                          series={hcTrendSeries}
                          weeks={weeks}
                          records={hcRecords}
                          columnHeader={c.header.trim() || 'Untitled'}
                        />
                      </td>
                    )
                  }
                  if (row.key === 'actions') {
                    return (
                      <td key={`${row.key}-${c.id}`} className="border-r border-b border-border px-1.5 py-1 text-muted">
                        Coming later
                      </td>
                    )
                  }
                  const trendId =
                    row.key === 'output' ? c.output_trend_id : row.key === 'in_a' ? c.in_process_a_trend_id : c.in_process_b_trend_id
                  const series = trendId ? seriesByTrendId.get(trendId) : null
                  const trend = trendId ? trendById.get(trendId) : null
                  const latestIx = series ? series.valueByWeek.map((v, i) => ({ v, i })).filter((x) => x.v != null).at(-1)?.i ?? -1 : -1
                  const latestValue = latestIx >= 0 && series ? series.valueByWeek[latestIx] : null
                  const latestTarget = latestIx >= 0 && series ? series.targetByWeek[latestIx] : null
                  const latestTone = latestIx >= 0 && series ? series.toneByWeek[latestIx] : 'neutral'
                  const totalComments = series ? series.commentCountByWeek.reduce((a, b) => a + b, 0) : 0
                  return (
                    <td key={`${row.key}-${c.id}`} className="relative border-r border-b border-border px-1.5 py-1 align-top">
                      {series ? (
                        <div className="mt-0.5 space-y-0.5">
                          <div className="flex items-start justify-between gap-1 rounded border border-border/70 bg-surface-raised/20 px-1.5 py-0.5">
                            <div className="min-w-0">
                              <p className="truncate text-[9px] font-semibold text-fg">{trend?.label ?? 'Trend'}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-[9px] font-semibold tabular-nums ${wdsToneTextClass(latestTone)}`}>
                                {latestValue == null ? '—' : compactFmt.format(latestValue)}
                              </p>
                              <p className="text-[8px] tabular-nums text-blue-700 dark:text-blue-300">
                                T {latestTarget == null ? '—' : compactFmt.format(latestTarget)}
                              </p>
                            </div>
                          </div>
                          {totalComments > 0 ? (
                            <button
                              type="button"
                              className="absolute right-8 top-2 inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded border border-amber-500/50 bg-amber-500/15 px-1 text-amber-900 hover:bg-amber-500/25 dark:text-amber-200"
                              aria-label="Open comments from latest commented week"
                              title={`${totalComments} comment${totalComments === 1 ? '' : 's'} available`}
                              onClick={(e) => {
                                e.stopPropagation()
                                const latestCommentWeek = [...(series.commentCountByWeek ?? [])]
                                  .map((count, wi) => ({ count, wi }))
                                  .filter((x) => x.count > 0)
                                  .at(-1)?.wi
                                if (latestCommentWeek == null) return
                                setCommentFor({
                                  trendId: trendId ?? '',
                                  weekIndex: latestCommentWeek,
                                  rowLabel: row.label,
                                  columnHeader: c.header.trim() || 'Untitled',
                                })
                              }}
                            >
                              <MessageSquare className="size-2.5" aria-hidden />
                              <span className="text-[8px] leading-none">{totalComments}</span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="absolute right-2 top-2 inline-flex size-5 items-center justify-center rounded border border-border/80 bg-surface/90 text-muted hover:text-fg"
                            aria-label="Select trend"
                            onClick={() => setPickerFor({ columnId: c.id, rowKey: row.key })}
                          >
                            <ListFilter className="size-3" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="block w-full text-left"
                            onClick={() =>
                              setZoomFor({
                                trendId: trendId ?? '',
                                rowLabel: row.label,
                                columnHeader: c.header.trim() || 'Untitled',
                              })
                            }
                            aria-label="Zoom trend chart"
                          >
                            <WdsTrendChart series={series} weeks={weeks} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex min-h-[6.5rem] items-center justify-center rounded border border-dashed border-border/70 bg-surface-raised/10">
                          <button
                            type="button"
                            className="inline-flex size-6 items-center justify-center rounded border border-border/80 bg-surface text-muted hover:text-fg"
                            aria-label="Select trend"
                            onClick={() => setPickerFor({ columnId: c.id, rowKey: row.key })}
                          >
                            <ListFilter className="size-3.5" aria-hidden />
                          </button>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {saving ? <p className="text-xs text-muted">Saving…</p> : null}
      {pickerFor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3"
          role="dialog"
          aria-modal="true"
          onClick={() => setPickerFor(null)}
        >
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-2" onClick={(e) => e.stopPropagation()}>
            <p className="mb-1 text-[10px] font-semibold text-muted">Select trend</p>
            <select
              className={`${ddsSelect} mt-0 h-8`}
              value={
                columns.find((c) => c.id === pickerFor.columnId)?.[
                  pickerFor.rowKey === 'output'
                    ? 'output_trend_id'
                    : pickerFor.rowKey === 'in_a'
                      ? 'in_process_a_trend_id'
                      : 'in_process_b_trend_id'
                ] ?? ''
              }
              onChange={(e) => {
                const v = e.target.value || null
                const next = columns.map((p) =>
                  p.id === pickerFor.columnId
                    ? pickerFor.rowKey === 'output'
                      ? { ...p, output_trend_id: v }
                      : pickerFor.rowKey === 'in_a'
                        ? { ...p, in_process_a_trend_id: v }
                        : { ...p, in_process_b_trend_id: v }
                    : p,
                )
                setColumns(next)
                const rowNext = next.find((x) => x.id === pickerFor.columnId)
                if (rowNext) void saveColumn(rowNext)
                setPickerFor(null)
              }}
            >
              <option value="">Select trend…</option>
              {trends.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
      {zoomFor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setZoomFor(null)
            setCommentFor(null)
          }}
        >
          <div
            className="h-[60dvh] w-[60vw] min-w-[48rem] rounded-lg border border-border bg-surface p-2 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-fg">
                  {zoomFor.columnHeader} · {zoomFor.rowLabel}
                </p>
                <p className="text-[10px] text-muted">
                  {trendById.get(zoomFor.trendId)?.label ?? 'Trend'} — orange dots show weeks with comments
                </p>
              </div>
              <div className="flex items-center gap-1">
                {(seriesByTrendId.get(zoomFor.trendId)?.commentCountByWeek.reduce((a, b) => a + b, 0) ?? 0) > 0 ? (
                  <button
                    type="button"
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-500/50 bg-amber-500/10 px-2 text-[10px] text-amber-900 hover:bg-amber-500/20 dark:text-amber-200"
                    onClick={() => {
                      const latestCommentWeek = [...(seriesByTrendId.get(zoomFor.trendId)?.commentCountByWeek ?? [])]
                        .map((count, wi) => ({ count, wi }))
                        .filter((x) => x.count > 0)
                        .at(-1)?.wi
                      if (latestCommentWeek == null) return
                      setCommentFor({
                        trendId: zoomFor.trendId,
                        weekIndex: latestCommentWeek,
                        rowLabel: zoomFor.rowLabel,
                        columnHeader: zoomFor.columnHeader,
                      })
                    }}
                  >
                    <MessageSquare className="size-3.5" aria-hidden />
                    Comments
                  </button>
                ) : null}
                <button
                  type="button"
                  className="h-7 rounded-md border border-border px-2 text-[10px] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  onClick={() => {
                    setZoomFor(null)
                    setCommentFor(null)
                  }}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="h-[calc(60dvh-4.5rem)]">
              {seriesByTrendId.get(zoomFor.trendId) ? (
                <WdsTrendChart
                  compact={false}
                  series={seriesByTrendId.get(zoomFor.trendId)!}
                  weeks={weeks}
                  onBarClick={(weekIndex) =>
                    setCommentFor({
                      trendId: zoomFor.trendId,
                      weekIndex,
                      rowLabel: zoomFor.rowLabel,
                      columnHeader: zoomFor.columnHeader,
                    })
                  }
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {commentFor ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-3"
          role="dialog"
          aria-modal="true"
          onClick={() => setCommentFor(null)}
        >
          <div className="w-full max-w-2xl rounded-lg border border-border bg-surface p-2 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-fg">
                  {commentFor.columnHeader} · {commentFor.rowLabel} · {weeks[commentFor.weekIndex]?.shortLabel ?? `W${commentFor.weekIndex + 1}`}
                </p>
                <p className="text-[10px] text-muted">Comments for selected chart column</p>
              </div>
              <button
                type="button"
                className="h-7 rounded-md border border-border px-2 text-[10px] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                onClick={() => setCommentFor(null)}
              >
                Close
              </button>
            </div>
            <div className="max-h-[55dvh] overflow-auto rounded border border-border/70">
              <table className="w-full border-collapse text-[10px]">
                <thead className="sticky top-0 bg-surface-raised/60">
                  <tr>
                    <th className="border-b border-r border-border px-1.5 py-1 text-left text-muted">Date</th>
                    <th className="border-b border-r border-border px-1.5 py-1 text-left text-muted">Shift</th>
                    <th className="border-b border-r border-border px-1.5 py-1 text-right text-muted">Value</th>
                    <th className="border-b border-r border-border px-1.5 py-1 text-left text-muted">Comment</th>
                    <th className="border-b border-border px-1.5 py-1 text-left text-muted">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {entries
                    .filter((e) => {
                      const trend = trendById.get(commentFor.trendId)
                      if (!trend) return false
                      const w = weeks[commentFor.weekIndex]
                      if (!w) return false
                      const inWeek = e.plan_date >= w.startYmd && e.plan_date <= w.endYmd
                      return e.kpi_id === trend.kpi_id && inWeek && Boolean(e.comment?.trim())
                    })
                    .sort((a, b) => {
                      const da = `${a.plan_date} ${a.shift_kind}`
                      const db = `${b.plan_date} ${b.shift_kind}`
                      return db.localeCompare(da)
                    })
                    .map((e) => (
                      <tr key={e.id}>
                        <td className="border-b border-r border-border px-1.5 py-1">{e.plan_date}</td>
                        <td className="border-b border-r border-border px-1.5 py-1">{e.shift_kind || '—'}</td>
                        <td className="border-b border-r border-border px-1.5 py-1 text-right tabular-nums">
                          {e.value_numeric == null ? '—' : tickFmt.format(Number(e.value_numeric))}
                        </td>
                        <td className="max-w-[22rem] border-b border-r border-border px-1.5 py-1">
                          <span className="whitespace-pre-wrap break-words">{e.comment?.trim() || '—'}</span>
                        </td>
                        <td className="border-b border-border px-1.5 py-1">{new Date(e.updated_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  {entries.filter((e) => {
                    const trend = trendById.get(commentFor.trendId)
                    if (!trend) return false
                    const w = weeks[commentFor.weekIndex]
                    if (!w) return false
                    const inWeek = e.plan_date >= w.startYmd && e.plan_date <= w.endYmd
                    return e.kpi_id === trend.kpi_id && inWeek && Boolean(e.comment?.trim())
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-4 text-center text-[11px] text-muted">
                        No comments for this week column.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
