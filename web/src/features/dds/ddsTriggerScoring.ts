import type { DdsTriggerDomain } from './ddsTriggerTypes'

export type DdsTriggerRiskPoints = 3 | 6 | 9

export type TriggerScoreTone = 'good' | 'warn' | 'bad'

export function parseTriggerRiskPoints(raw: string | number | null | undefined): DdsTriggerRiskPoints {
  const n = Number(raw)
  if (n === 3 || n === 6 || n === 9) return n
  return 3
}

export function riskPointsFromDb(raw: string): DdsTriggerRiskPoints {
  return parseTriggerRiskPoints(raw)
}

export type TriggerQuestionLite = {
  id: string
  risk_points: DdsTriggerRiskPoints
}

export type TriggerAnswerLite = {
  question_id: string
  answer_yes_no: boolean | null
}

/** Sum risk_points for each Yes; No or unanswered = 0. */
export function computeTriggerScore(
  questions: TriggerQuestionLite[],
  answersByQuestionId: Map<string, TriggerAnswerLite>,
): number {
  let total = 0
  for (const q of questions) {
    const a = answersByQuestionId.get(q.id)
    if (a?.answer_yes_no === true) total += q.risk_points
  }
  return total
}

/** Below 6 green; 6–8 yellow; above 8 red. */
export function triggerScoreTone(score: number): TriggerScoreTone {
  if (score > 8) return 'bad'
  if (score >= 6) return 'warn'
  return 'good'
}

export function triggerScoreBlockClasses(tone: TriggerScoreTone): string {
  if (tone === 'good') return 'border-emerald-600/50 bg-emerald-600/15 text-emerald-950 dark:bg-emerald-900/35 dark:text-emerald-50'
  if (tone === 'warn') return 'border-amber-500/55 bg-amber-500/15 text-amber-950 dark:bg-amber-900/35 dark:text-amber-50'
  return 'border-rose-600/50 bg-rose-600/15 text-rose-950 dark:bg-rose-900/35 dark:text-rose-50'
}

export const DDS_TRIGGER_DOMAIN_LABELS: Record<DdsTriggerDomain, string> = {
  safety: 'Safety',
  quality: 'Quality',
}
