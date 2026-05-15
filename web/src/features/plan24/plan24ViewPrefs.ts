/** Persisted Plan 24 view filters (localStorage, per user + cell). */

export const PLAN24_EVENT_TYPE_FILTER_OPTIONS: { id: string; label: string }[] = [
  { id: 'check', label: 'Check' },
  { id: 'cl_check', label: 'CL check' },
  { id: 'cil_check', label: 'CIL check' },
  { id: 'quality_check', label: 'Quality check' },
  { id: 'dds_action', label: 'DDS action' },
]

export type Plan24ViewPrefs = {
  eventTypes: Record<string, boolean>
  roles: Record<string, boolean>
}

function storageKey(userId: string, cellId: string): string {
  return `rtt-systems.plan24.viewPrefs.v1:${userId}:${cellId}`
}

export function plan24NormalizedEventType(eventType: string | null | undefined): string {
  const t = String(eventType ?? 'check').toLowerCase()
  return PLAN24_EVENT_TYPE_FILTER_OPTIONS.some((o) => o.id === t) ? t : 'check'
}

export function buildDefaultViewPrefs(roleNames: string[]): Plan24ViewPrefs {
  const eventTypes: Record<string, boolean> = {}
  for (const o of PLAN24_EVENT_TYPE_FILTER_OPTIONS) eventTypes[o.id] = true
  const roles: Record<string, boolean> = {}
  for (const n of roleNames) roles[n] = true
  return { eventTypes, roles }
}

/** Merge stored prefs with current roster role names; missing keys default to selected. */
export function mergeViewPrefs(stored: Plan24ViewPrefs | null, roleNames: string[]): Plan24ViewPrefs {
  const eventTypes: Record<string, boolean> = {}
  for (const o of PLAN24_EVENT_TYPE_FILTER_OPTIONS) {
    const id = o.id
    eventTypes[id] =
      stored?.eventTypes && Object.prototype.hasOwnProperty.call(stored.eventTypes, id)
        ? Boolean(stored.eventTypes[id])
        : true
  }
  const roles: Record<string, boolean> = {}
  for (const n of roleNames) {
    roles[n] =
      stored?.roles && Object.prototype.hasOwnProperty.call(stored.roles, n)
        ? Boolean(stored.roles[n])
        : true
  }
  return { eventTypes, roles }
}

export function loadViewPrefs(userId: string | undefined, cellId: string | null | undefined): Plan24ViewPrefs | null {
  if (!userId || !cellId) return null
  try {
    const raw = localStorage.getItem(storageKey(userId, cellId))
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<Plan24ViewPrefs>
    if (!p || typeof p !== 'object' || !p.eventTypes || !p.roles) return null
    return { eventTypes: p.eventTypes as Record<string, boolean>, roles: p.roles as Record<string, boolean> }
  } catch {
    return null
  }
}

export function saveViewPrefs(userId: string, cellId: string, prefs: Plan24ViewPrefs): void {
  try {
    localStorage.setItem(storageKey(userId, cellId), JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}
