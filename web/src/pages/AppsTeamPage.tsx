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
import type { AppsTeamChatTurn, AppsTeamTicket } from '../features/agents/appsTeam/types'

function toChatTurns(messages: { from_role: string; body: string; ticket_id: string | null }[]): AppsTeamChatTurn[] {
  const turns: AppsTeamChatTurn[] = []
  for (const m of messages) {
    if (m.ticket_id != null) continue
    if (m.from_role === 'customer') turns.push({ role: 'user', content: m.body })
    else if (m.from_role === 'pm') turns.push({ role: 'assistant', content: m.body })
  }
  return turns.slice(-20)
}

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
  const [busyTicket, setBusyTicket] = useState(false)
  const [invokeError, setInvokeError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const advancingRef = useRef<Set<string>>(new Set())

  const selected = useMemo(
    () => tickets.find((t) => t.id === selectedId) ?? null,
    [tickets, selectedId],
  )

  const runAdvance = useCallback(
    async (ticket: AppsTeamTicket, note?: string) => {
      if (!session?.access_token) return
      if (advancingRef.current.has(ticket.id)) return
      advancingRef.current.add(ticket.id)
      setBusyTicket(true)
      setInvokeError(null)
      try {
        let current = ticket
        // Keep stepping through non-cloud stages until we need sync or hit a terminal wait.
        for (let i = 0; i < 4; i++) {
          const { data, errorMessage } = await invokeAppsTeamAdvance(
            session.access_token,
            current,
            note,
          )
          if (errorMessage || !data) {
            setInvokeError(errorMessage || 'Advance failed')
            break
          }
          const updated = await applyOrchestration(current, data)
          if (!updated) break
          current = updated

          if (data.deferToSync) {
            const sync = await invokeAppsTeamSync(session.access_token, current)
            if (sync.errorMessage || !sync.data) {
              setInvokeError(sync.errorMessage || 'Sync failed')
              break
            }
            const afterSync = await applyOrchestration(current, sync.data)
            if (!afterSync) break
            current = afterSync
            // If still running, stop and let polling continue.
            if (sync.data.fromStatus === sync.data.toStatus) break
            continue
          }

          // Cloud launch: stop and let poller sync.
          if (data.cursor || current.status === 'done' || current.status === 'blocked') break
          // Continue auto-pipeline for designer / pm review / tester stages.
          if (
            current.status === 'design' ||
            current.status === 'pm_review_design' ||
            current.status === 'test'
          ) {
            continue
          }
          break
        }
      } finally {
        advancingRef.current.delete(ticket.id)
        setBusyTicket(false)
      }
    },
    [session?.access_token, applyOrchestration],
  )

  // Auto-sync cloud agent tickets while on the page.
  useEffect(() => {
    if (!session?.access_token) return
    const cloudTickets = tickets.filter(
      (t) =>
        (t.status === 'build' || t.status === 'deploy') &&
        (t.cursor_run_id || t.artifacts.deployRunId),
    )
    if (cloudTickets.length === 0) return

    let cancelled = false
    const tick = async () => {
      for (const t of cloudTickets) {
        if (cancelled || advancingRef.current.has(t.id)) continue
        advancingRef.current.add(t.id)
        try {
          const { data, errorMessage } = await invokeAppsTeamSync(session.access_token, t)
          if (!errorMessage && data) {
            await applyOrchestration(t, data)
            // After build→test or similar, keep pipeline moving.
            if (
              data.toStatus === 'test' ||
              data.toStatus === 'design' ||
              data.toStatus === 'pm_review_design'
            ) {
              const refreshed = { ...t, status: data.toStatus }
              // load() will refresh; schedule advance on next tick via status change below
              void runAdvance({
                ...t,
                status: data.toStatus,
                artifacts: { ...t.artifacts, ...(data.artifactsPatch ?? {}) },
                active_agent: data.activeAgent ?? t.active_agent,
              })
              void refreshed
            }
          }
        } finally {
          advancingRef.current.delete(t.id)
        }
      }
    }

    const id = window.setInterval(() => {
      void tick()
    }, 12_000)
    void tick()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [tickets, session?.access_token, applyOrchestration, runAdvance])

  const sendChat = useCallback(async () => {
    const q = input.trim()
    if (!q || sending || !session?.access_token) return
    setSending(true)
    setInvokeError(null)
    setInput('')

    await addMessage({ from_role: 'customer', to_role: 'pm', body: q, ticket_id: null })

    const history = toChatTurns([
      ...messages
        .filter((m) => m.ticket_id == null)
        .map((m) => ({ from_role: m.from_role, body: m.body, ticket_id: m.ticket_id })),
      { from_role: 'customer', body: q, ticket_id: null },
    ])

    const activeTicket =
      selected && selected.status !== 'done' ? selected : tickets.find((t) => t.status !== 'done') ?? null

    const { data, errorMessage } = await invokeAppsTeamChat(
      session.access_token,
      history,
      activeTicket,
    )
    if (errorMessage || !data) {
      setInvokeError(errorMessage || 'Chat failed')
      setSending(false)
      return
    }

    await addMessage({ from_role: 'pm', to_role: 'customer', body: data.reply, ticket_id: null })

    if (data.readyForTicket && data.ticket) {
      const created = await createTicketFromDraft(data.ticket)
      if (created) {
        setSelectedId(created.id)
        await addMessage({
          from_role: 'pm',
          to_role: 'customer',
          body: `Ticket created: “${created.title}”. Handing to Designer now.`,
          ticket_id: null,
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
    tickets,
    createTicketFromDraft,
    runAdvance,
  ])

  return (
    <div className="flex h-[calc(100vh-5.5rem)] min-h-[560px] flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-sky-700" />
          <div>
            <h1 className="text-lg font-semibold text-fg">Apps Team</h1>
            <p className="text-xs text-muted">
              PM · Designer · Developer (Cursor Cloud) · Tester · DevOps — PM owns delivery until done
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

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[340px_minmax(0,1fr)_minmax(320px,380px)]">
        <AppsTeamChat
          messages={messages}
          input={input}
          sending={sending}
          onInput={setInput}
          onSend={() => void sendChat()}
        />

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

        {selected ? (
          <AppsTeamTicketDrawer
            ticket={selected}
            messages={messages}
            events={events}
            busy={busyTicket}
            onClose={() => setSelectedId(null)}
            onAdvance={() => void runAdvance(selected)}
            onSync={async () => {
              if (!session?.access_token) return
              setBusyTicket(true)
              const { data, errorMessage } = await invokeAppsTeamSync(session.access_token, selected)
              if (errorMessage || !data) setInvokeError(errorMessage || 'Sync failed')
              else await applyOrchestration(selected, data)
              setBusyTicket(false)
            }}
            onDelete={async () => {
              await deleteTicket(selected.id)
              setSelectedId(null)
            }}
          />
        ) : (
          <div className="hidden items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted lg:flex">
            Select a ticket to see requirements, agent log, and status.
          </div>
        )}
      </div>
    </div>
  )
}
