import { useEffect, useRef } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import type { AppsTeamMessage } from './types'

export function isCustomerChatMessage(m: AppsTeamMessage): boolean {
  if (m.from_role === 'customer') return true
  if (m.ticket_id != null) return false
  const kind = typeof m.meta?.kind === 'string' ? m.meta.kind : ''
  // Hide noisy status spam; show real chat, questions, and milestones (ticket created / done).
  return kind === 'chat' || kind === 'customer_question' || kind === 'milestone' || kind === 'done' || !kind
}

export function getTicketChatMessages(messages: AppsTeamMessage[], ticketId: string): AppsTeamMessage[] {
  const chatMessages = messages.filter(isCustomerChatMessage)
  const result: AppsTeamMessage[] = []

  for (let i = 0; i < chatMessages.length; i++) {
    const m = chatMessages[i]
    const msgTicketId = typeof m.meta?.ticket_id === 'string' ? m.meta.ticket_id : null

    if (msgTicketId === ticketId) {
      result.push(m)
      continue
    }

    if (m.from_role === 'customer' && msgTicketId == null) {
      const nextPm = chatMessages.slice(i + 1).find((x) => x.from_role === 'pm')
      if (nextPm && typeof nextPm.meta?.ticket_id === 'string' && nextPm.meta.ticket_id === ticketId) {
        result.push(m)
        continue
      }
      const prevPm = [...chatMessages.slice(0, i)].reverse().find((x) => x.from_role === 'pm')
      if (
        prevPm &&
        typeof prevPm.meta?.ticket_id === 'string' &&
        prevPm.meta.ticket_id === ticketId &&
        prevPm.meta?.kind === 'customer_question'
      ) {
        result.push(m)
      }
    }
  }

  return result
}

export function AppsTeamChat(props: {
  selectedTicketId: string | null
  messages: AppsTeamMessage[]
  input: string
  sending: boolean
  onInput: (v: string) => void
  onSend: () => void
}) {
  const { selectedTicketId, messages, input, sending, onInput, onSend } = props
  const listRef = useRef<HTMLDivElement>(null)

  const chatMessages = selectedTicketId ? getTicketChatMessages(messages, selectedTicketId) : []

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatMessages, sending, selectedTicketId])

  const viewportClass =
    'min-h-[7.5rem] max-h-[min(15rem,28vh)] space-y-3 overflow-y-auto px-4 py-3'

  return (
    <div className="flex w-full flex-col rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-fg">Product Manager</h2>
        <p className="text-xs text-muted">
          Describe the outcome once. Reply only if the PM asks a question — otherwise watch the board.
        </p>
      </div>

      {!selectedTicketId ? (
        <div className={`flex flex-col items-center justify-center gap-2 text-center ${viewportClass}`}>
          <MessageSquare className="h-8 w-8 text-muted/50" aria-hidden />
          <p className="text-sm font-medium text-fg">No ticket selected</p>
          <p className="max-w-sm text-xs text-muted">
            Select a ticket to view or start a Product Manager conversation.
          </p>
        </div>
      ) : (
        <>
          <div ref={listRef} className={viewportClass}>
            {chatMessages.length === 0 ? (
              <p className="text-sm text-muted">No messages yet for this ticket.</p>
            ) : (
              chatMessages.map((m) => {
                const mine = m.from_role === 'customer'
                const isQuestion = m.meta?.kind === 'customer_question'
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        mine
                          ? 'bg-sky-600 text-white'
                          : isQuestion
                            ? 'border border-amber-300 bg-amber-50 text-fg'
                            : 'bg-muted/20 text-fg'
                      }`}
                    >
                      {!mine ? (
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                          {isQuestion ? 'PM needs your decision' : 'PM'}
                        </p>
                      ) : null}
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>
                  </div>
                )
              })
            )}
            {sending ? <p className="text-xs text-muted">PM is thinking…</p> : null}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => onInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    onSend()
                  }
                }}
                rows={2}
                placeholder="Message only when asked — or start a new request…"
                className="min-h-[64px] flex-1 resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-sky-500"
              />
              <button
                type="button"
                disabled={sending || !input.trim()}
                onClick={onSend}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-lg bg-sky-600 text-white disabled:opacity-50"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
