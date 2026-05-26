import { Filter, Search } from 'lucide-react'
import type { CascadeViewFilters } from '../cascadeTypes'
import type { KpiCascadeForum, KpiCascadeKpi, KpiCascadeLevel } from '../types'

type Props = {
  filters: CascadeViewFilters
  levels: KpiCascadeLevel[]
  kpis: KpiCascadeKpi[]
  forums: KpiCascadeForum[]
  onChange: (filters: CascadeViewFilters) => void
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

function MultiFilter({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: { id: string; name: string }[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-border bg-canvas px-3 py-1.5 text-sm font-medium text-fg hover:bg-surface-raised [&::-webkit-details-marker]:hidden">
        {label}
        {selected.length > 0 ? (
          <span className="rounded-full bg-accent/15 px-1.5 text-xs text-accent">{selected.length}</span>
        ) : null}
      </summary>
      <div className="absolute left-0 z-30 mt-1 max-h-48 min-w-[12rem] overflow-y-auto rounded-lg border border-border bg-canvas py-1 shadow-lg">
        {options.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted">None configured</p>
        ) : (
          options.map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-black/[0.04]"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.id)}
                onChange={() => onToggle(opt.id)}
                className="rounded border-border"
              />
              {opt.name}
            </label>
          ))
        )}
      </div>
    </details>
  )
}

export function CascadeFilterBar({ filters, levels, kpis, forums, onChange }: Props) {
  const activeLevels = levels.filter((l) => l.active)
  const activeKpis = kpis.filter((k) => k.active)
  const activeForums = forums.filter((f) => f.active)

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-raised/40 px-3 py-2.5">
      <Filter className="size-4 shrink-0 text-muted" aria-hidden />
      <div className="relative min-w-[10rem] flex-1 sm:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={filters.searchQuery}
          onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
          placeholder="Search metrics…"
          className="w-full rounded-lg border border-border bg-canvas py-1.5 pl-8 pr-3 text-sm"
        />
      </div>
      <MultiFilter
        label="Levels"
        options={activeLevels.map((l) => ({ id: l.id, name: l.name }))}
        selected={filters.levelIds}
        onToggle={(id) => onChange({ ...filters, levelIds: toggleId(filters.levelIds, id) })}
      />
      <MultiFilter
        label="KPIs"
        options={activeKpis.map((k) => ({ id: k.id, name: k.name }))}
        selected={filters.kpiIds}
        onToggle={(id) => onChange({ ...filters, kpiIds: toggleId(filters.kpiIds, id) })}
      />
      <MultiFilter
        label="Forums"
        options={activeForums.map((f) => ({ id: f.id, name: f.name }))}
        selected={filters.forumIds}
        onToggle={(id) => onChange({ ...filters, forumIds: toggleId(filters.forumIds, id) })}
      />
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-1.5 text-sm">
        <input
          type="checkbox"
          checked={filters.onlyConnected}
          onChange={(e) => onChange({ ...filters, onlyConnected: e.target.checked })}
          className="rounded border-border"
        />
        <span className="font-medium text-fg">Only connected</span>
      </label>
      {(filters.levelIds.length > 0 ||
        filters.kpiIds.length > 0 ||
        filters.forumIds.length > 0 ||
        filters.searchQuery ||
        filters.onlyConnected) && (
        <button
          type="button"
          onClick={() =>
            onChange({
              levelIds: [],
              kpiIds: [],
              forumIds: [],
              onlyConnected: false,
              searchQuery: '',
            })
          }
          className="text-sm font-medium text-accent hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
