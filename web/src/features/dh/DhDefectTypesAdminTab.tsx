import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { DhDefectTypeRow } from './dhTypes'

const inputClass =
  'mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2'

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'type'
}

export function DhDefectTypesAdminTab({
  config = {
    title: 'DH defect types',
    description: 'Super admin only. These labels appear when users create defects. Inactive types stay hidden from operators but remain on existing records.',
    tableName: 'dh_defect_types',
    itemLabel: 'defect type',
    itemLabelPlural: 'defect types',
  },
}: {
  config?: {
    title: string
    description: string
    tableName: 'dh_defect_types' | 'deviation_types' | 'quality_fail_types'
    itemLabel: string
    itemLabelPlural: string
  }
}) {
  const [rows, setRows] = useState<DhDefectTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from(config.tableName)
      .select('*')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true })
    setLoading(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    setRows((data ?? []) as DhDefectTypeRow[])
  }, [config.tableName])

  useEffect(() => {
    void load()
  }, [load])

  async function addType() {
    const label = newLabel.trim()
    if (!label) return
    setError(null)
    const slug = slugify(label)
    const nextOrder = rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0
    const { error: insErr } = await supabase.from(config.tableName).insert({
      slug,
      label,
      sort_order: nextOrder,
      is_active: true,
    })
    if (insErr) {
      setError(insErr.message)
      return
    }
    setNewLabel('')
    await load()
  }

  async function saveRow(row: DhDefectTypeRow, patch: Partial<Pick<DhDefectTypeRow, 'label' | 'sort_order' | 'is_active'>>) {
    setSavingId(row.id)
    setError(null)
    const { error: uErr } = await supabase.from(config.tableName).update(patch).eq('id', row.id)
    setSavingId(null)
    if (uErr) setError(uErr.message)
    else await load()
  }

  async function removeRow(row: DhDefectTypeRow) {
    if (!confirm(`Remove ${config.itemLabel} "${row.label}"? Only allowed if no records use it.`)) return
    setError(null)
    const { error: dErr } = await supabase.from(config.tableName).delete().eq('id', row.id)
    if (dErr) setError(dErr.message)
    else await load()
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{config.title}</h2>
        <p className="mt-1 max-w-2xl text-xs text-muted">{config.description}</p>
      </div>

      {error ? <div className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div> : null}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-border bg-surface-raised/40 text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="bg-surface">
                  <td className="px-3 py-2">
                    <input
                      className="h-9 w-full min-w-[10rem] rounded border border-border bg-canvas/50 px-2 text-sm"
                      defaultValue={r.label}
                      key={`${r.id}-${r.label}-${r.updated_at}`}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (v && v !== r.label) void saveRow(r, { label: v })
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted">{r.slug}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="h-9 w-20 rounded border border-border bg-canvas/50 px-2 text-sm"
                      defaultValue={r.sort_order}
                      key={`${r.id}-ord-${r.sort_order}`}
                      onBlur={(e) => {
                        const n = Number.parseInt(e.target.value, 10)
                        if (!Number.isNaN(n) && n !== r.sort_order) void saveRow(r, { sort_order: n })
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={r.is_active}
                      onChange={(e) => void saveRow(r, { is_active: e.target.checked })}
                      disabled={savingId === r.id}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="rounded p-1.5 text-danger hover:bg-danger/10"
                      onClick={() => void removeRow(r)}
                      aria-label={`Delete ${r.label}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-raised/30 p-4 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs text-muted">
          {`New ${config.itemLabel} label`}
          <input className={inputClass} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Packaging" />
        </label>
        <button
          type="button"
          onClick={() => void addType()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white"
        >
          <Plus className="size-4" aria-hidden />
          Add type
        </button>
      </div>
      <p className="text-[11px] text-muted">{`Slug is generated when adding; edit label to rename display text for ${config.itemLabelPlural}.`}</p>
    </div>
  )
}
