import { useCallback, useEffect, useId, useMemo, useState } from 'react'
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
import { ddsBtnDanger, ddsErr, ddsHint, ddsInput, ddsSelect, ddsStack } from '../features/dds/ddsAdminCompactClasses'

type KpiDef = { id: string; scoring: unknown }

const ROWS = [
  { key: 'output', label: 'Output measure' },
  { key: 'in_a', label: 'In-process measure' },
  { key: 'in_b', label: 'In-process measure' },
  { key: 'hc', label: 'Health check (placeholder)' },
  { key: 'actions', label: 'Actions (placeholder)' },
] as const

type TrendSeries = {
  valueByWeek: (number | null)[]
  targetByWeek: (number | null)[]
  toneByWeek: ('neutral' | 'good' | 'bad')[]
  commentCountByWeek: number[]
}

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

function toneTextClass(tone: 'neutral' | 'good' | 'bad'): string {
  if (tone === 'good') return 'text-emerald-700 dark:text-emerald-300'
  if (tone === 'bad') return 'text-rose-700 dark:text-rose-300'
  return 'text-sky-700 dark:text-sky-300'
}

function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / pow
  if (n <= 1) return pow
  if (n <= 2) return 2 * pow
  if (n <= 5) return 5 * pow
  return 10 * pow
}

function linePath(values: (number | null)[], xAt: (index: number) => number, yAt: (value: number) => number): string {
  let d = ''
  let penDown = false
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]
    if (v == null || !Number.isFinite(v)) {
      penDown = false
      continue
    }
    const x = xAt(i)
    const y = yAt(v)
    d += `${penDown ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)} `
    penDown = true
  }
  return d.trim()
}

function WdsTrendChart({
  series,
  weeks,
  compact = true,
  onChartClick,
  onBarClick,
}: {
  series: TrendSeries
  weeks: WdsWeekSlot[]
  compact?: boolean
  onChartClick?: () => void
  onBarClick?: (weekIndex: number) => void
}) {
  const clipId = useId().replace(/:/g, '')
  const width = compact ? 320 : 1080
  const height = compact ? 86 : 560
  const margin = compact ? { top: 6, right: 6, bottom: 14, left: 26 } : { top: 16, right: 20, bottom: 38, left: 58 }
  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom
  const allVals = [...series.valueByWeek, ...series.targetByWeek].filter((v): v is number => v != null && Number.isFinite(v))
  const fallbackMin = 0
  const fallbackMax = 1
  const rawMin = allVals.length > 0 ? Math.min(...allVals) : fallbackMin
  const rawMax = allVals.length > 0 ? Math.max(...allVals) : fallbackMax
  const spread = Math.max(1, Math.abs(rawMax - rawMin))
  const paddedMin = rawMin - spread * 0.15
  const paddedMax = rawMax + spread * 0.15
  const step = niceStep((paddedMax - paddedMin) / 4)
  const niceMin = Math.floor(paddedMin / step) * step
  const niceMax = Math.ceil(paddedMax / step) * step
  const yTicks = [niceMin, niceMin + (niceMax - niceMin) / 2, niceMax]
  const xAt = (i: number) => margin.left + (i * plotW) / Math.max(1, weeks.length - 1)
  const yAt = (v: number) => margin.top + ((niceMax - v) / Math.max(1e-9, niceMax - niceMin)) * plotH
  const targetPath = linePath(series.targetByWeek, xAt, yAt)
  const baselineValue = niceMin <= 0 && niceMax >= 0 ? 0 : niceMin
  const yBase = yAt(baselineValue)
  const barBand = plotW / Math.max(1, weeks.length)
  const baseBarW = Math.max(3, Math.min(compact ? 12 : 20, barBand * 0.58))
  const barW = compact ? baseBarW : Math.min(40, baseBarW * 2)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`${compact ? 'h-[5.25rem]' : 'h-full min-h-[22rem]'} w-full rounded border border-border/70 bg-surface-raised/20`}
      onClick={onChartClick}
    >
      <defs>
        <clipPath id={`clip-${clipId}`}>
          <rect x={margin.left} y={margin.top} width={plotW} height={plotH} />
        </clipPath>
      </defs>

      {yTicks.map((t) => (
        <g key={`y-${t}`}>
          <line x1={margin.left} y1={yAt(t)} x2={margin.left + plotW} y2={yAt(t)} stroke="currentColor" opacity="0.1" />
          <text x={margin.left - (compact ? 4 : 8)} y={yAt(t) + 3} textAnchor="end" className={`fill-muted ${compact ? 'text-[7px]' : 'text-[11px]'}`}>
            {tickFmt.format(t)}
          </text>
        </g>
      ))}

      {weeks.map((w, i) => (
        <g key={`${w.startYmd}-x`}>
          <line x1={xAt(i)} y1={margin.top} x2={xAt(i)} y2={margin.top + plotH} stroke="currentColor" opacity={i % 3 === 0 ? 0.06 : 0.02} />
          {compact ? i === 0 || i === Math.floor((weeks.length - 1) / 2) || i === weeks.length - 1 : i % 2 === 0 || i === weeks.length - 1 ? (
            <text x={xAt(i)} y={height - (compact ? 4 : 10)} textAnchor="middle" className={`fill-muted ${compact ? 'text-[7px]' : 'text-[10px]'}`}>
              {w.shortLabel}
            </text>
          ) : null}
        </g>
      ))}

      <g clipPath={`url(#clip-${clipId})`}>
        {series.valueByWeek.map((v, i) => {
          if (v == null || !Number.isFinite(v)) return null
          const tone = series.toneByWeek[i]
          const fill = tone === 'good' ? '#10b981' : tone === 'bad' ? '#f43f5e' : '#0ea5e9'
          const xCenter = xAt(i)
          const yVal = yAt(v)
          const top = Math.min(yVal, yBase)
          const h = Math.max(1, Math.abs(yVal - yBase))
          return (
            <g key={`bar-${i}`}>
              <rect
                x={xCenter - barW / 2}
                y={top}
                width={barW}
                height={h}
                rx={compact ? '1.5' : '2.5'}
                fill={fill}
                opacity="0.8"
                className={onBarClick ? 'cursor-pointer hover:opacity-100' : undefined}
                onClick={(e) => {
                  if (!onBarClick) return
                  e.stopPropagation()
                  onBarClick(i)
                }}
              />
              {series.commentCountByWeek[i]! > 0 ? (
                <circle
                  cx={xCenter}
                  cy={Math.max(margin.top + 3, top - 3)}
                  r={compact ? 1.6 : 3}
                  fill="#f59e0b"
                  stroke="#78350f"
                  strokeWidth={compact ? '0.3' : '0.8'}
                  className={onBarClick ? 'cursor-pointer' : undefined}
                  onClick={(e) => {
                    if (!onBarClick) return
                    e.stopPropagation()
                    onBarClick(i)
                  }}
                />
              ) : null}
              <text
                x={xCenter}
                y={Math.max(margin.top + (compact ? 4 : 10), top - (compact ? 1.2 : 4))}
                textAnchor="middle"
                className={`fill-fg/80 tabular-nums ${compact ? 'text-[6.5px]' : 'text-[10px]'} pointer-events-none`}
              >
                {compact ? tickFmt.format(v) : compactFmt.format(v)}
              </text>
            </g>
          )
        })}
        {targetPath ? (
          <path d={targetPath} fill="none" stroke="#2563eb" strokeWidth={compact ? '1.2' : '2.2'} strokeDasharray={compact ? '3 2' : '6 3'} />
        ) : null}
      </g>
    </svg>
  )
}

export function WdsPage() {
  const { status, cellId } = usePlan24Workspace()
  const [columns, setColumns] = useState<WdsColumnRow[]>([])
  const [trends, setTrends] = useState<WdsTrendDefRow[]>([])
  const [kpis, setKpis] = useState<KpiDef[]>([])
  const [entries, setEntries] = useState<KpiEntry[]>([])
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
      setLoading(false)
      return
    }
    const windowWeeks = defaultWdsWeeks()
    setWeeks(windowWeeks)
    const fromDate = windowWeeks[0]?.startYmd ?? '2000-01-01'
    const toDate = windowWeeks[windowWeeks.length - 1]?.endYmd ?? '2100-01-01'
    setLoading(true)
    setError(null)
    const [cRes, tRes, kRes, eRes] = await Promise.all([
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
    ])
    setLoading(false)
    if (cRes.error || tRes.error || kRes.error || eRes.error) {
      setError(cRes.error?.message ?? tRes.error?.message ?? kRes.error?.message ?? eRes.error?.message ?? 'Load failed')
      return
    }
    setColumns((cRes.data ?? []) as WdsColumnRow[])
    setTrends((tRes.data ?? []) as WdsTrendDefRow[])
    setKpis((kRes.data ?? []) as KpiDef[])
    setEntries((eRes.data ?? []) as KpiEntry[])
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

  const seriesByTrendId = useMemo(() => {
    const map = new Map<string, TrendSeries>()
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
                  if (row.key === 'hc' || row.key === 'actions') {
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
                              <p className={`text-[9px] font-semibold tabular-nums ${toneTextClass(latestTone)}`}>
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
