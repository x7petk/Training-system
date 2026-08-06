import { ExternalLink, X } from 'lucide-react'
import type { AppsTeamEvent, AppsTeamMessage, AppsTeamTicket } from './types'
import { AGENT_LABELS } from './types'

function roleLabel(role: string | null | undefined) {
  if (!role) return '—'
  if (role === 'customer') return 'You'
  if (role === 'system') return 'System'
  if (role in AGENT_LABELS) return AGENT_LABELS[role as keyof typeof AGENT_LABELS]
  return role
}

export function AppsTeamTicketDrawer(props: {
  ticket: AppsTeamTicket
  messages: AppsTeamMessage[]
  events: AppsTeamEvent[]
  busy: boolean
  onClose: () => void
  onAdvance: () => void
  onSync: () => void
  onDelete: () => void
}) {
  const { ticket, messages, events, busy, onClose, onAdvance, onSync, onDelete } = props
  const ticketMessages = messages.filter((m) => m.ticket_id === ticket.id)
  const ticketEvents = events
    .filter((e) => e.ticket_id === ticket.id)
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  const canAdvance =
    ticket.status === 'design' ||
    ticket.status === 'pm_review_design' ||
    ticket.status === 'build' ||
    ticket.status === 'clarify' ||
    ticket.status === 'test' ||
    ticket.status === 'deploy' ||
    ticket.status === 'blocked'

  const canSync = Boolean(ticket.cursor_agent_id || ticket.artifacts.deployRunId)

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{ticket.status}</p>
          <h2 className="truncate text-base font-semibold text-fg">{ticket.title}</h2>
          {ticket.active_agent ? (
            <p className="text-xs text-muted">Active: {AGENT_LABELS[ticket.active_agent]}</p>
          ) : null}
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-muted/20" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2">
        {canAdvance ? (
          <button
            type="button"
            disabled={busy}
            onClick={onAdvance}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Run next step
          </button>
        ) : null}
        {canSync ? (
          <button
            type="button"
            disabled={busy}
            onClick={onSync}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-fg disabled:opacity-50"
          >
            Sync cloud agent
          </button>
        ) : null}
        {ticket.cursor_url ? (
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

      <div className="space-y-5 px-4 py-4 text-sm">
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
            {ticket.design_brief.alignmentNotes ? (
              <p className="whitespace-pre-wrap text-fg">
                <span className="font-medium">Alignment: </span>
                {ticket.design_brief.alignmentNotes}
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
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Progress log</h3>
          <div className="space-y-2">
            {ticketEvents.length === 0 ? (
              <p className="text-muted">No events yet.</p>
            ) : (
              ticketEvents.map((e) => (
                <div key={e.id} className="rounded-lg border border-border bg-muted/10 px-3 py-2">
                  <p className="text-[11px] text-muted">
                    {new Date(e.created_at).toLocaleString()} · {e.event_type}
                    {e.actor_role ? ` · ${roleLabel(e.actor_role)}` : ''}
                  </p>
                  <p className="text-fg">{e.summary}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Agent communications</h3>
          <div className="space-y-2">
            {ticketMessages.length === 0 ? (
              <p className="text-muted">No messages yet.</p>
            ) : (
              ticketMessages.map((m) => (
                <div key={m.id} className="rounded-lg border border-border px-3 py-2">
                  <p className="text-[11px] text-muted">
                    {new Date(m.created_at).toLocaleString()} · {roleLabel(m.from_role)}
                    {m.to_role ? ` → ${roleLabel(m.to_role)}` : ''}
                  </p>
                  <p className="whitespace-pre-wrap text-fg">{m.body}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
