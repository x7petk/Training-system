import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { DDS_KPI_POINT_KINDS, type DdsKpiPointKind, isDdsKpiPointKind } from '../features/dds/ddsKpiPointKinds'
import {
  DDS_KPI_METRIC_SURFACE_OPTIONS,
  type DdsKpiMetricSurfaceKey,
  metricSurfacesFromRow,
} from '../features/dds/ddsKpiMetricSurfaces'
import { DDS_KPI_UNIT_OPTIONS, type DdsKpiUnit, parseDdsKpiUnit } from '../features/dds/ddsKpiUnits'
import {
  DDS_KPI_SCORING_KIND_OPTIONS,
  type DdsKpiScoring,
  parseDdsKpiScoring,
  scoringHint,
} from '../features/dds/ddsKpiScoring'
import {
  ddsBtn,
  ddsBtnDanger,
  ddsBtnGhostGrow,
  ddsCheckLabel,
  ddsCheckLabelMuted,
  ddsErr,
  ddsFieldsetGrid,
  ddsH2,
  ddsHint,
  ddsInput,
  ddsInset,
  ddsSection,
  ddsSelect,
  ddsStack,
} from '../features/dds/ddsAdminCompactClasses'

type KpiGroupRow = { id: string; name: string; sort_order: number }

type KpiRow = {
  id: string
  kpi_group_id: string
  label: string
  sort_order: number
  point_kind: string
  unit: string | null
  display_sections: string[] | null
  scoring: unknown
}

type KpiDraft = {
  label: string
  point_kind: DdsKpiPointKind
  unit: DdsKpiUnit
  sections: DdsKpiMetricSurfaceKey[]
  scoring: DdsKpiScoring
}

function defaultScoringForKind(kind: DdsKpiScoring['kind']): DdsKpiScoring {
  switch (kind) {
    case 'no_target':
      return { kind: 'no_target' }
    case 'min_red':
      return { kind: 'min_red', target: 0 }
    case 'max_red':
      return { kind: 'max_red', target: 100 }
    case 'range_green':
      return { kind: 'range_green', min: 0, max: 100 }
    case 'symmetric_abs':
      return { kind: 'symmetric_abs', target: 100, tolerance: 5 }
    case 'symmetric_pct':
      return { kind: 'symmetric_pct', target: 100, tolerancePct: 5 }
    default:
      return { kind: 'no_target' }
  }
}

function toggleSurface(prev: DdsKpiMetricSurfaceKey[], key: DdsKpiMetricSurfaceKey): DdsKpiMetricSurfaceKey[] {
  return prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
}

export function DdsAdminKpisPage() {
  const [groups, setGroups] = useState<KpiGroupRow[]>([])
  const [groupId, setGroupId] = useState('')
  const [rows, setRows] = useState<KpiRow[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [loadingKpis, setLoadingKpis] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newKind, setNewKind] = useState<DdsKpiPointKind>('hard_point')
  const [newUnit, setNewUnit] = useState<DdsKpiUnit>('none')
  const [drafts, setDrafts] = useState<Record<string, KpiDraft>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('dds_kpi_groups')
      .select('id, name, sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    setLoadingGroups(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    const list = (data ?? []) as KpiGroupRow[]
    setGroups(list)
    setGroupId((prev) => {
      if (prev && list.some((g) => g.id === prev)) return prev
      return list[0]?.id ?? ''
    })
  }, [])

  const loadKpis = useCallback(async (gid: string) => {
    if (!gid) {
      setRows([])
      setDrafts({})
      return
    }
    setLoadingKpis(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('dds_kpis')
      .select('id, kpi_group_id, label, sort_order, point_kind, unit, display_sections, scoring')
      .eq('kpi_group_id', gid)
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true })
    setLoadingKpis(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    const list = (data ?? []) as KpiRow[]
    setRows(list)
    const next: Record<string, KpiDraft> = {}
    for (const r of list) {
      const kind = isDdsKpiPointKind(r.point_kind) ? r.point_kind : 'hard_point'
      next[r.id] = {
        label: r.label,
        point_kind: kind,
        unit: parseDdsKpiUnit(r.unit),
        sections: metricSurfacesFromRow(r.display_sections),
        scoring: parseDdsKpiScoring(r.scoring),
      }
    }
    setDrafts(next)
  }, [])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

  useEffect(() => {
    void loadKpis(groupId)
  }, [groupId, loadKpis])

  async function addKpi() {
    const label = newLabel.trim()
    if (!label || !groupId) return
    setError(null)
    const nextOrder = rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0
    const { error: insErr } = await supabase.from('dds_kpis').insert({
      kpi_group_id: groupId,
      label,
      sort_order: nextOrder,
      point_kind: newKind,
      unit: newUnit,
      display_sections: [],
      scoring: { kind: 'no_target' },
    })
    if (insErr) {
      setError(insErr.message)
      return
    }
    setNewLabel('')
    setNewKind('hard_point')
    setNewUnit('none')
    await loadKpis(groupId)
  }

  async function saveRow(id: string) {
    const d = drafts[id]
    if (!d) return
    const label = d.label.trim()
    if (!label) return
    setSavingId(id)
    setError(null)
    const { error: uErr } = await supabase
      .from('dds_kpis')
      .update({
        label,
        point_kind: d.point_kind,
        unit: d.unit,
        display_sections: d.sections,
        scoring: d.scoring,
      })
      .eq('id', id)
    setSavingId(null)
    if (uErr) setError(uErr.message)
    else await loadKpis(groupId)
  }

  async function removeRow(row: KpiRow) {
    if (!confirm(`Remove KPI "${row.label}"?`)) return
    setError(null)
    const { error: dErr } = await supabase.from('dds_kpis').delete().eq('id', row.id)
    if (dErr) setError(dErr.message)
    else await loadKpis(groupId)
  }

  function setDraft(id: string, patch: Partial<KpiDraft>) {
    setDrafts((prev) => {
      const cur = prev[id]
      if (!cur) return prev
      return { ...prev, [id]: { ...cur, ...patch } }
    })
  }

  function setScoringKind(id: string, kind: DdsKpiScoring['kind']) {
    setDrafts((prev) => {
      const cur = prev[id]
      if (!cur) return prev
      return { ...prev, [id]: { ...cur, scoring: defaultScoringForKind(kind) } }
    })
  }

  function scoringFields(id: string, s: DdsKpiScoring) {
    const num = (label: string, val: number, onChange: (n: number) => void) => (
      <label className="min-w-0">
        <span className="text-[10px] font-medium text-muted">{label}</span>
        <input
          type="number"
          className={ddsInput}
          value={Number.isFinite(val) ? val : 0}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </label>
    )
    switch (s.kind) {
      case 'no_target':
        return <p className="text-[10px] text-muted">Blocks stay blue until a value is entered; no pass/fail colouring from target.</p>
      case 'min_red':
        return num('Target (below = red)', s.target, (n) => setDraft(id, { scoring: { kind: 'min_red', target: n } }))
      case 'max_red':
        return num('Target (above = red)', s.target, (n) => setDraft(id, { scoring: { kind: 'max_red', target: n } }))
      case 'range_green':
        return (
          <div className="grid grid-cols-2 gap-2">
            {num('Min', s.min, (n) => setDraft(id, { scoring: { kind: 'range_green', min: n, max: s.max } }))}
            {num('Max', s.max, (n) => setDraft(id, { scoring: { kind: 'range_green', min: s.min, max: n } }))}
          </div>
        )
      case 'symmetric_abs':
        return (
          <div className="grid grid-cols-2 gap-2">
            {num('Target', s.target, (n) => setDraft(id, { scoring: { kind: 'symmetric_abs', target: n, tolerance: s.tolerance } }))}
            {num('± absolute', s.tolerance, (n) =>
              setDraft(id, { scoring: { kind: 'symmetric_abs', target: s.target, tolerance: Math.max(0, n) } }),
            )}
          </div>
        )
      case 'symmetric_pct':
        return (
          <div className="grid grid-cols-2 gap-2">
            {num('Target', s.target, (n) =>
              setDraft(id, { scoring: { kind: 'symmetric_pct', target: n, tolerancePct: s.tolerancePct } }),
            )}
            {num('± %', s.tolerancePct, (n) =>
              setDraft(id, { scoring: { kind: 'symmetric_pct', target: s.target, tolerancePct: Math.max(0, n) } }),
            )}
          </div>
        )
      default:
        return null
    }
  }

  if (loadingGroups) {
    return (
      <div className="flex min-h-[10rem] items-center justify-center text-xs text-muted" role="status">
        Loading…
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <p className={ddsHint}>
        Create a{' '}
        <Link to="/dds-process/admin/kpi-groups" className="font-medium text-accent underline-offset-2 hover:underline">
          KPI group
        </Link>{' '}
        first, then add KPIs here.
      </p>
    )
  }

  const selectedGroup = groups.find((g) => g.id === groupId)

  return (
    <div className={ddsStack}>
      <div className={ddsSection}>
        <label htmlFor="dds-kpi-group-select" className="text-[10px] font-medium text-muted">
          KPI group
        </label>
        <select id="dds-kpi-group-select" className={ddsSelect} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        {selectedGroup ? (
          <p className="mt-1 text-[11px] leading-snug text-muted">
            KPIs belong to this group only. Tick which screens use each metric; manual values are per cell (same KPI everywhere, editable on each
            screen that shows it).
          </p>
        ) : null}
      </div>

      <section className={ddsSection}>
        <h2 className={ddsH2}>New KPI</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0 sm:col-span-2">
            <label htmlFor="dds-kpi-new-label" className="text-[10px] font-medium text-muted">
              Label
            </label>
            <input
              id="dds-kpi-new-label"
              className={ddsInput}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Line speed"
              autoComplete="off"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="dds-kpi-new-unit" className="text-[10px] font-medium text-muted">
              Metric
            </label>
            <select
              id="dds-kpi-new-unit"
              className={ddsSelect}
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value as DdsKpiUnit)}
            >
              {DDS_KPI_UNIT_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="dds-kpi-new-kind" className="text-[10px] font-medium text-muted">
              Type
            </label>
            <select
              id="dds-kpi-new-kind"
              className={ddsSelect}
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as DdsKpiPointKind)}
            >
              {DDS_KPI_POINT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" className={`${ddsBtn} mt-2`} disabled={!newLabel.trim() || !groupId} onClick={() => void addKpi()}>
          <Plus className="size-3.5" aria-hidden />
          Add KPI
        </button>
      </section>

      {error ? <p className={ddsErr}>{error}</p> : null}

      <section className={ddsSection}>
        <h2 className={ddsH2}>KPIs in this group</h2>
        {loadingKpis ? (
          <p className="mt-2 text-xs text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No KPIs yet for this group.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {rows.map((row) => {
              const d = drafts[row.id]
              if (!d) return null
              return (
                <li key={row.id} className={ddsInset}>
                  <div className="grid gap-2 lg:grid-cols-[1fr_7.5rem_7.5rem_auto] lg:items-end">
                    <div className="min-w-0">
                      <label className="text-[10px] font-medium text-muted" htmlFor={`dds-kpi-label-${row.id}`}>
                        Label
                      </label>
                      <input
                        id={`dds-kpi-label-${row.id}`}
                        className={ddsInput}
                        value={d.label}
                        onChange={(e) => setDraft(row.id, { label: e.target.value })}
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="text-[10px] font-medium text-muted" htmlFor={`dds-kpi-unit-${row.id}`}>
                        Metric
                      </label>
                      <select
                        id={`dds-kpi-unit-${row.id}`}
                        className={ddsSelect}
                        value={d.unit}
                        onChange={(e) => setDraft(row.id, { unit: e.target.value as DdsKpiUnit })}
                      >
                        {DDS_KPI_UNIT_OPTIONS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0">
                      <label className="text-[10px] font-medium text-muted" htmlFor={`dds-kpi-kind-${row.id}`}>
                        Type
                      </label>
                      <select
                        id={`dds-kpi-kind-${row.id}`}
                        className={ddsSelect}
                        value={d.point_kind}
                        onChange={(e) => setDraft(row.id, { point_kind: e.target.value as DdsKpiPointKind })}
                      >
                        {DDS_KPI_POINT_KINDS.map((k) => (
                          <option key={k.value} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-1.5 lg:justify-end">
                      <button
                        type="button"
                        className={ddsBtnGhostGrow}
                        disabled={savingId === row.id}
                        onClick={() => void saveRow(row.id)}
                      >
                        {savingId === row.id ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" className={ddsBtnDanger} title="Delete KPI" onClick={() => void removeRow(row)}>
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-border/50 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Show on screens</p>
                    <div className={`${ddsFieldsetGrid} mt-1.5`}>
                      {DDS_KPI_METRIC_SURFACE_OPTIONS.map((opt) => (
                        <label key={opt.key} className={d.sections.includes(opt.key) ? ddsCheckLabel : ddsCheckLabelMuted}>
                          <input
                            type="checkbox"
                            className="size-3.5 rounded border-border accent-violet-600"
                            checked={d.sections.includes(opt.key)}
                            onChange={() => setDraft(row.id, { sections: toggleSurface(d.sections, opt.key) })}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 border-t border-border/50 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Colour / target logic</p>
                    <p className="mt-0.5 text-[10px] text-muted">Preview: {scoringHint(d.scoring)}</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="min-w-0">
                        <span className="text-[10px] font-medium text-muted">Rule</span>
                        <select
                          className={ddsSelect}
                          value={d.scoring.kind}
                          onChange={(e) => setScoringKind(row.id, e.target.value as DdsKpiScoring['kind'])}
                        >
                          {DDS_KPI_SCORING_KIND_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="mt-2">{scoringFields(row.id, d.scoring)}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
