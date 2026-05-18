import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import {
  ddsBtn,
  ddsBtnDanger,
  ddsErr,
  ddsH2,
  ddsHint,
  ddsInput,
  ddsInset,
  ddsSection,
  ddsSelect,
  ddsStack,
} from '../features/dds/ddsAdminCompactClasses'
import {
  parseWdsAggregation,
  parseWdsGlidepathMode,
  WDS_AGGREGATION_OPTIONS,
  WDS_GLIDEPATH_MODE_OPTIONS,
  type WdsTrendDefRow,
} from '../features/dds/ddsWds'

type KpiOption = { id: string; label: string; scoring: unknown; metric_scope: string; display_sections: string[] | null }

type TrendDraft = {
  id: string
  kpi_id: string
  label: string
  aggregation: string
  glidepath_mode: string
  target_flat: string
  target_start: string
  target_end: string
  target_weekly: string[]
  sort_order: number
  is_active: boolean
}

function numOrNull(s: string): number | null {
  const v = Number(s.trim().replace(',', '.'))
  return Number.isFinite(v) ? v : null
}

function parseWeekly(raw: unknown): string[] {
  const out = Array.from({ length: 14 }, () => '')
  if (!Array.isArray(raw)) return out
  for (let i = 0; i < 14; i += 1) {
    const v = raw[i]
    if (typeof v === 'number' && Number.isFinite(v)) out[i] = String(v)
  }
  return out
}

function fromRow(r: WdsTrendDefRow): TrendDraft {
  return {
    id: r.id,
    kpi_id: r.kpi_id,
    label: r.label,
    aggregation: parseWdsAggregation(r.aggregation),
    glidepath_mode: parseWdsGlidepathMode(r.glidepath_mode),
    target_flat: r.target_flat == null ? '' : String(r.target_flat),
    target_start: r.target_start == null ? '' : String(r.target_start),
    target_end: r.target_end == null ? '' : String(r.target_end),
    target_weekly: parseWeekly(r.target_weekly),
    sort_order: r.sort_order,
    is_active: r.is_active,
  }
}

export function DdsAdminWdsKpisPage() {
  const { status, cellId } = usePlan24Workspace()
  const [kpis, setKpis] = useState<KpiOption[]>([])
  const [drafts, setDrafts] = useState<TrendDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const kpiById = useMemo(() => {
    const m = new Map<string, KpiOption>()
    for (const k of kpis) m.set(k.id, k)
    return m
  }, [kpis])

  const load = useCallback(async () => {
    if (!cellId) {
      setKpis([])
      setDrafts([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const [kRes, tRes] = await Promise.all([
      supabase
        .from('dds_kpis')
        .select('id, label, scoring, metric_scope, display_sections')
        .eq('metric_scope', 'cell')
        .order('label'),
      supabase
        .from('dds_wds_trends')
        .select(
          'id, master_cell_id, kpi_id, label, aggregation, glidepath_mode, target_flat, target_start, target_end, target_weekly, sort_order, is_active',
        )
        .eq('master_cell_id', cellId)
        .order('sort_order')
        .order('created_at'),
    ])
    setLoading(false)
    if (kRes.error || tRes.error) {
      setError(kRes.error?.message ?? tRes.error?.message ?? 'Load failed')
      return
    }
    const allKpis = (kRes.data ?? []) as KpiOption[]
    setKpis(allKpis)
    setDrafts(((tRes.data ?? []) as WdsTrendDefRow[]).map(fromRow))
  }, [cellId])

  useEffect(() => {
    void load()
  }, [load])

  function addTrend() {
    const firstKpi = kpis[0]
    if (!firstKpi) {
      setError('Add at least one KPI with WDS display section first (Admin > KPIs).')
      return
    }
    setError(null)
    setDrafts((prev) => [
      ...prev,
      {
        id: `new-${crypto.randomUUID()}`,
        kpi_id: firstKpi.id,
        label: `${firstKpi.label} trend`,
        aggregation: 'sum',
        glidepath_mode: 'flat',
        target_flat: '',
        target_start: '',
        target_end: '',
        target_weekly: Array.from({ length: 14 }, () => ''),
        sort_order: prev.length,
        is_active: true,
      },
    ])
  }

  async function removeTrend(id: string) {
    if (!cellId) return
    if (!id.startsWith('new-')) {
      const { error: delErr } = await supabase.from('dds_wds_trends').delete().eq('id', id).eq('master_cell_id', cellId)
      if (delErr) {
        setError(delErr.message)
        return
      }
    }
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }

  async function save() {
    if (!cellId) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    for (let i = 0; i < drafts.length; i += 1) {
      const d = drafts[i]!
      const label = d.label.trim()
      if (!label) {
        setSaving(false)
        setError(`Trend ${i + 1} needs a name.`)
        return
      }
      if (!d.kpi_id || !kpiById.has(d.kpi_id)) {
        setSaving(false)
        setError(`Trend ${i + 1} has invalid KPI.`)
        return
      }
      const mode = parseWdsGlidepathMode(d.glidepath_mode)
      if (mode === 'flat' && numOrNull(d.target_flat) == null) {
        setSaving(false)
        setError(`Trend "${label}" needs a flat target.`)
        return
      }
      if (mode === 'start_end' && (numOrNull(d.target_start) == null || numOrNull(d.target_end) == null)) {
        setSaving(false)
        setError(`Trend "${label}" needs start and end targets.`)
        return
      }
      if (mode === 'weekly' && d.target_weekly.some((w) => numOrNull(w) == null)) {
        setSaving(false)
        setError(`Trend "${label}" needs 14 weekly targets.`)
        return
      }
    }

    for (let i = 0; i < drafts.length; i += 1) {
      const d = drafts[i]!
      const payload = {
        master_cell_id: cellId,
        kpi_id: d.kpi_id,
        label: d.label.trim(),
        aggregation: parseWdsAggregation(d.aggregation),
        glidepath_mode: parseWdsGlidepathMode(d.glidepath_mode),
        target_flat: numOrNull(d.target_flat),
        target_start: numOrNull(d.target_start),
        target_end: numOrNull(d.target_end),
        target_weekly: d.target_weekly.map((w) => numOrNull(w)).filter((n): n is number => n != null),
        sort_order: i,
        is_active: d.is_active,
      }
      if (d.id.startsWith('new-')) {
        const { error: insErr } = await supabase.from('dds_wds_trends').insert(payload)
        if (insErr) {
          setSaving(false)
          setError(insErr.message)
          return
        }
      } else {
        const { error: upErr } = await supabase.from('dds_wds_trends').update(payload).eq('id', d.id).eq('master_cell_id', cellId)
        if (upErr) {
          setSaving(false)
          setError(upErr.message)
          return
        }
      }
    }
    setSaving(false)
    setSuccess('Saved WDS trends.')
    void load()
  }

  if (status === 'loading' || loading) {
    return <p className="text-xs text-muted">Loading…</p>
  }

  return (
    <div className={ddsStack}>
      <p className={ddsHint}>
        Configure WDS trend list for this cell. Each trend links to a KPI, defines weekly aggregation, and stores a 14-week
        glidepath target (10 past + current + 3 future).
      </p>
      {error ? <p className={ddsErr}>{error}</p> : null}
      {success ? <p className="text-xs text-emerald-700 dark:text-emerald-300">{success}</p> : null}

      <button type="button" className={ddsBtn} onClick={addTrend} disabled={kpis.length === 0}>
        <Plus className="size-4" aria-hidden />
        Add trend
      </button>

      {drafts.length === 0 ? (
        <p className={ddsHint}>No trends yet for this cell.</p>
      ) : null}

      {drafts.map((d, ix) => (
        <section key={d.id} className={ddsSection}>
          <div className="flex items-center justify-between gap-2">
            <h2 className={ddsH2}>Trend {ix + 1}</h2>
            <button type="button" className={ddsBtnDanger} onClick={() => void removeTrend(d.id)} aria-label="Delete trend">
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>

          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <label className="text-[10px] font-medium text-muted">
              Trend name
              <input
                className={ddsInput}
                value={d.label}
                onChange={(e) => setDrafts((prev) => prev.map((x) => (x.id === d.id ? { ...x, label: e.target.value } : x)))}
              />
            </label>
            <label className="text-[10px] font-medium text-muted">
              KPI
              <select
                className={ddsSelect}
                value={d.kpi_id}
                onChange={(e) => setDrafts((prev) => prev.map((x) => (x.id === d.id ? { ...x, kpi_id: e.target.value } : x)))}
              >
                {kpis.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-medium text-muted">
              Weekly aggregation
              <select
                className={ddsSelect}
                value={d.aggregation}
                onChange={(e) => setDrafts((prev) => prev.map((x) => (x.id === d.id ? { ...x, aggregation: e.target.value } : x)))}
              >
                {WDS_AGGREGATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-medium text-muted">
              Glidepath mode
              <select
                className={ddsSelect}
                value={d.glidepath_mode}
                onChange={(e) =>
                  setDrafts((prev) => prev.map((x) => (x.id === d.id ? { ...x, glidepath_mode: e.target.value } : x)))
                }
              >
                {WDS_GLIDEPATH_MODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {d.glidepath_mode === 'flat' ? (
            <label className="mt-2 block text-[10px] font-medium text-muted">
              Flat target (all weeks)
              <input
                className={ddsInput}
                inputMode="decimal"
                value={d.target_flat}
                onChange={(e) => setDrafts((prev) => prev.map((x) => (x.id === d.id ? { ...x, target_flat: e.target.value } : x)))}
              />
            </label>
          ) : null}

          {d.glidepath_mode === 'start_end' ? (
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="text-[10px] font-medium text-muted">
                Start target
                <input
                  className={ddsInput}
                  inputMode="decimal"
                  value={d.target_start}
                  onChange={(e) =>
                    setDrafts((prev) => prev.map((x) => (x.id === d.id ? { ...x, target_start: e.target.value } : x)))
                  }
                />
              </label>
              <label className="text-[10px] font-medium text-muted">
                End target
                <input
                  className={ddsInput}
                  inputMode="decimal"
                  value={d.target_end}
                  onChange={(e) =>
                    setDrafts((prev) => prev.map((x) => (x.id === d.id ? { ...x, target_end: e.target.value } : x)))
                  }
                />
              </label>
            </div>
          ) : null}

          {d.glidepath_mode === 'weekly' ? (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] font-medium text-muted">Weekly targets (14)</p>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 md:grid-cols-7">
                {d.target_weekly.map((w, wi) => (
                  <label key={`${d.id}-${wi}`} className={ddsInset}>
                    <span className="text-[10px] text-muted">W{wi + 1}</span>
                    <input
                      className={`${ddsInput} mt-1`}
                      inputMode="decimal"
                      value={w}
                      onChange={(e) =>
                        setDrafts((prev) =>
                          prev.map((x) =>
                            x.id === d.id
                              ? {
                                  ...x,
                                  target_weekly: x.target_weekly.map((pv, pwi) => (pwi === wi ? e.target.value : pv)),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ))}

      <button type="button" className={ddsBtn} onClick={() => void save()} disabled={saving}>
        {saving ? 'Saving…' : 'Save WDS trends'}
      </button>
    </div>
  )
}
