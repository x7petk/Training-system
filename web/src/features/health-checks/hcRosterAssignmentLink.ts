import type { SupabaseClient } from '@supabase/supabase-js'
import type { HcRag } from './hcScore'

const storageKey = (recordId: string) => `hc_ldr_assignment_id:${recordId}`

/** PostgREST / Supabase when `ldr_assignment_id` migration is not applied yet. */
export function isMissingHcLdrAssignmentColumnError(message: string) {
  const m = message.toLowerCase()
  return m.includes('ldr_assignment_id') && (m.includes('schema cache') || m.includes('could not find'))
}

export function setPendingHcLdrAssignment(recordId: string, assignmentId: string) {
  try {
    sessionStorage.setItem(storageKey(recordId), assignmentId)
  } catch {
    /* ignore quota / private mode */
  }
}

export function hasPendingHcLdrAssignment(recordId: string) {
  try {
    return Boolean(sessionStorage.getItem(storageKey(recordId)))
  } catch {
    return false
  }
}

export function clearPendingHcLdrAssignment(recordId: string) {
  try {
    sessionStorage.removeItem(storageKey(recordId))
  } catch {
    /* ignore */
  }
}

function takePendingHcLdrAssignment(recordId: string): string | null {
  try {
    const k = storageKey(recordId)
    const v = sessionStorage.getItem(k)
    if (v) sessionStorage.removeItem(k)
    return v
  } catch {
    return null
  }
}

/** When DB column/trigger is missing, push roster RAG + plain newline-separated comments. */
export async function syncLdrAssignmentRagFromHcOutcome(
  supabase: SupabaseClient,
  args: {
    assignmentId: string
    hcTypeId: string
    completedAtIso: string
    hcStatus: HcRag
    score: number
    completedByName: string
    overallComment: string
    answerComments: { question: string; comment: string }[]
  },
): Promise<{ ok: boolean; error: string | null }> {
  const ldrRag: 'green' | 'yellow' | 'red' =
    args.hcStatus === 'amber' ? 'yellow' : args.hcStatus === 'green' ? 'green' : 'red'

  const [aRes, tRes] = await Promise.all([
    supabase.from('ldr_assignments').select('id, activity_id, comment').eq('id', args.assignmentId).maybeSingle(),
    supabase.from('hc_types').select('ldr_activity_id').eq('id', args.hcTypeId).maybeSingle(),
  ])
  if (aRes.error) return { ok: false, error: aRes.error.message }
  if (tRes.error) return { ok: false, error: tRes.error.message }
  const a = aRes.data as { id: string; activity_id: string; comment: string | null } | null
  const t = tRes.data as { ldr_activity_id: string } | null
  if (!a || !t) return { ok: false, error: 'Assignment or HC type not found.' }
  if (a.activity_id !== t.ldr_activity_id) return { ok: false, error: 'Assignment does not match this HC type.' }

  const feedbackLines = [
    ...(args.overallComment.trim() ? [args.overallComment.trim()] : []),
    ...args.answerComments.map((x) => x.comment.trim()).filter(Boolean),
  ]
  const feedback = feedbackLines.join('\n')
  const merged = feedback ? (a.comment?.trim() ? `${a.comment.trim()}\n${feedback}` : feedback) : (a.comment ?? '')

  const up = await supabase
    .from('ldr_assignments')
    .update({ rag_status: ldrRag, comment: merged })
    .eq('id', args.assignmentId)
  if (up.error) return { ok: false, error: up.error.message }
  return { ok: true, error: null }
}

/** After successful submit: if roster link was stored locally (no DB column), sync RAG here. */
export async function applyPendingRosterRagAfterHcSubmit(
  supabase: SupabaseClient,
  recordId: string,
  args: {
    hcTypeId: string
    completedAtIso: string
    hcStatus: HcRag
    score: number
    completedByName: string
    overallComment: string
    answerComments: { question: string; comment: string }[]
  },
) {
  const assignmentId = takePendingHcLdrAssignment(recordId)
  if (!assignmentId) return { ran: false as const, ok: true, error: null as string | null }
  const result = await syncLdrAssignmentRagFromHcOutcome(supabase, {
    assignmentId,
    hcTypeId: args.hcTypeId,
    completedAtIso: args.completedAtIso,
    hcStatus: args.hcStatus,
    score: args.score,
    completedByName: args.completedByName,
    overallComment: args.overallComment,
    answerComments: args.answerComments,
  })
  return { ran: true as const, ok: result.ok, error: result.error }
}
