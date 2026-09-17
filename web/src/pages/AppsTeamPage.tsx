import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, RefreshCw, Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import {
  invokeAppsTeamAdvance,
  invokeAppsTeamChat,
  invokeAppsTeamSync,
} from '../lib/appsTeamProxy'
import { AppsTeamChat } from '../features/agents/appsTeam/AppsTeamChat'
import { AppsTeamKanban } from '../features/agents/appsTeam/AppsTeamKanban'
import {
  LIVE_BOARD_COUNT_BADGE,
  LIVE_BOARD_HEADER,
  LIVE_BOARD_TITLE,
  LIVE_BOARD_WRAPPER,
} from '../features/agents/appsTeam/liveBoardTheme'
import { AppsTeamTicketDrawer } from '../features/agents/appsTeam/AppsTeamTicketDrawer'
import { useAppsTeam } from '../features/agents/appsTeam/useAppsTeam'
import { filterTicketChatMessages } from '../features/agents/appsTeam/appsTeamChatUtils'

import type { AppsTeamChatTurn, AppsTeamTicket, AppsTeamTicketStatus } from '../features/agents/appsTeam/types'

function toChatTurns(
  messages: { from_role: string; body: string; ticket_id: string | null }[],
  ticketId: string,
): AppsTeamChatTurn[] {
  const turns: AppsTeamChatTurn[] = []
  for (const m of messages) {
    if (m.ticket_id !== ticketId) continue
    if (m.from_role === 'customer') turns.push({ role: 'user', content: m.body })
    else if (m.from_role === 'pm') turns.push({ role: 'assistant', content: m.body })
  }
  return turns.slice(-20)
}

function needsPipelineWork(t: AppsTeamTicket): boolean {
  if (t.status === 'done') return false
  // Waiting on an in-flight cloud build → sync, don't advance.
  if (t.status === 'build' && t.cursor_run_id && !t.artifacts.cursorRetry) return false
  // Waiting on customer answer.
  if (t.status === 'clarify' && t.artifacts.awaitingCustomer) return false
  return (
    t.status === 'intake' ||
    t.status === 'design' ||
    t.status === 'pm_review_design' ||
    t.status === 'build' ||
    t.status === 'clarify' ||
    t.status === 'test' ||
    t.status === 'deploy' ||
    t.status === 'blocked'
  )
}

function needsCloudSync(t: AppsTeamTicket): boolean {
  // Only sync developer cloud builds. Deploy is deterministic (no Cursor watch).
  if (t.status === 'build' && t.cursor_run_id && !t.artifacts.cursorRetry) return true
  return false
}

const AUTO_ADVANCE_STATUSES: AppsTeamTicketStatus[] = [
  'intake',
  'design',
  'pm_review_design',
  'test',
  'clarify',
  'blocked',
  'build',
  'deploy',
]

export function AppsTeamPage() {
  const { session } = useAuth()
  const {
    tickets,
    messages,
    events,
    loading,
    error,
    load,
    addMessage,
    createTicketFromDraft,
    applyOrchestration,
    deleteTicket,
  } = useAppsTeam()

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [pipelineBusy, setPipelineBusy] = useState(false)
  const [invokeError, setInvokeError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const advancingRef = useRef<Set<string>>(new Set())

  const selected = useMemo(
    () => tickets.find((t) => t.id === selectedId) ?? null,
    [tickets, selectedId],
  )

  useEffect(() => {
    setInput('')
  }, [selectedId])

  const runAdvance = useCallback(
    async (ticket: AppsTeamTicket, note?: string) => {
      if (!session?.access_token) return
      if (advancingRef.current.has(ticket.id)) return
      advancingRef.current.add(ticket.id)
      setPipelineBusy(true)
      setInvokeError(null)
      try {
        let current = ticket
        for (let i = 0; i < 8; i++) {
          if (current.status === 'done') break
          if (current.artifacts.awaitingCustomer) break

          if (needsCloudSync(current)) {
            const sync = await invokeAppsTeamSync(session.access_token, current)
            if (sync.errorMessage || !sync.data) {
              setInvokeError(sync.errorMessage || 'Sync failed')
              break
            }
            if (sync.data.noop) break
            const afterSync = await applyOrchestration(current, sync.data)
            if (!afterSync) break
            current = afterSync
            if (sync.data.fromStatus === sync.data.toStatus) break
            continue
          }

          if (!needsPipelineWork(current) && current.status !== 'build') break

          const { data, errorMessage } = await invokeAppsTeamAdvance(
            session.access_token,
            current,
            note,
          )
          note = undefined
          if (errorMessage || !data) {
            setInvokeError(errorMessage || 'Advance failed')
            break
          }

          // Mark awaiting customer so we don't loop.
          if (data.needsCustomerInput) {
            data.artifactsPatch = {
              ...(data.artifactsPatch ?? {}),
              awaitingCustomer: true,
            }
          }

          const updated = await applyOrchestration(current, data)
          if (!updated) break
          current = updated

          if (data.needsCustomerInput) break
          if (data.deferToSync || data.cursor) break
          if (!AUTO_ADVANCE_STATUSES.includes(current.status)) break
        }
      } finally {
        advancingRef.current.delete(ticket.id)
        setPipelineBusy(false)
      }
    },
    [session?.access_token, applyOrchestration],
  )

  // Autonomous pipeline: keep every open ticket moving without customer clicks.
  useEffect(() => {
    if (!session?.access_token) return
    let cancelled = false

    const tick = async () => {
      const open = tickets.filter((t) => t.status !== 'done')
      for (const t of open) {
        if (cancelled) return
        if (advancingRef.current.has(t.id)) continue
        if (t.artifacts.awaitingCustomer) continue
        if (needsCloudSync(t) || needsPipelineWork(t)) {
          await runAdvance(t)
        }
      }
    }

    const id = window.setInterval(() => {
      void tick()
    }, 10_000)
    void tick()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [tickets, session?.access_token, runAdvance])

  const sendChat = useCallback(async () => {
    const q = input.trim()
    if (!q || sending || !session?.access_token || !selected) return
    setSending(true)
    setInvokeError(null)
    setInput('')

    await addMessage({
      from_role: 'customer',
      to_role: 'pm',
      body: q,
      ticket_id: selected.id,
    })

    const ticketMessages = filterTicketChatMessages(messages, selected.id)
    const history = toChatTurns(
      [
        ...ticketMessages.map((m) => ({
          from_role: m.from_role,
          body: m.body,
          ticket_id: m.ticket_id,
        })),
        { from_role: 'customer', body: q, ticket_id: selected.id },
      ],
      selected.id,
    )

    const { data, errorMessage } = await invokeAppsTeamChat(
      session.access_token,
      history,
      selected,
    )
    if (errorMessage || !data) {
      setInvokeError(errorMessage || 'Chat failed')
      setSending(false)
      return
    }

    await addMessage({
      from_role: 'pm',
      to_role: 'customer',
      body: data.reply,
      ticket_id: selected.id,
      meta: {
        kind: data.needsCustomerInput ? 'customer_question' : data.readyForTicket ? 'milestone' : 'chat',
      },
    })

    // Customer answered → clear awaiting and resume that ticket.
    if (selected.status === 'clarify' && selected.artifacts.awaitingCustomer && !data.needsCustomerInput) {
      const resumed = {
        ...selected,
        artifacts: {
          ...selected.artifacts,
          awaitingCustomer: false,
          lastCustomerAnswer: q,
          lastAgentQuestion: `${selected.artifacts.lastAgentQuestion ?? ''}\n\nCustomer answer:\n${q}`,
        },
      }
      await applyOrchestration(selected, {
        action: 'advance',
        fromStatus: selected.status,
        toStatus: 'clarify',
        activeAgent: 'pm',
        notifyCustomer: false,
        artifactsPatch: {
          awaitingCustomer: false,
          lastCustomerAnswer: q,
          lastAgentQuestion: resumed.artifacts.lastAgentQuestion,
        },
        messages: [
          {
            fromRole: 'customer',
            toRole: 'pm',
            body: q,
            meta: { kind: 'customer_answer' },
          },
        ],
        events: [
          {
            eventType: 'customer_answered',
            actorRole: 'customer',
            summary: 'Customer answered PM question; resuming',
          },
        ],
      })
      void runAdvance({
        ...selected,
        artifacts: {
          ...selected.artifacts,
          awaitingCustomer: false,
          lastCustomerAnswer: q,
          lastAgentQuestion: resumed.artifacts.lastAgentQuestion as string,
        },
      })
    }

    if (data.readyForTicket && data.ticket) {
      const created = await createTicketFromDraft(data.ticket)
      if (created) {
        setSelectedId(created.id)
        await addMessage({
          from_role: 'pm',
          to_role: 'customer',
          body: `Ticket “${created.title}” is in progress. I’ll only message you if I need a decision.`,
          ticket_id: created.id,
          meta: { kind: 'milestone' },
        })
        void runAdvance(created)
      }
    }

    setSending(false)
  }, [
    input,
    sending,
    session?.access_token,
    addMessage,
    messages,
    selected,
    createTicketFromDraft,
    runAdvance,
    applyOrchestration,
  ])

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-sky-700" />
          <div>
            <h1 className="text-lg font-semibold text-fg">Apps Team</h1>
            <p className="text-xs text-muted">
              Chat only when the PM asks. Watch the board — the team runs itself.
              {pipelineBusy ? ' · Working…' : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-fg"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </div>

      {(error || invokeError) && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error || invokeError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <div className={LIVE_BOARD_WRAPPER}>
            <div className={LIVE_BOARD_HEADER}>
              <h2 className={LIVE_BOARD_TITLE}>Live board</h2>
              <span className={LIVE_BOARD_COUNT_BADGE}>{tickets.length} tickets</span>
            </div>
            <AppsTeamKanban
              tickets={tickets}
              selectedId={selectedId}
              onSelect={setSelectedId}
              variant="live-board"
            />
          </div>

          <section className="w-full rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-fg">Information</h2>
              <p className="text-xs text-muted">
                Requirements, progress, and agent activity for the selected ticket.
              </p>
            </div>

            {selected ? (
              <AppsTeamTicketDrawer
                ticket={selected}
                events={events}
                busy={pipelineBusy}
                onClose={() => setSelectedId(null)}
                onDelete={async () => {
                  await deleteTicket(selected.id)
                  setSelectedId(null)
                }}
              />
            ) : (
              <div className="flex items-center justify-center px-4 py-12 text-sm text-muted">
                Select a ticket to see requirements and handoffs.
              </div>
            )}
          </section>
        </div>

        <section className="w-full lg:max-w-none">
          <AppsTeamChat
            selectedTicket={selected}
            messages={messages}
            input={input}
            sending={sending}
            onInput={setInput}
            onSend={() => void sendChat()}
            className="lg:sticky lg:top-4"
          />
        </section>
      </div>
    </div>
  )
}
