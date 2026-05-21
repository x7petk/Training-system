import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  computeTriggerScore,
  DDS_TRIGGER_DOMAIN_LABELS,
  triggerScoreBlockClasses,
  triggerScoreTone,
} from './ddsTriggerScoring'
import {
  loadDayTriggerSubmissions,
  loadTriggerQuestionsForCell,
  loadTriggerSubmissionBundle,
  questionsWithRiskPoints,
} from './ddsTriggerService'
import { pickTriggerDisplayShiftKind } from './ddsTriggerDisplay'
import { DdsTriggerControlsPanel } from './DdsTriggerControlsPanel'
import type { ShiftRow } from '../plan24/plan24ShiftUtils'
import type { DdsTriggerDomain } from './ddsTriggerTypes'

type Props = {
  cellId: string
  planDate: string
  /** When set, use this shift. When empty, pick latest/active for the day. */
  shiftKind?: string
  domain: DdsTriggerDomain
  shifts?: ShiftRow[]
  /** Day rollup (Line DDS / compliance): pick display shift from submissions. */
  dayRollup?: boolean
  compact?: boolean
  className?: string
}

export function DdsTriggerScoreTile({
  cellId,
  planDate,
  shiftKind: shiftKindProp,
  domain,
  shifts = [],
  dayRollup = false,
  compact,
  className = '',
}: Props) {
  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState(0)
  const [resolvedShift, setResolvedShift] = useState('')
  const [open, setOpen] = useState(false)
  const [epoch, setEpoch] = useState(0)

  const load = useCallback(async () => {
    if (!cellId || !planDate) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const questions = questionsWithRiskPoints(await loadTriggerQuestionsForCell(cellId, domain))
      if (questions.length === 0) {
        setScore(0)
        setResolvedShift(shiftKindProp ?? '')
        setLoading(false)
        return
      }

      let sk = shiftKindProp ?? ''
      if (dayRollup || !sk) {
        const subs = await loadDayTriggerSubmissions({ cellId, planDate, domain })
        const updatedAtByShift = new Map(subs.map((s) => [s.shift_kind, s.updated_at]))
        sk = pickTriggerDisplayShiftKind({
          planDateYmd: planDate,
          shifts,
          shiftsWithData: subs.map((s) => s.shift_kind),
          updatedAtByShift,
        })
      }
      setResolvedShift(sk)
      if (!sk) {
        setScore(0)
        setLoading(false)
        return
      }

      const { answers } = await loadTriggerSubmissionBundle({ cellId, planDate, shiftKind: sk, domain })
      setScore(
        computeTriggerScore(
          questions,
          new Map(answers.map((a) => [a.question_id, a])),
        ),
      )
    } catch {
      setScore(0)
    }
    setLoading(false)
  }, [cellId, planDate, shiftKindProp, domain, dayRollup, shifts, epoch])

  useEffect(() => {
    void load()
  }, [load])

  const tone = triggerScoreTone(score)
  const label = DDS_TRIGGER_DOMAIN_LABELS[domain]

  if (loading) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted ${className}`}
      >
        <Loader2 className="size-3 animate-spin" aria-hidden />
        {label}
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        title={`${label} triggers — click for controls`}
        className={`inline-flex cursor-pointer flex-col rounded-md border text-left shadow-sm transition hover:brightness-[1.02] ${
          compact ? 'min-w-[3.25rem] px-1.5 py-1' : 'min-w-[4rem] px-2 py-1'
        } ${triggerScoreBlockClasses(tone)} ${className}`}
        onClick={() => setOpen(true)}
      >
        <span className={`font-semibold uppercase leading-none ${compact ? 'text-[8px]' : 'text-[9px]'}`}>{label}</span>
        <span className={`font-bold tabular-nums ${compact ? 'text-sm' : 'text-base'}`}>{score}</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div
            className="flex max-h-[min(90vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label={`${label} controls`}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
              <h2 className="font-display text-lg font-semibold">{label} controls</h2>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-black/[0.06]"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {resolvedShift ? (
                <DdsTriggerControlsPanel
                  cellId={cellId}
                  planDate={planDate}
                  shiftKind={resolvedShift}
                  domain={domain}
                  onSaved={() => {
                    setEpoch((n) => n + 1)
                  }}
                />
              ) : (
                <p className="text-[11px] text-muted">Select a shift in the scope bar.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
