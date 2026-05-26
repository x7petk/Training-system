import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { DdsKpiScoring } from './ddsKpiScoring'
import { evaluateKpiBlock, kpiBlockToneClasses, scoringHint, scoringTargetNumbersOnly } from './ddsKpiScoring'
import type { DdsKpiUnit } from './ddsKpiUnits'
import { DDS_KPI_UNIT_OPTIONS, formatKpiValueWithUnit, parseDdsKpiUnit } from './ddsKpiUnits'
import { DdsKpiValueField } from './DdsKpiValueField'
import { parseDdsKpiScoring } from './ddsKpiScoring'
import {
  DDS_COMPLIANCE_DAY_SHIFT_KIND,
  formatShortYmd,
  last7DaysEndingYmd,
  type ComplianceKpiViewMode,
} from './ddsComplianceConstants'
import {
  DDS_KPI_METRIC_SURFACE_OPTIONS,
  kpiShowsOnMetricSurface,
  type DdsKpiMetricSurfaceKey,
} from './ddsKpiMetricSurfaces'

type KpiGroup = { id: string; name: string; sort_order: number }

type KpiDef = {
  id: string
  kpi_group_id: string
  label: string
  sort_order: number
  unit: DdsKpiUnit
  scoring: DdsKpiScoring
  display_sections: string[] | null
}

type EntryRow = {
  id: string
  kpi_id: string
  plan_date: string
  value_numeric: number | null
  comment: string | null
}

type Props = {
  cellId: string
  planDate: string
  viewMode: ComplianceKpiViewMode
  metricSurface: Extract<DdsKpiMetricSurfaceKey, 'line-compliance' | 'site-compliance'>
}

const inputClass =
  'w-full min-w-0 rounded-md border border-border bg-canvas/60 px-2 py-1 text-xs tabular-nums outline-none ring-accent/40 focus:border-accent/50 focus:ring-2'

export function ComplianceKpiPanel({ cellId, planDate, viewMode, metricSurface }: Props) {
  const { user } = useAuth()
  const kpiEditTitleId = useId()
  const surfaceLabel = DDS_KPI_METRIC_SURFACE_OPTIONS.find((o) => o.key === metricSurface)?.label ?? metricSurface

  const dateKeys = useMemo(
    () => (viewMode === 'day' ? [planDate] : last7DaysEndingYmd(planDate)),
    [viewMode, planDate],
  )

  const [groups, setGroups] = useState<KpiGroup[]>([])
  const [kpis, setKpis] = useState<KpiDef[]>([])
  const [entries, setEntries] = useState<Record<string, EntryRow>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState<{
    kpi: KpiDef
    planDate: string
    valueStr: string
    comment: string
    entryId: string | null
  } | null>(null)
  const [tableDraft, setTableDraft] = useState<Record<string, Record<string, string>>>({})

  const entryKey = (kpiId: string, ymd: string) => `${kpiId}:${ymd}`

  const load = useCallback(async () => {
    if (!cellId || !planDate) {
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
        .order('sort_order')
        .order('label'),
      supabase
        .from('dds_kpi_cell_entries')
        .select('id, kpi_id, plan_date, value_numeric, comment')
        .eq('master_cell_id', cellId)
        .eq('shift_kind', DDS_COMPLIANCE_DAY_SHIFT_KIND)
        .in('plan_date', dateKeys),
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
    const kRows = ((kRes.data ?? []) as {
      id: string
      kpi_group_id: string
      label: string
      sort_order: number
      unit: string | null
      display_sections: string[] | null
      scoring: unknown
    }[]).filter((r) => kpiShowsOnMetricSurface({ display_sections: r.display_sections }, metricSurface))
    setKpis(
      kRows.map((r) => ({
        id: r.id,
        kpi_group_id: r.kpi_group_id,
        label: r.label,
        sort_order: r.sort_order,
        display_sections: r.display_sections,
        unit: parseDdsKpiUnit(r.unit),
        scoring: parseDdsKpiScoring(r.scoring),
      })),
    )
    const em: Record<string, EntryRow> = {}
    for (const row of eRes.data ?? []) {
      const r = row as EntryRow
      em[entryKey(r.kpi_id, r.plan_date)] = r
    }
    setEntries(em)
  }, [cellId, planDate, dateKeys, metricSurface])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const draft: Record<string, Record<string, string>> = {}
    for (const kpi of kpis) {
      const row: Record<string, string> = {}
      for (const ymd of dateKeys) {
        const e = entries[entryKey(kpi.id, ymd)]
        const v = e?.value_numeric
        row[ymd] = v != null && Number.isFinite(v) ? String(v) : ''
      }
      draft[kpi.id] = row
    }
    setTableDraft(draft)
  }, [kpis, entries, dateKeys])

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

  async function saveEntry(kpi: KpiDef, ymd: string, valueStr: string, comment: string) {
    const n = Number(String(valueStr).trim().replace(',', '.'))
    const value_numeric = String(valueStr).trim() === '' || !Number.isFinite(n) ? null : n
    setSaving(true)
    setError(null)
    const { error: uErr } = await supabase.from('dds_kpi_cell_entries').upsert(
      {
        master_cell_id: cellId,
        kpi_id: kpi.id,
        plan_date: ymd,
        shift_kind: DDS_COMPLIANCE_DAY_SHIFT_KIND,
        value_numeric,
        comment: comment.trim() || null,
        p2p_breakdown: null,
        updated_by: user?.id ?? null,
      },
      { onConflict: 'master_cell_id,kpi_id,plan_date,shift_kind' },
    )
    setSaving(false)
    if (uErr) {
      setError(uErr.message)
      return false
    }
    await load()
    return true
  }

  async function saveModal() {
    if (!modal) return
    const ok = await saveEntry(modal.kpi, modal.planDate, modal.valueStr, modal.comment)
    if (ok) setModal(null)
  }

  async function saveTableRow(kpi: KpiDef) {
    const row = tableDraft[kpi.id]
    if (!row) return
    setSaving(true)
    setError(null)
    for (const ymd of dateKeys) {
      const prev = entries[entryKey(kpi.id, ymd)]
      const nextStr = row[ymd] ?? ''
      const prevStr =
        prev?.value_numeric != null && Number.isFinite(prev.value_numeric) ? String(prev.value_numeric) : ''
      if (nextStr.trim() === prevStr.trim()) continue
      const ok = await saveEntry(kpi, ymd, nextStr, prev?.comment ?? '')
      if (!ok) {
        setSaving(false)
        return
      }
    }
    setSaving(false)
  }

  function openModal(kpi: KpiDef, ymd: string) {
    const e = entries[entryKey(kpi.id, ymd)]
    const v = e?.value_numeric
    setModal({
      kpi,
      planDate: ymd,
      valueStr: v != null && Number.isFinite(v) ? String(v) : '',
      comment: e?.comment ?? '',
      entryId: e?.id ?? null,
    })
  }

  function renderTile(kpi: KpiDef, ymd: string, compact?: boolean) {
    const e = entries[entryKey(kpi.id, ymd)]
    const val = e?.value_numeric ?? null
    const tone = evaluateKpiBlock(val, kpi.scoring)
    const targetLine = scoringTargetNumbersOnly(kpi.scoring)
    const valueLabel = val != null && Number.isFinite(val) ? formatKpiValueWithUnit(val, kpi.unit) : '—'
    return (
      <div
        key={`${kpi.id}-${ymd}`}
        role="button"
        tabIndex={0}
        className={`flex cursor-pointer flex-col rounded-sm border text-left outline-none ring-accent/30 transition hover:brightness-[1.02] focus-visible:ring-2 ${
          compact ? 'min-w-[2.75rem] max-w-[5rem] px-1 py-0.5' : 'min-w-[3.5rem] max-w-[6.5rem] px-1 py-0.5'
        } ${kpiBlockToneClasses(tone)}`}
        aria-label={`${kpi.label}, ${formatShortYmd(ymd)}, edit`}
        onClick={() => openModal(kpi, ymd)}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault()
            openModal(kpi, ymd)
          }
        }}
      >
        {viewMode === 'week' ? (
          <span className="text-[8px] font-medium text-fg/65">{formatShortYmd(ymd)}</span>
        ) : null}
        <span className={`inline-flex min-w-0 flex-wrap items-baseline gap-x-0.5 ${compact ? 'text-[8px]' : 'text-[8px]'}`}>
          <span className="font-medium leading-tight text-fg/90">{kpi.label}</span>
          {targetLine ? (
            <span className="shrink-0 text-[7px] font-medium tabular-nums leading-none text-fg/60">{targetLine}</span>
          ) : null}
        </span>
        <span className={`font-semibold tabular-nums leading-none text-fg ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
          {valueLabel}
        </span>
      </div>
    )
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
        No KPIs are assigned to <strong className="text-fg/80">{surfaceLabel}</strong> yet. Tick{' '}
        <strong className="text-fg/80">{surfaceLabel}</strong> under <strong className="text-fg/80">Admin → KPIs</strong>{' '}
        → Show on screens.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {sortedGroups.map((g) => {
        const list = kpisByGroup.get(g.id) ?? []
        if (list.length === 0) return null

        if (viewMode === 'table') {
          return (
            <div key={g.id} className="overflow-x-auto">
              <h3 className="mb-1 border-b border-border/60 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {g.name}
              </h3>
              <table className="w-full min-w-[28rem] border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-border/60 text-muted">
                    <th className="sticky left-0 z-[1] min-w-[8rem] bg-surface py-1 pr-2 font-semibold">KPI</th>
                    {dateKeys.map((ymd) => (
                      <th key={ymd} className="min-w-[4.5rem] px-1 py-1 text-center font-semibold">
                        {formatShortYmd(ymd)}
                      </th>
                    ))}
                    <th className="w-16 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((kpi) => (
                    <tr key={kpi.id} className="border-b border-border/40">
                      <td className="sticky left-0 z-[1] bg-surface py-1 pr-2 font-medium text-fg">{kpi.label}</td>
                      {dateKeys.map((ymd) => (
                        <td key={ymd} className="px-1 py-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            className={inputClass}
                            value={tableDraft[kpi.id]?.[ymd] ?? ''}
                            onChange={(e) =>
                              setTableDraft((d) => ({
                                ...d,
                                [kpi.id]: { ...(d[kpi.id] ?? {}), [ymd]: e.target.value },
                              }))
                            }
                            aria-label={`${kpi.label} ${ymd}`}
                          />
                        </td>
                      ))}
                      <td className="py-1 pl-1">
                        <button
                          type="button"
                          className="rounded-md border border-border/80 bg-surface px-2 py-0.5 text-[10px] font-semibold hover:bg-surface-raised/80 disabled:opacity-45"
                          disabled={saving || !user}
                          onClick={() => void saveTableRow(kpi)}
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        return (
          <div key={g.id}>
            <h3 className="mb-1.5 border-b border-border/60 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {g.name}
            </h3>
            {viewMode === 'week' ? (
              <div className="space-y-2">
                {list.map((kpi) => {
                  const targetLine = scoringTargetNumbersOnly(kpi.scoring)
                  return (
                  <div key={kpi.id}>
                    <div className="mb-0.5 inline-flex flex-wrap items-baseline gap-x-1 text-[10px] font-medium text-fg">
                      <span>{kpi.label}</span>
                      {targetLine ? (
                        <span className="text-[8px] tabular-nums text-fg/60">{targetLine}</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1">{dateKeys.map((ymd) => renderTile(kpi, ymd, true))}</div>
                  </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">{list.map((kpi) => renderTile(kpi, planDate))}</div>
            )}
          </div>
        )
      })}

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
              {formatShortYmd(modal.planDate)} · 24h day. {scoringHint(modal.kpi.scoring)}
            </p>
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
