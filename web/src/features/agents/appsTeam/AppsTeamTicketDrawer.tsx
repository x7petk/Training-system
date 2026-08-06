import { ExternalLink, X } from 'lucide-react'
import type { AppsTeamEvent, AppsTeamTicket } from './types'
import { AGENT_LABELS, boardColumnForStatus, handoffLabel } from './types'

export function AppsTeamTicketDrawer(props: {
  ticket: AppsTeamTicket
  events: AppsTeamEvent[]
  busy: boolean
  onClose: () => void
  onDelete: () => void
}) {
  const { ticket, events, busy, onClose, onDelete } = props
  const boardStatus = boardColumnForStatus(ticket.status)

  const handoffs = events
    .filter((e) => e.ticket_id === ticket.id)
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((e) => {
      const label = handoffLabel(e)
      if (!label) return null
      return { id: e.id, at: e.created_at, label }
    })
    .filter((x): x is { id: string; at: string; label: string } => Boolean(x))

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{boardStatus}</p>
          <h2 className="truncate text-base font-semibold text-fg">{ticket.title}</h2>
          {ticket.active_agent ? (
            <p className="text-xs text-muted">Active: {AGENT_LABELS[ticket.active_agent]}</p>
          ) : null}
          {busy ? <p className="text-[11px] text-sky-700">Pipeline working…</p> : null}
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-muted/20" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2.5 sm:px-5">
        {ticket.cursor_url && ticket.status !== 'done' ? (
          <a
            href={ticket.cursor_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-sky-700"
          >
            Open in Cursor <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="ml-auto rounded-md px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      <div className="space-y-6 px-4 py-5 text-sm sm:px-5 sm:py-6">
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Description</h3>
          <p className="whitespace-pre-wrap text-fg">{ticket.description || '—'}</p>
        </section>

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Value</h3>
          <p className="whitespace-pre-wrap text-fg">{ticket.value_proposition || '—'}</p>
        </section>

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Requirements</h3>
          {ticket.requirements.length === 0 ? (
            <p className="text-muted">—</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-fg">
              {ticket.requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Acceptance criteria</h3>
          {ticket.acceptance_criteria.length === 0 ? (
            <p className="text-muted">—</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-fg">
              {ticket.acceptance_criteria.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </section>

        {ticket.design_brief ? (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Design brief</h3>
            <p className="mb-2 whitespace-pre-wrap text-fg">{ticket.design_brief.summary}</p>
            {ticket.design_brief.layout ? (
              <p className="mb-2 whitespace-pre-wrap text-fg">
                <span className="font-medium">Layout: </span>
                {ticket.design_brief.layout}
              </p>
            ) : null}
          </section>
        ) : null}

        {(ticket.artifacts.prUrl || ticket.artifacts.productionUrl || ticket.artifacts.branch) && (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Artifacts</h3>
            <ul className="space-y-1 text-fg">
              {ticket.artifacts.branch ? <li>Branch: {String(ticket.artifacts.branch)}</li> : null}
              {ticket.artifacts.prUrl ? (
                <li>
                  PR:{' '}
                  <a className="text-sky-700 underline" href={String(ticket.artifacts.prUrl)} target="_blank" rel="noreferrer">
                    {String(ticket.artifacts.prUrl)}
                  </a>
                </li>
              ) : null}
              {ticket.artifacts.productionUrl ? (
                <li>
                  Prod:{' '}
                  <a
                    className="text-sky-700 underline"
                    href={String(ticket.artifacts.productionUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {String(ticket.artifacts.productionUrl)}
                  </a>
                </li>
              ) : null}
            </ul>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Handoffs</h3>
          <div className="space-y-2">
            {handoffs.length === 0 ? (
              <p className="text-muted">No handoffs yet.</p>
            ) : (
              handoffs.map((h) => (
                <div key={h.id} className="flex items-baseline justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <p className="font-medium text-fg">{h.label}</p>
                  <p className="shrink-0 text-[11px] text-muted">{new Date(h.at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
