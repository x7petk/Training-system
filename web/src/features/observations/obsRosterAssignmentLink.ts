import type { SupabaseClient } from '@supabase/supabase-js'
import type { ObsKind } from './obsKind'

function pendingKey(kind: ObsKind, recordId: string) {
  return `${kind}_ldr_assignment_id:${recordId}`
}

export function isMissingObsLdrAssignmentColumnError(message: string) {
  const m = message.toLowerCase()
  return m.includes('ldr_assignment_id') && (m.includes('schema cache') || m.includes('could not find'))
}

export function setPendingObsLdrAssignment(kind: ObsKind, recordId: string, assignmentId: string) {
  try {
    sessionStorage.setItem(pendingKey(kind, recordId), assignmentId)
  } catch {
    /* ignore */
  }
}

export function hasPendingObsLdrAssignment(kind: ObsKind, recordId: string) {
  try {
    return Boolean(sessionStorage.getItem(pendingKey(kind, recordId)))
  } catch {
    return false
  }
}

export function clearPendingObsLdrAssignment(kind: ObsKind, recordId: string) {
  try {
    sessionStorage.removeItem(pendingKey(kind, recordId))
  } catch {
    /* ignore */
  }
}

export async function verifyObsAssignmentMatchesType(
  supabase: SupabaseClient,
  kind: ObsKind,
  args: { assignmentId: string; typeId: string },
): Promise<{ ok: boolean; error: string | null }> {
  const aRes = await supabase
    .from('ldr_assignments')
    .select('id, activity_id, workspace_id')
    .eq('id', args.assignmentId)
    .maybeSingle()
  const tRes =
    kind === 'sos'
      ? await supabase.from('sos_types').select('workspace_id').eq('id', args.typeId).maybeSingle()
      : kind === 'qos'
        ? await supabase.from('qos_types').select('workspace_id').eq('id', args.typeId).maybeSingle()
        : await supabase.from('ppo_types').select('workspace_id').eq('id', args.typeId).maybeSingle()
  if (aRes.error) return { ok: false, error: aRes.error.message }
  if (tRes.error) return { ok: false, error: tRes.error.message }
  const a = aRes.data as { id: string; activity_id: string; workspace_id: string } | null
  const t = tRes.data as { workspace_id: string } | null
  if (!a || !t) return { ok: false, error: 'Assignment or type not found.' }
  const linkRes = await supabase
    .from('obs_system_activity_links')
    .select('ldr_activity_id')
    .eq('workspace_id', t.workspace_id)
    .eq('kind', kind)
    .maybeSingle()
  if (linkRes.error) return { ok: false, error: linkRes.error.message }
  const linkedActivityId = (linkRes.data as { ldr_activity_id?: string } | null)?.ldr_activity_id ?? null
  if (!linkedActivityId) return { ok: false, error: `No ${kind.toUpperCase()} activity is linked in admin.` }
  if (a.activity_id !== linkedActivityId) return { ok: false, error: 'Assignment does not match this observation system activity.' }
  return { ok: true, error: null }
}
