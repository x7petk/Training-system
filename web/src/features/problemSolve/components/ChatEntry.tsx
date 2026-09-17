import { useEffect, useRef } from 'react'
import { FileText, ImagePlus, Paperclip, Send, Sparkles, X } from 'lucide-react'
import type { AttachmentMeta, ChatMessage, ChatSuggestedAction } from '../types'

export function ChatEntry(props: {
  messages: ChatMessage[]
  input: string
  sending: boolean
  attachments: AttachmentMeta[]
  onInput: (v: string) => void
  onSend: () => void
  onAction: (a: ChatSuggestedAction) => void
  onAddFiles: (files: FileList | null) => void
  onRemoveAttachment: (id: string) => void
  onSkipAi: () => void
}) {
  const {
    messages,
    input,
    sending,
    attachments,
    onInput,
    onSend,
    onAction,
    onAddFiles,
    onRemoveAttachment,
    onSkipAi,
  } = props
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, sending, attachments])

  return (
    <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-border bg-gradient-to-r from-orange-500/10 via-accent/5 to-transparent px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-fg">
            <Sparkles className="size-4 text-accent" aria-hidden />
            Loss Elimination Navigator
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Describe the problem. AI gathers facts, classifies the loss, and opens the right form.
          </p>
        </div>
        <button
          type="button"
          onClick={onSkipAi}
          className="shrink-0 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted hover:text-fg"
        >
          Skip AI → pick form
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-raised/60 px-4 py-8 text-center">
            <p className="font-display text-lg font-semibold text-fg">What is the problem?</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Start with one sentence. You can attach photos or documents. AI will ask only for what it needs
              (asset, type, timing) then navigate you.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[
                'Seal scrap rising on Filler Line 1 Head 3 this shift',
                'Case Packer CP-2 motor seized — line down',
                'Customer complaint: wrinkled seal on SKU-A',
              ].map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => onInput(ex)}
                  className="max-w-[16rem] rounded-full border border-border bg-surface px-3 py-1.5 text-left text-xs text-fg hover:border-accent/40"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.role === 'user'
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    mine ? 'bg-orange-600 text-white' : 'border border-border bg-surface-raised text-fg'
                  }`}
                >
                  {!mine ? (
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-accent">Navigator AI</p>
                  ) : null}
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.suggestedActions?.length ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {m.suggestedActions.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          disabled={sending}
                          onClick={() => onAction(a)}
                          className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-50"
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
        {sending ? (
          <p className="flex items-center gap-2 text-xs text-muted">
            <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            AI is navigating…
          </p>
        ) : null}
      </div>

      {attachments.length ? (
        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-2">
          {attachments.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-2 py-1 text-xs text-fg"
            >
              {a.kind === 'image' ? <ImagePlus className="size-3.5" /> : <FileText className="size-3.5" />}
              {a.name}
              <span className="text-muted">{a.sizeLabel}</span>
              <button type="button" aria-label="Remove" onClick={() => onRemoveAttachment(a.id)}>
                <X className="size-3.5 text-muted" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={(e) => {
              onAddFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-lg border border-border text-muted hover:text-fg"
            aria-label="Attach"
          >
            <Paperclip className="size-4" />
          </button>
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
            placeholder="What is the problem?"
            className="min-h-[64px] flex-1 resize-none rounded-xl border border-border bg-canvas px-3 py-2 text-sm text-fg outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={sending || (!input.trim() && !attachments.length)}
            onClick={onSend}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-xl bg-accent text-white disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
