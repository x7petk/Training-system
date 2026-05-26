import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Edit3,
  ImagePlus,
  Layers3,
  Maximize2,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import { PdcaPlan90Gantt } from '../features/pdca/PdcaPlan90Gantt'
import { ddsBtn, ddsBtnGhost, ddsErr, ddsHint, ddsInput, ddsSelect, ddsTextarea } from '../features/dds/ddsAdminCompactClasses'
import { loadEPlanActions } from '../features/eplan/eplanService'
import type { EPlanAction, EPlanActionStatus } from '../features/eplan/eplanTypes'
import { useAuth } from '../hooks/useAuth'
import { localYMD } from '../lib/dueDateUtils'
import { invokePdcaCbnImageViaProxy } from '../lib/pdcaCbnImageProxy'
import { supabase } from '../lib/supabase'

type BoardKind = 'site' | 'cell'
type PdcaColumn = 'Plan' | 'Do' | 'Check' | 'Act'
type TileKind =
  | 'ogsm'
  | 'cbn'
  | 'masterplan'
  | 'plan90'
  | 'priorities'
  | 'skillMatrix'
  | 'scorecard'
  | 'projects'
  | 'trend'
  | 'engagementPlan'
  | 'hoshin'
  | 'engagementActions'

type TileDef = {
  id: string
  column: PdcaColumn
  row: number
  title: string
  kind: TileKind
}

type CbnDraft = {
  slogan: string
  vision: string
  associations: string
  metrics: string
  logoText: string
  generatedAt: string
  priorities: string[]
  imageDataUrl?: string | null
}

type PdcaBoardRow = {
  id: string
  scope_kind: BoardKind
  master_site_id: string | null
  master_cell_id: string | null
  cbn: CbnDraft | null
  selected_trends: Record<string, string>
}

type WdsTrend = {
  id: string
  kpi_id: string
  label: string
  aggregation: string | null
  target_flat: number | null
  target_start: number | null
  target_end: number | null
  target_weekly: unknown
}

type KpiEntry = {
  kpi_id: string
  master_cell_id: string
  plan_date: string
  value_numeric: number | null
  comment: string | null
}

type KpiDef = {
  id: string
  label: string
  unit: string | null
  metric_scope: string | null
}

type MonthSlot = {
  key: string
  label: string
  start: string
  end: string
}

const COLUMNS: PdcaColumn[] = ['Plan', 'Do', 'Check', 'Act']

const COLUMN_STYLE: Record<PdcaColumn, { header: string; accent: string }> = {
  Plan: { header: 'bg-sky-500/15 text-sky-800 dark:text-sky-200', accent: 'border-sky-500/30' },
  Do: { header: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200', accent: 'border-emerald-500/30' },
  Check: { header: 'bg-amber-500/15 text-amber-900 dark:text-amber-200', accent: 'border-amber-500/30' },
  Act: { header: 'bg-rose-500/15 text-rose-800 dark:text-rose-200', accent: 'border-rose-500/30' },
}

const COL_CLASS: Record<PdcaColumn, string> = {
  Plan: 'col-start-1',
  Do: 'col-start-2',
  Check: 'col-start-3',
  Act: 'col-start-4',
}

const ROW_CLASS: Record<number, string> = {
  1: 'row-start-2',
  2: 'row-start-3',
  3: 'row-start-4',
  4: 'row-start-5',
}

const TILES: TileDef[] = [
  { id: 'plan-ogsm', column: 'Plan', row: 1, title: 'OGSM', kind: 'ogsm' },
  { id: 'plan-cbn', column: 'Plan', row: 2, title: 'CBN', kind: 'cbn' },
  { id: 'plan-masterplan', column: 'Plan', row: 3, title: 'Masterplan', kind: 'masterplan' },
  { id: 'plan-90', column: 'Plan', row: 4, title: '90 day plan', kind: 'plan90' },
  { id: 'do-priorities', column: 'Do', row: 1, title: 'Top priorities', kind: 'priorities' },
  { id: 'do-skill-matrix', column: 'Do', row: 2, title: 'Skill matrix', kind: 'skillMatrix' },
  { id: 'do-scorecard', column: 'Do', row: 3, title: 'Scorecard', kind: 'scorecard' },
  { id: 'do-projects', column: 'Do', row: 4, title: 'Top projects', kind: 'projects' },
  { id: 'check-trend-1', column: 'Check', row: 1, title: 'Trend 1', kind: 'trend' },
  { id: 'check-trend-2', column: 'Check', row: 2, title: 'Trend 2', kind: 'trend' },
  { id: 'check-trend-3', column: 'Check', row: 3, title: 'Trend 3', kind: 'trend' },
  { id: 'check-engagement', column: 'Check', row: 4, title: 'Engagement plan', kind: 'engagementPlan' },
  { id: 'act-hoshin-1', column: 'Act', row: 1, title: 'Hoshin · 1', kind: 'hoshin' },
  { id: 'act-hoshin-2', column: 'Act', row: 2, title: 'Hoshin · 2', kind: 'hoshin' },
  { id: 'act-hoshin-3', column: 'Act', row: 3, title: 'Hoshin · 3', kind: 'hoshin' },
  { id: 'act-engagement-actions', column: 'Act', row: 4, title: 'Engagement actions', kind: 'engagementActions' },
]

const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short' })
const compactFmt = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

function addMonths(date: Date, count: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + count)
  return next
}

function monthBounds(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 12)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12)
  return { start: localYMD(start), end: localYMD(end) }
}

function next12Months(): MonthSlot[] {
  const anchor = new Date()
  return Array.from({ length: 12 }, (_, ix) => {
    const d = addMonths(anchor, ix)
    const { start, end } = monthBounds(d)
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: monthFmt.format(d), start, end }
  })
}

function sanitizeWords(value: string, maxWords: number): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(' ')
}

function buildCbnDraft(input: { vision: string; associations: string; metrics: string }, existingLogo = 'CBN'): CbnDraft {
  const associations = input.associations
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
  const metrics = input.metrics
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
  const energyWord = associations[0] ?? 'Win'
  const outcomeWord = associations[1] ?? metrics[0] ?? 'Together'
  const slogan = sanitizeWords(`${energyWord} ${outcomeWord} Every Day`, 4)
  return {
    slogan,
    vision: input.vision.trim(),
    associations: input.associations.trim(),
    metrics: input.metrics.trim(),
    logoText: sanitizeWords(existingLogo || slogan, 3).toUpperCase(),
    generatedAt: new Date().toISOString(),
    priorities: [
      `Make ${metrics[0] ?? 'performance'} visible every week`,
      `Coach leaders around ${associations[0] ?? 'ownership'}`,
      `Remove one blocker for ${metrics[1] ?? 'flow'} every 30 days`,
      `Celebrate progress linked to ${associations[1] ?? 'team energy'}`,
    ],
  }
}

function aggregate(values: number[], mode: string | null): number | null {
  if (values.length === 0) return null
  if (mode === 'sum') return values.reduce((a, b) => a + b, 0)
  return values.reduce((a, b) => a + b, 0) / values.length
}

function statusShort(status: EPlanActionStatus): string {
  if (status === 'COMPLETED') return 'Done'
  if (status === 'OFF_TRACK') return 'Off'
  if (status === 'NEED_HELP') return 'Help'
  if (status === 'NOT_REQUIRED') return 'N/R'
  if (status === 'NOT_STARTED') return 'New'
  return 'On'
}

function statusClass(status: EPlanActionStatus): string {
  if (status === 'COMPLETED') return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
  if (status === 'OFF_TRACK') return 'bg-rose-500/15 text-rose-800 dark:text-rose-200'
  if (status === 'NEED_HELP') return 'bg-amber-500/15 text-amber-900 dark:text-amber-200'
  if (status === 'NOT_REQUIRED') return 'bg-slate-500/15 text-muted'
  return 'bg-sky-500/15 text-sky-800 dark:text-sky-200'
}

function trendTarget(trend: WdsTrend, index: number): number | null {
  if (trend.target_flat != null) return Number(trend.target_flat)
  if (trend.target_start != null && trend.target_end != null) {
    return Number(trend.target_start) + ((Number(trend.target_end) - Number(trend.target_start)) * index) / 11
  }
  return null
}

function coerceBoardRow(row: Record<string, unknown>): PdcaBoardRow {
  const selected = row.selected_trends && typeof row.selected_trends === 'object' ? (row.selected_trends as Record<string, string>) : {}
  return {
    id: String(row.id),
    scope_kind: row.scope_kind === 'cell' ? 'cell' : 'site',
    master_site_id: typeof row.master_site_id === 'string' ? row.master_site_id : null,
    master_cell_id: typeof row.master_cell_id === 'string' ? row.master_cell_id : null,
    cbn: row.cbn && typeof row.cbn === 'object' ? (row.cbn as CbnDraft) : null,
    selected_trends: selected,
  }
}

function MiniMonthChart({
  months,
  values,
  targets,
  compact = true,
}: {
  months: MonthSlot[]
  values: (number | null)[]
  targets?: (number | null)[]
  compact?: boolean
}) {
  const numeric = [...values, ...(targets ?? [])].filter((v): v is number => v != null && Number.isFinite(v))
  const max = Math.max(1, ...numeric)
  const trackH = compact ? 28 : 100
  return (
    <div className={`flex min-h-0 w-full flex-1 items-end gap-0.5 rounded-md border border-border/60 bg-surface/70 ${compact ? 'max-h-10 px-0.5 py-0' : 'h-32 px-2 py-2'}`}>
      {months.map((m, ix) => {
        const v = values[ix]
        const t = targets?.[ix]
        const h = v == null ? 2 : Math.max(2, (v / max) * trackH)
        const targetTop = t == null ? null : Math.max(2, trackH + 2 - (t / max) * trackH)
        return (
          <div key={m.key} className="relative flex min-w-0 flex-1 flex-col items-center justify-end">
            {targetTop != null ? <span className="absolute left-0 right-0 h-px bg-blue-500/70" style={{ top: targetTop }} /> : null}
            <span className="w-full rounded-t bg-emerald-500/75" style={{ height: h }} />
            {!compact ? <span className="mt-0.5 text-[8px] text-muted">{m.label.slice(0, 1)}</span> : null}
          </div>
        )
      })}
    </div>
  )
}

function PlaceholderPanel({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-0.5 text-center">
      <Layers3 className="size-3.5 text-muted/70" aria-hidden />
      <p className="text-[10px] font-semibold text-fg">{label}</p>
      <p className="text-[9px] text-muted">Placeholder</p>
    </div>
  )
}

export function PdcaPage() {
  const { status, error: scopeError, siteId, cellId, siteCells, cells } = usePlan24Workspace()
  const [boardKind, setBoardKind] = useState<BoardKind>('site')
  const [siteBoard, setSiteBoard] = useState<PdcaBoardRow | null>(null)
  const [cellBoard, setCellBoard] = useState<PdcaBoardRow | null>(null)
  const [zoomTile, setZoomTile] = useState<TileDef | null>(null)
  const [editCbnOpen, setEditCbnOpen] = useState(false)
  const [trendPickerTile, setTrendPickerTile] = useState<string | null>(null)
  const [trends, setTrends] = useState<WdsTrend[]>([])
  const [kpis, setKpis] = useState<KpiDef[]>([])
  const [entries, setEntries] = useState<KpiEntry[]>([])
  const [dataError, setDataError] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [boardLoading, setBoardLoading] = useState(false)
  const [boardSaving, setBoardSaving] = useState(false)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [actions, setActions] = useState<EPlanAction[]>(() => loadEPlanActions())

  const months = useMemo(() => next12Months(), [])
  const activeCellIds = useMemo(() => (boardKind === 'site' ? siteCells.map((c) => c.id) : cellId ? [cellId] : []), [boardKind, siteCells, cellId])
  const boardLabel = boardKind === 'site' ? 'Site PDCA' : `${cells.find((c) => c.id === cellId)?.name ?? 'Cell'} PDCA`
  const activeBoard = boardKind === 'site' ? siteBoard : cellBoard
  const selectedTrends = activeBoard?.selected_trends ?? {}
  const activeCbn = siteBoard?.cbn ?? null

  useEffect(() => {
    setActions(loadEPlanActions())
  }, [cellId, siteId])

  const loadBoards = useCallback(async () => {
    if (status !== 'ready' || !siteId) return
    setBoardLoading(true)
    setBoardError(null)
    const siteQuery = supabase
      .from('dds_pdca_boards')
      .select('id, scope_kind, master_site_id, master_cell_id, cbn, selected_trends')
      .eq('scope_kind', 'site')
      .eq('master_site_id', siteId)
      .maybeSingle()
    const cellQuery = cellId
      ? supabase
          .from('dds_pdca_boards')
          .select('id, scope_kind, master_site_id, master_cell_id, cbn, selected_trends')
          .eq('scope_kind', 'cell')
          .eq('master_cell_id', cellId)
          .maybeSingle()
      : null
    const [siteRes, cellRes] = await Promise.all([siteQuery, cellQuery])
    setBoardLoading(false)
    if (siteRes.error || cellRes?.error) {
      setBoardError(siteRes.error?.message ?? cellRes?.error?.message ?? 'Could not load PDCA board.')
      return
    }
    setSiteBoard(siteRes.data ? coerceBoardRow(siteRes.data as Record<string, unknown>) : null)
    setCellBoard(cellRes?.data ? coerceBoardRow(cellRes.data as Record<string, unknown>) : null)
  }, [cellId, siteId, status])

  useEffect(() => {
    void loadBoards()
  }, [loadBoards])

  const saveBoardPatch = useCallback(
    async (kind: BoardKind, patch: { cbn?: CbnDraft | null; selected_trends?: Record<string, string> }) => {
      const current = kind === 'site' ? siteBoard : cellBoard
      const scopeId = kind === 'site' ? siteId : cellId
      if (!scopeId) return
      setBoardSaving(true)
      setBoardError(null)
      const payload = {
        scope_kind: kind,
        master_site_id: kind === 'site' ? siteId : null,
        master_cell_id: kind === 'cell' ? cellId : null,
        cbn: patch.cbn !== undefined ? patch.cbn : (current?.cbn ?? null),
        selected_trends: patch.selected_trends !== undefined ? patch.selected_trends : (current?.selected_trends ?? {}),
      }
      const res = current
        ? await supabase
            .from('dds_pdca_boards')
            .update(payload)
            .eq('id', current.id)
            .select('id, scope_kind, master_site_id, master_cell_id, cbn, selected_trends')
            .single()
        : await supabase
            .from('dds_pdca_boards')
            .insert(payload)
            .select('id, scope_kind, master_site_id, master_cell_id, cbn, selected_trends')
            .single()
      setBoardSaving(false)
      if (res.error) {
        setBoardError(res.error.message)
        return
      }
      const next = coerceBoardRow(res.data as Record<string, unknown>)
      if (kind === 'site') setSiteBoard(next)
      else setCellBoard(next)
    },
    [cellBoard, cellId, siteBoard, siteId],
  )

  const loadData = useCallback(async () => {
    if (status !== 'ready' || activeCellIds.length === 0) return
    setLoadingData(true)
    setDataError(null)
    const from = months[0]?.start ?? '2000-01-01'
    const to = months[months.length - 1]?.end ?? '2100-01-01'
    const [trendsRes, kpisRes, entriesRes] = await Promise.all([
      supabase
        .from('dds_wds_trends')
        .select('id, kpi_id, label, aggregation, target_flat, target_start, target_end, target_weekly')
        .in('master_cell_id', activeCellIds)
        .eq('is_active', true)
        .order('sort_order')
        .order('created_at'),
      supabase.from('dds_kpis').select('id, label, unit, metric_scope').order('sort_order').order('label'),
      supabase
        .from('dds_kpi_cell_entries')
        .select('kpi_id, master_cell_id, plan_date, value_numeric, comment')
        .in('master_cell_id', activeCellIds)
        .gte('plan_date', from)
        .lte('plan_date', to),
    ])
    setLoadingData(false)
    if (trendsRes.error || kpisRes.error || entriesRes.error) {
      setDataError(trendsRes.error?.message ?? kpisRes.error?.message ?? entriesRes.error?.message ?? 'Could not load PDCA data.')
      return
    }
    setTrends((trendsRes.data ?? []) as WdsTrend[])
    setKpis((kpisRes.data ?? []) as KpiDef[])
    setEntries((entriesRes.data ?? []) as KpiEntry[])
  }, [activeCellIds, months, status])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const kpiById = useMemo(() => {
    const map = new Map<string, KpiDef>()
    for (const kpi of kpis) map.set(kpi.id, kpi)
    return map
  }, [kpis])

  const seriesByTrendId = useMemo(() => {
    const map = new Map<string, { values: (number | null)[]; targets: (number | null)[]; comments: number[] }>()
    for (const trend of trends) {
      const values = months.map((m) =>
        aggregate(
          entries
            .filter((e) => e.kpi_id === trend.kpi_id && e.plan_date >= m.start && e.plan_date <= m.end && e.value_numeric != null)
            .map((e) => Number(e.value_numeric)),
          trend.aggregation,
        ),
      )
      const targets = months.map((_, ix) => trendTarget(trend, ix))
      const comments = months.map(
        (m) => entries.filter((e) => e.kpi_id === trend.kpi_id && e.plan_date >= m.start && e.plan_date <= m.end && Boolean(e.comment?.trim())).length,
      )
      map.set(trend.id, { values, targets, comments })
    }
    return map
  }, [entries, months, trends])

  const scorecardRows = useMemo(() => {
    const kpiIds = Array.from(new Set(entries.map((e) => e.kpi_id))).slice(0, 12)
    return kpiIds.map((kpiId) => ({
      kpi: kpiById.get(kpiId),
      values: months.map((m) =>
        aggregate(
          entries
            .filter((e) => e.kpi_id === kpiId && e.plan_date >= m.start && e.plan_date <= m.end && e.value_numeric != null)
            .map((e) => Number(e.value_numeric)),
          'avg',
        ),
      ),
    }))
  }, [entries, kpiById, months])

  const boardActions = useMemo(() => {
    const cellSet = new Set(activeCellIds)
    return actions.filter((a) => cellSet.has(a.cellId)).sort((a, b) => a.endDate.localeCompare(b.endDate))
  }, [actions, activeCellIds])

  if (status === 'loading') return <p className="text-sm text-muted">Loading PDCA…</p>
  if (scopeError) return <p className={ddsErr}>{scopeError}</p>
  if (!siteId) return <p className={ddsHint}>Select a site in the scope bar to use PDCA.</p>

  const renderTileContent = (tile: TileDef, expanded = false) => {
    if (tile.kind === 'ogsm') {
      return (
        <div className="flex h-full flex-col gap-1 overflow-hidden">
          <span className="inline-flex w-fit rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900 dark:text-amber-200">
            In progress
          </span>
          <p className={`min-h-0 flex-1 text-[10px] leading-snug text-muted ${expanded ? '' : 'line-clamp-2'}`}>
            Strategy direction. Connects to CBN, masterplan, 90-day plan, priorities, trends and actions.
          </p>
        </div>
      )
    }
    if (tile.kind === 'cbn') {
      const cbnImage = activeCbn?.imageDataUrl
      return (
        <div className="flex h-full min-h-0 flex-col gap-1 overflow-hidden">
          {cbnImage ? (
            <div
              className={`relative flex min-h-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-black/[0.04] dark:bg-white/[0.04] ${
                expanded ? 'min-h-[min(50dvh,28rem)] flex-1' : 'min-h-0 flex-1'
              }`}
            >
              <img src={cbnImage} alt="" className="max-h-full max-w-full object-contain" />
              <span className="absolute bottom-0.5 left-0.5 rounded bg-black/55 px-1 py-0 text-[8px] font-bold uppercase tracking-wide text-white">
                {activeCbn?.logoText}
              </span>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-500/25 bg-gradient-to-r from-emerald-500/15 to-sky-500/10 px-1.5 py-1">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-fg text-[8px] font-black text-bg">
                {activeCbn?.logoText ?? 'CBN'}
              </span>
              <p className="min-w-0 truncate text-[10px] font-bold uppercase text-fg">{activeCbn?.slogan ?? 'Build the Future'}</p>
            </div>
          )}
          {!cbnImage || expanded ? (
            <p className={`shrink-0 text-[9px] leading-snug text-muted ${expanded ? '' : 'line-clamp-2'}`}>
              {activeCbn?.vision || 'Edit to add vision and generate a motivating image.'}
            </p>
          ) : null}
          {expanded && activeCbn?.priorities?.length ? (
            <ul className="shrink-0 space-y-0.5 text-[10px]">
              {activeCbn.priorities.map((p) => (
                <li key={p} className="rounded border border-border/60 bg-surface/60 px-1.5 py-0.5">
                  {p}
                </li>
              ))}
            </ul>
          ) : null}
          {expanded ? (
            <button
              type="button"
              className="mt-auto inline-flex w-fit shrink-0 items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted hover:bg-surface-raised/60 hover:text-fg"
              onClick={(e) => {
                e.stopPropagation()
                setEditCbnOpen(true)
              }}
            >
              <Edit3 className="size-3" aria-hidden />
              Edit / generate
            </button>
          ) : null}
        </div>
      )
    }
    if (tile.kind === 'masterplan') {
      return <MonthPlan months={months} actions={boardActions} expanded={expanded} />
    }
    if (tile.kind === 'plan90') {
      return <PdcaPlan90Gantt actions={boardActions} expanded={expanded} />
    }
    if (tile.kind === 'priorities') {
      const priorities = activeCbn?.priorities ?? ['Create the CBN to seed priorities', 'Align lead team on metrics', 'Pick owners for top losses', 'Set a weekly review cadence']
      return (
        <ol className="flex h-full flex-col gap-1 overflow-hidden text-[10px]">
          {priorities.slice(0, expanded ? 8 : 2).map((p, ix) => (
            <li key={p} className="flex min-h-0 items-start gap-1 rounded-md border border-border/60 bg-surface/60 px-1 py-0.5">
              <span className="shrink-0 text-[9px] font-bold text-accent">{ix + 1}.</span>
              <span className={`min-w-0 leading-snug ${expanded ? '' : 'line-clamp-1'}`}>{p}</span>
            </li>
          ))}
        </ol>
      )
    }
    if (tile.kind === 'scorecard') {
      return <Scorecard rows={scorecardRows} months={months} expanded={expanded} />
    }
    if (tile.kind === 'trend') {
      const trendId = selectedTrends[tile.id] ?? ''
      const trend = trends.find((t) => t.id === trendId)
      const series = trend ? seriesByTrendId.get(trend.id) : null
      return (
        <div className="flex h-full flex-col gap-1 overflow-hidden">
          <div className="flex shrink-0 items-center justify-between gap-1">
            <p className="min-w-0 truncate text-[10px] font-semibold text-fg">
              {trend?.label ?? 'No trend selected'}
            </p>
            <button
              type="button"
              className="inline-flex size-5 shrink-0 items-center justify-center rounded border border-border bg-surface text-muted hover:text-fg"
              onClick={(e) => {
                e.stopPropagation()
                setTrendPickerTile(tile.id)
              }}
              aria-label="Select trend"
            >
              <Search className="size-3" aria-hidden />
            </button>
          </div>
          {series ? (
            <div className="flex min-h-0 flex-1">
              <MiniMonthChart months={months} values={series.values} targets={series.targets} compact={!expanded} />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-dashed border-border text-[9px] text-muted">
              Select a WDS trend
            </div>
          )}
          {expanded && trend ? (
            <p className="text-[10px] text-muted">
              {months
                .map((m, ix) => `${m.label}: ${series?.values[ix] == null ? '—' : compactFmt.format(series!.values[ix]!)}`)
                .join('  •  ')}
            </p>
          ) : null}
        </div>
      )
    }
    if (tile.kind === 'hoshin') {
      const checkTileId = tile.id.endsWith('1') ? 'check-trend-1' : tile.id.endsWith('2') ? 'check-trend-2' : 'check-trend-3'
      const trendId = selectedTrends[checkTileId] ?? ''
      const trend = trends.find((t) => t.id === trendId)
      return <HoshinActions trend={trend} actions={boardActions} expanded={expanded} />
    }
    if (tile.kind === 'skillMatrix') return <PlaceholderPanel label="Skill matrix for lead team" />
    if (tile.kind === 'projects') return <PlaceholderPanel label="Top projects" />
    if (tile.kind === 'engagementPlan') return <PlaceholderPanel label="Engagement plan" />
    if (tile.kind === 'engagementActions') return <PlaceholderPanel label="Plan for engagement actions" />
    return null
  }

  const statusLine =
    dataError ?? boardError ?? (loadingData || boardLoading ? 'Loading board…' : boardSaving ? 'Saving…' : null)

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 py-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <h1 className="font-display text-sm font-semibold tracking-tight text-fg">PDCA</h1>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-raised/60 px-1.5 py-0 text-[9px] font-semibold text-fg">
            {boardLabel}
          </span>
          {statusLine ? (
            <span className={`min-w-0 truncate text-[9px] ${dataError || boardError ? 'text-danger' : 'text-muted'}`}>
              {statusLine}
            </span>
          ) : (
            <span className="hidden text-[9px] text-muted md:inline">
              {activeCellIds.length} cell{activeCellIds.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="PDCA board">
            {(['site', 'cell'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                className={[
                  'rounded-md px-2 py-1 text-[11px] font-semibold transition',
                  boardKind === kind ? 'bg-accent-dim text-accent' : 'text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06]',
                ].join(' ')}
                onClick={() => setBoardKind(kind)}
              >
                {kind === 'site' ? 'Site' : 'Cell'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-[auto_repeat(4,minmax(0,1fr))] gap-1 overflow-hidden">
        {COLUMNS.map((column) => {
          const style = COLUMN_STYLE[column]
          return (
            <div
              key={`hdr-${column}`}
              className={`row-start-1 ${COL_CLASS[column]} shrink-0 rounded-md border ${style.accent} ${style.header} px-1.5 py-0.5`}
            >
              <p className="text-center text-[10px] font-black uppercase tracking-[0.14em]">{column}</p>
            </div>
          )
        })}
        {TILES.map((tile) => (
          <article
            key={tile.id}
            className={`${COL_CLASS[tile.column]} ${ROW_CLASS[tile.row]} group relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition hover:border-accent/40 hover:shadow-md ${
              tile.kind === 'ogsm' ? 'ring-1 ring-amber-500/40' : ''
            }`}
          >
            <div className="flex shrink-0 items-center justify-between gap-0.5 border-b border-border/60 bg-surface-raised/30 px-1.5 py-1">
              <p className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wide text-fg">{tile.title}</p>
              <div className="flex shrink-0 items-center gap-0.5">
                {tile.kind === 'cbn' ? (
                  <button
                    type="button"
                    className="inline-flex size-5 items-center justify-center rounded border border-transparent text-muted hover:border-border hover:bg-surface hover:text-fg"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditCbnOpen(true)
                    }}
                    aria-label="Edit CBN"
                  >
                    <Edit3 className="size-3" aria-hidden />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex size-5 items-center justify-center rounded border border-transparent text-muted hover:border-border hover:bg-surface hover:text-fg"
                  onClick={() => setZoomTile(tile)}
                  aria-label={`Zoom ${tile.title}`}
                >
                  <Maximize2 className="size-3" aria-hidden />
                </button>
              </div>
            </div>
            <div
              role="button"
              tabIndex={0}
              className="flex min-h-0 flex-1 cursor-zoom-in flex-col overflow-hidden px-1.5 py-1 text-left"
              onClick={() => setZoomTile(tile)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setZoomTile(tile)
                }
              }}
              aria-label={`Open ${tile.title}`}
            >
              {renderTileContent(tile, false)}
            </div>
          </article>
        ))}
      </div>

      {zoomTile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3" role="dialog" aria-modal="true" onClick={() => setZoomTile(null)}>
          <div className="flex h-[82dvh] w-full max-w-6xl flex-col rounded-2xl border border-border bg-surface p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex shrink-0 items-start justify-between gap-3 border-b border-border pb-2">
              <div>
                <p className="text-base font-bold text-fg">{zoomTile.title}</p>
                <p className="text-[11px] text-muted">{zoomTile.column} · Row {zoomTile.row} · {boardLabel}</p>
              </div>
              <button type="button" className={`${ddsBtnGhost} h-7 px-2 text-[11px]`} onClick={() => setZoomTile(null)}>
                <X className="size-3" aria-hidden />
                Close
              </button>
            </div>
            <div
              className={`min-h-0 flex-1 rounded-xl border border-border/70 bg-surface-raised/20 p-3 ${
                zoomTile.kind === 'cbn' ? 'flex flex-col overflow-hidden' : 'overflow-auto'
              }`}
            >
              {renderTileContent(zoomTile, true)}
            </div>
          </div>
        </div>
      ) : null}

      {editCbnOpen ? (
        <CbnEditor
          value={activeCbn}
          boardKind={boardKind}
          onClose={() => setEditCbnOpen(false)}
          onSave={(draft) => {
            void saveBoardPatch('site', { cbn: draft }).then(() => {
              setEditCbnOpen(false)
            })
          }}
          onImageGenerated={(imageDataUrl) => {
            const base = activeCbn ?? buildCbnDraft({ vision: '', associations: '', metrics: '' })
            void saveBoardPatch('site', { cbn: { ...base, imageDataUrl } })
          }}
        />
      ) : null}

      {trendPickerTile ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-3" role="dialog" aria-modal="true" onClick={() => setTrendPickerTile(null)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-fg">Select trend</p>
            <p className="mt-1 text-xs text-muted">Trend will show 12 monthly values on this PDCA board.</p>
            <select
              className={`${ddsSelect} mt-3`}
              value={selectedTrends[trendPickerTile] ?? ''}
              onChange={(e) => {
                const next = { ...selectedTrends, [trendPickerTile]: e.target.value }
                void saveBoardPatch(boardKind, { selected_trends: next }).then(() => {
                  setTrendPickerTile(null)
                })
              }}
            >
              <option value="">Select trend…</option>
              {trends.map((trend) => (
                <option key={trend.id} value={trend.id}>
                  {trend.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CbnEditor({
  value,
  boardKind,
  onClose,
  onSave,
  onImageGenerated,
}: {
  value: CbnDraft | null | undefined
  boardKind: BoardKind
  onClose: () => void
  onSave: (draft: CbnDraft) => void
  onImageGenerated: (imageDataUrl: string) => void
}) {
  const { user } = useAuth()
  const [vision, setVision] = useState(value?.vision ?? '')
  const [associations, setAssociations] = useState(value?.associations ?? '')
  const [metrics, setMetrics] = useState(value?.metrics ?? '')
  const [logoText, setLogoText] = useState(value?.logoText ?? 'CBN')
  const [previewImage, setPreviewImage] = useState(value?.imageDataUrl ?? null)
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const draft = useMemo(() => buildCbnDraft({ vision, associations, metrics }, logoText), [associations, logoText, metrics, vision])

  async function generateImage() {
    if (!user) {
      setImageError('Sign in to generate a CBN image.')
      return
    }
    setImageLoading(true)
    setImageError(null)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) {
      setImageLoading(false)
      setImageError('No active session.')
      return
    }
    const { data, errorMessage } = await invokePdcaCbnImageViaProxy(token, {
      slogan: draft.slogan,
      vision: draft.vision,
      associations: draft.associations,
      metrics: draft.metrics,
      logoText: draft.logoText,
    })
    setImageLoading(false)
    if (errorMessage || !data?.imageDataUrl) {
      setImageError(errorMessage ?? data?.error ?? 'Image generation failed.')
      return
    }
    setPreviewImage(data.imageDataUrl)
    onImageGenerated(data.imageDataUrl)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-3" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="grid max-h-[86dvh] w-full max-w-4xl grid-cols-1 gap-4 overflow-auto rounded-2xl border border-border bg-surface p-4 shadow-2xl lg:grid-cols-[1fr_22rem]" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <div>
            <p className="text-lg font-bold text-fg">Generate CBN</p>
            <p className="text-xs text-muted">
              {boardKind === 'site' ? 'Site CBN is reused by all cells on the site.' : 'Cell boards use the shared site CBN.'}
            </p>
          </div>
          <label className="block text-xs font-semibold text-muted">
            Your vision
            <textarea className={`${ddsTextarea} min-h-24`} value={vision} onChange={(e) => setVision(e.target.value)} placeholder="What future do you want people to feel excited about?" />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Key associations
            <input className={ddsInput} value={associations} onChange={(e) => setAssociations(e.target.value)} placeholder="e.g. pride, flow, ownership, customer trust" />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Key metrics
            <input className={ddsInput} value={metrics} onChange={(e) => setMetrics(e.target.value)} placeholder="e.g. TRS, safety, quality, waste" />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Logo text
            <input className={ddsInput} value={logoText} onChange={(e) => setLogoText(sanitizeWords(e.target.value, 3).toUpperCase())} placeholder="3 words max" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={ddsBtn} onClick={() => onSave({ ...draft, imageDataUrl: previewImage })}>
              <Sparkles className="size-4" aria-hidden />
              Save CBN
            </button>
            <button type="button" className={ddsBtnGhost} disabled={imageLoading} onClick={() => void generateImage()}>
              <ImagePlus className="size-4" aria-hidden />
              {imageLoading ? 'Generating image…' : 'Generate image'}
            </button>
            <button type="button" className={ddsBtnGhost} onClick={onClose}>
              Cancel
            </button>
          </div>
          {imageError ? <p className={ddsErr}>{imageError}</p> : null}
        </div>
        <div className="flex min-h-0 flex-col rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 via-sky-500/15 to-amber-500/20 p-4">
          <div className="flex min-h-[12rem] flex-1 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-black/[0.06] dark:bg-black/20 lg:min-h-[16rem]">
            {previewImage ? (
              <img src={previewImage} alt="" className="max-h-full max-w-full object-contain shadow-md" />
            ) : (
              <p className="px-4 text-center text-sm text-muted">Generate image to preview</p>
            )}
          </div>
          <p className="mt-3 text-xl font-black uppercase tracking-tight text-fg">{draft.slogan}</p>
          <p className="mt-1 text-sm text-muted">{draft.vision || 'Add a vision to make this CBN feel specific to your site.'}</p>
          <div className="mt-3 space-y-1.5">
            {draft.priorities.map((p) => (
              <div key={p} className="rounded-lg border border-white/30 bg-white/20 px-2 py-1.5 text-xs font-semibold text-fg">
                {p}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MonthPlan({ months, actions, expanded }: { months: MonthSlot[]; actions: EPlanAction[]; expanded: boolean }) {
  const rows = actions.filter((a) => months.some((m) => a.startDate <= m.end && a.endDate >= m.start)).slice(0, expanded ? 16 : 2)
  return (
    <div className="flex h-full flex-col gap-1 overflow-hidden">
      <div className="grid grid-cols-12 gap-0.5 text-center text-[7px] font-bold uppercase text-muted">
        {months.map((m) => (
          <span key={m.key}>{m.label.slice(0, 1)}</span>
        ))}
      </div>
      <div className={`flex min-h-0 flex-1 flex-col gap-0.5 ${expanded ? 'overflow-auto' : 'overflow-hidden'}`}>
        {rows.map((a) => (
          <div key={a.id} className="rounded border border-border/60 bg-surface/60 px-1.5 py-0.5">
            <p className="truncate text-[9px] font-semibold text-fg">{a.title}</p>
            <div className="mt-0.5 grid grid-cols-12 gap-0.5">
              {months.map((m) => {
                const active = a.startDate <= m.end && a.endDate >= m.start
                return <span key={m.key} className={`h-1 rounded-full ${active ? 'bg-accent' : 'bg-border/50'}`} />
              })}
            </div>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="rounded border border-dashed border-border p-1.5 text-center text-[9px] text-muted">No actions in window</p>
        ) : null}
      </div>
    </div>
  )
}

function Scorecard({
  rows,
  months,
  expanded,
}: {
  rows: { kpi: KpiDef | undefined; values: (number | null)[] }[]
  months: MonthSlot[]
  expanded: boolean
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded border border-dashed border-border p-2 text-center text-[10px] text-muted">
        No metric entries yet
      </p>
    )
  }
  if (!expanded) {
    return (
      <div className="flex h-full flex-col gap-0.5 overflow-hidden">
        <div className="grid grid-cols-[5rem_repeat(12,minmax(0,1fr))] gap-0.5 text-[7px] font-bold uppercase text-muted">
          <span />
          {months.map((m) => (
            <span key={m.key} className="text-center">{m.label.slice(0, 1)}</span>
          ))}
        </div>
        {rows.slice(0, 3).map((row) => (
          <div
            key={row.kpi?.id ?? row.values.join('-')}
            className="grid grid-cols-[5rem_repeat(12,minmax(0,1fr))] items-center gap-0.5"
          >
            <span className="truncate text-[9px] font-semibold text-fg" title={row.kpi?.label ?? 'Metric'}>
              {row.kpi?.label ?? 'Metric'}
            </span>
            {row.values.map((v, ix) => (
              <span
                key={`${row.kpi?.id ?? 'metric'}-${months[ix]?.key}`}
                className="rounded bg-surface/60 px-0.5 text-center text-[8px] tabular-nums"
                title={v == null ? '—' : String(v)}
              >
                {v == null ? '·' : compactFmt.format(v)}
              </span>
            ))}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="max-w-full overflow-auto rounded-lg border border-border/70">
      <table className="w-full min-w-[44rem] border-collapse text-[10px]">
        <thead className="bg-surface-raised/70">
          <tr>
            <th className="border-b border-r border-border px-2 py-1 text-left text-muted">Metric</th>
            {months.map((m) => (
              <th key={m.key} className="border-b border-r border-border px-1 py-1 text-right text-muted">{m.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.kpi?.id ?? row.values.join('-')}>
              <td className="max-w-40 truncate border-b border-r border-border px-2 py-1 font-semibold">
                {row.kpi?.label ?? 'Metric'}
              </td>
              {row.values.map((v, ix) => (
                <td
                  key={`${row.kpi?.id ?? 'metric'}-${months[ix]?.key}`}
                  className="border-b border-r border-border px-1 py-1 text-right tabular-nums"
                >
                  {v == null ? '—' : compactFmt.format(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HoshinActions({ trend, actions, expanded }: { trend: WdsTrend | undefined; actions: EPlanAction[]; expanded: boolean }) {
  const related = trend
    ? actions.filter((a) => {
        const text = `${a.title} ${a.description ?? ''}`.toLowerCase()
        return trend.label.toLowerCase().split(/\s+/).some((word) => word.length > 3 && text.includes(word))
      })
    : []
  const limit = expanded ? 12 : 2
  const visible = related.slice(0, limit)
  return (
    <div className="flex h-full flex-col gap-1 overflow-hidden">
      <p className="truncate text-[10px] font-semibold text-fg">
        {trend?.label ?? 'Pick Check trend'}
      </p>
      {visible.length === 0 ? (
        <p className="rounded border border-dashed border-border p-1.5 text-center text-[9px] text-muted">
          {trend ? 'No matching actions' : 'Select a trend in the Check column'}
        </p>
      ) : (
        <div className={`flex min-h-0 flex-1 flex-col gap-0.5 ${expanded ? 'overflow-auto' : 'overflow-hidden'}`}>
          {visible.map((a) => (
            <div key={a.id} className="rounded border border-border/60 bg-surface/60 px-1.5 py-0.5">
              <div className="flex items-center justify-between gap-1">
                <p className="min-w-0 truncate text-[10px] font-semibold text-fg">{a.title}</p>
                <span className={`shrink-0 rounded-full px-1 py-0 text-[8px] font-bold ${statusClass(a.status)}`}>{statusShort(a.status)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {!expanded && related.length > limit ? (
        <p className="text-right text-[8px] text-muted">+{related.length - limit} more</p>
      ) : null}
    </div>
  )
}
