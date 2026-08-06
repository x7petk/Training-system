import type { AppsTeamTicket, AppsTeamTicketStatus } from './types'
import { AGENT_LABELS, KANBAN_COLUMNS } from './types'

const STATUS_TINT: Record<AppsTeamTicketStatus, string> = {
  intake: 'border-slate-300 bg-slate-50',
  design: 'border-sky-300 bg-sky-50',
  pm_review_design: 'border-indigo-300 bg-indigo-50',
  build: 'border-amber-300 bg-amber-50',
  clarify: 'border-orange-300 bg-orange-50',
  test: 'border-violet-300 bg-violet-50',
  deploy: 'border-teal-300 bg-teal-50',
  done: 'border-emerald-300 bg-emerald-50',
  blocked: 'border-rose-300 bg-rose-50',
}

export function AppsTeamKanban(props: {
  tickets: AppsTeamTicket[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { tickets, selectedId, onSelect } = props

  return (
    <div className="flex w-full gap-3 overflow-x-auto pb-2">
      {KANBAN_COLUMNS.map((col) => {
        const cards = tickets.filter((t) => t.status === col.id)
        return (
          <div
            key={col.id}
            className="flex w-56 shrink-0 flex-col rounded-xl border border-border bg-surface/80"
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">{col.label}</span>
              <span className="rounded-full bg-muted/30 px-2 py-0.5 text-[11px] text-fg">{cards.length}</span>
            </div>
            <div className="flex flex-col gap-2 p-2">
              {cards.length === 0 ? (
                <p className="px-1 py-6 text-center text-[11px] text-muted">Empty</p>
              ) : (
                cards.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelect(t.id)}
                    className={`rounded-lg border px-2.5 py-2 text-left transition ${STATUS_TINT[t.status]} ${
                      selectedId === t.id ? 'ring-2 ring-sky-500' : 'hover:brightness-[0.98]'
                    }`}
                  >
                    <p className="line-clamp-2 text-sm font-medium text-fg">{t.title}</p>
                    {t.active_agent ? (
                      <p className="mt-1 text-[11px] text-muted">{AGENT_LABELS[t.active_agent]}</p>
                    ) : null}
                    {t.cursor_url ? (
                      <p className="mt-1 truncate text-[10px] text-sky-700">Cloud agent active</p>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
