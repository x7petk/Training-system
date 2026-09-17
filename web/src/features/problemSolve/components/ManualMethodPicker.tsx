import { LOSS_TYPES, METHOD_LABELS } from '../mockData'
import type { InitialMethod, LossTypeId } from '../types'

export function ManualMethodPicker(props: {
  onPick: (lossTypeId: LossTypeId, method: InitialMethod) => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Choose method manually</h2>
          <p className="mt-1 text-sm text-muted">
            Skip AI routing and open the initial problem-solve form for the matching loss type.
          </p>
        </div>
        <button
          type="button"
          onClick={props.onCancel}
          className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-fg"
        >
          Back to chat
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {LOSS_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => props.onPick(t.id, t.initialMethod)}
            className={`rounded-xl border ${t.border} ${t.bg} p-3 text-left transition hover:shadow-sm`}
          >
            <p className={`text-sm font-semibold ${t.color}`}>{t.shortLabel}</p>
            <p className="mt-1 text-xs text-fg/80">{t.description}</p>
            <p className="mt-2 text-[11px] font-medium text-muted">
              Initial: {METHOD_LABELS[t.initialMethod]} · Advanced: {METHOD_LABELS[t.advancedMethod]}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
