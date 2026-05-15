import type { SupabaseClient } from '@supabase/supabase-js'
import { isPlan24DdsAction } from './plan24DdsUtils'
import type { Plan24EventRow } from './plan24Types'

export type Plan24PersistMoveOpts = {
  /** When moving a `dds_action` to another role, the person on that role for this shift. */
  ddsTargetPersonId?: string | null
}

/**
 * Persist drag move: optional suppression row (so materialize does not refill the vacated
 * schedule slot), then update the event. Uses table APIs only — no RPC.
 */
export async function plan24PersistCheckMove(
  client: SupabaseClient,
  ev: Plan24EventRow,
  eventId: string,
  startAt: Date,
  endAt: Date,
  roleName: string,
  opts?: Plan24PersistMoveOpts,
): Promise<string | null> {
  const normalizeRole = (v: string | null | undefined) => (v ?? '').trim().toLowerCase()
  const oldStart = new Date(ev.start_at)
  const oldEnd = new Date(ev.end_at)
  const oldDurationMs = Math.max(60_000, oldEnd.getTime() - oldStart.getTime())
  const startMs = startAt.getTime()
  const endMs = endAt.getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return 'Invalid time range'
  }
  const nextStartAt = new Date(startMs)
  const nextEndAt = endMs > startMs ? new Date(endMs) : new Date(startMs + oldDurationMs)
  const timeChanged =
    Math.abs(nextStartAt.getTime() - oldStart.getTime()) > 1000 ||
    Math.abs(nextEndAt.getTime() - oldEnd.getTime()) > 1000
  const roleChanged = normalizeRole(roleName) !== normalizeRole(ev.role_name)
  const linkedToSchedule = !!ev.schedule_id
  const detachedFromSchedule = linkedToSchedule && (timeChanged || roleChanged)

  // Any manual move of a scheduled occurrence must suppress the original slot.
  if (ev.schedule_id && detachedFromSchedule && ev.schedule_occurrence_at) {
    const oldSlot = (ev.schedule_role_name?.trim() || ev.role_name || '').trim() || ''
    const { error } = await client.from('plan24_check_schedule_occurrence_suppressions').insert({
      master_cell_id: ev.master_cell_id,
      schedule_id: ev.schedule_id,
      schedule_occurrence_at: ev.schedule_occurrence_at,
      schedule_role_name: oldSlot,
    })
    if (error && String(error.code) !== '23505') {
      // Keep moving even if suppression write fails; otherwise drag/resize appears broken.
      console.warn('[plan24PersistCheckMove] suppression insert failed', error)
    }
  }

  const nextRole = roleName.trim() === '' ? null : roleName.trim()

  if (isPlan24DdsAction(ev)) {
    if (!nextRole) {
      return 'DDS actions must stay on a role column (pick a role that has someone assigned for this shift).'
    }
    if (roleChanged) {
      const pid = opts?.ddsTargetPersonId ?? null
      if (!pid) {
        return 'That role has no one assigned for this shift, so DDS actions cannot be moved there.'
      }
    }
  }

  const payload: Record<string, unknown> = {
    start_at: nextStartAt.toISOString(),
    end_at: nextEndAt.toISOString(),
    role_name: nextRole,
  }

  if (isPlan24DdsAction(ev) && nextRole && roleChanged && opts?.ddsTargetPersonId) {
    payload.assigned_person_id = opts.ddsTargetPersonId
  }

  if (detachedFromSchedule) {
    payload.source = 'ad_hoc'
    payload.schedule_id = null
    payload.schedule_occurrence_at = null
    payload.template_version_id = null
    payload.schedule_role_name = ''
  } else if (!ev.schedule_id) {
    payload.schedule_role_name = roleName || ''
  }

  const { error: uErr } = await client.from('plan24_events').update(payload).eq('id', eventId)
  if (uErr && /plan24_events_time_order/i.test(uErr.message)) {
    const fallbackEnd = new Date(nextStartAt.getTime() + oldDurationMs)
    const { error: retryErr } = await client
      .from('plan24_events')
      .update({ ...payload, end_at: fallbackEnd.toISOString() })
      .eq('id', eventId)
    return retryErr?.message ?? null
  }
  return uErr?.message ?? null
}
