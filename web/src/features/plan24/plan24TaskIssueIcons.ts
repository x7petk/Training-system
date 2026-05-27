import type { Plan24EventRow } from './plan24Types'

export type PlanTaskIssueLinkRow = {
  plan24_event_id: string | null
  role_name: string | null
  cil_template_id?: string | null
  cil_template_task_id?: string | null
}

/** Plan grid icons for task-level issues not linked on plan24_events. */
export function buildTaskIssueEventIds(
  events: Plan24EventRow[],
  rows: PlanTaskIssueLinkRow[],
  eventType: 'cl_check' | 'cil_check' | 'quality_check',
): Set<string> {
  const typedEvents = events.filter((e) => String(e.event_type ?? '').toLowerCase() === eventType)
  const iconIds = new Set<string>()
  for (const row of rows) {
    if (row.plan24_event_id && typedEvents.some((e) => e.id === row.plan24_event_id)) {
      iconIds.add(row.plan24_event_id)
      continue
    }
    if (!row.role_name?.trim()) continue
    const roleKey = row.role_name.trim().toLowerCase()
    if (eventType === 'cil_check') {
      if (!row.cil_template_task_id || !row.cil_template_id) continue
      const match = typedEvents.find(
        (e) => e.cil_template_id === row.cil_template_id && (e.role_name ?? '').trim().toLowerCase() === roleKey,
      )
      if (match) iconIds.add(match.id)
    } else {
      const match = typedEvents.find((e) => (e.role_name ?? '').trim().toLowerCase() === roleKey)
      if (match) iconIds.add(match.id)
    }
  }
  return iconIds
}

export function mergeTaskIssueEventIdSets(...sets: ReadonlySet<string>[]): Set<string> {
  const out = new Set<string>()
  for (const s of sets) {
    for (const id of s) out.add(id)
  }
  return out
}
