import { useId, useLayoutEffect, useRef, useState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { DdsKpiScoring } from './ddsKpiScoring'
import { evaluateKpiBlock, scoringHint, scoringTargetNumbersOnly } from './ddsKpiScoring'
import type { DdsKpiUnit } from './ddsKpiUnits'
import { formatKpiValueWithUnit } from './ddsKpiUnits'
import {
  resolveSiteDdsKpiValue,
  sitePresentationLabel,
  type DdsKpiSitePresentationMode,
} from './ddsKpiSitePresentation'

export type ConsolidatedKpiDef = {
  id: string
  label: string
  sort_order: number
  unit: DdsKpiUnit
  scoring: DdsKpiScoring
  site_dds_presentation: DdsKpiSitePresentationMode
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
  siteEntries: Record<string, SiteEntryRow>
  planDate: string
  shiftKind: string
  onSaved: () => void
}

function blockClasses(tone: 'neutral' | 'good' | 'bad'): string {
  if (tone === 'good') return 'border-emerald-600/50 bg-emerald-600/15 text-emerald-950 dark:bg-emerald-900/35 dark:text-emerald-50'
  if (tone === 'bad') return 'border-rose-600/50 bg-rose-600/15 text-rose-950 dark:bg-rose-900/35 dark:text-rose-50'
  return 'border-sky-600/45 bg-sky-600/12 text-sky-950 dark:bg-sky-900/35 dark:text-sky-50'
}

export function SiteDdsConsolidatedKpiStrip({
  siteId,
  cellIds,
  kpis,
  cellValuesByKpi,
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
  const [detail, setDetail] = useState<{ top: number; left: number; text: string } | null>(null)
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
              className={`flex min-w-[3rem] max-w-[5.5rem] cursor-pointer flex-col rounded-md border px-1 py-0.5 text-left shadow-sm outline-none ring-accent/30 focus-visible:ring-2 ${blockClasses(tone)}`}
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
              <span className="line-clamp-2 text-[8px] font-medium leading-tight text-fg/90">{kpi.label}</span>
              <span className="text-[10px] font-semibold tabular-nums leading-none">{valueLabel}</span>
              {targetLine ? <span className="text-[7px] tabular-nums text-fg/55">{targetLine}</span> : null}
              <span className="mt-px line-clamp-1 text-[7px] text-fg/50">{sub}</span>
              {cmt ? (
                <button
                  type="button"
                  className="mt-px self-end text-muted"
                  aria-label="Comment"
                  onClick={(ev) => {
                    ev.stopPropagation()
                    const r = ev.currentTarget.getBoundingClientRect()
                    setDetail({ top: r.bottom + 4, left: r.left, text: cmt })
                  }}
                >
                  <MessageSquare className="size-2.5 text-accent" />
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      {detail ? (
        <div
          ref={detailRef}
          className="fixed z-[68] max-w-xs rounded-lg border border-border bg-surface px-2 py-1.5 text-[11px] shadow-lg"
          style={{ top: detail.top, left: detail.left }}
        >
          {detail.text}
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
