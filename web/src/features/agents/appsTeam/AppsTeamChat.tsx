import { useEffect, useRef } from 'react'
import { Send } from 'lucide-react'
import type { AppsTeamMessage } from './types'

function isCustomerChatMessage(m: AppsTeamMessage): boolean {
  if (m.from_role === 'customer') return true
  if (m.ticket_id != null) return false
  const kind = typeof m.meta?.kind === 'string' ? m.meta.kind : ''
  // Hide noisy status spam; show real chat, questions, and milestones (ticket created / done).
  return kind === 'chat' || kind === 'customer_question' || kind === 'milestone' || kind === 'done' || !kind
}

export function AppsTeamChat(props: {
  messages: AppsTeamMessage[]
  input: string
  sending: boolean
  onInput: (v: string) => void
  onSend: () => void
}) {
  const { messages, input, sending, onInput, onSend } = props
  const listRef = useRef<HTMLDivElement>(null)

  const chatMessages = messages.filter(isCustomerChatMessage)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatMessages, sending])

  return (
    <div className="flex w-full flex-col rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-fg">Product Manager</h2>
        <p className="text-xs text-muted">
          Describe the outcome once. Reply only if the PM asks a question — otherwise watch the board.
        </p>
      </div>

      <div
        ref={listRef}
        className="min-h-[240px] max-h-[min(480px,50vh)] space-y-3 overflow-y-auto px-4 py-3"
      >
        {chatMessages.length === 0 ? (
          <p className="text-sm text-muted">
            Tell the PM what you want built. They’ll decide details and run Designer → Dev → Test → Deploy.
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
    </div>
  )
}
