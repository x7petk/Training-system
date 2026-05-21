import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  computeTriggerScore,
  DDS_TRIGGER_DOMAIN_LABELS,
  triggerScoreBlockClasses,
  triggerScoreTone,
} from './ddsTriggerScoring'
import {
  loadTriggerQuestionsForCell,
  loadTriggerSubmissionBundle,
  questionsWithRiskPoints,
  saveTriggerAnswers,
} from './ddsTriggerService'
import type { DdsTriggerDomain } from './ddsTriggerTypes'

type AnswerDraft = { answer_yes_no: boolean | null; comment: string }

type Props = {
  cellId: string
  planDate: string
  shiftKind: string
  domain: DdsTriggerDomain
  compact?: boolean
  onSaved?: () => void
}

export function DdsTriggerControlsPanel({ cellId, planDate, shiftKind, domain, compact, onSaved }: Props) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [questionIds, setQuestionIds] = useState<string[]>([])
  const [prompts, setPrompts] = useState<Record<string, string>>({})
  const [riskById, setRiskById] = useState<Record<string, number>>({})
  const [drafts, setDrafts] = useState<Record<string, AnswerDraft>>({})

  const load = useCallback(async () => {
    if (!cellId || !planDate || !shiftKind) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const questions = await loadTriggerQuestionsForCell(cellId, domain)
      const scored = questionsWithRiskPoints(questions)
      setQuestionIds(scored.map((q) => q.id))
      const pm: Record<string, string> = {}
      const rk: Record<string, number> = {}
      for (const q of scored) {
        pm[q.id] = q.prompt
        rk[q.id] = q.risk_points
      }
      setPrompts(pm)
      setRiskById(rk)

      const { answers } = await loadTriggerSubmissionBundle({ cellId, planDate, shiftKind, domain })
      const d: Record<string, AnswerDraft> = {}
      for (const q of scored) {
        const a = answers.find((x) => x.question_id === q.id)
        d[q.id] = {
          answer_yes_no: a?.answer_yes_no ?? null,
          comment: a?.comment ?? '',
        }
      }
      setDrafts(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    }
    setLoading(false)
  }, [cellId, planDate, shiftKind, domain])

  useEffect(() => {
    void load()
  }, [load])

  const score = computeTriggerScore(
    questionIds.map((id) => ({ id, risk_points: riskById[id] as 3 | 6 | 9 })),
    new Map(
      questionIds.map((id) => [
        id,
        { question_id: id, answer_yes_no: drafts[id]?.answer_yes_no ?? null },
      ]),
    ),
  )
  const tone = triggerScoreTone(score)

  async function handleSave() {
    if (!user?.id) {
      setError('Sign in to save.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveTriggerAnswers({
        cellId,
        planDate,
        shiftKind,
        domain,
        userId: user.id,
        answers: questionIds.map((id) => ({
          questionId: id,
          answer_yes_no: drafts[id]?.answer_yes_no ?? null,
          comment: drafts[id]?.comment ?? null,
        })),
      })
      await load()
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <p className="flex items-center gap-1 text-[11px] text-muted">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading…
      </p>
    )
  }

  if (questionIds.length === 0) {
    return (
      <p className="text-[11px] text-muted">
        No {DDS_TRIGGER_DOMAIN_LABELS[domain].toLowerCase()} controls configured. Add questions in Admin → Triggers.
      </p>
    )
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div
        className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] font-semibold tabular-nums ${triggerScoreBlockClasses(tone)}`}
      >
        <span>{DDS_TRIGGER_DOMAIN_LABELS[domain]} score</span>
        <span>{score}</span>
      </div>

      {error ? <p className="text-[11px] text-rose-700 dark:text-rose-300">{error}</p> : null}

      <ul className="space-y-2">
        {questionIds.map((id) => (
          <li key={id} className="rounded-lg border border-border/60 bg-canvas/20 px-2 py-1.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="min-w-0 flex-1 text-[11px] font-medium text-fg">
                {prompts[id]}
                <span className="ml-1 text-[10px] font-normal text-muted">({riskById[id]} pts if Yes)</span>
              </span>
              <div className="inline-flex shrink-0 rounded-md border border-border bg-surface p-0.5">
                {(['yes', 'no'] as const).map((v) => {
                  const isYes = v === 'yes'
                  const active = isYes
                    ? drafts[id]?.answer_yes_no === true
                    : drafts[id]?.answer_yes_no === false
                  return (
                    <button
                      key={v}
                      type="button"
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        active ? 'bg-accent text-white' : 'text-muted hover:text-fg'
                      }`}
                      onClick={() =>
                        setDrafts((d) => ({
                          ...d,
                          [id]: { ...d[id], answer_yes_no: isYes, comment: d[id]?.comment ?? '' },
                        }))
                      }
                    >
                      {v}
                    </button>
                  )
                })}
              </div>
            </div>
            <input
              type="text"
              className="mt-1 w-full rounded-md border border-border/80 bg-surface px-2 py-1 text-[11px]"
              placeholder="Comment (optional)"
              value={drafts[id]?.comment ?? ''}
              onChange={(e) =>
                setDrafts((d) => ({
                  ...d,
                  [id]: { answer_yes_no: d[id]?.answer_yes_no ?? null, comment: e.target.value },
                }))
              }
            />
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={saving || !user}
        className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-45"
        onClick={() => void handleSave()}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
