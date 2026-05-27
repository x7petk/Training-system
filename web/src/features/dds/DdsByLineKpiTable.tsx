import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { DdsCellLine, DdsKpiLineEntry } from './ddsCellLines'
import { lineEntryKey } from './ddsCellLines'
import {
  kpiHasDdsCommentDetail,
  parseDdsP2pKpiBreakdown,
  type DdsP2pKpiBreakdownItem,
} from './ddsKpiP2pRollup'
import type { DdsKpiScoring } from './ddsKpiScoring'
import {
  evaluateKpiBlock,
  kpiBlockToneClasses,
  lineKpiScoringKey,
  resolveLineKpiScoring,
  scoringHint,
  scoringTargetNumbersOnly,
} from './ddsKpiScoring'
import type { DdsKpiUnit } from './ddsKpiUnits'
import { DDS_KPI_UNIT_OPTIONS, formatKpiValueWithUnit } from './ddsKpiUnits'
import { DdsKpiValueField } from './DdsKpiValueField'
import {
  DDS_KPI_TABLE_CLASS,
  DDS_KPI_METRIC_TD_CLASS,
  DDS_KPI_METRIC_TD_COMPACT_CLASS,
  DDS_KPI_METRIC_TH_CLASS,
  DDS_KPI_VALUE_BUTTON_CLASS,
  DDS_KPI_VALUE_BUTTON_COMPACT_CLASS,
  DDS_KPI_VALUE_COL_CLASS,
  DDS_KPI_VALUE_COL_COMPACT_CLASS,
  DDS_KPI_VALUE_TH_CLASS,
  DDS_KPI_TABLE_WRAPPER_CLASS,
  DDS_KPI_TABLE_WRAPPER_COMPACT_CLASS,
} from './ddsKpiTableLayout'

export type ByLineKpiDef = {
  id: string
  label: string
  sort_order: number
  unit: DdsKpiUnit
  scoring: DdsKpiScoring
}

export type ByLineTableColumn = {
  line: DdsCellLine
  cellId: string
  columnLabel: string
}

type Props = {
  columns: ByLineTableColumn[]
  kpis: ByLineKpiDef[]
  entries: DdsKpiLineEntry[]
  planDate: string
  shiftKind: string
  tableTitle?: string
  emptyLinesMessage?: string
  /** Per-line scoring overrides keyed by lineKpiScoringKey(kpiId, lineId). */
  lineScoringByKey?: Map<string, DdsKpiScoring>
  /** Tighter rows for Line / Plant DDS. */
  compact?: boolean
  onSaved: () => void
}

type EditModal = {
  col: ByLineTableColumn
  kpi: ByLineKpiDef
  scoring: DdsKpiScoring
  valueStr: string
  comment: string
  entryId: string | null
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

export function DdsByLineKpiTable({
  columns,
  kpis,
  entries,
  planDate,
  shiftKind,
  tableTitle,
  emptyLinesMessage = 'No lines configured. Add lines under Admin → Cell lines.',
  lineScoringByKey,
  compact = false,
  onSaved,
}: Props) {
  const { user } = useAuth()
  const editTitleId = useId()
  const detailPanelRef = useRef<HTMLDivElement>(null)
  const [modal, setModal] = useState<EditModal | null>(null)
  const [detailPop, setDetailPop] = useState<DetailPop | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const entryByKey = useMemo(() => {
    const m = new Map<string, DdsKpiLineEntry>()
    for (const e of entries) {
      m.set(lineEntryKey(e.line_id, e.kpi_id), e)
    }
    return m
  }, [entries])

  const resolveScoring = useCallback(
    (kpi: ByLineKpiDef, lineId: string): DdsKpiScoring => {
      const override = lineScoringByKey?.get(lineKpiScoringKey(kpi.id, lineId)) ?? null
      return resolveLineKpiScoring(kpi.scoring, override)
    },
    [lineScoringByKey],
  )

  const openModal = useCallback(
    (col: ByLineTableColumn, kpi: ByLineKpiDef) => {
      const key = lineEntryKey(col.line.id, kpi.id)
      const entry = entryByKey.get(key)
      const v = entry?.value_numeric
      setModal({
        col,
        kpi,
        scoring: resolveScoring(kpi, col.line.id),
        valueStr: v != null && Number.isFinite(v) ? String(v) : '',
        comment: entry?.comment ?? '',
        entryId: entry?.id ?? null,
        p2pBreakdown: parseDdsP2pKpiBreakdown(entry?.p2p_breakdown),
      })
    },
    [entryByKey, resolveScoring],
  )

  const saveModal = useCallback(async () => {
    if (!modal) return
    const n = Number(String(modal.valueStr).trim().replace(',', '.'))
    const value_numeric = String(modal.valueStr).trim() === '' || !Number.isFinite(n) ? null : n
    setSaving(true)
    setError(null)
    const { error: uErr } = await supabase.from('dds_kpi_line_entries').upsert(
      {
        master_cell_id: modal.col.cellId,
        line_id: modal.col.line.id,
        kpi_id: modal.kpi.id,
        plan_date: planDate,
        shift_kind: shiftKind,
        value_numeric,
        comment: modal.comment.trim() || null,
        updated_by: user?.id ?? null,
      },
      { onConflict: 'line_id,kpi_id,plan_date,shift_kind' },
    )
    setSaving(false)
    if (uErr) setError(uErr.message)
    else {
      setModal(null)
      onSaved()
    }
  }, [modal, planDate, shiftKind, user?.id, onSaved])

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

  const metricTdClass = compact ? DDS_KPI_METRIC_TD_COMPACT_CLASS : DDS_KPI_METRIC_TD_CLASS
  const valueColClass = compact ? DDS_KPI_VALUE_COL_COMPACT_CLASS : DDS_KPI_VALUE_COL_CLASS
  const valueButtonClass = compact ? DDS_KPI_VALUE_BUTTON_COMPACT_CLASS : DDS_KPI_VALUE_BUTTON_CLASS
  const tableWrapperClass = compact ? DDS_KPI_TABLE_WRAPPER_COMPACT_CLASS : DDS_KPI_TABLE_WRAPPER_CLASS

  if (columns.length === 0) {
    return (
      <div className="mt-0.5 rounded border border-dashed border-border/70 bg-canvas/30 px-1.5 py-1">
        {tableTitle ? (
          <p className="text-[8px] font-semibold uppercase tracking-wide text-muted">{tableTitle}</p>
        ) : null}
        <p className="mt-px text-[9px] leading-snug text-muted">{emptyLinesMessage}</p>
      </div>
    )
  }

  return (
    <>
      <div className={tableWrapperClass}>
        {tableTitle ? (
          <p className="border-b border-border/60 bg-canvas/40 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-muted">
            {tableTitle}
          </p>
        ) : null}
        {error && !modal ? (
          <p className="px-1.5 py-0.5 text-[9px] text-rose-700 dark:text-rose-300">{error}</p>
        ) : null}
        <table className={DDS_KPI_TABLE_CLASS}>
          <thead>
            <tr className="border-b border-border/60 bg-surface-raised/50">
              <th className={DDS_KPI_METRIC_TH_CLASS}>Metric</th>
              {columns.map((col) => (
                <th
                  key={`${col.cellId}-${col.line.id}`}
                  className={DDS_KPI_VALUE_TH_CLASS}
                  title={col.columnLabel}
                >
                  <span className="line-clamp-2 break-words">{col.columnLabel}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kpis.map((kpi) => {
              const hasPerLineTargets = Boolean(
                lineScoringByKey &&
                  columns.some((col) => lineScoringByKey.has(lineKpiScoringKey(kpi.id, col.line.id))),
              )
              const rowTargetLine = hasPerLineTargets ? '' : scoringTargetNumbersOnly(kpi.scoring)
              return (
                <tr key={kpi.id} className="border-b border-border/40 last:border-b-0">
                  <td className={metricTdClass}>
                    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-0.5">
                      <span className="font-medium leading-none text-fg">{kpi.label}</span>
                      {rowTargetLine ? (
                        <span className="shrink-0 text-[7px] font-medium tabular-nums leading-none text-muted">
                          {rowTargetLine}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  {columns.map((col) => {
                    const key = lineEntryKey(col.line.id, kpi.id)
                    const entry = entryByKey.get(key)
                    const val = entry?.value_numeric ?? null
                    const scoring = resolveScoring(kpi, col.line.id)
                    const tone = evaluateKpiBlock(val, scoring)
                    const cellTargetLine = scoringTargetNumbersOnly(scoring)
                    const valueLabel =
                      val != null && Number.isFinite(val) ? formatKpiValueWithUnit(val, kpi.unit) : '—'
                    const cmt = entry?.comment?.trim() ?? ''
                    const breakdown = parseDdsP2pKpiBreakdown(entry?.p2p_breakdown)
                    const showComment = kpiHasDdsCommentDetail(cmt, breakdown)
                    return (
                      <td key={`${col.cellId}-${col.line.id}`} className={valueColClass}>
                        <button
                          type="button"
                          disabled={!user}
                          className={`${valueButtonClass} ${kpiBlockToneClasses(tone)}`}
                          aria-label={`${kpi.label}, ${col.columnLabel}: ${valueLabel}${showComment ? ', has comment' : ''}. Edit value and comment.`}
                          onClick={() => openModal(col, kpi)}
                        >
                          <span className="inline-flex min-w-0 items-center justify-center gap-0.5 leading-none">
                            {hasPerLineTargets && cellTargetLine ? (
                              <span className="shrink-0 text-[6px] font-medium tabular-nums opacity-75">{cellTargetLine}</span>
                            ) : null}
                            <span className="shrink-0 tabular-nums text-[9px] font-semibold">{valueLabel}</span>
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
                          </span>
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
            <p className="mt-2 text-[11px] text-muted">{scoringHint(modal.scoring)}</p>
            {scoringTargetNumbersOnly(modal.scoring) ? (
              <p className="mt-1 text-[11px] font-medium tabular-nums text-fg/80">
                Target: {scoringTargetNumbersOnly(modal.scoring)}
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
                scoring={modal.scoring}
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
