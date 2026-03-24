import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Layers, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type TeamRow = { id: string; name: string; sort_order: number }

const inputClass =
  'w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2'

export function TeamsManager() {
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase.from('teams').select('id, name, sort_order').order('sort_order')
    setLoading(false)
    if (qErr) {
      setError(qErr.message)
      setTeams([])
      return
    }
    setTeams((data ?? []) as TeamRow[])
  }, [])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void load()
    })
    return () => cancelAnimationFrame(id)
  }, [load])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    setError(null)
    const nextOrder = teams.length > 0 ? Math.max(...teams.map((t) => t.sort_order)) + 10 : 10
    const { error: insErr } = await supabase.from('teams').insert({ name, sort_order: nextOrder })
    setSaving(false)
    if (insErr) {
      setError(insErr.message)
      return
    }
    setNewName('')
    void load()
  }

  async function handleDelete(row: TeamRow) {
    if (!window.confirm(`Delete team “${row.name}”? People in this team will have no team assigned.`)) return
    setError(null)
    const { error: delErr } = await supabase.from('teams').delete().eq('id', row.id)
    if (delErr) {
      setError(delErr.message)
      return
    }
    void load()
  }

  return (
    <section className="rounded-2xl border border-border bg-surface-raised/40 backdrop-blur-sm">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Layers className="size-5 text-accent" aria-hidden />
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Teams</h2>
            <p className="text-xs text-muted">Shifts and work groups. Assign people in People.</p>
          </div>
        </div>
        <form onSubmit={(e) => void handleAdd(e)} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New team name"
            className={`${inputClass} sm:min-w-[12rem]`}
            maxLength={120}
            aria-label="New team name"
          />
          <button
            type="submit"
            disabled={saving || !newName.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
          >
            <Plus className="size-4" aria-hidden />
            Add team
          </button>
        </form>
      </div>

      {error ? (
        <p className="border-b border-border px-4 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
        ) : teams.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No teams yet.</p>
        ) : (
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="w-20 px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {teams.map((t) => (
                <tr key={t.id} className="hover:bg-black/[0.04]">
                  <td className="px-4 py-3 font-medium text-fg">{t.name}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDelete(t)}
                      className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"
                      aria-label={`Delete ${t.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
