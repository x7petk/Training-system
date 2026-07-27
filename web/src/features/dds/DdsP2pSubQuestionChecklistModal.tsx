import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { DdsP2pSoftSubQuestion, DdsP2pSubAnswerForm } from './ddsP2pSoftSubQuestions'
import { countSubYesNoAnswers } from './ddsP2pSoftSubQuestions'
import { DdsP2pSubYesNoSummary } from './DdsP2pSubYesNoSummary'

type Props = {
  open: boolean
  questionPrompt: string
  subQuestions: DdsP2pSoftSubQuestion[]
  subAnswers: Record<string, DdsP2pSubAnswerForm>
  readOnly?: boolean
  onChange: (subQuestionId: string, patch: Partial<DdsP2pSubAnswerForm>) => void
  onClose: () => void
}

function growTextarea(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${Math.min(Math.max(el.scrollHeight, 22), 96)}px`
}

export function DdsP2pSubQuestionChecklistModal({
  open,
  questionPrompt,
  subQuestions,
  subAnswers,
  readOnly = false,
  onChange,
  onClose,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open, onClose])

  if (!open) return null

  const subIds = subQuestions.map((s) => s.id)
  const counts = countSubYesNoAnswers(subAnswers, subIds)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-[1px]">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="p2p-sub-checklist-title"
        className="flex max-h-[min(90vh,32rem)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border/70 px-3 py-2">
          <div className="min-w-0">
            <h2 id="p2p-sub-checklist-title" className="text-xs font-semibold text-fg">
              {questionPrompt}
            </h2>
            <p className="mt-0.5 text-[10px]">
              <DdsP2pSubYesNoSummary yesCount={counts.yesCount} noCount={counts.noCount} />
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-muted hover:bg-black/[0.06] hover:text-fg dark:hover:bg-white/[0.06]"
            aria-label="Close checklist"
            onClick={onClose}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
          {subQuestions.length === 0 ? (
            <li className="py-4 text-center text-[11px] text-muted">
              No sub-questions assigned to this role. Configure under Admin → P2P set-up.
            </li>
          ) : null}
          {subQuestions.map((sq) => {
            const ans = subAnswers[sq.id] ?? { yesNo: false, comment: '' }
            return (
              <li key={sq.id} className="rounded-md border border-border/70 bg-surface-raised/20 px-2 py-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 flex-1 text-[11px] leading-snug text-fg">{sq.prompt}</span>
                  <div
                    className="flex shrink-0 items-center gap-0.5 rounded-md border border-border/80 bg-surface p-0.5"
                    role="group"
                    aria-label="Yes or no"
                  >
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => onChange(sq.id, { yesNo: true })}
                      className={`h-5 min-w-[2.1rem] rounded px-1.5 text-[10px] font-semibold transition-colors disabled:opacity-50 ${
                        ans.yesNo === true
                          ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-500/40'
                          : 'text-rose-800 hover:bg-rose-500/15 dark:text-rose-300'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => onChange(sq.id, { yesNo: false })}
                      className={`h-5 min-w-[2.1rem] rounded px-1.5 text-[10px] font-semibold transition-colors disabled:opacity-50 ${
                        ans.yesNo === false
                          ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/40'
                          : 'text-emerald-800 hover:bg-emerald-500/15 dark:text-emerald-300'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
                <textarea
                  className="mt-1 w-full resize-none overflow-hidden rounded border border-border/80 bg-surface px-1 py-px text-[11px] leading-tight outline-none ring-accent/30 focus:border-accent/50 focus:ring-1"
                  rows={1}
                  placeholder="Comment"
                  disabled={readOnly}
                  value={ans.comment}
                  onChange={(e) => onChange(sq.id, { comment: e.target.value })}
                  onInput={(e) => growTextarea(e.currentTarget)}
                />
              </li>
            )
          })}
        </ul>
        <div className="shrink-0 border-t border-border/70 px-3 py-2">
          <button
            type="button"
            className="inline-flex h-7 items-center rounded-md bg-accent px-2.5 text-xs font-semibold text-accent-fg"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
