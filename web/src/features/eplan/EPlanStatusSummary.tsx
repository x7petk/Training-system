import { EPLAN_STATUS_CARD_CLASS, EPLAN_STATUS_LABEL, EPLAN_STATUS_ORDER } from './eplanConstants'
import type { EPlanActionStatus } from './eplanTypes'

type Props = {
  counts: Record<EPlanActionStatus, number>
  activeStatus: EPlanActionStatus | 'all'
  onSelect: (status: EPlanActionStatus | 'all') => void
  hideNotRequired?: boolean
}

export function EPlanStatusSummary({ counts, activeStatus, onSelect, hideNotRequired = true }: Props) {
  const statuses = hideNotRequired ? EPLAN_STATUS_ORDER.filter((s) => s !== 'NOT_REQUIRED') : EPLAN_STATUS_ORDER

  return (
    <div className="flex flex-wrap gap-1" aria-label="Status summary">
      {statuses.map((status) => {
        const active = activeStatus === status
        return (
          <button
            key={status}
            type="button"
            onClick={() => onSelect(active ? 'all' : status)}
            className={[
              'inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-left transition-shadow',
              EPLAN_STATUS_CARD_CLASS[status],
              active ? 'ring-1 ring-accent/50' : 'hover:shadow-sm',
            ].join(' ')}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wide opacity-85">{EPLAN_STATUS_LABEL[status]}</span>
            <span className="font-display text-sm font-semibold tabular-nums leading-none">{counts[status]}</span>
          </button>
        )
      })}
    </div>
  )
}
