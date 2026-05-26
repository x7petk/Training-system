import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  DDS_KPI_DISPLAY_SECTION_OPTIONS,
  defaultKpiDisplaySections,
  type DdsKpiDisplaySectionKey,
} from '../features/dds/ddsKpiDisplaySections'
import {
  ddsBtn,
  ddsBtnDanger,
  ddsBtnGhost,
  ddsCheckLabel,
  ddsCheckLabelMuted,
  ddsErr,
  ddsFieldsetGrid,
  ddsH2,
  ddsInput,
  ddsInset,
  ddsSection,
  ddsStack,
} from '../features/dds/ddsAdminCompactClasses'

type KpiGroupRow = {
  id: string
  name: string
  sort_order: number
  display_sections: string[] | null
}

function sectionsFromRow(raw: string[] | null | undefined): DdsKpiDisplaySectionKey[] {
  const allowed = new Set<string>(DDS_KPI_DISPLAY_SECTION_OPTIONS.map((o) => o.key))
  return (raw ?? []).filter((s): s is DdsKpiDisplaySectionKey => allowed.has(s))
}

export function DdsAdminKpiGroupsPage() {
  const [rows, setRows] = useState<KpiGroupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newSections, setNewSections] = useState<DdsKpiDisplaySectionKey[]>(() => defaultKpiDisplaySections())
  const [drafts, setDrafts] = useState<Record<string, { name: string; sections: DdsKpiDisplaySectionKey[] }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [reorderingId, setReorderingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('dds_kpi_groups')
      .select('id, name, sort_order, display_sections')
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
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function addGroup() {
    const name = newName.trim()
    if (!name) return
    setError(null)
    const nextOrder = rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0
    const { error: insErr } = await supabase.from('dds_kpi_groups').insert({
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

  async function moveGroup(id: string, direction: -1 | 1) {
    const index = rows.findIndex((r) => r.id === id)
    if (index < 0) return
    const target = index + direction
    if (target < 0 || target >= rows.length) return

    setError(null)
    const nextRows = [...rows]
    const [item] = nextRows.splice(index, 1)
    nextRows.splice(target, 0, item!)
    setRows(nextRows)
    setReorderingId(id)

    const updates = nextRows.map((row, idx) =>
      supabase.from('dds_kpi_groups').update({ sort_order: idx }).eq('id', row.id),
    )
    const results = await Promise.all(updates)
    const failed = results.find((res) => res.error)
    setReorderingId(null)
    if (failed?.error) {
      setError(failed.error.message)
      await load()
    }
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

  return (
    <div className={ddsStack}>
      <section className={ddsSection}>
        <h2 className={ddsH2}>New KPI group</h2>
        <p className="mt-0.5 text-[11px] leading-snug text-muted">
          Name must be unique across the whole organisation (case-insensitive). Tick where this group should appear in DDS.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="dds-kpi-new-name" className="text-[10px] font-medium text-muted">
              Name
            </label>
            <input
              id="dds-kpi-new-name"
              className={ddsInput}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Safety"
              autoComplete="off"
            />
          </div>
          <button type="button" className={ddsBtn} disabled={!newName.trim()} onClick={() => void addGroup()}>
            <Plus className="size-3.5" aria-hidden />
            Add group
          </button>
        </div>
        <fieldset className="mt-2">
          <legend className="text-[10px] font-medium text-muted">Displayed in</legend>
          <div className={ddsFieldsetGrid}>
            {DDS_KPI_DISPLAY_SECTION_OPTIONS.map((opt) => (
              <label key={opt.key} className={ddsCheckLabel}>
                <input
                  type="checkbox"
                  className="size-3 rounded border-border accent-accent"
                  checked={newSections.includes(opt.key)}
                  onChange={() => toggleNewSection(opt.key)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {error ? <p className={ddsErr}>{error}</p> : null}

      <section className={ddsSection}>
        <h2 className={ddsH2}>Existing groups</h2>
        <p className="mt-0.5 text-[11px] leading-snug text-muted">
          Order here controls how groups appear across DDS (Shift / Line / Plant / Site DDS, P2P, compliance, and Admin → KPIs).
        </p>
        {loading ? (
          <p className="mt-2 text-xs text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No KPI groups yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {rows.map((row, idx) => {
              const d = drafts[row.id]
              if (!d) return null
              return (
                <li key={row.id} className={ddsInset}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium tabular-nums text-muted">#{idx + 1}</span>
                        <label className="text-[10px] font-medium text-muted" htmlFor={`dds-kpi-name-${row.id}`}>
                          Name
                        </label>
                      </div>
                      <input
                        id={`dds-kpi-name-${row.id}`}
                        className={ddsInput}
                        value={d.name}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [row.id]: { ...d, name: e.target.value } }))
                        }
                      />
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        title="Move up"
                        aria-label={`Move ${row.name} up`}
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-muted hover:bg-black/[0.04] disabled:opacity-40 dark:hover:bg-white/[0.06]"
                        disabled={idx === 0 || reorderingId === row.id}
                        onClick={() => void moveGroup(row.id, -1)}
                      >
                        <ArrowUp className="size-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        title="Move down"
                        aria-label={`Move ${row.name} down`}
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-muted hover:bg-black/[0.04] disabled:opacity-40 dark:hover:bg-white/[0.06]"
                        disabled={idx === rows.length - 1 || reorderingId === row.id}
                        onClick={() => void moveGroup(row.id, 1)}
                      >
                        <ArrowDown className="size-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={ddsBtnGhost}
                        disabled={savingId === row.id || reorderingId === row.id}
                        onClick={() => void saveRow(row.id)}
                      >
                        {savingId === row.id ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className={ddsBtnDanger}
                        title="Delete group"
                        onClick={() => void removeRow(row)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <fieldset className="mt-2">
                    <legend className="text-[10px] font-medium text-muted">Displayed in</legend>
                    <div className={ddsFieldsetGrid}>
                      {DDS_KPI_DISPLAY_SECTION_OPTIONS.map((opt) => (
                        <label key={opt.key} className={ddsCheckLabelMuted}>
                          <input
                            type="checkbox"
                            className="size-3 rounded border-border accent-accent"
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
