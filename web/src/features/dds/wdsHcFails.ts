import { eventLocalDate } from '../report/reportBucketUtils'
import type { WdsWeekSlot } from './ddsWds'

export type WdsHcFailAnswerLite = {
  record_id: string
  completed_at: string
  hc_type_id: string
  question_text: string
  comment: string
}

export type WdsHcTopFail = {
  questionText: string
  count: number
  comments: string[]
}

const TOP_FAIL_LIMIT = 5

export function buildWdsHcTopFails(fails: WdsHcFailAnswerLite[], week: WdsWeekSlot | null): WdsHcTopFail[] {
  if (!week) return []

  const inWeek = fails.filter((f) => {
    const d = eventLocalDate(f.completed_at)
    return d >= week.startYmd && d <= week.endYmd
  })

  const byQuestion = new Map<string, { count: number; comments: Set<string> }>()
  for (const f of inWeek) {
    const q = f.question_text.trim() || '—'
    const cur = byQuestion.get(q) ?? { count: 0, comments: new Set<string>() }
    cur.count += 1
    const c = f.comment.trim()
    if (c) cur.comments.add(c)
    byQuestion.set(q, cur)
  }

  return [...byQuestion.entries()]
    .map(([questionText, { count, comments }]) => ({
      questionText,
      count,
      comments: [...comments],
    }))
    .sort((a, b) => b.count - a.count || a.questionText.localeCompare(b.questionText))
    .slice(0, TOP_FAIL_LIMIT)
}
