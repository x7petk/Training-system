import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import type { DdsCellLine } from '../features/dds/ddsCellLines'
import {
  ddsBtn,
  ddsBtnDanger,
  ddsBtnGhostGrow,
  ddsErr,
  ddsH2,
  ddsHint,
  ddsInput,
  ddsInset,
  ddsSection,
  ddsStack,
} from '../features/dds/ddsAdminCompactClasses'

type LineRow = DdsCellLine

export function DdsAdminCellLinesPage() {
  const { status: scopeStatus, error: scopeError, cellId, cells } = usePlan24Workspace()
  const cellLabel = useMemo(() => cells.find((c) => c.id === cellId)?.name ?? 'this cell', [cells, cellId])
  const [rows, setRows] = useState<LineRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [drafts, setDrafts] = useState<Record<string, { name: string }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!cellId) {
      setRows([])
      setDrafts({})
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('dds_cell_lines')
      .select('id, master_cell_id, name, sort_order, active')
      .eq('master_cell_id', cellId)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    setLoading(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    const list = (data ?? []) as LineRow[]
    setRows(list)
    const next: Record<string, { name: string }> = {}
    for (const r of list) next[r.id] = { name: r.name }
    setDrafts(next)
  }, [cellId])

  useEffect(() => {
    void load()
  }, [load])

  async function addLine() {
    const name = newName.trim()
    if (!name || !cellId) return
    setError(null)
    const nextOrder = rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0
    const { error: insErr } = await supabase.from('dds_cell_lines').insert({
      master_cell_id: cellId,
      name,
      sort_order: nextOrder,
      active: true,
    })
    if (insErr) {
      setError(insErr.message)
      return
    }
    setNewName('')
    await load()
  }

  async function saveRow(id: string) {
    const d = drafts[id]
    if (!d) return
    const name = d.name.trim()
    if (!name) return
    setSavingId(id)
    setError(null)
    const { error: uErr } = await supabase.from('dds_cell_lines').update({ name }).eq('id', id)
    setSavingId(null)
    if (uErr) setError(uErr.message)
    else await load()
  }

  async function removeRow(row: LineRow) {
    if (!confirm(`Remove line "${row.name}"? Line KPI values for this line will be deleted.`)) return
    setError(null)
    const { error: dErr } = await supabase.from('dds_cell_lines').delete().eq('id', row.id)
    if (dErr) setError(dErr.message)
    else await load()
  }

  if (scopeStatus === 'loading') {
    return (
      <p className="text-xs text-muted" role="status">
        Loading scope…
      </p>
    )
  }
  if (scopeStatus === 'error') {
    return <p className={ddsErr}>{scopeError ?? 'Could not load scope.'}</p>
  }
  if (!cellId) {
    return <p className={ddsHint}>Select a cell in the scope bar to manage lines.</p>
  }

  return (
    <div className={ddsStack}>
      <section className={ddsSection}>
        <h2 className={ddsH2}>Cell lines</h2>
        <p className="mt-1 text-[11px] leading-snug text-muted">
          Lines for <strong className="text-fg/85">{cellLabel}</strong>. Used as columns on Site DDS
          when a KPI&apos;s site presentation is <strong className="text-fg/85">By line (table)</strong>.
        </p>
      </section>

      <section className={ddsSection}>
        <h2 className={ddsH2}>New line</h2>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="min-w-[12rem] flex-1">
            <span className="text-[10px] font-medium text-muted">Line name</span>
            <input
              className={ddsInput}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Line 1"
              autoComplete="off"
            />
          </label>
          <button type="button" className={ddsBtn} disabled={!newName.trim()} onClick={() => void addLine()}>
            <Plus className="size-3.5" aria-hidden />
            Add line
          </button>
        </div>
      </section>

      {error ? <p className={ddsErr}>{error}</p> : null}

      <section className={ddsSection}>
        <h2 className={ddsH2}>Lines in this cell</h2>
        {loading ? (
          <p className="mt-2 text-xs text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No lines yet. Add lines above — they become table columns on Site DDS.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {rows.map((row) => {
              const d = drafts[row.id]
              if (!d) return null
              return (
                <li key={row.id} className={ddsInset}>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-[10rem] flex-1">
                      <span className="text-[10px] font-medium text-muted">Name</span>
                      <input
                        className={ddsInput}
                        value={d.name}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [row.id]: { name: e.target.value } }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className={ddsBtnGhostGrow}
                      disabled={savingId === row.id}
                      onClick={() => void saveRow(row.id)}
                    >
                      {savingId === row.id ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" className={ddsBtnDanger} title="Delete line" onClick={() => void removeRow(row)}>
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
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
