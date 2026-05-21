import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { ComplianceKpiPanel } from './ComplianceKpiPanel'
import {
  DDS_COMPLIANCE_DAY_SHIFT_KIND,
  formatShortYmd,
  last7DaysEndingYmd,
  type ComplianceKpiViewMode,
} from './ddsComplianceConstants'
import { kpiShowsOnMetricSurface } from './ddsKpiMetricSurfaces'
import { parseDdsKpiMetricScope } from './ddsKpiDdsSetupSurfaces'
import { evaluateKpiBlock, scoringHint, scoringTargetNumbersOnly } from './ddsKpiScoring'
import { formatKpiValueWithUnit, parseDdsKpiUnit } from './ddsKpiUnits'
import { parseDdsKpiScoring } from './ddsKpiScoring'
import type { DdsKpiScoring } from './ddsKpiScoring'
import type { DdsKpiUnit } from './ddsKpiUnits'
type CellLite = { id: string; name: string }

type KpiGroup = { id: string; name: string; sort_order: number }

type SiteKpiDef = {
  id: string
  kpi_group_id: string
  label: string
  sort_order: number
  unit: DdsKpiUnit
  scoring: DdsKpiScoring
}

type SiteEntryRow = {
  id: string
  kpi_id: string
  plan_date: string
  value_numeric: number | null
  comment: string | null
}

type Props = {
  siteId: string
  cells: CellLite[]
  planDate: string
  viewMode: ComplianceKpiViewMode
}

function blockClasses(tone: 'neutral' | 'good' | 'bad'): string {
  if (tone === 'good') return 'border-emerald-600/50 bg-emerald-600/15 text-emerald-950 dark:bg-emerald-900/35 dark:text-emerald-50'
  if (tone === 'bad') return 'border-rose-600/50 bg-rose-600/15 text-rose-950 dark:bg-rose-900/35 dark:text-rose-50'
  return 'border-sky-600/45 bg-sky-600/12 text-sky-950 dark:bg-sky-900/35 dark:text-sky-50'
}

const inputClass =
  'w-full min-w-0 rounded-md border border-border bg-canvas/60 px-2 py-1 text-xs tabular-nums outline-none ring-accent/40 focus:border-accent/50 focus:ring-2'

export function SiteComplianceKpiPanel({ siteId, cells, planDate, viewMode }: Props) {
  const { user } = useAuth()
  const titleId = useId()
  const dateKeys = useMemo(
    () => (viewMode === 'day' ? [planDate] : last7DaysEndingYmd(planDate)),
    [viewMode, planDate],
  )

  const [groups, setGroups] = useState<KpiGroup[]>([])
  const [siteKpis, setSiteKpis] = useState<SiteKpiDef[]>([])
  const [hasCellKpis, setHasCellKpis] = useState(false)
  const [entries, setEntries] = useState<Record<string, SiteEntryRow>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState<{
    kpi: SiteKpiDef
    planDate: string
    valueStr: string
    comment: string
    entryId: string | null
  } | null>(null)
  const [tableDraft, setTableDraft] = useState<Record<string, Record<string, string>>>({})

  const entryKey = (kpiId: string, ymd: string) => `${kpiId}:${ymd}`

  const load = useCallback(async () => {
    if (!siteId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const [gRes, kRes, eRes] = await Promise.all([
      supabase.from('dds_kpi_groups').select('id, name, sort_order').order('sort_order').order('name'),
      supabase
        .from('dds_kpis')
        .select('id, kpi_group_id, label, sort_order, unit, display_sections, scoring, metric_scope')
        .order('sort_order')
        .order('label'),
      supabase
        .from('dds_kpi_site_entries')
        .select('id, kpi_id, plan_date, value_numeric, comment')
        .eq('master_site_id', siteId)
        .eq('shift_kind', DDS_COMPLIANCE_DAY_SHIFT_KIND)
        .in('plan_date', dateKeys),
    ])
    setLoading(false)
    if (gRes.error || kRes.error || eRes.error) {
      setError(gRes.error?.message ?? kRes.error?.message ?? eRes.error?.message ?? 'Load failed')
      return
    }
    setGroups((gRes.data ?? []) as KpiGroup[])
    const rows = (kRes.data ?? []) as {
      id: string
      kpi_group_id: string
      label: string
      sort_order: number
      unit: string | null
      display_sections: string[] | null
      scoring: unknown
      metric_scope: string | null
    }[]
    const onSite = rows.filter(
      (r) =>
        kpiShowsOnMetricSurface({ display_sections: r.display_sections }, 'site-compliance') &&
        parseDdsKpiMetricScope(r.metric_scope) === 'site',
    )
    const cellTagged = rows.some(
      (r) =>
        kpiShowsOnMetricSurface({ display_sections: r.display_sections }, 'site-compliance') &&
        parseDdsKpiMetricScope(r.metric_scope) !== 'site',
    )
    setHasCellKpis(cellTagged)
    setSiteKpis(
      onSite.map((r) => ({
        id: r.id,
        kpi_group_id: r.kpi_group_id,
        label: r.label,
        sort_order: r.sort_order,
        unit: parseDdsKpiUnit(r.unit),
        scoring: parseDdsKpiScoring(r.scoring),
      })),
    )
    const em: Record<string, SiteEntryRow> = {}
    for (const row of eRes.data ?? []) {
      const r = row as SiteEntryRow
      em[entryKey(r.kpi_id, r.plan_date)] = r
    }
    setEntries(em)
  }, [siteId, dateKeys])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const draft: Record<string, Record<string, string>> = {}
    for (const kpi of siteKpis) {
      const row: Record<string, string> = {}
      for (const ymd of dateKeys) {
        const e = entries[entryKey(kpi.id, ymd)]
        const v = e?.value_numeric
        row[ymd] = v != null && Number.isFinite(v) ? String(v) : ''
      }
      draft[kpi.id] = row
    }
    setTableDraft(draft)
  }, [siteKpis, entries, dateKeys])

  const siteKpisByGroup = useMemo(() => {
    const m = new Map<string, SiteKpiDef[]>()
    for (const k of siteKpis) {
      if (!m.has(k.kpi_group_id)) m.set(k.kpi_group_id, [])
      m.get(k.kpi_group_id)!.push(k)
    }
    for (const [, list] of m) {
      list.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
    }
    return m
  }, [siteKpis])

  const sortedGroups = useMemo(() => {
    const sorted = [...groups].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    return sorted.filter((g) => (siteKpisByGroup.get(g.id) ?? []).length > 0)
  }, [groups, siteKpisByGroup])

  async function saveSiteEntry(kpi: SiteKpiDef, ymd: string, valueStr: string, comment: string) {
    const n = Number(String(valueStr).trim().replace(',', '.'))
    const value_numeric = String(valueStr).trim() === '' || !Number.isFinite(n) ? null : n
    setSaving(true)
    const { error: uErr } = await supabase.from('dds_kpi_site_entries').upsert(
      {
        master_site_id: siteId,
        kpi_id: kpi.id,
        plan_date: ymd,
        shift_kind: DDS_COMPLIANCE_DAY_SHIFT_KIND,
        value_numeric,
        comment: comment.trim() || null,
        updated_by: user?.id ?? null,
      },
      { onConflict: 'master_site_id,kpi_id,plan_date,shift_kind' },
    )
    setSaving(false)
    if (uErr) {
      setError(uErr.message)
      return false
    }
    await load()
    return true
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

  const emptySite = siteKpis.length === 0 && !hasCellKpis
  if (emptySite) {
    return (
      <p className="text-[11px] leading-snug text-muted">
        No KPIs are assigned to <strong className="text-fg/80">Site compliance</strong> yet. Tick it under{' '}
        <strong className="text-fg/80">Admin → KPIs</strong> → Show on screens.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {sortedGroups.map((g) => {
        const list = siteKpisByGroup.get(g.id) ?? []
        if (list.length === 0) return null
        return (
          <section key={g.id}>
            <h3 className="mb-1 border-b border-border/60 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {g.name} · Site
            </h3>
            {viewMode === 'table' ? (
              <table className="mb-2 w-full min-w-[28rem] border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-border/60 text-muted">
                    <th className="py-1 pr-2 font-semibold">KPI</th>
                    {dateKeys.map((ymd) => (
                      <th key={ymd} className="min-w-[4.5rem] px-1 py-1 text-center font-semibold">
                        {formatShortYmd(ymd)}
                      </th>
                    ))}
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((kpi) => (
                    <tr key={kpi.id} className="border-b border-border/40">
                      <td className="py-1 pr-2 font-medium">{kpi.label}</td>
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
                          />
                        </td>
                      ))}
                      <td className="py-1">
                        <button
                          type="button"
                          className="rounded-md border border-border/80 px-2 py-0.5 text-[10px] font-semibold disabled:opacity-45"
                          disabled={saving || !user}
                          onClick={async () => {
                            const row = tableDraft[kpi.id]
                            if (!row) return
                            for (const ymd of dateKeys) {
                              const prev = entries[entryKey(kpi.id, ymd)]
                              const nextStr = row[ymd] ?? ''
                              const prevStr =
                                prev?.value_numeric != null && Number.isFinite(prev.value_numeric)
                                  ? String(prev.value_numeric)
                                  : ''
                              if (nextStr.trim() === prevStr.trim()) continue
                              const ok = await saveSiteEntry(kpi, ymd, nextStr, prev?.comment ?? '')
                              if (!ok) return
                            }
                          }}
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : viewMode === 'week' ? (
              <div className="space-y-2">
                {list.map((kpi) => (
                  <div key={kpi.id}>
                    <div className="mb-0.5 text-[10px] font-medium">{kpi.label}</div>
                    <div className="flex flex-wrap gap-1">
                      {dateKeys.map((ymd) => {
                        const e = entries[entryKey(kpi.id, ymd)]
                        const val = e?.value_numeric ?? null
                        const tone = evaluateKpiBlock(val, kpi.scoring)
                        const valueLabel =
                          val != null && Number.isFinite(val) ? formatKpiValueWithUnit(val, kpi.unit) : '—'
                        return (
                          <button
                            key={ymd}
                            type="button"
                            className={`flex min-w-[3rem] max-w-[5.5rem] flex-col rounded-md border px-1.5 py-1 text-left ${blockClasses(tone)}`}
                            onClick={() =>
                              setModal({
                                kpi,
                                planDate: ymd,
                                valueStr: val != null && Number.isFinite(val) ? String(val) : '',
                                comment: e?.comment ?? '',
                                entryId: e?.id ?? null,
                              })
                            }
                          >
                            <span className="text-[8px] text-fg/65">{formatShortYmd(ymd)}</span>
                            <span className="text-[10px] font-semibold tabular-nums">{valueLabel}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {list.map((kpi) => {
                  const e = entries[entryKey(kpi.id, planDate)]
                  const val = e?.value_numeric ?? null
                  const tone = evaluateKpiBlock(val, kpi.scoring)
                  const valueLabel =
                    val != null && Number.isFinite(val) ? formatKpiValueWithUnit(val, kpi.unit) : '—'
                  return (
                    <button
                      key={kpi.id}
                      type="button"
                      className={`flex min-w-[4.75rem] max-w-[8rem] flex-col rounded-md border px-1.5 py-1 text-left ${blockClasses(tone)}`}
                      onClick={() =>
                        setModal({
                          kpi,
                          planDate,
                          valueStr: val != null && Number.isFinite(val) ? String(val) : '',
                          comment: e?.comment ?? '',
                          entryId: e?.id ?? null,
                        })
                      }
                    >
                      <span className="text-[9px] font-medium line-clamp-2">{kpi.label}</span>
                      <span className="text-sm font-semibold tabular-nums">{valueLabel}</span>
                      {scoringTargetNumbersOnly(kpi.scoring) ? (
                        <span className="text-[8px] text-fg/60">{scoringTargetNumbersOnly(kpi.scoring)}</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}

      {hasCellKpis && cells.length > 0 ? (
        <section>
          <h3 className="mb-2 border-b border-border/60 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            By cell
          </h3>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {cells.map((cell) => (
              <div key={cell.id} className="rounded border border-border/50 bg-canvas/15 p-2">
                <h4 className="mb-1 truncate text-[10px] font-semibold uppercase text-muted">{cell.name}</h4>
                <ComplianceKpiPanel
                  cellId={cell.id}
                  planDate={planDate}
                  viewMode={viewMode}
                  metricSurface="site-compliance"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {modal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div
            className="w-full max-w-md rounded-2xl border border-border-strong bg-surface p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <h2 id={titleId} className="font-display text-lg font-semibold">
              {modal.kpi.label}
            </h2>
            <p className="mt-1 text-[11px] text-muted">
              {formatShortYmd(modal.planDate)} · Site · 24h day. {scoringHint(modal.kpi.scoring)}
            </p>
            <label className="mt-4 block text-xs font-medium text-muted">
              Value
              <input
                type="text"
                inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm"
                value={modal.valueStr}
                onChange={(e) => setModal((m) => (m ? { ...m, valueStr: e.target.value } : m))}
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-muted">
              Comment
              <textarea
                className="mt-1 min-h-[4.5rem] w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm"
                value={modal.comment}
                onChange={(e) => setModal((m) => (m ? { ...m, comment: e.target.value } : m))}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-xl px-3 py-2 text-sm text-muted" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={saving}
                onClick={() => void saveSiteEntry(modal.kpi, modal.planDate, modal.valueStr, modal.comment).then((ok) => ok && setModal(null))}
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
