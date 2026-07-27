import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Search } from 'lucide-react'
import { BDE_TIME_PRESETS, type BdeTimePreset } from './bdeReportUtils'
import type { BdeReportFilters } from './useBdeReportData'

const selectClass =
  'h-8 min-w-[7rem] max-w-[11rem] rounded-lg border border-border-strong bg-surface px-2 text-xs text-fg shadow-sm'

export function BdeReportTabs() {
  return (
    <nav className="flex shrink-0 flex-wrap gap-2" aria-label="BDE report tabs">
      {[
        { to: '/problem-solve/bde/reports', label: 'Breakdown Elimination', end: true },
        { to: '/problem-solve/bde/reports/actions', label: 'BDE Actions' },
        { to: '/problem-solve/bde/reports/trends', label: 'BDE Trends' },
      ].map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            [
              'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
              isActive
                ? 'border-accent bg-accent text-white'
                : 'border-border bg-surface text-muted hover:bg-canvas hover:text-fg',
            ].join(' ')
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function BdeReportToolbar({
  filters,
  onChange,
  areas,
  equipment,
  createdByOptions,
  extraFilters,
}: {
  filters: BdeReportFilters
  onChange: (next: BdeReportFilters) => void
  areas: { id: string; name: string }[]
  equipment: { id: string; area_id: string; name: string }[]
  createdByOptions: string[]
  extraFilters?: ReactNode
}) {
  const equipmentOptions = filters.areaId
    ? equipment.filter((e) => e.area_id === filters.areaId)
    : equipment

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-raised/40 px-3 py-2">
      <label className="relative w-[11rem] min-w-[8rem]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
        <input
          className="h-8 w-full rounded-lg border border-border-strong bg-surface py-1 pl-8 pr-2 text-xs shadow-sm outline-none ring-accent/40 focus:ring-2"
          placeholder="Search…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </label>
      <div className="flex flex-wrap gap-1">
        {BDE_TIME_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`rounded-lg border px-2 py-1 text-xs font-medium transition ${
              filters.preset === p.id
                ? 'border-accent bg-accent text-white'
                : 'border-border bg-surface text-muted hover:bg-canvas hover:text-fg'
            }`}
            onClick={() => onChange({ ...filters, preset: p.id as BdeTimePreset })}
          >
            {p.label}
          </button>
        ))}
      </div>
      <select
        className={selectClass}
        aria-label="Area"
        value={filters.areaId}
        onChange={(e) => onChange({ ...filters, areaId: e.target.value, equipmentId: '' })}
      >
        <option value="">Area: All</option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        aria-label="Equipment"
        value={filters.equipmentId}
        onChange={(e) => onChange({ ...filters, equipmentId: e.target.value })}
      >
        <option value="">Equipment: All</option>
        {equipmentOptions.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        aria-label="Created by"
        value={filters.createdBy}
        onChange={(e) => onChange({ ...filters, createdBy: e.target.value })}
      >
        <option value="">Created by: All</option>
        {createdByOptions.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      {extraFilters}
    </div>
  )
}

export function BdeKpiCard({
  title,
  children,
  active,
  onClick,
}: {
  title: string
  children: ReactNode
  active?: boolean
  onClick?: () => void
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex min-h-[3.25rem] items-center gap-3 rounded-xl border px-3 py-1.5 text-left transition ${
        active
          ? 'border-fg bg-fg text-white'
          : 'border-border bg-surface-raised/60 hover:border-accent/40'
      } ${onClick ? 'cursor-pointer' : ''}`}
    >
      <p
        className={`shrink-0 text-[10px] font-medium uppercase tracking-wider ${active ? 'text-white/70' : 'text-muted'}`}
      >
        {title}
      </p>
      <div className="min-w-0 flex-1">{children}</div>
    </Comp>
  )
}
