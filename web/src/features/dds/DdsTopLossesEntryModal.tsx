import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { DdsTlConfigOption, DdsTlEntryRow } from './ddsTopLosses'

const inputClass =
  'w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2'

export type DdsTlEntryDraft = {
  topLoss: string
  amount: string
  typeOptionId: string
  immediateCause: string
  immediateAction: string
  rootCauseOptionId: string
  problemSolveOptionId: string
}

type Props = {
  open: boolean
  title: string
  types: DdsTlConfigOption[]
  rootCauses: DdsTlConfigOption[]
  problemSolves: DdsTlConfigOption[]
  initial: DdsTlEntryDraft | null
  saving: boolean
  onClose: () => void
  onSave: (draft: DdsTlEntryDraft) => void
}

export function entryToDraft(row: DdsTlEntryRow): DdsTlEntryDraft {
  return {
    topLoss: row.top_loss,
    amount: row.amount ?? '',
    typeOptionId: row.type_option_id,
    immediateCause: row.immediate_cause ?? '',
    immediateAction: row.immediate_action ?? '',
    rootCauseOptionId: row.root_cause_option_id,
    problemSolveOptionId: row.problem_solve_option_id,
  }
}

export function DdsTopLossesEntryModal({
  open,
  title,
  types,
  rootCauses,
  problemSolves,
  initial,
  saving,
  onClose,
  onSave,
}: Props) {
  const [topLoss, setTopLoss] = useState('')
  const [amount, setAmount] = useState('')
  const [typeOptionId, setTypeOptionId] = useState('')
  const [immediateCause, setImmediateCause] = useState('')
  const [immediateAction, setImmediateAction] = useState('')
  const [rootCauseOptionId, setRootCauseOptionId] = useState('')
  const [problemSolveOptionId, setProblemSolveOptionId] = useState('')

  useEffect(() => {
    if (!open) return
    if (initial) {
      setTopLoss(initial.topLoss)
      setAmount(initial.amount)
      setTypeOptionId(initial.typeOptionId)
      setImmediateCause(initial.immediateCause)
      setImmediateAction(initial.immediateAction)
      setRootCauseOptionId(initial.rootCauseOptionId)
      setProblemSolveOptionId(initial.problemSolveOptionId)
    } else {
      setTopLoss('')
      setAmount('')
      setTypeOptionId(types[0]?.id ?? '')
      setImmediateCause('')
      setImmediateAction('')
      setRootCauseOptionId(rootCauses[0]?.id ?? '')
      setProblemSolveOptionId(problemSolves[0]?.id ?? '')
    }
  }, [open, initial, types, rootCauses, problemSolves])

  if (!open) return null

  const valid =
    topLoss.trim() &&
    typeOptionId &&
    rootCauseOptionId &&
    problemSolveOptionId

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border-strong bg-surface p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dds-tl-entry-title"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="dds-tl-entry-title" className="font-display text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-black/[0.06] hover:text-fg dark:hover:bg-white/10"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid) return
            onSave({
              topLoss: topLoss.trim(),
              amount: amount.trim(),
              typeOptionId,
              immediateCause: immediateCause.trim(),
              immediateAction: immediateAction.trim(),
              rootCauseOptionId,
              problemSolveOptionId,
            })
          }}
        >
          <label className="block text-xs font-medium text-muted">
            Top loss
            <input className={`${inputClass} mt-1`} value={topLoss} onChange={(e) => setTopLoss(e.target.value)} required />
          </label>

          <label className="block text-xs font-medium text-muted">
            Amount
            <input className={`${inputClass} mt-1`} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>

          <label className="block text-xs font-medium text-muted">
            Type
            <select
              className={`${inputClass} mt-1`}
              value={typeOptionId}
              onChange={(e) => setTypeOptionId(e.target.value)}
              required
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-muted">
            Immediate cause
            <textarea
              className={`${inputClass} mt-1 min-h-[3rem] py-2`}
              value={immediateCause}
              onChange={(e) => setImmediateCause(e.target.value)}
              rows={2}
            />
          </label>

          <label className="block text-xs font-medium text-muted">
            Immediate action
            <textarea
              className={`${inputClass} mt-1 min-h-[3rem] py-2`}
              value={immediateAction}
              onChange={(e) => setImmediateAction(e.target.value)}
              rows={2}
            />
          </label>

          <label className="block text-xs font-medium text-muted">
            Root cause
            <select
              className={`${inputClass} mt-1`}
              value={rootCauseOptionId}
              onChange={(e) => setRootCauseOptionId(e.target.value)}
              required
            >
              {rootCauses.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-muted">
            Problem solve
            <select
              className={`${inputClass} mt-1`}
              value={problemSolveOptionId}
              onChange={(e) => setProblemSolveOptionId(e.target.value)}
              required
            >
              {problemSolves.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-black/[0.04]"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-45"
              disabled={saving || !valid}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
