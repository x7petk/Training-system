import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { DdsKpiCellEntry } from './ddsCellLines'
import { cellEntryKey } from './ddsCellLines'
import type { DdsKpiDdsSetupSurfaceKey } from './ddsKpiDdsSetupSurfaces'
import {
  kpiHasDdsCommentDetail,
  parseDdsP2pKpiBreakdown,
  type DdsP2pKpiBreakdownItem,
} from './ddsKpiP2pRollup'
import type { DdsKpiScoring } from './ddsKpiScoring'
import { evaluateKpiBlock, kpiBlockToneClasses, scoringHint, scoringTargetNumbersOnly } from './ddsKpiScoring'
import type { DdsKpiUnit } from './ddsKpiUnits'
import { DDS_KPI_UNIT_OPTIONS, formatKpiValueWithUnit } from './ddsKpiUnits'
import { DdsKpiValueField } from './DdsKpiValueField'
import { isDdsPlan24ValueSource, plan24EntryShiftKind } from './ddsPlan24ValueSource'
import {
  DDS_KPI_TABLE_CLASS,
  DDS_KPI_METRIC_TD_CLASS,
  DDS_KPI_METRIC_TH_CLASS,
  DDS_KPI_VALUE_BUTTON_CLASS,
  DDS_KPI_VALUE_COL_CLASS,
  DDS_KPI_VALUE_TH_CLASS,
} from './ddsKpiTableLayout'

export type ByCellKpiDef = {
  id: string
  label: string
  sort_order: number
  unit: DdsKpiUnit
  scoring: DdsKpiScoring
  plan24_value_source: string | null
}

export type ByCellTableColumn = {
  cellId: string
  columnLabel: string
}

type Props = {
  columns: ByCellTableColumn[]
  kpis: ByCellKpiDef[]
  entries: DdsKpiCellEntry[]
  planDate: string
  shiftKind: string
  kpiSurface: DdsKpiDdsSetupSurfaceKey
  onSaved: () => void
  /** Hide column header row (e.g. Line DDS single-cell view). */
  hideHeader?: boolean
}

type EditModal = {
  col: ByCellTableColumn
  kpi: ByCellKpiDef
  valueStr: string
  comment: string
  entryId: string | null
  hadP2pBreakdown: boolean
  p2pBreakdown: DdsP2pKpiBreakdownItem[]
}

type DetailPop = {
  top: number
  left: number
  maxW: number
  text: string
  breakdown: DdsP2pKpiBreakdownItem[]
}

function placeDetailPanel(anchor: HTMLElement, maxW: number): { top: number; left: number; maxW: number } {
  const rect = anchor.getBoundingClientRect()
  const w = typeof window !== 'undefined' ? window.innerWidth : 400
  const left = Math.max(8, Math.min(rect.left, w - maxW - 8))
  return { top: rect.bottom + 6, left, maxW }
}

export function DdsByCellKpiTable({
  columns,
  kpis,
  entries,
  planDate,
  shiftKind,
  kpiSurface,
  onSaved,
  hideHeader = false,
}: Props) {
  const { user } = useAuth()
  const editTitleId = useId()
  const detailPanelRef = useRef<HTMLDivElement>(null)
  const [modal, setModal] = useState<EditModal | null>(null)
  const [detailPop, setDetailPop] = useState<DetailPop | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const entryByKey = useMemo(() => {
    const m = new Map<string, DdsKpiCellEntry>()
    for (const e of entries) {
      m.set(cellEntryKey(e.master_cell_id, e.kpi_id), e)
    }
    return m
  }, [entries])

  const openModal = useCallback(
    (col: ByCellTableColumn, kpi: ByCellKpiDef) => {
      const key = cellEntryKey(col.cellId, kpi.id)
      const entry = entryByKey.get(key)
      const v = entry?.value_numeric
      const p2pBreakdown = parseDdsP2pKpiBreakdown(entry?.p2p_breakdown)
      setModal({
        col,
        kpi,
        valueStr: v != null && Number.isFinite(v) ? String(v) : '',
        comment: entry?.comment ?? '',
        entryId: entry?.id ?? null,
        hadP2pBreakdown: p2pBreakdown.length > 0,
        p2pBreakdown,
      })
    },
    [entryByKey],
  )

  const saveModal = useCallback(async () => {
    if (!modal) return
    const n = Number(String(modal.valueStr).trim().replace(',', '.'))
    const value_numeric = String(modal.valueStr).trim() === '' || !Number.isFinite(n) ? null : n
    setSaving(true)
    setError(null)
    const entryShift = plan24EntryShiftKind(modal.kpi.plan24_value_source, kpiSurface, shiftKind)
    const plan24Manual = isDdsPlan24ValueSource(modal.kpi.plan24_value_source)
    const { error: uErr } = await supabase.from('dds_kpi_cell_entries').upsert(
      {
        master_cell_id: modal.col.cellId,
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
      onSaved()
    }
  }, [modal, planDate, shiftKind, kpiSurface, user?.id, onSaved])

  useEffect(() => {
    if (!modal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) setModal(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal, saving])

  useEffect(() => {
    if (!detailPop) return
    const onPointer = (e: MouseEvent) => {
      if (detailPanelRef.current?.contains(e.target as Node)) return
      setDetailPop(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailPop(null)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [detailPop])

  if (kpis.length === 0) return null

  return (
    <>
      <div className="mt-0.5 overflow-x-auto rounded border border-border/60">
        {error && !modal ? (
          <p className="px-1.5 py-0.5 text-[9px] text-rose-700 dark:text-rose-300">{error}</p>
        ) : null}
        <table className={DDS_KPI_TABLE_CLASS}>
          {!hideHeader ? (
            <thead>
              <tr className="border-b border-border/60 bg-surface-raised/50">
                <th className={DDS_KPI_METRIC_TH_CLASS}>Metric</th>
                {columns.map((col) => (
                  <th
                    key={col.cellId}
                    className={DDS_KPI_VALUE_TH_CLASS}
                    title={col.columnLabel}
                  >
                    <span className="line-clamp-2 break-words">{col.columnLabel}</span>
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {kpis.map((kpi) => {
              const targetLine = scoringTargetNumbersOnly(kpi.scoring)
              return (
                <tr key={kpi.id} className="border-b border-border/40 last:border-b-0">
                  <td className={DDS_KPI_METRIC_TD_CLASS}>
                    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-0.5">
                      <span className="font-medium leading-none text-fg">{kpi.label}</span>
                      {targetLine ? (
                        <span className="shrink-0 text-[7px] font-medium tabular-nums leading-none text-muted">
                          {targetLine}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  {columns.map((col) => {
                    const key = cellEntryKey(col.cellId, kpi.id)
                    const entry = entryByKey.get(key)
                    const val = entry?.value_numeric ?? null
                    const tone = evaluateKpiBlock(val, kpi.scoring)
                    const valueLabel =
                      val != null && Number.isFinite(val) ? formatKpiValueWithUnit(val, kpi.unit) : '—'
                    const cmt = entry?.comment?.trim() ?? ''
                    const breakdown = parseDdsP2pKpiBreakdown(entry?.p2p_breakdown)
                    const showComment = kpiHasDdsCommentDetail(cmt, breakdown)
                    return (
                      <td key={col.cellId} className={DDS_KPI_VALUE_COL_CLASS}>
                        <button
                          type="button"
                          disabled={!user}
                          className={`${DDS_KPI_VALUE_BUTTON_CLASS} ${kpiBlockToneClasses(tone)}`}
                          aria-label={`${kpi.label}, ${col.columnLabel}: ${valueLabel}${showComment ? ', has comment' : ''}. Edit value and comment.`}
                          onClick={() => openModal(col, kpi)}
                        >
                          <span className="tabular-nums text-[9px] font-semibold leading-none">{valueLabel}</span>
                          {showComment ? (
                            <span
                              role="button"
                              tabIndex={0}
                              className="inline-flex shrink-0 rounded p-px text-muted hover:text-fg"
                              aria-label="Show P2P comments"
                              onClick={(clickEv) => {
                                clickEv.stopPropagation()
                                const pos = placeDetailPanel(clickEv.currentTarget as HTMLElement, 280)
                                setDetailPop({ ...pos, text: cmt, breakdown })
                              }}
                              onKeyDown={(keyEv) => {
                                if (keyEv.key === 'Enter' || keyEv.key === ' ') {
                                  keyEv.preventDefault()
                                  keyEv.stopPropagation()
                                  const pos = placeDetailPanel(keyEv.currentTarget as HTMLElement, 280)
                                  setDetailPop({ ...pos, text: cmt, breakdown })
                                }
                              }}
                            >
                              <MessageSquare className="size-2.5 shrink-0 text-accent" aria-hidden />
                            </span>
                          ) : null}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

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
                    {b.line_name ? <span className="text-muted"> · {b.line_name}</span> : null}
                    {b.prompt ? <span className="text-muted"> · {b.prompt}</span> : null}
                    <span className="tabular-nums text-fg/90"> · {b.value}</span>
                    {b.comment ? <span className="text-fg/85"> — {b.comment}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {detailPop.text ? (
            <p className="whitespace-pre-wrap leading-snug text-fg">{detailPop.text}</p>
          ) : detailPop.breakdown.length === 0 ? (
            <p className="text-muted">No comment.</p>
          ) : null}
        </div>
      ) : null}

      {modal ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onClick={() => {
            if (!saving) setModal(null)
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border-strong bg-surface p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby={editTitleId}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={editTitleId} className="font-display text-lg font-semibold">
              {modal.kpi.label}
            </h2>
            <p className="mt-0.5 text-[11px] text-muted">{modal.col.columnLabel}</p>
            <p className="mt-2 text-[11px] text-muted">{scoringHint(modal.kpi.scoring)}</p>
            {modal.hadP2pBreakdown ? (
              <p className="mt-2 rounded-lg border border-amber-600/35 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-950 dark:bg-amber-950/25 dark:text-amber-100/90">
                Saving replaces the automatic P2P rollup for this KPI with your manual value and clears per-role P2P
                lines.
              </p>
            ) : null}
            {error ? <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">{error}</p> : null}
            {modal.p2pBreakdown.length > 0 ? (
              <div className="mt-3 rounded-xl border border-border/70 bg-canvas/40 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">From P2P</p>
                <ul className="mt-1 space-y-1 text-[11px] leading-snug">
                  {modal.p2pBreakdown.map((b, i) => (
                    <li key={`${b.roster_role_id}-${i}`}>
                      <span className="font-semibold">{b.role_name}</span>
                      {b.prompt ? <span className="text-muted"> · {b.prompt}</span> : null}
                      <span className="tabular-nums"> · {b.value}</span>
                      {b.comment ? <span> — {b.comment}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <label className="mt-4 block text-xs font-medium text-muted">
              Value
              {modal.kpi.unit !== 'none' ? (
                <span className="font-normal text-fg/55">
                  {' '}
                  ({DDS_KPI_UNIT_OPTIONS.find((u) => u.value === modal.kpi.unit)?.label})
                </span>
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
                {saving ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Saving…
                  </span>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
