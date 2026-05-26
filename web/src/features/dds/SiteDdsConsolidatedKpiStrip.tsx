import { useId, useLayoutEffect, useRef, useState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { DdsKpiScoring } from './ddsKpiScoring'
import { evaluateKpiBlock, kpiBlockToneClasses, scoringHint, scoringTargetNumbersOnly } from './ddsKpiScoring'
import type { DdsKpiUnit } from './ddsKpiUnits'
import { formatKpiValueWithUnit } from './ddsKpiUnits'
import { kpiHasDdsCommentDetail, type DdsP2pKpiBreakdownItem } from './ddsKpiP2pRollup'
import {
  resolveSiteDdsKpiValue,
  sitePresentationLabel,
  type DdsKpiSiteRollupMode,
} from './ddsKpiSitePresentation'

export type ConsolidatedKpiDef = {
  id: string
  label: string
  sort_order: number
  unit: DdsKpiUnit
  scoring: DdsKpiScoring
  site_dds_presentation: DdsKpiSiteRollupMode
}

type SiteEntryRow = {
  id: string
  kpi_id: string
  value_numeric: number | null
  comment: string | null
}

type Props = {
  siteId: string
  cellIds: string[]
  kpis: ConsolidatedKpiDef[]
  cellValuesByKpi: Map<string, number[]>
  p2pBreakdownByKpi?: Map<string, DdsP2pKpiBreakdownItem[]>
  siteEntries: Record<string, SiteEntryRow>
  planDate: string
  shiftKind: string
  onSaved: () => void
}

export function SiteDdsConsolidatedKpiStrip({
  siteId,
  cellIds,
  kpis,
  cellValuesByKpi,
  p2pBreakdownByKpi,
  siteEntries,
  planDate,
  shiftKind,
  onSaved,
}: Props) {
  const { user } = useAuth()
  const titleId = useId()
  const [modal, setModal] = useState<{
    kpi: ConsolidatedKpiDef
    valueStr: string
    comment: string
    entryId: string | null
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<{
    top: number
    left: number
    text: string
    breakdown: DdsP2pKpiBreakdownItem[]
  } | null>(null)
  const detailRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (!detail) return
    const onDown = (e: MouseEvent) => {
      if (detailRef.current?.contains(e.target as Node)) return
      setDetail(null)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [detail])

  if (kpis.length === 0) return null

  async function saveModal() {
    if (!modal) return
    const n = Number(String(modal.valueStr).trim().replace(',', '.'))
    const value_numeric = String(modal.valueStr).trim() === '' || !Number.isFinite(n) ? null : n
    setSaving(true)
    setError(null)
    const { error: uErr } = await supabase.from('dds_kpi_site_entries').upsert(
      {
        master_site_id: siteId,
        kpi_id: modal.kpi.id,
        plan_date: planDate,
        shift_kind: shiftKind,
        value_numeric,
        comment: modal.comment.trim() || null,
        updated_by: user?.id ?? null,
      },
      { onConflict: 'master_site_id,kpi_id,plan_date,shift_kind' },
    )
    setSaving(false)
    if (uErr) setError(uErr.message)
    else {
      setModal(null)
      onSaved()
    }
  }

  return (
    <div className="mt-1 border-t border-dashed border-border/70 pt-1">
      <p className="mb-0.5 text-[8px] font-semibold uppercase tracking-wide text-muted">Site consolidated</p>
      {error ? <p className="mb-1 text-[10px] text-rose-700 dark:text-rose-300">{error}</p> : null}
      <div className="flex flex-wrap gap-0.5">
        {kpis.map((kpi) => {
          const siteEntry = siteEntries[kpi.id]
          const cellVals = cellValuesByKpi.get(kpi.id) ?? []
          const resolved = resolveSiteDdsKpiValue({
            presentation: kpi.site_dds_presentation,
            scoring: kpi.scoring,
            siteValue: siteEntry?.value_numeric,
            cellValues: cellVals,
          })
          const tone = evaluateKpiBlock(resolved.value, kpi.scoring)
          const valueLabel =
            resolved.value != null && Number.isFinite(resolved.value)
              ? formatKpiValueWithUnit(resolved.value, kpi.unit)
              : '—'
          const targetLine = scoringTargetNumbersOnly(kpi.scoring)
          const cmt = siteEntry?.comment?.trim() ?? ''
          const breakdown = p2pBreakdownByKpi?.get(kpi.id) ?? []
          const showComment = kpiHasDdsCommentDetail(cmt, breakdown)
          const sub = resolved.fromRollup
            ? `${sitePresentationLabel(kpi.site_dds_presentation)} · ${cellVals.length} cell${cellVals.length === 1 ? '' : 's'}`
            : resolved.fromSiteEntry
              ? 'Site entry'
              : cellIds.length === 0
                ? 'Site entry'
                : 'No values'

          return (
            <div
              key={kpi.id}
              role="button"
              tabIndex={0}
              className={`flex min-w-[2.75rem] max-w-[5rem] cursor-pointer flex-col rounded-sm border px-1 py-px text-left outline-none ring-accent/30 focus-visible:ring-2 ${kpiBlockToneClasses(tone)}`}
              onClick={() =>
                setModal({
                  kpi,
                  valueStr:
                    siteEntry?.value_numeric != null && Number.isFinite(siteEntry.value_numeric)
                      ? String(siteEntry.value_numeric)
                      : resolved.value != null && Number.isFinite(resolved.value)
                        ? String(resolved.value)
                        : '',
                  comment: siteEntry?.comment ?? '',
                  entryId: siteEntry?.id ?? null,
                })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setModal({
                    kpi,
                    valueStr: '',
                    comment: siteEntry?.comment ?? '',
                    entryId: siteEntry?.id ?? null,
                  })
                }
              }}
            >
              <span className="line-clamp-2 text-[7px] font-medium leading-none text-fg/90">{kpi.label}</span>
              <span className="inline-flex items-center gap-0.5">
                <span className="text-[9px] font-semibold tabular-nums leading-none">{valueLabel}</span>
                {showComment ? (
                  <button
                    type="button"
                    className="inline-flex shrink-0 rounded p-0.5 text-muted hover:bg-black/[0.06] hover:text-fg dark:hover:bg-white/[0.06]"
                    aria-label={breakdown.length > 0 ? 'Show P2P role comments' : 'Show KPI comment'}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      const r = ev.currentTarget.getBoundingClientRect()
                      setDetail({ top: r.bottom + 4, left: r.left, text: cmt, breakdown })
                    }}
                  >
                    <MessageSquare className="size-3.5 shrink-0 text-accent" aria-hidden />
                  </button>
                ) : null}
              </span>
              {targetLine ? <span className="text-[6px] tabular-nums leading-none text-fg/55">{targetLine}</span> : null}
              <span className="mt-px line-clamp-1 text-[6px] leading-none text-fg/50">{sub}</span>
            </div>
          )
        })}
      </div>

      {detail ? (
        <div
          ref={detailRef}
          className="fixed z-[68] max-h-[min(50vh,20rem)] max-w-xs overflow-y-auto rounded-lg border border-border bg-surface px-2 py-1.5 text-[11px] shadow-lg"
          style={{ top: detail.top, left: detail.left }}
        >
          {detail.breakdown.length > 0 ? (
            <div className="mb-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">P2P by role</div>
              <ul className="space-y-1.5 leading-snug">
                {detail.breakdown.map((b, i) => (
                  <li key={`${b.roster_role_id}-${b.question_key}-${i}`}>
                    <span className="font-semibold">{b.role_name}</span>
                    {b.prompt ? <span className="text-muted"> · {b.prompt}</span> : null}
                    <span className="tabular-nums"> · {b.value}</span>
                    {b.comment ? <span> — {b.comment}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {detail.text ? (
            <div>
              {detail.breakdown.length > 0 ? (
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Comment</div>
              ) : null}
              {detail.text}
            </div>
          ) : null}
        </div>
      ) : null}

      {modal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-4 shadow-xl" role="dialog" aria-labelledby={titleId}>
            <h2 id={titleId} className="font-display text-lg font-semibold">
              {modal.kpi.label}
            </h2>
            <p className="mt-1 text-[11px] text-muted">
              Site-level value for this shift. Overrides auto rollup when saved. {scoringHint(modal.kpi.scoring)}
            </p>
            <label className="mt-3 block text-xs font-medium text-muted">
              Value
              <input
                type="text"
                inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm"
                value={modal.valueStr}
                onChange={(e) => setModal((m) => (m ? { ...m, valueStr: e.target.value } : m))}
              />
            </label>
            <label className="mt-2 block text-xs font-medium text-muted">
              Comment
              <textarea
                className="mt-1 min-h-[4rem] w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm"
                value={modal.comment}
                onChange={(e) => setModal((m) => (m ? { ...m, comment: e.target.value } : m))}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-xl px-3 py-2 text-sm text-muted" disabled={saving} onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={saving}
                onClick={() => void saveModal()}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save site value'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
