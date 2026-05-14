import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import {
  DDS_KPI_DISPLAY_SECTION_OPTIONS,
  defaultKpiDisplaySections,
  type DdsKpiDisplaySectionKey,
} from '../features/dds/ddsKpiDisplaySections'

type KpiGroupRow = {
  id: string
  master_cell_id: string
  name: string
  sort_order: number
  display_sections: string[] | null
}

const inputClass =
  'mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2'

function sectionsFromRow(raw: string[] | null | undefined): DdsKpiDisplaySectionKey[] {
  const allowed = new Set<string>(DDS_KPI_DISPLAY_SECTION_OPTIONS.map((o) => o.key))
  return (raw ?? []).filter((s): s is DdsKpiDisplaySectionKey => allowed.has(s))
}

export function DdsAdminKpiGroupsPage() {
  const { status: scopeStatus, error: scopeError, cellId } = usePlan24Workspace()
  const [rows, setRows] = useState<KpiGroupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newSections, setNewSections] = useState<DdsKpiDisplaySectionKey[]>(() => defaultKpiDisplaySections())
  const [drafts, setDrafts] = useState<Record<string, { name: string; sections: DdsKpiDisplaySectionKey[] }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!cellId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('dds_kpi_groups')
      .select('id, master_cell_id, name, sort_order, display_sections')
      .eq('master_cell_id', cellId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    setLoading(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    const list = (data ?? []) as KpiGroupRow[]
    setRows(list)
    const nextDrafts: Record<string, { name: string; sections: DdsKpiDisplaySectionKey[] }> = {}
    for (const r of list) {
      nextDrafts[r.id] = { name: r.name, sections: sectionsFromRow(r.display_sections) }
    }
    setDrafts(nextDrafts)
  }, [cellId])

  useEffect(() => {
    if (scopeStatus !== 'ready') return
    void load()
  }, [scopeStatus, load])

  const canUseCell = scopeStatus === 'ready' && Boolean(cellId)

  async function addGroup() {
    const name = newName.trim()
    if (!name || !cellId) return
    setError(null)
    const nextOrder = rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0
    const { error: insErr } = await supabase.from('dds_kpi_groups').insert({
      master_cell_id: cellId,
      name,
      sort_order: nextOrder,
      display_sections: newSections,
    })
    if (insErr) {
      setError(insErr.message)
      return
    }
    setNewName('')
    setNewSections(defaultKpiDisplaySections())
    await load()
  }

  async function saveRow(id: string) {
    const d = drafts[id]
    if (!d) return
    const name = d.name.trim()
    if (!name) return
    setSavingId(id)
    setError(null)
    const { error: uErr } = await supabase
      .from('dds_kpi_groups')
      .update({ name, display_sections: d.sections })
      .eq('id', id)
    setSavingId(null)
    if (uErr) setError(uErr.message)
    else await load()
  }

  async function removeRow(row: KpiGroupRow) {
    if (!confirm(`Remove KPI group "${row.name}"?`)) return
    setError(null)
    const { error: dErr } = await supabase.from('dds_kpi_groups').delete().eq('id', row.id)
    if (dErr) setError(dErr.message)
    else await load()
  }

  function toggleNewSection(key: DdsKpiDisplaySectionKey) {
    setNewSections((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  function toggleRowSection(id: string, key: DdsKpiDisplaySectionKey) {
    setDrafts((prev) => {
      const cur = prev[id]
      if (!cur) return prev
      const nextSections = cur.sections.includes(key)
        ? cur.sections.filter((k) => k !== key)
        : [...cur.sections, key]
      return { ...prev, [id]: { ...cur, sections: nextSections } }
    })
  }

  if (scopeStatus === 'loading') {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted" role="status">
        Loading scope…
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

  if (!canUseCell) {
    return (
      <p className="rounded-xl border border-border bg-surface-raised/50 px-4 py-3 text-sm text-muted">
        Choose a site, plant, and cell in the scope bar to manage KPI groups.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface-raised/30 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-fg">New KPI group</h2>
        <p className="mt-1 text-xs text-muted">Name must be unique per cell (case-insensitive). Tick where this group should appear.</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="dds-kpi-new-name" className="text-xs font-medium text-muted">
              Name
            </label>
            <input
              id="dds-kpi-new-name"
              className={inputClass}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Safety"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
            disabled={!newName.trim()}
            onClick={() => void addGroup()}
          >
            <Plus className="size-4" aria-hidden />
            Add group
          </button>
        </div>
        <fieldset className="mt-4">
          <legend className="text-xs font-medium text-muted">Displayed in</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {DDS_KPI_DISPLAY_SECTION_OPTIONS.map((opt) => (
              <label
                key={opt.key}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/80 bg-surface px-2 py-1.5 text-xs"
              >
                <input
                  type="checkbox"
                  className="size-3.5 rounded border-border accent-accent"
                  checked={newSections.includes(opt.key)}
                  onChange={() => toggleNewSection(opt.key)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface-raised/30 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-fg">Existing groups</h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No KPI groups for this cell yet.</p>
        ) : (
          <ul className="mt-4 space-y-6">
            {rows.map((row) => {
              const d = drafts[row.id]
              if (!d) return null
              return (
                <li key={row.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <label className="text-xs font-medium text-muted" htmlFor={`dds-kpi-name-${row.id}`}>
                        Name
                      </label>
                      <input
                        id={`dds-kpi-name-${row.id}`}
                        className={inputClass}
                        value={d.name}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [row.id]: { ...d, name: e.target.value } }))
                        }
                      />
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-3 text-sm font-semibold hover:bg-black/[0.04] disabled:opacity-40 dark:hover:bg-white/[0.06]"
                        disabled={savingId === row.id}
                        onClick={() => void saveRow(row.id)}
                      >
                        {savingId === row.id ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="inline-flex size-10 items-center justify-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10"
                        title="Delete group"
                        onClick={() => void removeRow(row)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <fieldset className="mt-3">
                    <legend className="text-xs font-medium text-muted">Displayed in</legend>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {DDS_KPI_DISPLAY_SECTION_OPTIONS.map((opt) => (
                        <label
                          key={opt.key}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/80 bg-surface-raised/40 px-2 py-1.5 text-xs"
                        >
                          <input
                            type="checkbox"
                            className="size-3.5 rounded border-border accent-accent"
                            checked={d.sections.includes(opt.key)}
                            onChange={() => toggleRowSection(row.id, opt.key)}
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
