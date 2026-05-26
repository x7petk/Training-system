import { Filter } from 'lucide-react'
import type { SwpSystem } from './types'

type Props = {
  systems: SwpSystem[]
  selectedSystemId: string | null
  onSelectSystem: (systemId: string) => void
}

export function SwpProcessFilterBar({ systems, selectedSystemId, onSelectSystem }: Props) {
  const active = systems.filter((s) => s.active)

  if (active.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised/40 px-4 py-3 text-sm text-muted">
        No active systems — add systems in Admin.
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface-raised/40 px-2 py-1.5">
      <Filter className="size-3.5 shrink-0 text-muted" aria-hidden />
      <div
        className="inline-flex flex-wrap gap-0.5 rounded-md border border-border bg-canvas p-0.5"
        role="radiogroup"
        aria-label="Select system"
      >
        {active.map((system) => {
          const on = selectedSystemId === system.id
          return (
            <button
              key={system.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelectSystem(system.id)}
              className={`rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                on
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-muted hover:bg-surface-raised hover:text-fg'
              }`}
            >
              {system.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
