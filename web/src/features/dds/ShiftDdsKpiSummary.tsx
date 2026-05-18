import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { DdsKpiScoring } from './ddsKpiScoring'
import { evaluateKpiBlock, parseDdsKpiScoring, scoringHint, scoringTargetNumbersOnly } from './ddsKpiScoring'
import type { DdsKpiUnit } from './ddsKpiUnits'
import { DDS_KPI_UNIT_OPTIONS, formatKpiValueWithUnit, parseDdsKpiUnit } from './ddsKpiUnits'
import { parseDdsP2pKpiBreakdown, type DdsP2pKpiBreakdownItem } from './ddsKpiP2pRollup'
import { subscribeDdsP2pKpiRollupDone } from './ddsP2pKpiRollupEvents'
import {
  DDS_KPI_DDS_SETUP_SURFACE_LABELS,
  type DdsKpiDdsSetupSurfaceKey,
  kpiShowsOnDdsSurface,
} from './ddsKpiDdsSetupSurfaces'

type KpiShellSurface = DdsKpiDdsSetupSurfaceKey

type KpiGroup = { id: string; name: string; sort_order: number }

type KpiDef = {
  id: string
  kpi_group_id: string
  label: string
  sort_order: number
  point_kind: string
  display_sections: string[] | null
  unit: DdsKpiUnit
  scoring: DdsKpiScoring
}

type EntryRow = {
  id: string
  kpi_id: string
  value_numeric: number | null
  comment: string | null
  p2p_breakdown: unknown
}

type Props = {
  cellId: string
  planDate: string
  shiftKind: string
  /** Admin KPI display surface: Shift DDS vs Line DDS metrics. */
  kpiSurface?: KpiShellSurface
  /** Narrower KPI tiles for Line DDS sidebar. */
  compact?: boolean
  /** Smallest tiles for Site DDS multi-cell roll-up. */
  dense?: boolean
  /** Roll-up panels: render nothing when no KPIs match this surface (no group headers). */
  hideWhenEmpty?: boolean
  /** Optional cell title shown above KPI groups (Site / Plant roll-up). */
  cellBanner?: string
  /** Fired after load when `hideWhenEmpty` — whether any KPIs are shown. */
  onVisibleChange?: (visible: boolean) => void
  /** Site DDS: hide KPIs with consolidated site presentation. */
  excludeKpiIds?: Set<string>
  /** Site DDS: only render this KPI group (when set). */
  groupId?: string
}

function blockClasses(tone: 'neutral' | 'good' | 'bad'): string {
  if (tone === 'good') return 'border-emerald-600/50 bg-emerald-600/15 text-emerald-950 dark:bg-emerald-900/35 dark:text-emerald-50'
  if (tone === 'bad') return 'border-rose-600/50 bg-rose-600/15 text-rose-950 dark:bg-rose-900/35 dark:text-rose-50'
  return 'border-sky-600/45 bg-sky-600/12 text-sky-950 dark:bg-sky-900/35 dark:text-sky-50'
}

function placeDetailPanel(anchor: HTMLElement, maxW: number): { top: number; left: number; maxW: number } {
  const rect = anchor.getBoundingClientRect()
  const w = typeof window !== 'undefined' ? window.innerWidth : 400
  const left = Math.max(8, Math.min(rect.left, w - maxW - 8))
  return { top: rect.bottom + 6, left, maxW }
}

export function ShiftDdsKpiSummary({
  cellId,
  planDate,
  shiftKind,
  kpiSurface = 'shift-dds',
  compact,
  dense,
  hideWhenEmpty,
  cellBanner,
  onVisibleChange,
  excludeKpiIds,
  groupId,
}: Props) {
  const tileCompact = compact || dense
  const { user } = useAuth()
  const kpiEditTitleId = useId()
  const surfaceLabel = DDS_KPI_DDS_SETUP_SURFACE_LABELS[kpiSurface]
  const [groups, setGroups] = useState<KpiGroup[]>([])
  const [kpis, setKpis] = useState<KpiDef[]>([])
  const [entries, setEntries] = useState<Record<string, EntryRow>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<{
    kpi: KpiDef
    valueStr: string
    comment: string
    entryId: string | null
    hadP2pBreakdown: boolean
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [detailPop, setDetailPop] = useState<{
    top: number
    left: number
    maxW: number
    text: string
    breakdown: DdsP2pKpiBreakdownItem[]
  } | null>(null)
  const detailPanelRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    if (!cellId || !planDate || !shiftKind) {
      setGroups([])
      setKpis([])
      setEntries({})
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const [gRes, kRes, eRes, oRes] = await Promise.all([
      supabase.from('dds_kpi_groups').select('id, name, sort_order').order('sort_order').order('name'),
      supabase
        .from('dds_kpis')
        .select('id, kpi_group_id, label, sort_order, point_kind, unit, display_sections, scoring')
        .order('sort_order')
        .order('label'),
      supabase
        .from('dds_kpi_cell_entries')
        .select('id, kpi_id, value_numeric, comment, p2p_breakdown')
        .eq('master_cell_id', cellId)
        .eq('plan_date', planDate)
        .eq('shift_kind', shiftKind),
      supabase.from('dds_kpi_cell_dds_display').select('kpi_id, surfaces').eq('master_cell_id', cellId),
    ])
    setLoading(false)
    if (gRes.error) {
      setError(gRes.error.message)
      return
    }
    if (kRes.error) {
      setError(kRes.error.message)
      return
    }
    if (eRes.error) {
      setError(eRes.error.message)
      return
    }
    if (oRes.error) {
      setError(oRes.error.message)
      return
    }
    const overrideBy = new Map<string, string[]>()
    for (const row of (oRes.data ?? []) as { kpi_id: string; surfaces: string[] }[]) {
      overrideBy.set(row.kpi_id, row.surfaces ?? [])
    }
    setGroups((gRes.data ?? []) as KpiGroup[])
    const kRowsAll = (kRes.data ?? []) as {
      id: string
      kpi_group_id: string
      label: string
      sort_order: number
      point_kind: string | null
      unit: string | null
      display_sections: string[] | null
      scoring: unknown
    }[]
    const kRows = kRowsAll.filter((r) => {
      if (excludeKpiIds?.has(r.id)) return false
      if (groupId && r.kpi_group_id !== groupId) return false
      return kpiShowsOnDdsSurface(
        { point_kind: r.point_kind, display_sections: r.display_sections },
        kpiSurface,
        overrideBy.has(r.id) ? overrideBy.get(r.id)! : null,
      )
    })
    setKpis(
      kRows.map((r) => ({
        id: r.id,
        kpi_group_id: r.kpi_group_id,
        label: r.label,
        sort_order: r.sort_order,
        point_kind: String(r.point_kind ?? ''),
        display_sections: r.display_sections,
        unit: parseDdsKpiUnit(r.unit),
        scoring: parseDdsKpiScoring(r.scoring),
      })),
    )
    const em: Record<string, EntryRow> = {}
    for (const row of eRes.data ?? []) {
      const r = row as EntryRow & { kpi_id: string }
      em[r.kpi_id] = {
        id: r.id,
        kpi_id: r.kpi_id,
        value_numeric: r.value_numeric,
        comment: r.comment,
        p2p_breakdown: r.p2p_breakdown,
      }
    }
    setEntries(em)
  }, [cellId, planDate, shiftKind, kpiSurface, excludeKpiIds, groupId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return subscribeDdsP2pKpiRollupDone((d) => {
      if (d.masterCellId !== cellId || d.planDate !== planDate || d.shiftKind !== shiftKind) return
      void load()
    })
  }, [cellId, planDate, shiftKind, kpiSurface, load])

  useEffect(() => {
    setDetailPop(null)
  }, [cellId, planDate, shiftKind, kpiSurface])

  useEffect(() => {
    if (!hideWhenEmpty || loading) return
    onVisibleChange?.(kpis.length > 0)
  }, [hideWhenEmpty, loading, kpis.length, onVisibleChange])

  useLayoutEffect(() => {
    if (!detailPop) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (detailPanelRef.current?.contains(t)) return
      setDetailPop(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailPop(null)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [detailPop])

  const kpisByGroup = useMemo(() => {
    const m = new Map<string, KpiDef[]>()
    for (const k of kpis) {
      if (!m.has(k.kpi_group_id)) m.set(k.kpi_group_id, [])
      m.get(k.kpi_group_id)!.push(k)
    }
    for (const [, list] of m) {
      list.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
    }
    return m
  }, [kpis])

  const sortedGroups = useMemo(() => {
    const sorted = [...groups].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    return sorted.filter((g) => (kpisByGroup.get(g.id) ?? []).length > 0)
  }, [groups, kpisByGroup])

  function openModal(kpi: KpiDef) {
    setDetailPop(null)
    const e = entries[kpi.id]
    const v = e?.value_numeric
    const b = parseDdsP2pKpiBreakdown(e?.p2p_breakdown)
    setModal({
      kpi,
      valueStr: v != null && Number.isFinite(v) ? String(v) : '',
      comment: e?.comment ?? '',
      entryId: e?.id ?? null,
      hadP2pBreakdown: b.length > 0,
    })
  }

  async function saveModal() {
    if (!modal) return
    const n = Number(String(modal.valueStr).trim().replace(',', '.'))
    const value_numeric = String(modal.valueStr).trim() === '' || !Number.isFinite(n) ? null : n
    setSaving(true)
    setError(null)
    const { error: uErr } = await supabase.from('dds_kpi_cell_entries').upsert(
      {
        master_cell_id: cellId,
        kpi_id: modal.kpi.id,
        plan_date: planDate,
        shift_kind: shiftKind,
        value_numeric,
        comment: modal.comment.trim() || null,
        p2p_breakdown: null,
        updated_by: user?.id ?? null,
      },
      { onConflict: 'master_cell_id,kpi_id,plan_date,shift_kind' },
    )
    setSaving(false)
    if (uErr) setError(uErr.message)
    else {
      setModal(null)
      await load()
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-1 text-xs text-muted" role="status">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Loading KPIs…
      </p>
    )
  }

  if (error) {
    return <p className="text-xs text-rose-700 dark:text-rose-300">{error}</p>
  }

  if (kpis.length === 0) {
    if (hideWhenEmpty) return null
    return (
      <p className="text-[11px] leading-snug text-muted">
        No KPIs are assigned to <strong className="text-fg/80">{surfaceLabel}</strong> for this cell yet. Use{' '}
        <strong className="text-fg/80">Admin → KPI set-up</strong> to choose which metrics appear on each DDS page, or{' '}
        <strong className="text-fg/80">Admin → KPIs</strong> for global screen targets.
      </p>
    )
  }

  const body = (
    <div className={dense ? 'space-y-1' : 'space-y-3'}>
      {sortedGroups.map((g) => {
        const list = kpisByGroup.get(g.id) ?? []
        if (list.length === 0) return null
        return (
          <div key={g.id}>
            <h3
              className={`border-b border-border/60 font-semibold uppercase tracking-wide text-muted ${
                dense ? 'mb-0.5 pb-px text-[8px]' : 'mb-1.5 pb-0.5 text-[10px]'
              }`}
            >
              {g.name}
            </h3>
            <div className={`flex flex-wrap ${dense ? 'gap-0.5' : 'gap-1.5'}`}>
              {list.map((kpi) => {
                const e = entries[kpi.id]
                const val = e?.value_numeric ?? null
                const tone = evaluateKpiBlock(val, kpi.scoring)
                const targetLine = scoringTargetNumbersOnly(kpi.scoring)
                const valueLabel =
                  val != null && Number.isFinite(val) ? formatKpiValueWithUnit(val, kpi.unit) : '—'
                const cmt = e?.comment?.trim() ?? ''
                const breakdown = parseDdsP2pKpiBreakdown(e?.p2p_breakdown)
                const hasCmt = Boolean(cmt)
                const hasP2pDetail = breakdown.length > 0
                return (
                  <div
                    key={kpi.id}
                    role="button"
                    tabIndex={0}
                    className={`flex cursor-pointer flex-col rounded-md border text-left shadow-sm outline-none ring-accent/30 transition hover:brightness-[1.02] focus-visible:ring-2 ${
                      dense
                        ? 'min-w-[2.5rem] max-w-[4.25rem] px-1 py-0.5'
                        : tileCompact
                          ? 'min-w-[3.25rem] max-w-[5.75rem] px-1.5 py-1'
                          : 'min-w-[4.75rem] max-w-[8rem] px-1.5 py-1'
                    } ${blockClasses(tone)}`}
                    aria-label={`${kpi.label}, edit KPI value`}
                    onClick={() => openModal(kpi)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault()
                        openModal(kpi)
                      }
                    }}
                  >
                    <span
                      className={`font-medium leading-tight text-fg/90 line-clamp-2 ${dense ? 'text-[8px]' : 'text-[9px]'}`}
                    >
                      {kpi.label}
                    </span>
                    <div className={`flex items-end justify-between gap-0.5 ${dense ? 'mt-px min-h-[1rem]' : 'mt-0.5 min-h-[1.25rem]'}`}>
                      <div className="min-w-0 flex-1">
                        <span
                          className={`font-semibold tabular-nums leading-none text-fg ${
                            dense ? 'text-[10px]' : tileCompact ? 'text-xs' : 'text-sm'
                          }`}
                        >
                          {valueLabel}
                        </span>
                        {targetLine ? (
                          <span className="mt-0.5 block text-[8px] font-medium tabular-nums leading-none text-fg/60">
                            {targetLine}
                          </span>
                        ) : null}
                      </div>
                      {hasCmt || hasP2pDetail ? (
                        <button
                          type="button"
                          className="-m-0.5 inline-flex shrink-0 rounded p-0.5 text-muted hover:bg-black/[0.06] hover:text-fg dark:hover:bg-white/[0.06]"
                          aria-label={hasP2pDetail ? 'Show P2P role comments' : 'Show KPI comment'}
                          onClick={(clickEv) => {
                            clickEv.stopPropagation()
                            const pos = placeDetailPanel(clickEv.currentTarget, 280)
                            setDetailPop({
                              ...pos,
                              text: cmt,
                              breakdown,
                            })
                          }}
                        >
                          <MessageSquare className="size-3 shrink-0 text-accent" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {detailPop ? (
        <div
          ref={detailPanelRef}
          role="dialog"
          aria-modal="false"
          aria-label="KPI details"
          className="fixed z-[68] max-h-[min(50vh,20rem)] overflow-y-auto rounded-lg border border-border-strong bg-surface px-3 py-2 text-xs shadow-xl"
          style={{ top: detailPop.top, left: detailPop.left, maxWidth: detailPop.maxW, width: detailPop.maxW }}
        >
          {detailPop.breakdown.length > 0 ? (
            <div className="mb-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">P2P by role</div>
              <ul className="space-y-1.5 leading-snug">
                {detailPop.breakdown.map((b, i) => (
                  <li key={`${b.roster_role_id}-${b.question_key}-${i}`} className="text-fg">
                    <span className="font-semibold text-fg">{b.role_name}</span>
                    {b.prompt ? <span className="text-muted"> · {b.prompt}</span> : null}
                    <span className="tabular-nums text-fg/90"> · {b.value}</span>
                    {b.comment ? <span className="text-fg/85"> — {b.comment}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {detailPop.text ? (
            <div>
              {detailPop.breakdown.length > 0 ? (
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Comment</div>
              ) : null}
              <div className="whitespace-pre-wrap break-words leading-snug text-fg">{detailPop.text}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      {modal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div
            className="w-full max-w-md rounded-2xl border border-border-strong bg-surface p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby={kpiEditTitleId}
          >
            <h2 id={kpiEditTitleId} className="font-display text-lg font-semibold">
              {modal.kpi.label}
            </h2>
            <p className="mt-1 text-[11px] text-muted">
              Manual value for this cell, date, and shift. {scoringHint(modal.kpi.scoring)}
            </p>
            {modal.hadP2pBreakdown ? (
              <p className="mt-2 rounded-lg border border-amber-600/35 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-950 dark:bg-amber-950/25 dark:text-amber-100/90">
                Saving replaces the automatic P2P rollup for this KPI with your manual value and clears per-role P2P
                lines.
              </p>
            ) : null}
            <label className="mt-4 block text-xs font-medium text-muted">
              Value
              {modal.kpi.unit !== 'none' ? (
                <span className="font-normal text-fg/55"> ({DDS_KPI_UNIT_OPTIONS.find((u) => u.value === modal.kpi.unit)?.label})</span>
              ) : null}
              <input
                type="text"
                inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2"
                value={modal.valueStr}
                onChange={(e) => setModal((m) => (m ? { ...m, valueStr: e.target.value } : m))}
                placeholder="e.g. 98.5"
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-muted">
              Comment
              <textarea
                className="mt-1 min-h-[4.5rem] w-full resize-y rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2"
                value={modal.comment}
                onChange={(e) => setModal((m) => (m ? { ...m, comment: e.target.value } : m))}
                placeholder="Optional note"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-black/[0.06]"
                disabled={saving}
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={saving}
                onClick={() => void saveModal()}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )

  if (cellBanner) {
    return (
      <div className="rounded border border-border/50 bg-canvas/15 p-1">
        <h3 className="mb-0.5 truncate border-b border-border/40 pb-px text-[9px] font-semibold uppercase tracking-wide text-muted">
          {cellBanner}
        </h3>
        {body}
      </div>
    )
  }

  return body
}
