import { ListPlus } from 'lucide-react'

/** Placeholder control next to site / plant / cell scope (LDR tools). */
export function LdrLocationCreateActionButton() {
  return (
    <button
      type="button"
      title="Create action (coming soon)"
      aria-label="Create action"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-surface-raised hover:text-fg"
      onClick={() => {
        /* placeholder */
      }}
    >
      <ListPlus className="size-4 shrink-0" aria-hidden />
      Create Action
    </button>
  )
}
