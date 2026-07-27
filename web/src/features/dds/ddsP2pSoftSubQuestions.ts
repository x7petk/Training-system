export type DdsP2pSoftSubQuestion = {
  id: string
  softQuestionId: string
  prompt: string
  sortOrder: number
}

export type DdsP2pSubAnswerForm = {
  yesNo: boolean | null
  comment: string
}

export type DdsP2pSubAnswerSnapshot = {
  subQuestionId: string
  prompt: string
  yesNo: boolean
  comment: string
}

export function sortSoftSubQuestions<T extends { sortOrder: number; prompt: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.prompt.localeCompare(b.prompt))
}

export function emptySubAnswers(subQuestions: { id: string }[]): Record<string, DdsP2pSubAnswerForm> {
  const m: Record<string, DdsP2pSubAnswerForm> = {}
  for (const sq of subQuestions) {
    m[sq.id] = { yesNo: false, comment: '' }
  }
  return m
}

export function countSubYesNoAnswers(
  subAnswers: Record<string, DdsP2pSubAnswerForm> | undefined,
  subQuestionIds: string[],
): { yesCount: number; noCount: number } {
  let yesCount = 0
  let noCount = 0
  if (!subAnswers) return { yesCount, noCount }
  for (const id of subQuestionIds) {
    const yn = subAnswers[id]?.yesNo
    if (yn === true) yesCount += 1
    else if (yn === false) noCount += 1
  }
  return { yesCount, noCount }
}

export function buildSubNoHoverLines(snapshots: DdsP2pSubAnswerSnapshot[]): string[] {
  const noRows = snapshots.filter((s) => s.yesNo === false)
  if (noRows.length === 0) return ['No issues flagged']
  return noRows.map((s) => {
    const cmt = s.comment.trim()
    return cmt ? `${s.prompt} — ${cmt}` : s.prompt
  })
}

export function buildSubYesDetailLines(snapshots: DdsP2pSubAnswerSnapshot[]): string[] {
  const yesRows = snapshots.filter((s) => s.yesNo === true)
  if (yesRows.length === 0) return ['No Yes answers']
  return yesRows.map((s) => {
    const cmt = s.comment.trim()
    return cmt ? `${s.prompt} — ${cmt}` : s.prompt
  })
}
