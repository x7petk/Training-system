import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { EPlanAdminStore, EPlanPageFilters } from './eplanTypes'
import { activeAdminItems, activeOwners } from './eplanAdminService'
import { EPLAN_STATUS_LABEL, EPLAN_STATUS_ORDER } from './eplanConstants'

const fieldClass =
  'h-7 rounded-md border border-border bg-surface px-1.5 text-[11px] outline-none ring-accent/30 focus:border-accent/50 focus:ring-1'

type Props = {
  filters: EPlanPageFilters
  admin: EPlanAdminStore
  onChange: (next: EPlanPageFilters) => void
}

export function EPlanFilters({ filters, admin, onChange }: Props) {
  const [moreOpen, setMoreOpen] = useState(false)
  const set = (patch: Partial<EPlanPageFilters>) => onChange({ ...filters, ...patch })

  const moreActive =
    filters.forumId !== 'all' ||
    filters.labelId !== 'all' ||
    filters.lossTypeId !== 'all' ||
    filters.raisedById !== 'all' ||
    filters.showNotRequired

  return (
    <div className="rounded-lg border border-border bg-surface-raised/30 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <InlineSelect
          label="Status"
          value={filters.status}
          onChange={(v) => set({ status: v as EPlanPageFilters['status'] })}
          options={[{ value: 'all', label: 'All' }, ...EPLAN_STATUS_ORDER.map((s) => ({ value: s, label: EPLAN_STATUS_LABEL[s] }))]}
        />
        <InlineSelect
          label="Category"
          value={filters.ogsmPillarId}
          onChange={(v) => set({ ogsmPillarId: v })}
          options={[{ value: 'all', label: 'All' }, ...activeAdminItems(admin.ogsmPillars).map((i) => ({ value: i.id, label: i.name }))]}
        />
        <InlineSelect
          label="Owner"
          value={filters.actionOwnerId}
          onChange={(v) => set({ actionOwnerId: v })}
          options={[{ value: 'all', label: 'All' }, ...activeOwners(admin.owners).map((i) => ({ value: i.id, label: i.name }))]}
        />
        <label className="inline-flex items-center gap-1 text-[10px] text-muted">
          <span className="shrink-0">From</span>
          <input type="date" className={`${fieldClass} w-[7.25rem]`} value={filters.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} />
        </label>
        <label className="inline-flex items-center gap-1 text-[10px] text-muted">
          <span className="shrink-0">To</span>
          <input type="date" className={`${fieldClass} w-[7.25rem]`} value={filters.dateTo} onChange={(e) => set({ dateTo: e.target.value })} />
        </label>
        <button
          type="button"
          className={[
            'inline-flex h-7 items-center gap-0.5 rounded-md border px-1.5 text-[10px] font-medium',
            moreActive || moreOpen ? 'border-accent/40 bg-accent-dim text-accent' : 'border-border text-muted hover:bg-black/[0.04]',
          ].join(' ')}
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
        >
          More
          {moreOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>
      </div>
      {moreOpen ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/60 pt-1.5">
          <InlineSelect
            label="Forum"
            value={filters.forumId}
            onChange={(v) => set({ forumId: v })}
            options={[{ value: 'all', label: 'All' }, ...activeAdminItems(admin.forums).map((i) => ({ value: i.id, label: i.name }))]}
          />
          <InlineSelect
            label="Label"
            value={filters.labelId}
            onChange={(v) => set({ labelId: v })}
            options={[{ value: 'all', label: 'All' }, ...activeAdminItems(admin.labels).map((i) => ({ value: i.id, label: i.name }))]}
          />
          <InlineSelect
            label="Loss"
            value={filters.lossTypeId}
            onChange={(v) => set({ lossTypeId: v })}
            options={[{ value: 'all', label: 'All' }, ...activeAdminItems(admin.lossTypes).map((i) => ({ value: i.id, label: i.name }))]}
          />
          <InlineSelect
            label="Raised"
            value={filters.raisedById}
            onChange={(v) => set({ raisedById: v })}
            options={[{ value: 'all', label: 'All' }, ...activeOwners(admin.owners).map((i) => ({ value: i.id, label: i.name }))]}
          />
          <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border bg-surface px-1.5 text-[10px] text-fg">
            <input
              type="checkbox"
              className="size-3 accent-[var(--color-accent)]"
              checked={filters.showNotRequired}
              onChange={(e) => set({ showNotRequired: e.target.checked })}
            />
            Not Required
          </label>
        </div>
      ) : null}
    </div>
  )
}

function InlineSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="inline-flex items-center gap-1 text-[10px] text-muted">
      <span className="shrink-0">{label}</span>
      <select className={`${fieldClass} max-w-[6.5rem]`} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
