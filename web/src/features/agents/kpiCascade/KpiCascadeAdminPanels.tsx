import { useMemo, useState, type ReactNode } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { ForumMultiSelect } from './ForumMultiSelect'
import { newForum, newKpi, newLevel, newRole } from './catalogFactories'
import type { KpiCascadeForum, KpiCascadeKpi, KpiCascadeLevel, KpiCascadeRole } from './types'

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

type RolesPanelProps = {
  roles: KpiCascadeRole[]
  onChange: (roles: KpiCascadeRole[]) => void
}

export function RolesAdminPanel({ roles, onChange }: RolesPanelProps) {
  const [search, setSearch] = useState('')
  const [draftName, setDraftName] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return roles
    return roles.filter(
      (r) => r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q),
    )
  }, [roles, search])

  function patch(id: string, patch: Partial<KpiCascadeRole>) {
    onChange(roles.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  return (
    <TableShell
      count={roles.length}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search roles…"
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
                  onChange([...roles, newRole(draftName)])
                  setDraftName('')
                }
              }
            }}
            placeholder="New role name"
            className={`${inputClass} min-w-[12rem] flex-1`}
          />
          <button
            type="button"
            disabled={!draftName.trim()}
            onClick={() => {
              onChange([...roles, newRole(draftName)])
              setDraftName('')
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-4" />
            Add role
          </button>
        </div>
      }
    >
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="border-b border-border bg-canvas/60">
          <tr>
            <th className={thClass}>Name</th>
            <th className={`${thClass} w-[45%]`}>Description</th>
            <th className={`${thClass} w-20`}>Active</th>
            <th className={`${thClass} w-12`} aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-muted">
                No roles match your search
              </td>
            </tr>
          ) : (
            filtered.map((role) => (
              <tr key={role.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                <td className={tdClass}>
                  <input
                    type="text"
                    value={role.name}
                    onChange={(e) => patch(role.id, { name: e.target.value })}
                    className={`${inputClass} font-medium`}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="text"
                    value={role.description ?? ''}
                    onChange={(e) => patch(role.id, { description: e.target.value })}
                    placeholder="What this role owns in the cascade"
                    className={inputClass}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="checkbox"
                    checked={role.active}
                    onChange={(e) => patch(role.id, { active: e.target.checked })}
                    className="rounded border-border"
                    aria-label={`${role.name} active`}
                  />
                </td>
                <td className={tdClass}>
                  <DeleteButton label={role.name} onDelete={() => onChange(roles.filter((r) => r.id !== role.id))} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableShell>
  )
}

type ForumsPanelProps = {
  forums: KpiCascadeForum[]
  onChange: (forums: KpiCascadeForum[]) => void
}

export function ForumsAdminPanel({ forums, onChange }: ForumsPanelProps) {
  const [search, setSearch] = useState('')
  const [draftName, setDraftName] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return forums
    return forums.filter(
      (f) => f.name.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q),
    )
  }, [forums, search])

  function patch(id: string, patch: Partial<KpiCascadeForum>) {
    onChange(forums.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  return (
    <TableShell
      count={forums.length}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search forums…"
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
                  onChange([...forums, newForum(draftName, forums)])
                  setDraftName('')
                }
              }
            }}
            placeholder="New forum name"
            className={`${inputClass} min-w-[12rem] flex-1`}
          />
          <button
            type="button"
            disabled={!draftName.trim()}
            onClick={() => {
              onChange([...forums, newForum(draftName, forums)])
              setDraftName('')
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-4" />
            Add forum
          </button>
        </div>
      }
    >
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="border-b border-border bg-canvas/60">
          <tr>
            <th className={thClass}>Name</th>
            <th className={`${thClass} w-[40%]`}>Description</th>
            <th className={`${thClass} w-24`}>Position</th>
            <th className={`${thClass} w-20`}>Active</th>
            <th className={`${thClass} w-12`} aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-muted">
                No forums match your search
              </td>
            </tr>
          ) : (
            filtered.map((forum) => (
              <tr key={forum.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                <td className={tdClass}>
                  <input
                    type="text"
                    value={forum.name}
                    onChange={(e) => patch(forum.id, { name: e.target.value })}
                    className={`${inputClass} font-medium`}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="text"
                    value={forum.description ?? ''}
                    onChange={(e) => patch(forum.id, { description: e.target.value })}
                    placeholder="Meeting purpose, rhythm, attendees"
                    className={inputClass}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={forum.columnOrder ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value
                      patch(forum.id, {
                        columnOrder: raw === '' ? undefined : Math.max(1, Math.floor(Number(raw))),
                      })
                    }}
                    placeholder="—"
                    title="Column position (1 = leftmost)"
                    className={`${inputClass} w-16 text-center tabular-nums`}
                    aria-label={`Column position for ${forum.name}`}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="checkbox"
                    checked={forum.active}
                    onChange={(e) => patch(forum.id, { active: e.target.checked })}
                    className="rounded border-border"
                    aria-label={`${forum.name} active`}
                  />
                </td>
                <td className={tdClass}>
                  <DeleteButton
                    label={forum.name}
                    onDelete={() => onChange(forums.filter((f) => f.id !== forum.id))}
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

type LevelsPanelProps = {
  levels: KpiCascadeLevel[]
  forums: KpiCascadeForum[]
  onChange: (levels: KpiCascadeLevel[]) => void
}

export function LevelsAdminPanel({ levels, forums, onChange }: LevelsPanelProps) {
  const [search, setSearch] = useState('')
  const [draftName, setDraftName] = useState('')
  const [draftCode, setDraftCode] = useState('')

  const forumById = useMemo(() => new Map(forums.map((f) => [f.id, f])), [forums])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return levels
    return levels.filter((l) => {
      const forumNames = (l.forumIds ?? [])
        .map((id) => forumById.get(id)?.name ?? 'unknown')
        .join(' ')
      return (
        l.name.toLowerCase().includes(q) ||
        l.code?.toLowerCase().includes(q) ||
        forumNames.toLowerCase().includes(q)
      )
    })
  }, [levels, search, forumById])

  function patch(id: string, patch: Partial<KpiCascadeLevel>) {
    onChange(levels.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  return (
    <TableShell
      count={levels.length}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search levels…"
      footer={
        <div className="flex flex-wrap items-end gap-2">
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Level name"
            className={`${inputClass} min-w-[10rem] flex-1`}
          />
          <input
            type="text"
            value={draftCode}
            onChange={(e) => setDraftCode(e.target.value)}
            placeholder="Code"
            className={`${inputClass} w-20`}
          />
          <button
            type="button"
            disabled={!draftName.trim()}
            onClick={() => {
              onChange([...levels, newLevel(draftName, draftCode, levels)])
              setDraftName('')
              setDraftCode('')
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-4" />
            Add level
          </button>
        </div>
      }
    >
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="border-b border-border bg-canvas/60">
          <tr>
            <th className={thClass}>Name</th>
            <th className={`${thClass} w-24`}>Code</th>
            <th className={`${thClass} w-24`}>Position</th>
            <th className={`${thClass} min-w-[16rem]`}>Forums</th>
            <th className={`${thClass} w-20`}>Active</th>
            <th className={`${thClass} w-12`} aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-muted">
                No levels match your search
              </td>
            </tr>
          ) : (
            filtered.map((level) => (
                <tr key={level.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                  <td className={tdClass}>
                    <input
                      type="text"
                      value={level.name}
                      onChange={(e) => patch(level.id, { name: e.target.value })}
                      className={`${inputClass} font-medium`}
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="text"
                      value={level.code ?? ''}
                      onChange={(e) => patch(level.id, { code: e.target.value })}
                      placeholder="1–5"
                      className={`${inputClass} text-center`}
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={level.columnOrder ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value
                        patch(level.id, {
                          columnOrder: raw === '' ? undefined : Math.max(1, Math.floor(Number(raw))),
                        })
                      }}
                      placeholder="—"
                      title="Column position (1 = leftmost)"
                      className={`${inputClass} w-16 text-center tabular-nums`}
                      aria-label={`Column position for ${level.name}`}
                    />
                  </td>
                  <td className={`${tdClass} min-w-[16rem]`}>
                    <ForumMultiSelect
                      selectedIds={level.forumIds ?? []}
                      forums={forums}
                      forumById={forumById}
                      onChange={(forumIds) => patch(level.id, { forumIds })}
                      ariaLabel={`Forums for ${level.name}`}
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="checkbox"
                      checked={level.active}
                      onChange={(e) => patch(level.id, { active: e.target.checked })}
                      className="rounded border-border"
                      aria-label={`${level.name} active`}
                    />
                  </td>
                  <td className={tdClass}>
                    <DeleteButton
                      label={level.name}
                      onDelete={() => onChange(levels.filter((l) => l.id !== level.id))}
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

type KpisPanelProps = {
  kpis: KpiCascadeKpi[]
  forums: KpiCascadeForum[]
  onChange: (kpis: KpiCascadeKpi[]) => void
}

export function KpisAdminPanel({ kpis, forums, onChange }: KpisPanelProps) {
  const [search, setSearch] = useState('')
  const [draftName, setDraftName] = useState('')

  const forumById = useMemo(() => new Map(forums.map((f) => [f.id, f])), [forums])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return kpis
    return kpis.filter(
      (k) => k.name.toLowerCase().includes(q) || k.measure?.toLowerCase().includes(q),
    )
  }, [kpis, search])

  function patch(id: string, patch: Partial<KpiCascadeKpi>) {
    onChange(kpis.map((k) => (k.id === id ? { ...k, ...patch } : k)))
  }

  return (
    <TableShell
      count={kpis.length}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search KPIs…"
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
                  onChange([...kpis, newKpi(draftName)])
                  setDraftName('')
                }
              }
            }}
            placeholder="New KPI name"
            className={`${inputClass} min-w-[12rem] flex-1`}
          />
          <button
            type="button"
            disabled={!draftName.trim()}
            onClick={() => {
              onChange([...kpis, newKpi(draftName)])
              setDraftName('')
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-4" />
            Add KPI
          </button>
        </div>
      }
    >
      <table className="w-full min-w-[32rem] text-sm">
        <thead className="border-b border-border bg-canvas/60">
          <tr>
            <th className={thClass}>Name</th>
            <th className={`${thClass} w-48`}>Measure</th>
            <th className={`${thClass} min-w-[16rem]`}>Link to forum</th>
            <th className={`${thClass} w-20`}>Active</th>
            <th className={`${thClass} w-12`} aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-muted">
                No KPIs match your search
              </td>
            </tr>
          ) : (
            filtered.map((kpi) => (
              <tr key={kpi.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                <td className={tdClass}>
                  <input
                    type="text"
                    value={kpi.name}
                    onChange={(e) => patch(kpi.id, { name: e.target.value })}
                    className={`${inputClass} font-medium`}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="text"
                    value={kpi.measure ?? ''}
                    onChange={(e) => patch(kpi.id, { measure: e.target.value })}
                    placeholder="%, min, units, count…"
                    className={inputClass}
                  />
                </td>
                <td className={tdClass}>
                  <ForumMultiSelect
                    selectedIds={kpi.forumIds ?? []}
                    forums={forums}
                    forumById={forumById}
                    onChange={(forumIds) => patch(kpi.id, { forumIds })}
                    ariaLabel={`Forums for ${kpi.name}`}
                    panelSize="large"
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="checkbox"
                    checked={kpi.active}
                    onChange={(e) => patch(kpi.id, { active: e.target.checked })}
                    className="rounded border-border"
                    aria-label={`${kpi.name} active`}
                  />
                </td>
                <td className={tdClass}>
                  <DeleteButton label={kpi.name} onDelete={() => onChange(kpis.filter((k) => k.id !== kpi.id))} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableShell>
  )
}
