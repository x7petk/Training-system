import { RotateCcw } from 'lucide-react'
import type { BmsCatalogRow, BmsViewFilters } from './types'

type Props = {
  roles: BmsCatalogRow[]
  forums: BmsCatalogRow[]
  systems: BmsCatalogRow[]
  filters: BmsViewFilters
  onChange: (patch: Partial<BmsViewFilters>) => void
  onReset: () => void
}

function MultiSelect({
  label,
  options,
  selected,
  onToggle,
  colorKey,
}: {
  label: string
  options: { id: string; name: string; color?: string }[]
  selected: string[]
  onToggle: (id: string) => void
  colorKey?: boolean
}) {
  return (
    <label className="flex min-w-[10rem] flex-col gap-1 text-xs">
      <span className="font-medium text-muted">{label}</span>
      <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto rounded-lg border border-border bg-canvas/60 p-2">
        {options.map((o) => {
          const on = selected.length === 0 || selected.includes(o.id)
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onToggle(o.id)}
              className={[
                'rounded-full px-2 py-0.5 text-[11px] font-medium transition',
                on ? 'ring-1 ring-accent/40' : 'opacity-40',
              ].join(' ')}
              style={
                colorKey && o.color
                  ? { backgroundColor: `${o.color}22`, color: o.color, borderColor: o.color }
                  : undefined
              }
            >
              {o.name}
            </button>
          )
        })}
      </div>
    </label>
  )
}

function toggleId(list: string[], id: string, total: number): string[] {
  if (list.length === 0) return [id]
  if (list.includes(id)) {
    const next = list.filter((x) => x !== id)
    return next.length === 0 ? [] : next
  }
  const next = [...list, id]
  return next.length === total ? [] : next
}

export function BmsBrainFilterBar({ roles, forums, systems, filters, onChange, onReset }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface-raised/50 p-3">
      <MultiSelect
        label="Tool tags"
        options={systems.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
        selected={filters.systemIds}
        onToggle={(id) => onChange({ systemIds: toggleId(filters.systemIds, id, systems.length) })}
        colorKey
      />
      <MultiSelect
        label="Roles"
        options={roles.map((r) => ({ id: r.id, name: r.name, color: r.color }))}
        selected={filters.roleIds}
        onToggle={(id) => onChange({ roleIds: toggleId(filters.roleIds, id, roles.length) })}
        colorKey
      />
      <MultiSelect
        label="Forums"
        options={forums.map((f) => ({ id: f.id, name: f.name, color: f.color }))}
        selected={filters.forumIds}
        onToggle={(id) => onChange({ forumIds: toggleId(filters.forumIds, id, forums.length) })}
        colorKey
      />
      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:bg-black/[0.04] hover:text-fg"
      >
        <RotateCcw className="size-3.5" aria-hidden />
        Reset filters
      </button>
    </div>
  )
}
