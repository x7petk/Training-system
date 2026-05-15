import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { DdsKpiScoring } from './ddsKpiScoring'
import { evaluateKpiBlock, parseDdsKpiScoring, scoringHint, scoringTargetNumbersOnly } from './ddsKpiScoring'
import type { DdsKpiUnit } from './ddsKpiUnits'
import { DDS_KPI_UNIT_OPTIONS, formatKpiValueWithUnit, parseDdsKpiUnit } from './ddsKpiUnits'

type KpiGroup = { id: string; name: string; sort_order: number }

type KpiDef = {
  id: string
  kpi_group_id: string
  label: string
  sort_order: number
  unit: DdsKpiUnit
  scoring: DdsKpiScoring
}

type EntryRow = {
  id: string
  kpi_id: string
  value_numeric: number | null
  comment: string | null
}

type Props = {
  cellId: string
  planDate: string
  shiftKind: string
}

function blockClasses(tone: 'neutral' | 'good' | 'bad'): string {
  if (tone === 'good') return 'border-emerald-600/50 bg-emerald-600/15 text-emerald-950 dark:bg-emerald-900/35 dark:text-emerald-50'
  if (tone === 'bad') return 'border-rose-600/50 bg-rose-600/15 text-rose-950 dark:bg-rose-900/35 dark:text-rose-50'
  return 'border-sky-600/45 bg-sky-600/12 text-sky-950 dark:bg-sky-900/35 dark:text-sky-50'
}

export function ShiftDdsKpiSummary({ cellId, planDate, shiftKind }: Props) {
  const { user } = useAuth()
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
  } | null>(null)
  const [saving, setSaving] = useState(false)

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
    const [gRes, kRes, eRes] = await Promise.all([
      supabase.from('dds_kpi_groups').select('id, name, sort_order').order('sort_order').order('name'),
      supabase
        .from('dds_kpis')
        .select('id, kpi_group_id, label, sort_order, unit, display_sections, scoring')
        .contains('display_sections', ['shift-dds'])
        .order('sort_order')
        .order('label'),
      supabase
        .from('dds_kpi_cell_entries')
        .select('id, kpi_id, value_numeric, comment')
        .eq('master_cell_id', cellId)
        .eq('plan_date', planDate)
        .eq('shift_kind', shiftKind),
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
    setGroups((gRes.data ?? []) as KpiGroup[])
    const kRows = (kRes.data ?? []) as {
      id: string
      kpi_group_id: string
      label: string
      sort_order: number
      unit: string | null
      scoring: unknown
    }[]
    setKpis(
      kRows.map((r) => ({
        id: r.id,
        kpi_group_id: r.kpi_group_id,
        label: r.label,
        sort_order: r.sort_order,
        unit: parseDdsKpiUnit(r.unit),
        scoring: parseDdsKpiScoring(r.scoring),
      })),
    )
    const em: Record<string, EntryRow> = {}
    for (const row of eRes.data ?? []) {
      const r = row as EntryRow & { kpi_id: string }
      em[r.kpi_id] = { id: r.id, kpi_id: r.kpi_id, value_numeric: r.value_numeric, comment: r.comment }
    }
    setEntries(em)
  }, [cellId, planDate, shiftKind])

  useEffect(() => {
    void load()
  }, [load])

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

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [groups],
  )

  function openModal(kpi: KpiDef) {
    const e = entries[kpi.id]
    const v = e?.value_numeric
    setModal({
      kpi,
      valueStr: v != null && Number.isFinite(v) ? String(v) : '',
      comment: e?.comment ?? '',
      entryId: e?.id ?? null,
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
    return (
      <p className="text-[11px] leading-snug text-muted">
        No KPIs are assigned to <strong className="text-fg/80">Shift DDS</strong> yet. In{' '}
        <strong className="text-fg/80">Admin → KPIs</strong>, tick &quot;Shift DDS&quot; (and set scoring) for each metric you want here.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {sortedGroups.map((g) => {
        const list = kpisByGroup.get(g.id) ?? []
        if (list.length === 0) return null
        return (
          <div key={g.id}>
            <h3 className="mb-1.5 border-b border-border/60 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">{g.name}</h3>
            <div className="flex flex-wrap gap-1.5">
              {list.map((kpi) => {
                const e = entries[kpi.id]
                const val = e?.value_numeric ?? null
                const tone = evaluateKpiBlock(val, kpi.scoring)
                const targetLine = scoringTargetNumbersOnly(kpi.scoring)
                const valueLabel =
                  val != null && Number.isFinite(val) ? formatKpiValueWithUnit(val, kpi.unit) : '—'
                return (
                  <button
                    key={kpi.id}
                    type="button"
                    onClick={() => openModal(kpi)}
                    className={`flex min-w-[4.75rem] max-w-[7.5rem] flex-col rounded-md border px-1.5 py-1 text-left shadow-sm transition hover:brightness-[1.02] ${blockClasses(tone)}`}
                  >
                    <span className="text-[9px] font-medium leading-tight text-fg/90 line-clamp-2">{kpi.label}</span>
                    <span className="mt-0.5 text-sm font-semibold tabular-nums leading-none text-fg">{valueLabel}</span>
                    {targetLine ? (
                      <span className="mt-0.5 text-[8px] font-medium tabular-nums leading-none text-fg/60">{targetLine}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {modal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div
            className="w-full max-w-md rounded-2xl border border-border-strong bg-surface p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shift-dds-kpi-edit-title"
          >
            <h2 id="shift-dds-kpi-edit-title" className="font-display text-lg font-semibold">
              {modal.kpi.label}
            </h2>
            <p className="mt-1 text-[11px] text-muted">
              Manual value for this cell, date, and shift. {scoringHint(modal.kpi.scoring)}
            </p>
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
}
