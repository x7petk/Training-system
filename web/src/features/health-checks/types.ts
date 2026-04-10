import type { HcRag } from './hcScore'

export type HcTypeRow = {
  id: string
  name: string
  /** Every HC type maps to one LDR activity (same workspace). */
  ldr_activity_id: string
  description: string | null
  active: boolean
  sort_order: number
  ldr_activities?: { name: string; workspace_id: string } | { name: string; workspace_id: string }[] | null
}

export type HcTemplateRow = {
  id: string
  hc_type_id: string
  name: string
  version: number
  description: string | null
  active: boolean
  threshold_score: number | null
}

export type HcTemplateQuestionRow = {
  id: string
  template_id: string
  question_text: string
  expected_standard: string
  sort_order: number
  active: boolean
  is_critical: boolean
  help_text: string | null
}

export type HcRecordRow = {
  id: string
  hc_type_id: string
  template_id: string
  master_site_id: string
  master_plant_id: string
  master_cell_id: string
  /** When set (roster “Complete HC”), submit syncs HC RAG to this assignment. Omitted until migration is applied. */
  ldr_assignment_id?: string | null
  completed_by_user_id: string
  completed_by_name: string
  operator_name: string | null
  completed_at: string | null
  score: number | null
  status: HcRag | null
  overall_comment: string | null
  template_version_snapshot: number | null
  created_at: string
}

export type HcAnswerRow = {
  id: string
  hc_record_id: string
  template_question_id: string
  question_text_snapshot: string | null
  expected_standard_snapshot: string | null
  answer: 'pass' | 'fail' | null
  score_value: number | null
  comment: string
  sort_order: number
}
