import { useMemo, useState, type ReactNode } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { newSystem } from './catalogFactories'
import type { SwpSystem } from './types'

type TableShellProps = {
  count: number
  search: string
  onSearch: (q: string) => void
  searchPlaceholder: string
  children: ReactNode
  footer: ReactNode
}

function TableShell({ count, search, onSearch, searchPlaceholder, children, footer }: TableShellProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-raised/40 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-4 py-3">
        <span className="text-sm text-muted">
          <span className="font-medium text-fg">{count}</span> items
        </span>
        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-border bg-canvas py-1.5 pl-8 pr-3 text-sm"
          />
        </div>
      </div>
      <div className="overflow-x-auto">{children}</div>
      <footer className="border-t border-border bg-canvas/50 px-4 py-3">{footer}</footer>
    </div>
  )
}

const inputClass =
  'w-full min-w-0 rounded-md border border-border bg-canvas px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30'
const thClass = 'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted'
const tdClass = 'px-3 py-2 align-middle'

function DeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm(`Remove "${label}"?`)) onDelete()
      }}
      className="rounded p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-600"
      aria-label={`Delete ${label}`}
    >
      <Trash2 className="size-4" />
    </button>
  )
}

type SystemsPanelProps = {
  systems: SwpSystem[]
  onChange: (systems: SwpSystem[]) => void
}

export function SystemsAdminPanel({ systems, onChange }: SystemsPanelProps) {
  const [search, setSearch] = useState('')
  const [draftName, setDraftName] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return systems
    return systems.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q),
    )
  }, [systems, search])

  function patch(id: string, patch: Partial<SwpSystem>) {
    onChange(systems.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  return (
    <TableShell
      count={systems.length}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search systems…"
      footer={
        <div className="flex flex-wrap items-end gap-2">
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (draftName.trim()) {
                  onChange([...systems, newSystem(draftName)])
                  setDraftName('')
                }
              }
            }}
            placeholder="New system code (e.g. CL)"
            className={`${inputClass} min-w-[12rem] flex-1`}
          />
          <button
            type="button"
            disabled={!draftName.trim()}
            onClick={() => {
              onChange([...systems, newSystem(draftName)])
              setDraftName('')
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-4" />
            Add system
          </button>
        </div>
      }
    >
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="border-b border-border bg-canvas/60">
          <tr>
            <th className={thClass}>System</th>
            <th className={`${thClass} w-[45%]`}>Description</th>
            <th className={`${thClass} w-20`}>Active</th>
            <th className={`${thClass} w-12`} aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-muted">
                No systems match your search
              </td>
            </tr>
          ) : (
            filtered.map((system) => (
              <tr key={system.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                <td className={tdClass}>
                  <input
                    type="text"
                    value={system.name}
                    onChange={(e) => patch(system.id, { name: e.target.value })}
                    className={`${inputClass} font-medium uppercase tracking-wide`}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="text"
                    value={system.description ?? ''}
                    onChange={(e) => patch(system.id, { description: e.target.value })}
                    placeholder="What this system covers"
                    className={inputClass}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="checkbox"
                    checked={system.active}
                    onChange={(e) => patch(system.id, { active: e.target.checked })}
                    className="rounded border-border"
                    aria-label={`${system.name} active`}
                  />
                </td>
                <td className={tdClass}>
                  <DeleteButton
                    label={system.name}
                    onDelete={() => onChange(systems.filter((s) => s.id !== system.id))}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableShell>
  )
}
