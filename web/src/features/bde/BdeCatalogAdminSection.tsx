import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { BdeCatalogOption } from './bdeTypes'

const inputClass =
  'mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2'

type CatalogTable =
  | 'bde_problem_types'
  | 'bde_activity_codes'
  | 'bde_object_part_codes'
  | 'bde_damage_codes'
  | 'bde_cause_codes'

export function BdeCatalogAdminSection({
  title,
  description,
  tableName,
  itemLabel,
}: {
  title: string
  description: string
  tableName: CatalogTable
  itemLabel: string
}) {
  const [rows, setRows] = useState<BdeCatalogOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from(tableName)
      .select('id, label, sort_order, is_active')
      .order('sort_order')
      .order('label')
    setLoading(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    setRows((data ?? []) as BdeCatalogOption[])
  }, [tableName])

  useEffect(() => {
    void load()
  }, [load])

  async function addRow() {
    const label = newLabel.trim()
    if (!label) return
    setSavingId('new')
    setError(null)
    const next = rows.reduce((m, r) => Math.max(m, r.sort_order), -1) + 1
    const { error: insErr } = await supabase.from(tableName).insert({ label, sort_order: next, is_active: true })
    setSavingId(null)
    if (insErr) {
      setError(insErr.message)
      return
    }
    setNewLabel('')
    await load()
  }

  async function saveLabel(id: string, label: string) {
    const trimmed = label.trim()
    if (!trimmed) {
      setError(`Each ${itemLabel} needs a label.`)
      return
    }
    setSavingId(id)
    setError(null)
    const { error: uErr } = await supabase.from(tableName).update({ label: trimmed }).eq('id', id)
    setSavingId(null)
    if (uErr) setError(uErr.message)
    else await load()
  }

  async function toggleActive(row: BdeCatalogOption) {
    setSavingId(row.id)
    setError(null)
    const { error: uErr } = await supabase.from(tableName).update({ is_active: !row.is_active }).eq('id', row.id)
    setSavingId(null)
    if (uErr) setError(uErr.message)
    else await load()
  }

  async function removeRow(id: string) {
    if (!window.confirm(`Delete this ${itemLabel}? Existing BDE links may keep the id but label will be gone.`)) return
    setSavingId(id)
    setError(null)
    const { error: dErr } = await supabase.from(tableName).delete().eq('id', id)
    setSavingId(null)
    if (dErr) setError(dErr.message)
    else await load()
  }

  return (
    <section className="rounded-2xl border border-border bg-surface-raised/50 p-4 sm:p-5">
      <header className="mb-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </header>

      {error ? (
        <p className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-canvas/40 px-3 py-2"
            >
              <input
                className={`${inputClass} mt-0 min-w-[12rem] flex-1`}
                defaultValue={row.label}
                disabled={savingId === row.id}
                onBlur={(e) => {
                  if (e.target.value.trim() !== row.label) void saveLabel(row.id, e.target.value)
                }}
              />
              <button
                type="button"
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-black/[0.04] hover:text-fg"
                onClick={() => void toggleActive(row)}
                disabled={savingId === row.id}
              >
                {row.is_active ? 'Active' : 'Inactive'}
              </button>
              <button
                type="button"
                className="rounded-lg p-2 text-danger hover:bg-danger/10"
                aria-label={`Delete ${itemLabel}`}
                onClick={() => void removeRow(row.id)}
                disabled={savingId === row.id}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          className={`${inputClass} mt-0 min-w-[12rem] flex-1`}
          placeholder={`New ${itemLabel}`}
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void addRow()
            }
          }}
        />
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          onClick={() => void addRow()}
          disabled={!newLabel.trim() || savingId === 'new'}
        >
          <Plus className="size-4" />
          Add
        </button>
      </div>
    </section>
  )
}
