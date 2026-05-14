import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import { labelForDdsP2pResponseKind } from '../features/dds/ddsP2pResponseKind'

type StdQuestion = {
  id: string
  kpi_group_id: string
  prompt: string
  response_kind: string
  target_number: number | string | null
  sort_order: number
}

type SoftKpi = {
  id: string
  label: string
  sort_order: number
  kpi_group_id: string
  group_name: string
}

type CellSoftRow = {
  id: string
  kpi_id: string
  is_enabled: boolean
  note: string | null
  sort_order: number
}

type Draft = { is_enabled: boolean; note: string; rowId: string | null }

const textareaClass =
  'mt-1 min-h-[4.5rem] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2'

export function DdsAdminP2pSoftPointsPage() {
  const { status: scopeStatus, error: scopeError, cellId } = usePlan24Workspace()
  const [stdQuestions, setStdQuestions] = useState<StdQuestion[]>([])
  const [groupNames, setGroupNames] = useState<Record<string, string>>({})
  const [loadingStd, setLoadingStd] = useState(true)

  const [softKpis, setSoftKpis] = useState<SoftKpi[]>([])
  const [loadingKpis, setLoadingKpis] = useState(true)

  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [savingKpiId, setSavingKpiId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadGlobalStandard = useCallback(async () => {
    setLoadingStd(true)
    setError(null)
    const { data: qs, error: qErr } = await supabase
      .from('dds_p2p_standard_questions')
      .select('id, kpi_group_id, prompt, response_kind, target_number, sort_order')
      .order('sort_order', { ascending: true })
      .order('prompt', { ascending: true })
    if (qErr) {
      setError(qErr.message)
      setLoadingStd(false)
      return
    }
    const list = (qs ?? []) as StdQuestion[]
    setStdQuestions(list)
    const gids = [...new Set(list.map((q) => q.kpi_group_id))]
    if (gids.length === 0) {
      setGroupNames({})
      setLoadingStd(false)
      return
    }
    const { data: grps, error: gErr } = await supabase.from('dds_kpi_groups').select('id, name').in('id', gids)
    if (gErr) {
      setError(gErr.message)
      setLoadingStd(false)
      return
    }
    const map: Record<string, string> = {}
    for (const g of grps ?? []) {
      map[g.id as string] = g.name as string
    }
    setGroupNames(map)
    setLoadingStd(false)
  }, [])

  const loadSoftKpis = useCallback(async () => {
    setLoadingKpis(true)
    setError(null)
    const { data: kpis, error: kErr } = await supabase
      .from('dds_kpis')
      .select('id, label, sort_order, kpi_group_id')
      .eq('point_kind', 'soft_point')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true })
    if (kErr) {
      setError(kErr.message)
      setLoadingKpis(false)
      return
    }
    const kList = (kpis ?? []) as Omit<SoftKpi, 'group_name'>[]
    const gids = [...new Set(kList.map((k) => k.kpi_group_id))]
    let gmap: Record<string, string> = {}
    if (gids.length > 0) {
      const { data: grps, error: gErr } = await supabase.from('dds_kpi_groups').select('id, name').in('id', gids)
      if (gErr) {
        setError(gErr.message)
        setLoadingKpis(false)
        return
      }
      for (const g of grps ?? []) {
        gmap[g.id as string] = g.name as string
      }
    }
    const merged: SoftKpi[] = kList.map((k) => ({
      ...k,
      group_name: gmap[k.kpi_group_id] ?? 'Group',
    }))
    merged.sort((a, b) => a.group_name.localeCompare(b.group_name) || a.sort_order - b.sort_order || a.label.localeCompare(b.label))
    setSoftKpis(merged)
    setLoadingKpis(false)
  }, [])

  const loadCellSettings = useCallback(
    async (cid: string) => {
      if (!cid) {
        setDrafts({})
        return
      }
      setError(null)
      const { data, error: sErr } = await supabase
        .from('dds_p2p_cell_soft_points')
        .select('id, kpi_id, is_enabled, note, sort_order')
        .eq('master_cell_id', cid)
      if (sErr) {
        setError(sErr.message)
        return
      }
      const rows = (data ?? []) as CellSoftRow[]
      const byKpi = new Map(rows.map((r) => [r.kpi_id, r]))
      setDrafts(() => {
        const next: Record<string, Draft> = {}
        for (const k of softKpis) {
          const r = byKpi.get(k.id)
          next[k.id] = {
            is_enabled: r?.is_enabled ?? false,
            note: r?.note ?? '',
            rowId: r?.id ?? null,
          }
        }
        return next
      })
    },
    [softKpis],
  )

  useEffect(() => {
    void loadGlobalStandard()
    void loadSoftKpis()
  }, [loadGlobalStandard, loadSoftKpis])

  useEffect(() => {
    if (softKpis.length === 0) {
      setDrafts({})
      return
    }
    if (scopeStatus !== 'ready' || !cellId) {
      setDrafts({})
      return
    }
    void loadCellSettings(cellId)
  }, [scopeStatus, cellId, softKpis, loadCellSettings])

  const stdGrouped = useMemo(() => {
    const map = new Map<string, StdQuestion[]>()
    for (const q of stdQuestions) {
      const g = groupNames[q.kpi_group_id] ?? 'KPI group'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(q)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [stdQuestions, groupNames])

  async function saveSoftKpi(kpi: SoftKpi) {
    const d = drafts[kpi.id]
    if (!d || !cellId) return
    setSavingKpiId(kpi.id)
    setError(null)
    let ok = true
    try {
      if (d.is_enabled) {
        const note = d.note.trim() || null
        if (d.rowId) {
          const { error: uErr } = await supabase
            .from('dds_p2p_cell_soft_points')
            .update({ is_enabled: true, note, sort_order: kpi.sort_order })
            .eq('id', d.rowId)
          if (uErr) {
            setError(uErr.message)
            ok = false
          }
        } else {
          const { data: ins, error: iErr } = await supabase
            .from('dds_p2p_cell_soft_points')
            .insert({
              master_cell_id: cellId,
              kpi_id: kpi.id,
              is_enabled: true,
              note,
              sort_order: kpi.sort_order,
            })
            .select('id')
            .single()
          if (iErr) {
            setError(iErr.message)
            ok = false
          } else if (ins?.id) {
            setDrafts((prev) => ({
              ...prev,
              [kpi.id]: { ...d, rowId: ins.id as string },
            }))
          }
        }
      } else if (d.rowId) {
        const { error: dErr } = await supabase.from('dds_p2p_cell_soft_points').delete().eq('id', d.rowId)
        if (dErr) {
          setError(dErr.message)
          ok = false
        } else {
          setDrafts((prev) => ({
            ...prev,
            [kpi.id]: { is_enabled: false, note: '', rowId: null },
          }))
        }
      }
      if (ok) await loadCellSettings(cellId)
    } finally {
      setSavingKpiId(null)
    }
  }

  if (scopeStatus === 'loading' || loadingStd || loadingKpis) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted" role="status">
        Loading…
      </div>
    )
  }

  if (scopeStatus === 'error') {
    return (
      <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {scopeError ?? 'Could not load master data.'}
      </p>
    )
  }

  if (scopeStatus !== 'ready' || !cellId) {
    return (
      <p className="rounded-xl border border-border bg-surface-raised/50 px-4 py-3 text-sm text-muted">
        Choose a site, plant, and cell in the scope bar to configure P2P soft points for that cell.
      </p>
    )
  }

  return (
    <div className="space-y-10">
      <p className="max-w-2xl text-sm text-muted">
        Global P2P standard questions are shown for reference. Soft point KPIs (from Admin → KPIs) can be turned on for this cell with an optional note.
      </p>

      {error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface-raised/30 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-fg">Global P2P standard questions</h2>
        <p className="mt-1 text-xs text-muted">Defined under P2P standard. Read-only here.</p>
        {stdQuestions.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            None yet. Add them under{' '}
            <Link to="/dds-process/admin/p2p-standard" className="font-medium text-accent underline-offset-2 hover:underline">
              P2P standard
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4 space-y-6">
            {stdGrouped.map(([gname, qs]) => (
              <div key={gname}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{gname}</h3>
                <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface">
                  {qs.map((q) => (
                    <li key={q.id} className="px-4 py-3">
                      <p className="text-sm text-fg">{q.prompt}</p>
                      <p className="mt-1 text-xs text-muted">
                        {labelForDdsP2pResponseKind(q.response_kind)}
                        {q.response_kind === 'number_with_target' && q.target_number != null
                          ? ` · target ${q.target_number}`
                          : null}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface-raised/30 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-fg">Soft points for this cell</h2>
        <p className="mt-1 text-xs text-muted">
          Only KPIs marked as Soft Point in{' '}
          <Link to="/dds-process/admin/kpis" className="font-medium text-accent underline-offset-2 hover:underline">
            KPIs
          </Link>{' '}
          appear here. Saving when enabled creates a row for this cell; turning off removes it.
        </p>
        {softKpis.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No Soft Point KPIs exist yet. Add KPIs with type Soft Point under KPIs.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {softKpis.map((kpi) => {
              const d = drafts[kpi.id]
              if (!d) return null
              return (
                <li key={kpi.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-muted">{kpi.group_name}</p>
                      <p className="text-sm font-medium text-fg">{kpi.label}</p>
                    </div>
                    <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted">
                      <input
                        type="checkbox"
                        className="size-3.5 rounded border-border accent-accent"
                        checked={d.is_enabled}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [kpi.id]: { ...d, is_enabled: e.target.checked },
                          }))
                        }
                      />
                      Use for this cell
                    </label>
                  </div>
                  <div className="mt-3">
                    <label className="text-xs font-medium text-muted" htmlFor={`soft-note-${kpi.id}`}>
                      Note (optional)
                    </label>
                    <textarea
                      id={`soft-note-${kpi.id}`}
                      className={textareaClass}
                      rows={2}
                      value={d.note}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [kpi.id]: { ...d, note: e.target.value },
                        }))
                      }
                      disabled={!d.is_enabled}
                    />
                  </div>
                  <button
                    type="button"
                    className="mt-3 inline-flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold hover:bg-black/[0.04] disabled:opacity-40 dark:hover:bg-white/[0.06]"
                    disabled={savingKpiId === kpi.id}
                    onClick={() => void saveSoftKpi(kpi)}
                  >
                    {savingKpiId === kpi.id ? 'Saving…' : 'Save'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
