export type DdsTriggerDomain = 'safety' | 'quality'

export type DdsTriggerPointKind = 'hard_point' | 'soft_point'

export type TriggerQuestionRow = {
  id: string
  domain: DdsTriggerDomain
  point_kind: DdsTriggerPointKind
  risk_points: string
  prompt: string
  sort_order: number
  master_cell_id: string | null
  is_active: boolean
}

export type TriggerAnswerRow = {
  id: string
  submission_id: string
  question_id: string
  answer_yes_no: boolean | null
  comment: string | null
}

export type TriggerSubmissionRow = {
  id: string
  master_cell_id: string
  plan_date: string
  shift_kind: string
  domain: DdsTriggerDomain
  updated_at: string
}
