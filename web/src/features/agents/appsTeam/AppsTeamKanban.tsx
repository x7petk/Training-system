import type { AppsTeamTicket, AppsTeamTicketStatus } from './types'
import { AGENT_LABELS, KANBAN_COLUMNS, boardColumnForStatus } from './types'
import { LIVE_BOARD_KANBAN } from './liveBoardTheme'

const STATUS_TINT: Record<AppsTeamTicketStatus, string> = {
  intake: 'border-slate-300 bg-slate-50',
  design: 'border-sky-300 bg-sky-50',
  pm_review_design: 'border-sky-300 bg-sky-50',
  build: 'border-amber-300 bg-amber-50',
  clarify: 'border-amber-300 bg-amber-50',
  test: 'border-violet-300 bg-violet-50',
  deploy: 'border-teal-300 bg-teal-50',
  done: 'border-emerald-300 bg-emerald-50',
  blocked: 'border-rose-300 bg-rose-50',
}

const NEUTRAL = {
  column: 'flex w-56 shrink-0 flex-col rounded-xl border border-border bg-surface/80',
  columnHeader: 'flex items-center justify-between border-b border-border px-3 py-2',
  columnLabel: 'text-xs font-semibold uppercase tracking-wide text-muted',
  countBadge: 'rounded-full bg-muted/30 px-2 py-0.5 text-[11px] text-fg',
  empty: 'px-1 py-6 text-center text-[11px] text-muted',
  cardSelected: 'ring-2 ring-sky-500',
  cardHover: 'hover:brightness-[0.98]',
  cardFocus: '',
} as const

export function AppsTeamKanban(props: {
  tickets: AppsTeamTicket[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** When `live-board`, applies sky theme classes from liveBoardTheme (scoped by page wrapper). */
  variant?: 'neutral' | 'live-board'
}) {
  const { tickets, selectedId, onSelect, variant = 'live-board' } = props
  const theme = variant === 'live-board' ? LIVE_BOARD_KANBAN : NEUTRAL

  return (
    <div className="flex w-full gap-3 overflow-x-auto pb-2">
      {KANBAN_COLUMNS.map((col) => {
        const cards = tickets.filter((t) => boardColumnForStatus(t.status) === col.id)
        return (
          <div key={col.id} className={theme.column}>
            <div className={theme.columnHeader}>
              <span className={theme.columnLabel}>{col.label}</span>
              <span className={theme.countBadge}>{cards.length}</span>
            </div>
            <div className="flex flex-col gap-2 p-2">
              {cards.length === 0 ? (
                <p className={theme.empty}>Empty</p>
              ) : (
                cards.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelect(t.id)}
                    className={`rounded-lg border px-2.5 py-2 text-left transition ${STATUS_TINT[t.status]} ${
                      selectedId === t.id ? theme.cardSelected : theme.cardHover
                    } ${theme.cardFocus}`}
                  >
                    <p className="line-clamp-2 text-sm font-medium text-fg">{t.title}</p>
                    {t.active_agent ? (
                      <p className="mt-1 text-[11px] text-muted">{AGENT_LABELS[t.active_agent]}</p>
                    ) : null}
                    {t.cursor_url && t.status !== 'done' ? (
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
