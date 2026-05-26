import { Calendar, RefreshCw } from 'lucide-react'
import type { CascadeScope } from '../cascadeTypes'

type Props = {
  scope: CascadeScope
  onChange: (scope: CascadeScope) => void
  onRefreshLive: () => void
  liveLoading: boolean
}

const fieldClass =
  'h-9 min-w-0 rounded-lg border border-border bg-canvas px-2.5 text-sm text-fg shadow-sm'

export function CascadeScopeBar({ scope, onChange, onRefreshLive, liveLoading }: Props) {
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-surface-raised/40 px-2 py-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Analysis scope</span>
        </div>
        <button
          type="button"
          onClick={onRefreshLive}
          disabled={liveLoading || !scope.dateFrom || !scope.dateTo}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${liveLoading ? 'animate-spin' : ''}`} />
          Sync budget / fact from DDS
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Product (optional)
          <input
            type="text"
            value={scope.product}
            onChange={(e) => onChange({ ...scope, product: e.target.value })}
            placeholder="e.g. Concentrate"
            className={`${fieldClass} min-w-[10rem]`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Analysis period
          <select
            className={fieldClass}
            value={scope.analysisPeriod}
            onChange={(e) =>
              onChange({ ...scope, analysisPeriod: e.target.value as CascadeScope['analysisPeriod'] })
            }
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          <span className="inline-flex items-center gap-1">
            <Calendar className="size-3.5" /> From
          </span>
          <input
            type="date"
            className={fieldClass}
            value={scope.dateFrom}
            onChange={(e) => onChange({ ...scope, dateFrom: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          To
          <input
            type="date"
            className={fieldClass}
            value={scope.dateTo}
            onChange={(e) => onChange({ ...scope, dateTo: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Periodicity
          <select
            className={fieldClass}
            value={scope.periodicity}
            onChange={(e) =>
              onChange({ ...scope, periodicity: e.target.value as CascadeScope['periodicity'] })
            }
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
      </div>
    </div>
  )
}
