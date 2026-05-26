import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { DdsKpiScoring } from './ddsKpiScoring'
import {
  evaluateKpiBlock,
  kpiBlockToneClasses,
  parseDdsKpiScoring,
  scoringHint,
  scoringTargetNumbersOnly,
} from './ddsKpiScoring'
import type { DdsKpiUnit } from './ddsKpiUnits'
import { DDS_KPI_UNIT_OPTIONS, formatKpiValueWithUnit, parseDdsKpiUnit } from './ddsKpiUnits'
import { DdsKpiValueField } from './DdsKpiValueField'
import {
  kpiHasDdsCommentDetail,
  mergeMeetingDayKpiCellEntry,
  parseDdsP2pKpiBreakdown,
  p2pRollupEventMatchesMeetingDay,
  refreshKpiP2pRollups,
  type DdsP2pKpiBreakdownItem,
} from './ddsKpiP2pRollup'
import { subscribeDdsP2pKpiRollupDone } from './ddsP2pKpiRollupEvents'
import { refreshKpiPlan24Rollups } from './ddsPlan24KpiRollup'
import { DDS_MEETING_SHIFT_KIND } from './ddsMeetingDay'
import {
  isDdsPlan24ValueSource,
  plan24EntryShiftKind,
} from './ddsPlan24ValueSource'
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
  plan24_value_source: string | null
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

function placeDetailPanel(anchor: HTMLElement, maxW: number): { top: number; left: number; maxW: number } {
  const rect = anchor.getBoundingClientRect()
  const w = typeof window !== 'undefined' ? window.innerWidth : 400
  const left = Math.max(8, Math.min(rect.left, w - maxW - 8))
  return { top: rect.bottom + 6, left, maxW }
}

function kpiTileLayout(compact: boolean, dense: boolean) {
  if (dense) {
    return {
      bodySpace: 'space-y-0.5',
      groupHead: 'mb-0.5 pb-px text-[8px]',
      wrapGap: 'gap-0.5',
      tile: 'min-w-[2.125rem] max-w-[3.75rem] px-0.5 py-px rounded-sm shadow-none',
      label: 'text-[7px]',
      valueRow: 'mt-px min-h-[0.875rem]',
      value: 'text-[9px]',
      target: 'text-[7px]',
      commentIcon: 'size-2.5',
    }
  }
  if (compact) {
    return {
      bodySpace: 'space-y-1.5',
      groupHead: 'mb-1 pb-px text-[9px]',
      wrapGap: 'gap-1',
      tile: 'min-w-[2.75rem] max-w-[5rem] px-1 py-0.5 rounded-sm shadow-none',
      label: 'text-[8px]',
      valueRow: 'mt-px min-h-[1rem]',
      value: 'text-[10px]',
      target: 'text-[7px]',
      commentIcon: 'size-2.5',
    }
  }
  return {
    bodySpace: 'space-y-2',
    groupHead: 'mb-1 pb-0.5 text-[9px]',
    wrapGap: 'gap-1',
    tile: 'min-w-[3.5rem] max-w-[6.5rem] px-1 py-0.5 rounded-sm shadow-none',
    label: 'text-[8px]',
    valueRow: 'mt-0.5 min-h-[1.125rem]',
    value: 'text-[11px]',
    target: 'text-[8px]',
    commentIcon: 'size-3',
  }
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
  const meetingSurface =
    kpiSurface === 'line-dds' || kpiSurface === 'plant-dds' || kpiSurface === 'site-dds'
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
    const meetingSurfaceLoad = meetingSurface
    if (!cellId || !planDate || (!meetingSurfaceLoad && !shiftKind)) {
      setGroups([])
      setKpis([])
      setEntries({})
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await refreshKpiPlan24Rollups(supabase, {
        masterCellId: cellId,
        planDate,
        mode: meetingSurfaceLoad ? 'line_consolidated' : 'per_shift',
        shiftKind: meetingSurfaceLoad ? undefined : shiftKind,
        updatedBy: user?.id ?? null,
      })
    } catch (e) {
      setLoading(false)
      setError(e instanceof Error ? e.message : 'Could not refresh Plan 24 KPI values')
      return
    }
    if (meetingSurfaceLoad) {
      try {
        const { data: auditShiftRows, error: auditShiftErr } = await supabase
          .from('dds_p2p_audits')
          .select('shift_kind')
          .eq('master_cell_id', cellId)
          .eq('plan_date', planDate)
        if (auditShiftErr) throw new Error(auditShiftErr.message)
        const shiftKinds = [
          ...new Set(
            ((auditShiftRows ?? []) as { shift_kind: string }[])
              .map((row) => row.shift_kind)
              .filter((sk) => sk && sk !== DDS_MEETING_SHIFT_KIND),
          ),
        ]
        for (const sk of shiftKinds) {
          await refreshKpiP2pRollups(supabase, {
            masterCellId: cellId,
            planDate,
            shiftKind: sk,
            updatedBy: user?.id ?? null,
          })
        }
      } catch (e) {
        setLoading(false)
        setError(e instanceof Error ? e.message : 'Could not refresh P2P KPI values')
        return
      }
    }
    let entryQuery = supabase
      .from('dds_kpi_cell_entries')
      .select('id, kpi_id, shift_kind, value_numeric, comment, p2p_breakdown, plan24_manual_override')
      .eq('master_cell_id', cellId)
      .eq('plan_date', planDate)
    if (!meetingSurfaceLoad) {
      entryQuery = entryQuery.eq('shift_kind', shiftKind)
    }
    const [gRes, kRes, eRes, oRes] = await Promise.all([
      supabase.from('dds_kpi_groups').select('id, name, sort_order').order('sort_order').order('name'),
      supabase
        .from('dds_kpis')
        .select('id, kpi_group_id, label, sort_order, point_kind, unit, display_sections, scoring, plan24_value_source')
        .order('sort_order')
        .order('label'),
      entryQuery,
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
      plan24_value_source: string | null
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
    const kpiDefs = kRows.map((r) => ({
      id: r.id,
      kpi_group_id: r.kpi_group_id,
      label: r.label,
      sort_order: r.sort_order,
      point_kind: String(r.point_kind ?? ''),
      display_sections: r.display_sections,
      plan24_value_source: r.plan24_value_source,
      unit: parseDdsKpiUnit(r.unit),
      scoring: parseDdsKpiScoring(r.scoring),
    }))
    setKpis(kpiDefs)
    const rowsByKpi = new Map<string, (EntryRow & { shift_kind: string })[]>()
    for (const row of eRes.data ?? []) {
      const r = row as EntryRow & { kpi_id: string; shift_kind: string }
      const list = rowsByKpi.get(r.kpi_id) ?? []
      list.push(r)
      rowsByKpi.set(r.kpi_id, list)
    }
    const em: Record<string, EntryRow> = {}
    for (const kpi of kpiDefs) {
      if (meetingSurfaceLoad && !isDdsPlan24ValueSource(kpi.plan24_value_source)) {
        const merged = mergeMeetingDayKpiCellEntry(rowsByKpi.get(kpi.id) ?? [])
        if (!merged) continue
        em[kpi.id] = {
          id: merged.id,
          kpi_id: kpi.id,
          value_numeric: merged.value_numeric,
          comment: merged.comment,
          p2p_breakdown: merged.p2p_breakdown,
        }
        continue
      }
      const sk = plan24EntryShiftKind(kpi.plan24_value_source, kpiSurface, shiftKind)
      const r = (rowsByKpi.get(kpi.id) ?? []).find((row) => row.shift_kind === sk)
      if (!r) continue
      em[kpi.id] = {
        id: r.id,
        kpi_id: r.kpi_id,
        value_numeric: r.value_numeric,
        comment: r.comment,
        p2p_breakdown: r.p2p_breakdown,
      }
    }
    setEntries(em)
  }, [cellId, planDate, shiftKind, kpiSurface, meetingSurface, excludeKpiIds, groupId, user?.id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return subscribeDdsP2pKpiRollupDone((d) => {
      if (d.masterCellId !== cellId || d.planDate !== planDate) return
      if (!p2pRollupEventMatchesMeetingDay({ eventShiftKind: d.shiftKind, viewShiftKind: shiftKind, meetingSurface })) {
        return
      }
      void load()
    })
  }, [cellId, planDate, shiftKind, meetingSurface, load])

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
    const entryShift = plan24EntryShiftKind(modal.kpi.plan24_value_source, kpiSurface, shiftKind)
    const plan24Manual = isDdsPlan24ValueSource(modal.kpi.plan24_value_source)
    const { error: uErr } = await supabase.from('dds_kpi_cell_entries').upsert(
      {
        master_cell_id: cellId,
        kpi_id: modal.kpi.id,
        plan_date: planDate,
        shift_kind: entryShift,
        value_numeric,
        comment: modal.comment.trim() || null,
        p2p_breakdown: null,
        plan24_manual_override: plan24Manual,
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

  /** Line / Site DDS wrap each group in a section that already shows the group title. */
  const hideGroupHeaders = Boolean(groupId)
  const layout = kpiTileLayout(Boolean(tileCompact), Boolean(dense))

  const body = (
    <div className={layout.bodySpace}>
      {sortedGroups.map((g) => {
        const list = kpisByGroup.get(g.id) ?? []
        if (list.length === 0) return null
        return (
          <div key={g.id}>
            {!hideGroupHeaders ? (
              <h3
                className={`border-b border-border/60 font-semibold uppercase tracking-wide text-muted ${layout.groupHead}`}
              >
                {g.name}
              </h3>
            ) : null}
            <div className={`flex flex-wrap ${layout.wrapGap}`}>
              {list.map((kpi) => {
                const e = entries[kpi.id]
                const val = e?.value_numeric ?? null
                const tone = evaluateKpiBlock(val, kpi.scoring)
                const targetLine = scoringTargetNumbersOnly(kpi.scoring)
                const valueLabel =
                  val != null && Number.isFinite(val) ? formatKpiValueWithUnit(val, kpi.unit) : '—'
                const cmt = e?.comment?.trim() ?? ''
                const breakdown = parseDdsP2pKpiBreakdown(e?.p2p_breakdown)
                const showComment = kpiHasDdsCommentDetail(cmt, breakdown)
                return (
                  <div
                    key={kpi.id}
                    role="button"
                    tabIndex={0}
                    className={`flex shrink-0 cursor-pointer flex-col border text-left outline-none ring-accent/30 transition hover:brightness-[1.02] focus-visible:ring-2 ${layout.tile} ${kpiBlockToneClasses(tone)}`}
                    aria-label={`${kpi.label}, edit KPI value`}
                    onClick={() => openModal(kpi)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault()
                        openModal(kpi)
                      }
                    }}
                  >
                    <span className={`inline-flex min-w-0 flex-wrap items-baseline gap-x-0.5 ${layout.label}`}>
                      <span className="font-medium leading-tight text-fg/90">{kpi.label}</span>
                      {targetLine ? (
                        <span className={`shrink-0 font-medium tabular-nums leading-none text-fg/60 ${layout.target}`}>
                          {targetLine}
                        </span>
                      ) : null}
                    </span>
                    <div className={`flex flex-col gap-px ${layout.valueRow}`}>
                      <span className="inline-flex min-w-0 items-center gap-0.5">
                        <span className={`font-semibold tabular-nums leading-none text-fg ${layout.value}`}>
                          {valueLabel}
                        </span>
                        {showComment ? (
                          <button
                            type="button"
                            className="inline-flex shrink-0 rounded p-0.5 text-muted hover:bg-black/[0.06] hover:text-fg dark:hover:bg-white/[0.06]"
                            aria-label={breakdown.length > 0 ? 'Show P2P role comments' : 'Show KPI comment'}
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
                            <MessageSquare className={`${layout.commentIcon} shrink-0 text-accent`} aria-hidden />
                          </button>
                        ) : null}
                      </span>
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
              <DdsKpiValueField
                scoring={modal.kpi.scoring}
                valueStr={modal.valueStr}
                onChange={(valueStr) => setModal((m) => (m ? { ...m, valueStr } : m))}
                disabled={saving}
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
      <div className="w-max max-w-full shrink-0 rounded border border-border/50 bg-canvas/15 p-0.5">
        <h3 className="mb-px truncate border-b border-border/40 pb-px text-[8px] font-semibold uppercase tracking-wide text-muted">
          {cellBanner}
        </h3>
        {body}
      </div>
    )
  }

  return body
}
