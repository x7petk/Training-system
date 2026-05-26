import {
  ArrowDownUp,
  Filter,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { CascadeScope, CascadeViewFilters } from '../cascadeTypes'
import type { KpiCascadeForum, KpiCascadeKpi, KpiCascadeLevel } from '../types'

const selectClass =
  'h-8 w-full min-w-0 rounded border border-[#c5cad3] bg-white px-2 text-xs text-[#1a1a1a] shadow-sm'

const labelClass = 'mb-0.5 block text-[10px] font-medium text-[#5c6570]'

type Props = {
  scope: CascadeScope
  filters: CascadeViewFilters
  levels: KpiCascadeLevel[]
  kpis: KpiCascadeKpi[]
  forums: KpiCascadeForum[]
  liveLoading: boolean
  zoom: number
  selectionCount: number
  onScopeChange: (scope: CascadeScope) => void
  onFiltersChange: (filters: CascadeViewFilters) => void
  onRefreshLive: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onClearSelection: () => void
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

export function CascadeBuilderToolbar({
  scope,
  filters,
  levels,
  kpis,
  forums,
  liveLoading,
  zoom,
  selectionCount,
  onScopeChange,
  onFiltersChange,
  onRefreshLive,
  onZoomIn,
  onZoomOut,
  onClearSelection,
}: Props) {
  const activeLevels = levels.filter((l) => l.active)
  const activeKpis = kpis.filter((k) => k.active)
  const activeForums = forums.filter((f) => f.active)

  const hierarchy: { key: keyof CascadeScope; label: string }[] = [
    { key: 'product', label: 'Product' },
    { key: 'enterprise', label: 'Enterprise' },
    { key: 'workshop', label: 'Workshop' },
    { key: 'area', label: 'Area' },
    { key: 'unit', label: 'Unit' },
  ]

  return (
    <div className="shrink-0 space-y-2 rounded-lg border border-[#c5cad3] bg-[#f7f8fa] px-3 py-2.5 shadow-sm">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {hierarchy.map(({ key, label }) => (
          <label key={key} className="min-w-0">
            <span className={labelClass}>{label}</span>
            <input
              type="text"
              value={scope[key] as string}
              onChange={(e) => onScopeChange({ ...scope, [key]: e.target.value })}
              placeholder="All"
              className={selectClass}
            />
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-[#dde1e6] pt-2">
        <label className="min-w-[6.5rem]">
          <span className={labelClass}>Analysis period</span>
          <select
            className={selectClass}
            value={scope.analysisPeriod}
            onChange={(e) =>
              onScopeChange({
                ...scope,
                analysisPeriod: e.target.value as CascadeScope['analysisPeriod'],
              })
            }
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
        <label className="min-w-[7.5rem]">
          <span className={labelClass}>Date from</span>
          <input
            type="date"
            className={selectClass}
            value={scope.dateFrom}
            onChange={(e) => onScopeChange({ ...scope, dateFrom: e.target.value })}
          />
        </label>
        <label className="min-w-[7.5rem]">
          <span className={labelClass}>Date to</span>
          <input
            type="date"
            className={selectClass}
            value={scope.dateTo}
            onChange={(e) => onScopeChange({ ...scope, dateTo: e.target.value })}
          />
        </label>
        <label className="min-w-[6.5rem]">
          <span className={labelClass}>Period</span>
          <select
            className={selectClass}
            value={scope.periodicity}
            onChange={(e) =>
              onScopeChange({
                ...scope,
                periodicity: e.target.value as CascadeScope['periodicity'],
              })
            }
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
          <button
            type="button"
            onClick={onZoomOut}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#c5cad3] bg-white text-[#444] hover:bg-[#eef1f5]"
            title="Zoom out"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <span className="min-w-[2.5rem] text-center text-[10px] tabular-nums text-[#5c6570]">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={onZoomIn}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#c5cad3] bg-white text-[#444] hover:bg-[#eef1f5]"
            title="Zoom in"
          >
            <ZoomIn className="size-3.5" />
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded border border-[#c5cad3] bg-white px-2 text-xs font-medium text-[#333] hover:bg-[#eef1f5]"
            title="Filters"
          >
            <Filter className="size-3.5" />
            Filters
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded border border-[#c5cad3] bg-white px-2 text-xs font-medium text-[#333] hover:bg-[#eef1f5]"
            title="Sorting"
          >
            <ArrowDownUp className="size-3.5" />
            Sort
          </button>
        </div>

        <div className="relative min-w-[9rem] flex-1 sm:max-w-[14rem]">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[#8a939e]" />
          <input
            type="search"
            value={filters.searchQuery}
            onChange={(e) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
            placeholder="Search KPI…"
            className="h-8 w-full rounded border border-[#c5cad3] bg-white py-0 pl-7 pr-2 text-xs"
          />
        </div>

        <details className="group relative">
          <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded border border-[#c5cad3] bg-white px-2 text-xs font-medium text-[#333] hover:bg-[#eef1f5] [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal className="size-3.5" />
            Slice
          </summary>
          <div className="absolute left-0 z-40 mt-1 max-h-56 min-w-[14rem] overflow-y-auto rounded border border-[#c5cad3] bg-white py-1 shadow-lg">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase text-[#8a939e]">Levels</p>
            {activeLevels.map((l) => (
              <label key={l.id} className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs hover:bg-[#f0f2f5]">
                <input
                  type="checkbox"
                  checked={filters.levelIds.includes(l.id)}
                  onChange={() =>
                    onFiltersChange({
                      ...filters,
                      levelIds: toggleId(filters.levelIds, l.id),
                    })
                  }
                />
                {l.name}
              </label>
            ))}
            <p className="mt-1 px-2 py-1 text-[10px] font-semibold uppercase text-[#8a939e]">KPIs</p>
            {activeKpis.map((k) => (
              <label key={k.id} className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs hover:bg-[#f0f2f5]">
                <input
                  type="checkbox"
                  checked={filters.kpiIds.includes(k.id)}
                  onChange={() =>
                    onFiltersChange({
                      ...filters,
                      kpiIds: toggleId(filters.kpiIds, k.id),
                    })
                  }
                />
                {k.name}
              </label>
            ))}
            <p className="mt-1 px-2 py-1 text-[10px] font-semibold uppercase text-[#8a939e]">Forums</p>
            {activeForums.map((f) => (
              <label key={f.id} className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs hover:bg-[#f0f2f5]">
                <input
                  type="checkbox"
                  checked={filters.forumIds.includes(f.id)}
                  onChange={() =>
                    onFiltersChange({
                      ...filters,
                      forumIds: toggleId(filters.forumIds, f.id),
                    })
                  }
                />
                {f.name}
              </label>
            ))}
          </div>
        </details>

        <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded border border-[#c5cad3] bg-white px-2.5 text-xs font-medium text-[#333]">
          <input
            type="checkbox"
            checked={filters.onlyConnected}
            onChange={(e) => onFiltersChange({ ...filters, onlyConnected: e.target.checked })}
            className="rounded border-[#c5cad3]"
          />
          Only linked
        </label>

        <button
          type="button"
          onClick={onRefreshLive}
          disabled={liveLoading || !scope.dateFrom || !scope.dateTo}
          className="inline-flex h-8 items-center gap-1 rounded border border-[#c5cad3] bg-white px-2.5 text-xs font-medium text-[#333] hover:bg-[#eef1f5] disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${liveLoading ? 'animate-spin' : ''}`} />
          Sync DDS
        </button>

        <button
          type="button"
          onClick={onClearSelection}
          disabled={selectionCount === 0}
          className="ml-auto inline-flex h-8 items-center rounded bg-[#2b6cb0] px-4 text-xs font-semibold text-white hover:bg-[#255b9a] disabled:opacity-40"
        >
          Clear selection{selectionCount > 0 ? ` (${selectionCount})` : ''}
        </button>
      </div>
    </div>
  )
}
