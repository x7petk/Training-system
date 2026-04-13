import type { SupabaseClient } from '@supabase/supabase-js'
import type { ObsKind } from './obsKind'
import { obsDuplicateToken, obsLabel } from './obsKind'
import { hcUtcDayRange } from '../health-checks/hcSubmitDuplicate'

type RecordTable = 'sos_records' | 'qos_records' | 'ppo_records'

function recordTable(k: ObsKind): RecordTable {
  switch (k) {
    case 'sos':
      return 'sos_records'
    case 'qos':
      return 'qos_records'
    case 'ppo':
      return 'ppo_records'
  }
}

function typeColumn(k: ObsKind): 'sos_type_id' | 'qos_type_id' | 'ppo_type_id' {
  switch (k) {
    case 'sos':
      return 'sos_type_id'
    case 'qos':
      return 'qos_type_id'
    case 'ppo':
      return 'ppo_type_id'
  }
}

export async function findSubmittedObsDuplicateSameDay(
  supabase: SupabaseClient,
  kind: ObsKind,
  params: {
    completedByUserId: string
    typeId: string
    masterCellId: string
    ldrAssignmentId?: string | null
  },
) {
  const table = recordTable(kind)
  const col = typeColumn(kind)

  if (params.ldrAssignmentId) {
    const byAssignment = await supabase
      .from(table)
      .select('id')
      .eq('completed_by_user_id', params.completedByUserId)
      .eq(col, params.typeId)
      .eq('master_cell_id', params.masterCellId)
      .eq('ldr_assignment_id', params.ldrAssignmentId)
      .not('completed_at', 'is', null)
      .limit(1)
    if (byAssignment.error) return { error: byAssignment.error.message, duplicateId: null as string | null }
    const row = byAssignment.data?.[0] as { id?: string } | undefined
    return { error: null as string | null, duplicateId: row?.id ?? null }
  }

  const { startIso, endIso } = hcUtcDayRange()
  const res = await supabase
    .from(table)
    .select('id')
    .eq('completed_by_user_id', params.completedByUserId)
    .eq(col, params.typeId)
    .eq('master_cell_id', params.masterCellId)
    .not('completed_at', 'is', null)
    .gte('completed_at', startIso)
    .lt('completed_at', endIso)
    .limit(1)
  if (res.error) return { error: res.error.message, duplicateId: null as string | null }
  const row = res.data?.[0] as { id?: string } | undefined
  return { error: null as string | null, duplicateId: row?.id ?? null }
}

export function isObsDuplicateSubmitDbError(kind: ObsKind, message: string) {
  return message.includes(obsDuplicateToken(kind))
}

export function obsDuplicateSubmitMessage(kind: ObsKind) {
  const n = obsLabel(kind)
  return `You already completed this ${n} for this cell and type on this scheduled day. Someone else can complete it, or pick another cell, type, or day.`
}
