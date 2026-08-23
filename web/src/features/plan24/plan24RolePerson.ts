import { supabase } from '../../lib/supabase'
import { patternDayIndex, type ShiftScope } from './plan24ShiftUtils'
import type {
  Plan24PatternSlotRow,
  Plan24RoleAssignmentRow,
  Plan24RoleTeamDefaultRow,
  Plan24RosterRoleRow,
} from './plan24Types'

function personLabel(p: {
  id: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
}): string {
  const a = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  return a || p.display_name || p.id.slice(0, 8)
}

function legacyDefaultPersonId(r: Plan24RosterRoleRow, sk: string): string | null {
  if (sk === 'day') return r.default_person_day_id ?? r.default_person_id ?? null
  if (sk === 'night') return r.default_person_night_id ?? r.default_person_id ?? null
  return r.default_person_id ?? null
}

export function plan24ShiftScopeKey(planDate: string, shiftKind: string): string {
  return `${planDate}:${shiftKind}`
}

/** Resolve operator display names for a roster role across multiple shifts (Plan 24 assignment order). */
export async function resolveRolePersonNamesForShifts(
  cellId: string,
  rosterRoleId: string,
  _roleName: string,
  scopes: ShiftScope[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  for (const s of scopes) {
    result.set(plan24ShiftScopeKey(s.planDate, s.shiftKind), '—')
  }
  if (scopes.length === 0) return result

  const rosterRes = await supabase
    .from('plan24_rosters')
    .select('id, pattern_length, pattern_start_date')
    .eq('master_cell_id', cellId)
    .eq('is_active', true)
    .maybeSingle()
  const roster = rosterRes.data as { id: string; pattern_length: number | null; pattern_start_date: string | null } | null
  if (rosterRes.error || !roster?.id) return result

  const uniqueDates = [...new Set(scopes.map((s) => s.planDate))]
  const [roleRes, asRes, patRes, rtdRes] = await Promise.all([
    supabase
      .from('plan24_roster_roles')
      .select('id, name, default_person_id, default_person_day_id, default_person_night_id')
      .eq('id', rosterRoleId)
      .eq('roster_id', roster.id)
      .maybeSingle(),
    supabase
      .from('plan24_role_day_assignments')
      .select('role_name, person_id, plan_date, shift_kind')
      .eq('roster_id', roster.id)
      .in('plan_date', uniqueDates),
    supabase.from('plan24_pattern_slots').select('pattern_day, shift_kind, team_id').eq('roster_id', roster.id),
    supabase.from('plan24_role_team_defaults').select('team_id, person_id').eq('role_id', rosterRoleId),
  ])
  if (roleRes.error || !roleRes.data) return result

  const roleRow = roleRes.data as Plan24RosterRoleRow
  const assignments = (asRes.data ?? []) as (Plan24RoleAssignmentRow & { plan_date: string; shift_kind: string })[]
  const patternSlots = (patRes.data ?? []) as Plan24PatternSlotRow[]
  const roleTeamDefaults = (rtdRes.data ?? []) as Plan24RoleTeamDefaultRow[]
  const plen = roster.pattern_length != null ? roster.pattern_length : 8

  const personIdByScope = new Map<string, string | null>()
  const personIds = new Set<string>()

  for (const scope of scopes) {
    const key = plan24ShiftScopeKey(scope.planDate, scope.shiftKind)
    const scopedAssignments = assignments.filter(
      (a) => a.plan_date === scope.planDate && a.shift_kind === scope.shiftKind,
    )
    const assignmentByRole = new Map<string, string | null>()
    for (const a of scopedAssignments) {
      assignmentByRole.set(a.role_name, a.person_id)
    }

    let personId: string | null = null
    if (assignmentByRole.has(roleRow.name)) {
      personId = assignmentByRole.get(roleRow.name) ?? null
    } else {
      const patternDay = patternDayIndex(scope.planDate, roster.pattern_start_date ?? null, plen)
      const slot = patternSlots.find((p) => p.pattern_day === patternDay && p.shift_kind === scope.shiftKind)
      const activeTeamId = slot?.team_id ?? null
      if (activeTeamId) {
        const d = roleTeamDefaults.find((x) => x.team_id === activeTeamId)
        personId = d?.person_id ?? null
      }
      if (!personId) personId = legacyDefaultPersonId(roleRow, scope.shiftKind)
    }

    personIdByScope.set(key, personId)
    if (personId) personIds.add(personId)
  }

  if (personIds.size === 0) return result

  const peRes = await supabase
    .from('people')
    .select('id, display_name, first_name, last_name')
    .in('id', [...personIds])
  if (peRes.error) return result

  const peopleById = new Map<
    string,
    { id: string; display_name: string | null; first_name: string | null; last_name: string | null }
  >()
  for (const row of peRes.data ?? []) {
    peopleById.set(row.id as string, row as any)
  }

  for (const [key, personId] of personIdByScope) {
    if (!personId) continue
    const person = peopleById.get(personId)
    if (person) result.set(key, personLabel(person))
  }

  return result
}
