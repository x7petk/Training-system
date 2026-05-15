import type { Plan24EventRow } from './plan24Types'

export function isPlan24DdsAction(ev: { event_type?: string | null } | null | undefined): boolean {
  return String(ev?.event_type ?? '').toLowerCase() === 'dds_action'
}

type RosterRoleLite = { name: string; sort_order: number }

/**
 * When a DDS row has no `role_name` (e.g. created from DDS Actions / Line DDS with owner only),
 * infer which Plan 24 column to show it under from `assigned_person_id` and that day's role
 * assignments. If the person matches several roles, uses roster `sort_order` then name.
 */
export function plan24InferDdsRoleColumn(
  ev: Plan24EventRow,
  activeRoles: RosterRoleLite[],
  personIdByRole: Map<string, string | null>,
): string | null {
  if (!isPlan24DdsAction(ev)) return null
  const pid = ev.assigned_person_id
  if (!pid) return null
  const matches = activeRoles.filter((r) => (personIdByRole.get(r.name) ?? null) === pid)
  if (matches.length === 0) return null
  const sorted = [...matches].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  return sorted[0]?.name ?? null
}

/** Role key for grid column layout: persisted `role_name`, or inferred for owner-only DDS. */
export function plan24EventGridRoleKey(
  ev: Plan24EventRow,
  activeRoles: RosterRoleLite[],
  personIdByRole: Map<string, string | null>,
): string {
  const rn = (ev.role_name ?? '').trim()
  if (rn) return rn
  return plan24InferDdsRoleColumn(ev, activeRoles, personIdByRole) ?? ''
}

/** Status values persisted for DDS actions (subset of plan24_events.status). */
export type Plan24DdsStatus = 'in_progress' | 'complete' | 'not_required'

export function isPlan24DdsStatus(s: string | null | undefined): s is Plan24DdsStatus {
  return s === 'in_progress' || s === 'complete' || s === 'not_required'
}

export function plan24DdsDefaultStatus(): Plan24DdsStatus {
  return 'in_progress'
}
