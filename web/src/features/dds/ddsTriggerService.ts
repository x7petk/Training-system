import { supabase } from '../../lib/supabase'
import { riskPointsFromDb } from './ddsTriggerScoring'
import type {
  DdsTriggerDomain,
  TriggerAnswerRow,
  TriggerQuestionRow,
  TriggerSubmissionRow,
} from './ddsTriggerTypes'

export async function loadTriggerQuestionsForCell(
  cellId: string,
  domain: DdsTriggerDomain,
): Promise<TriggerQuestionRow[]> {
  const { data, error } = await supabase
    .from('dds_trigger_questions')
    .select('id, domain, point_kind, risk_points, prompt, sort_order, master_cell_id, is_active')
    .eq('domain', domain)
    .eq('is_active', true)
    .order('sort_order')
    .order('prompt')
  if (error) throw error
  return ((data ?? []) as TriggerQuestionRow[]).filter(
    (q) => q.point_kind === 'hard_point' || q.master_cell_id === cellId,
  )
}

export async function loadTriggerSubmissionBundle(opts: {
  cellId: string
  planDate: string
  shiftKind: string
  domain: DdsTriggerDomain
}): Promise<{
  submission: TriggerSubmissionRow | null
  answers: TriggerAnswerRow[]
}> {
  const { data: sub, error: sErr } = await supabase
    .from('dds_trigger_submissions')
    .select('id, master_cell_id, plan_date, shift_kind, domain, updated_at')
    .eq('master_cell_id', opts.cellId)
    .eq('plan_date', opts.planDate)
    .eq('shift_kind', opts.shiftKind)
    .eq('domain', opts.domain)
    .maybeSingle()
  if (sErr) throw sErr
  if (!sub) return { submission: null, answers: [] }
  const { data: ans, error: aErr } = await supabase
    .from('dds_trigger_answers')
    .select('id, submission_id, question_id, answer_yes_no, comment')
    .eq('submission_id', (sub as TriggerSubmissionRow).id)
  if (aErr) throw aErr
  return { submission: sub as TriggerSubmissionRow, answers: (ans ?? []) as TriggerAnswerRow[] }
}

export async function loadDayTriggerSubmissions(opts: {
  cellId: string
  planDate: string
  domain: DdsTriggerDomain
}): Promise<TriggerSubmissionRow[]> {
  const { data, error } = await supabase
    .from('dds_trigger_submissions')
    .select('id, master_cell_id, plan_date, shift_kind, domain, updated_at')
    .eq('master_cell_id', opts.cellId)
    .eq('plan_date', opts.planDate)
    .eq('domain', opts.domain)
  if (error) throw error
  return (data ?? []) as TriggerSubmissionRow[]
}

export function questionsWithRiskPoints(questions: TriggerQuestionRow[]) {
  return questions.map((q) => ({
    id: q.id,
    risk_points: riskPointsFromDb(q.risk_points),
    prompt: q.prompt,
    point_kind: q.point_kind,
    sort_order: q.sort_order,
  }))
}

export async function saveTriggerAnswers(opts: {
  cellId: string
  planDate: string
  shiftKind: string
  domain: DdsTriggerDomain
  userId: string | undefined
  answers: { questionId: string; answer_yes_no: boolean | null; comment: string | null }[]
}): Promise<void> {
  const { data: subRow, error: subErr } = await supabase
    .from('dds_trigger_submissions')
    .upsert(
      {
        master_cell_id: opts.cellId,
        plan_date: opts.planDate,
        shift_kind: opts.shiftKind,
        domain: opts.domain,
        updated_by: opts.userId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'master_cell_id,plan_date,shift_kind,domain' },
    )
    .select('id')
    .single()
  if (subErr) throw subErr
  const submissionId = (subRow as { id: string }).id

  for (const a of opts.answers) {
    const { error } = await supabase.from('dds_trigger_answers').upsert(
      {
        submission_id: submissionId,
        question_id: a.questionId,
        answer_yes_no: a.answer_yes_no,
        comment: a.comment?.trim() || null,
      },
      { onConflict: 'submission_id,question_id' },
    )
    if (error) throw error
  }
}
