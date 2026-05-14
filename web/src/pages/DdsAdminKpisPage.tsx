import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { DDS_KPI_POINT_KINDS, type DdsKpiPointKind, isDdsKpiPointKind } from '../features/dds/ddsKpiPointKinds'

type KpiGroupRow = { id: string; name: string; sort_order: number }

type KpiRow = {
  id: string
  kpi_group_id: string
  label: string
  sort_order: number
  point_kind: string
}

const inputClass =
  'mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2'

const selectClass =
  'mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2'

export function DdsAdminKpisPage() {
  const [groups, setGroups] = useState<KpiGroupRow[]>([])
  const [groupId, setGroupId] = useState('')
  const [rows, setRows] = useState<KpiRow[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [loadingKpis, setLoadingKpis] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newKind, setNewKind] = useState<DdsKpiPointKind>('hard_point')
  const [drafts, setDrafts] = useState<Record<string, { label: string; point_kind: DdsKpiPointKind }>>({})
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
      .select('id, kpi_group_id, label, sort_order, point_kind')
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
    const next: Record<string, { label: string; point_kind: DdsKpiPointKind }> = {}
    for (const r of list) {
      const kind = isDdsKpiPointKind(r.point_kind) ? r.point_kind : 'hard_point'
      next[r.id] = { label: r.label, point_kind: kind }
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
    })
    if (insErr) {
      setError(insErr.message)
      return
    }
    setNewLabel('')
    setNewKind('hard_point')
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
      .update({ label, point_kind: d.point_kind })
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

  if (loadingGroups) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted" role="status">
        Loading…
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface-raised/50 px-4 py-3 text-sm text-muted">
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
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface-raised/30 p-4 sm:p-5">
        <label htmlFor="dds-kpi-group-select" className="text-xs font-medium text-muted">
          KPI group
        </label>
        <select
          id="dds-kpi-group-select"
          className={selectClass}
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        {selectedGroup ? (
          <p className="mt-2 text-xs text-muted">KPIs belong to this group only. Names must be unique within the group.</p>
        ) : null}
      </div>

      <section className="rounded-2xl border border-border bg-surface-raised/30 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-fg">New KPI</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0 sm:col-span-2">
            <label htmlFor="dds-kpi-new-label" className="text-xs font-medium text-muted">
              Label
            </label>
            <input
              id="dds-kpi-new-label"
              className={inputClass}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Line speed"
              autoComplete="off"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="dds-kpi-new-kind" className="text-xs font-medium text-muted">
              Type
            </label>
            <select
              id="dds-kpi-new-kind"
              className={selectClass}
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
        <button
          type="button"
          className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
          disabled={!newLabel.trim() || !groupId}
          onClick={() => void addKpi()}
        >
          <Plus className="size-4" aria-hidden />
          Add KPI
        </button>
      </section>

      {error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface-raised/30 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-fg">KPIs in this group</h2>
        {loadingKpis ? (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No KPIs yet for this group.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {rows.map((row) => {
              const d = drafts[row.id]
              if (!d) return null
              return (
                <li key={row.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="grid gap-3 lg:grid-cols-[1fr_14rem_auto] lg:items-end">
                    <div className="min-w-0">
                      <label className="text-xs font-medium text-muted" htmlFor={`dds-kpi-label-${row.id}`}>
                        Label
                      </label>
                      <input
                        id={`dds-kpi-label-${row.id}`}
                        className={inputClass}
                        value={d.label}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [row.id]: { ...d, label: e.target.value } }))
                        }
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="text-xs font-medium text-muted" htmlFor={`dds-kpi-kind-${row.id}`}>
                        Type
                      </label>
                      <select
                        id={`dds-kpi-kind-${row.id}`}
                        className={selectClass}
                        value={d.point_kind}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.id]: { ...d, point_kind: e.target.value as DdsKpiPointKind },
                          }))
                        }
                      >
                        {DDS_KPI_POINT_KINDS.map((k) => (
                          <option key={k.value} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2 lg:justify-end">
                      <button
                        type="button"
                        className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-border bg-surface px-3 text-sm font-semibold hover:bg-black/[0.04] disabled:opacity-40 dark:hover:bg-white/[0.06] lg:flex-none"
                        disabled={savingId === row.id}
                        onClick={() => void saveRow(row.id)}
                      >
                        {savingId === row.id ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10"
                        title="Delete KPI"
                        onClick={() => void removeRow(row)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
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
