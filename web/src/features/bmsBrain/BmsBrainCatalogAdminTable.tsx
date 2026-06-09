import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { BmsCatalogKind, BmsCatalogRow } from './types'
import { useBmsBrainCatalog } from './useBmsBrainCatalog'

const TABLE: Record<BmsCatalogKind, string> = {
  roles: 'bms_brain_roles',
  forums: 'bms_brain_forums',
  systems: 'bms_brain_systems',
}

type Props = {
  kind: BmsCatalogKind
  title: string
  showIntegrations?: boolean
}

export function BmsBrainCatalogAdminTable({ kind, title, showIntegrations }: Props) {
  const { rows, loading, error, reload } = useBmsBrainCatalog(kind, true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function saveRow(row: BmsCatalogRow) {
    setSaving(true)
    setMsg(null)
    const payload = {
      slug: row.slug,
      name: row.name,
      description: row.description,
      color: row.color,
      icon: row.icon,
      sort_order: row.sort_order,
      is_active: row.is_active,
      ...(showIntegrations ? { integrations: row.integrations ?? '' } : {}),
    }
    const { error: e } = await supabase.from(TABLE[kind]).update(payload).eq('id', row.id)
    setSaving(false)
    setMsg(e ? e.message : 'Saved')
    if (!e) void reload()
  }

  async function addRow() {
    const slug = `${kind}-${Date.now()}`
    const { error: e } = await supabase.from(TABLE[kind]).insert({
      slug,
      name: 'New item',
      description: '',
      color: '#6366f1',
      icon: 'box',
      sort_order: rows.length + 1,
      is_active: true,
      ...(showIntegrations ? { integrations: '' } : {}),
    })
    if (e) setMsg(e.message)
    else void reload()
  }

  async function deleteRow(id: string) {
    const { error: e } = await supabase.from(TABLE[kind]).delete().eq('id', id)
    setMsg(e ? e.message : 'Deleted')
    if (!e) void reload()
  }

  if (loading) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted">
        <Loader2 className="size-5 animate-spin" aria-hidden />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <button
          type="button"
          onClick={() => void addRow()}
          className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
        >
          <Plus className="size-3.5" aria-hidden />
          Add
        </button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {msg ? <p className="text-xs text-muted">{msg}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-raised/80 text-xs text-muted">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Description</th>
              {showIntegrations ? <th className="px-3 py-2">Integrations</th> : null}
              <th className="px-3 py-2">Colour</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <CatalogRowEditor
                key={row.id}
                row={row}
                showIntegrations={showIntegrations}
                saving={saving}
                onSave={(r) => void saveRow(r)}
                onDelete={() => void deleteRow(row.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CatalogRowEditor({
  row: initial,
  showIntegrations,
  saving,
  onSave,
  onDelete,
}: {
  row: BmsCatalogRow
  showIntegrations?: boolean
  saving: boolean
  onSave: (row: BmsCatalogRow) => void
  onDelete: () => void
}) {
  const [row, setRow] = useState(initial)
  useEffect(() => setRow(initial), [initial])

  return (
    <tr className="border-t border-border/70">
      <td className="px-3 py-2">
        <input
          type="number"
          className="w-16 rounded border border-border px-2 py-1 text-xs"
          value={row.sort_order}
          onChange={(e) => setRow({ ...row, sort_order: Number(e.target.value) })}
        />
      </td>
      <td className="px-3 py-2">
        <input
          className="w-full min-w-[8rem] rounded border border-border px-2 py-1 text-xs"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
        />
      </td>
      <td className="px-3 py-2">
        <textarea
          className="w-full min-w-[12rem] rounded border border-border px-2 py-1 text-xs"
          rows={2}
          value={row.description}
          onChange={(e) => setRow({ ...row, description: e.target.value })}
        />
      </td>
      {showIntegrations ? (
        <td className="px-3 py-2">
          <textarea
            className="w-full min-w-[10rem] rounded border border-border px-2 py-1 text-xs"
            rows={2}
            value={row.integrations ?? ''}
            onChange={(e) => setRow({ ...row, integrations: e.target.value })}
          />
        </td>
      ) : null}
      <td className="px-3 py-2">
        <input
          type="color"
          className="h-8 w-12 cursor-pointer rounded border border-border"
          value={row.color}
          onChange={(e) => setRow({ ...row, color: e.target.value })}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={row.is_active}
          onChange={(e) => setRow({ ...row, is_active: e.target.checked })}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(row)}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-black/[0.04]"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded border border-danger/30 p-1 text-danger hover:bg-danger/10"
            title="Delete (blocked if used in published process)"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      </td>
    </tr>
  )
}
