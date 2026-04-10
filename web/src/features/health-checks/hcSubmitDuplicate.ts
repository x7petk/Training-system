import type { SupabaseClient } from '@supabase/supabase-js'

/** UTC midnight-to-midnight window for duplicate checks (matches DB trigger). */
export function hcUtcDayRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

export const HC_DUPLICATE_SUBMIT_MESSAGE =
  'You already completed this health check for this cell and type on this scheduled day. Someone else can complete it, or pick another cell, type, or day.'

export async function findSubmittedHcDuplicateSameDay(
  supabase: SupabaseClient,
  params: {
    completedByUserId: string
    hcTypeId: string
    masterCellId: string
    ldrAssignmentId?: string | null
  },
) {
  if (params.ldrAssignmentId) {
    const byAssignment = await supabase
      .from('hc_records')
      .select('id')
      .eq('completed_by_user_id', params.completedByUserId)
      .eq('hc_type_id', params.hcTypeId)
      .eq('master_cell_id', params.masterCellId)
      .eq('ldr_assignment_id', params.ldrAssignmentId)
      .not('completed_at', 'is', null)
      .limit(1)
    if (byAssignment.error) return { error: byAssignment.error.message, duplicateId: null as string | null }
    const byAssignmentRow = byAssignment.data?.[0] as { id?: string } | undefined
    return { error: null as string | null, duplicateId: byAssignmentRow?.id ?? null }
  }

  const { startIso, endIso } = hcUtcDayRange()
  const res = await supabase
    .from('hc_records')
    .select('id')
    .eq('completed_by_user_id', params.completedByUserId)
    .eq('hc_type_id', params.hcTypeId)
    .eq('master_cell_id', params.masterCellId)
    .not('completed_at', 'is', null)
    .gte('completed_at', startIso)
    .lt('completed_at', endIso)
    .limit(1)
  if (res.error) return { error: res.error.message, duplicateId: null as string | null }
  const row = res.data?.[0] as { id?: string } | undefined
  return { error: null as string | null, duplicateId: row?.id ?? null }
}

export function isHcDuplicateSubmitDbError(message: string) {
  return message.includes('hc_duplicate_submit')
}
