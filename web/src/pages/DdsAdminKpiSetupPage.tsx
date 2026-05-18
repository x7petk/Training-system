import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import { labelForPointKind } from '../features/dds/ddsKpiPointKinds'
import {
  DDS_KPI_DDS_SETUP_SURFACE_KEYS,
  DDS_KPI_DDS_SETUP_SURFACE_LABELS,
  type DdsKpiDdsSetupSurfaceKey,
  type DdsKpiMetricScope,
  effectiveDdsSurfacesForCell,
  isDdsKpiHardPointLocked,
  normalizeDdsSetupSurfaces,
} from '../features/dds/ddsKpiDdsSetupSurfaces'
import {
  ddsBtn,
  ddsErr,
  ddsH2,
  ddsHint,
  ddsInset,
  ddsSection,
  ddsStack,
} from '../features/dds/ddsAdminCompactClasses'

type KpiGroupRow = { id: string; name: string; sort_order: number }

type KpiRow = {
  id: string
  kpi_group_id: string
  label: string
  sort_order: number
  point_kind: string
  metric_scope: string
  display_sections: string[] | null
}

function toggleKey(list: DdsKpiDdsSetupSurfaceKey[], key: DdsKpiDdsSetupSurfaceKey): DdsKpiDdsSetupSurfaceKey[] {
  return list.includes(key) ? list.filter((k) => k !== key) : normalizeDdsSetupSurfaces([...list, key])
}

function scopeTitle(s: DdsKpiMetricScope): string {
  if (s === 'site') return 'Site-level metrics'
  if (s === 'plant') return 'Plant-level metrics'
  return 'Cell-level metrics'
}

export function DdsAdminKpiSetupPage() {
  const { status, cellId } = usePlan24Workspace()

  const [groups, setGroups] = useState<KpiGroupRow[]>([])
  const [kpis, setKpis] = useState<KpiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Checkbox state per KPI for the four DDS surfaces */
  const [drafts, setDrafts] = useState<Record<string, DdsKpiDdsSetupSurfaceKey[]>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groups) m.set(g.id, g.name)
    return m
  }, [groups])

  const load = useCallback(async () => {
    if (!cellId) {
      setGroups([])
      setKpis([])
      setDrafts({})
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const [gRes, kRes, oRes] = await Promise.all([
      supabase.from('dds_kpi_groups').select('id, name, sort_order').order('sort_order').order('name'),
      supabase
        .from('dds_kpis')
        .select('id, kpi_group_id, label, sort_order, point_kind, metric_scope, display_sections')
        .order('sort_order')
        .order('label'),
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
    if (oRes.error) {
      setError(oRes.error.message)
      return
    }
    const gList = (gRes.data ?? []) as KpiGroupRow[]
    setGroups(gList)
    const overrideBy = new Map<string, string[]>()
    for (const row of (oRes.data ?? []) as { kpi_id: string; surfaces: string[] }[]) {
      overrideBy.set(row.kpi_id, row.surfaces ?? [])
    }
    const kList = (kRes.data ?? []) as KpiRow[]
    setKpis(kList)
    const nextDrafts: Record<string, DdsKpiDdsSetupSurfaceKey[]> = {}
    for (const k of kList) {
      const ov = overrideBy.has(k.id) ? overrideBy.get(k.id)! : null
      nextDrafts[k.id] = effectiveDdsSurfacesForCell({
        point_kind: k.point_kind,
        globalDisplaySections: k.display_sections,
        override: ov,
      })
    }
    setDrafts(nextDrafts)
  }, [cellId])

  useEffect(() => {
    void load()
  }, [load])

  async function saveKpi(kpi: KpiRow) {
    if (!cellId || isDdsKpiHardPointLocked(kpi.point_kind)) return
    const surf = normalizeDdsSetupSurfaces(drafts[kpi.id] ?? [])
    setSavingId(kpi.id)
    setError(null)
    const { error: uErr } = await supabase.from('dds_kpi_cell_dds_display').upsert(
      {
        master_cell_id: cellId,
        kpi_id: kpi.id,
        surfaces: surf,
      },
      { onConflict: 'master_cell_id,kpi_id' },
    )
    setSavingId(null)
    if (uErr) setError(uErr.message)
    else await load()
  }

  function setDraft(id: string, next: DdsKpiDdsSetupSurfaceKey[]) {
    setDrafts((prev) => ({ ...prev, [id]: next }))
  }

  const byScope = useMemo(() => {
    const site = kpis.filter((k) => k.metric_scope === 'site')
    const plant = kpis.filter((k) => k.metric_scope === 'plant')
    const cell = kpis.filter((k) => k.metric_scope !== 'site' && k.metric_scope !== 'plant')
    return { site, plant, cell }
  }, [kpis])

  if (status === 'loading' || status === 'error') {
    return (
      <p className={ddsHint} role="status">
        {status === 'loading' ? 'Loading scope…' : 'Could not load site / plant / cell list.'}
      </p>
    )
  }

  return (
    <div className={ddsStack}>
      <p className={ddsHint}>
        Use the <strong className="text-fg/90">Cell scope</strong> bar above for site, plant, and cell. Tick which DDS pages
        show each KPI for the selected cell. <strong className="text-fg/90">Hard points</strong> (required and optional)
        follow the <strong className="text-fg/90">Site DDS</strong> (and other screen) ticks in{' '}
        <Link to="/dds-process/admin/kpis" className="font-medium text-accent underline-offset-2 hover:underline">
          Admin → KPIs
        </Link>{' '}
        and cannot be changed per cell here. Other metrics inherit those global ticks unless you save a custom per-cell
        set below. KPI <strong className="text-fg/90">level</strong> (site / plant / cell grouping) is
        edited under{' '}
        <Link to="/dds-process/admin/kpis" className="font-medium text-accent underline-offset-2 hover:underline">
          Admin → KPIs
        </Link>
        .
      </p>

      {error ? <p className={ddsErr}>{error}</p> : null}

      {!cellId ? (
        <p className={ddsHint}>Select a plant and cell in the scope bar to configure KPI visibility.</p>
      ) : loading ? (
        <p className="flex items-center gap-1 text-xs text-muted" role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Loading KPIs…
        </p>
      ) : kpis.length === 0 ? (
        <p className={ddsHint}>
          No KPIs defined yet. Add them under <Link to="/dds-process/admin/kpis">Admin → KPIs</Link>.
        </p>
      ) : (
        (['site', 'plant', 'cell'] as const).map((scope) => {
          const list = scope === 'site' ? byScope.site : scope === 'plant' ? byScope.plant : byScope.cell
          if (list.length === 0) return null
          return (
            <section key={scope} className={ddsSection}>
              <h2 className={ddsH2}>{scopeTitle(scope)}</h2>
              <ul className="mt-2 space-y-2">
                {list.map((row) => {
                  const locked = isDdsKpiHardPointLocked(row.point_kind)
                  const d =
                    drafts[row.id] ??
                    effectiveDdsSurfacesForCell({
                      point_kind: row.point_kind,
                      globalDisplaySections: row.display_sections,
                      override: null,
                    })
                  return (
                    <li key={row.id} className={ddsInset}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-fg">{row.label}</div>
                          <div className="mt-0.5 text-[10px] text-muted">
                            {groupNameById.get(row.kpi_group_id) ?? '—'} · {labelForPointKind(row.point_kind)}
                            {locked ? <span className="text-fg/80"> · follows Admin → KPIs screens (locked here)</span> : null}
                          </div>
                        </div>
                        {!locked ? (
                          <button
                            type="button"
                            className={ddsBtn}
                            disabled={savingId === row.id}
                            onClick={() => void saveKpi(row)}
                          >
                            {savingId === row.id ? 'Saving…' : 'Save'}
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/50 pt-2">
                        {DDS_KPI_DDS_SETUP_SURFACE_KEYS.map((key) => (
                          <label
                            key={key}
                            className={`inline-flex items-center gap-1.5 text-[11px] ${locked ? 'cursor-not-allowed text-muted' : 'cursor-pointer text-fg'}`}
                          >
                            <input
                              type="checkbox"
                              className="size-3.5 rounded border-border"
                              checked={d.includes(key)}
                              disabled={locked}
                              onChange={() => {
                                if (locked) return
                                setDraft(row.id, toggleKey(d, key))
                              }}
                            />
                            {DDS_KPI_DDS_SETUP_SURFACE_LABELS[key]}
                          </label>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}
