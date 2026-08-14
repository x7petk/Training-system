import { useEffect, useRef } from 'react'
import { Send } from 'lucide-react'
import type { AppsTeamMessage, AppsTeamTicket } from './types'
import { filterTicketChatMessages } from './appsTeamChatUtils'

export function AppsTeamChat(props: {
  selectedTicket: AppsTeamTicket | null
  messages: AppsTeamMessage[]
  input: string
  sending: boolean
  onInput: (v: string) => void
  onSend: () => void
  className?: string
}) {
  const { selectedTicket, messages, input, sending, onInput, onSend, className } = props
  const listRef = useRef<HTMLDivElement>(null)

  const chatMessages = selectedTicket ? filterTicketChatMessages(messages, selectedTicket.id) : []

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatMessages, sending, selectedTicket?.id])

  const hasSelection = selectedTicket != null

  return (
    <div
      className={`flex w-full flex-col rounded-xl border border-border bg-surface ${className ?? ''}`}
    >
      <div className="border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold text-fg">Product Manager</h2>
        {hasSelection ? (
          <p className="text-xs text-muted">
            Chat for <span className="font-medium text-fg">{selectedTicket.title}</span> — reply when
            asked.
          </p>
        ) : (
          <p className="text-xs text-muted">Select a ticket to view and send messages.</p>
        )}
      </div>

      <div
        ref={listRef}
        className="min-h-[120px] max-h-[min(240px,25vh)] space-y-2 overflow-y-auto px-4 py-2.5 md:max-h-[min(240px,30vh)]"
      >
        {!hasSelection ? (
          <div className="flex h-full min-h-[96px] items-center justify-center px-2 py-4 text-center">
            <p className="text-sm text-muted">Select a ticket to view chat.</p>
          </div>
        ) : chatMessages.length === 0 ? (
          <p className="text-sm text-muted">
            No messages yet for this ticket. Reply when the PM asks a question.
          </p>
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
        {sending && hasSelection ? <p className="text-xs text-muted">PM is thinking…</p> : null}
      </div>

      <div className="border-t border-border p-2.5">
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
            rows={1}
            disabled={!hasSelection || sending}
            placeholder={
              hasSelection
                ? 'Message only when asked…'
                : 'Select a ticket on the board to chat…'
            }
            className="min-h-[40px] flex-1 resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="button"
            disabled={!hasSelection || sending || !input.trim()}
            onClick={onSend}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-lg bg-sky-600 text-white disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
