import { type SkillKind } from '../matrix/gapLogic'
import type { ReportBucket } from './reportBucketUtils'

function asSingle<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function skillKindFromPs(skills: unknown): SkillKind {
  const s = asSingle(skills as { kind?: SkillKind } | { kind?: SkillKind }[] | null)
  return s?.kind ?? 'numeric'
}

function skillNameFromPs(skills: unknown, skillId: string, skillNameById: Map<string, string>): string {
  const s = asSingle(skills as { name?: string } | null)
  return s?.name?.trim() || skillNameById.get(skillId) || '—'
}

function teamNameFromEmbed(teams: unknown): string {
  if (teams == null) return ''
  const g = teams as { name?: string } | { name?: string }[] | null
  if (g == null) return ''
  return Array.isArray(g) ? (g[0]?.name ?? '') : (g.name ?? '')
}

export type ReportAdvisorContext = {
  generatedAt: string
  dateRange: { start: string; end: string }
  filters: {
    nameContains: string
    roleId: string
    teamId: string
    skillGroupId: string
    roleLabel: string
    teamLabel: string
    groupLabel: string
  }
  summary: {
    peopleInView: number
    passedL12AttemptsInRange: number
    l23ProgressionEventsInRange: number
  }
  dataNotes: string[]
  /** Passed L1→2 quiz attempts only (matches report chart). */
  periodTrendL12: { label: string; count: number }[]
  periodTrendL23: { label: string; count: number }[]
  gapsByRole: { roleName: string; assignedPeople: number; gapCellCount: number }[]
  trainingNeedsL12: { person: string; skill: string; requiredLevel: number; actualLevel: number | null }[]
  readyForAssessmentL23: { person: string; skill: string; requiredLevel: number; actualLevel: number }[]
  topL12Completers: { person: string; completions: number }[]
  topL23Promotions: { person: string; events: number }[]
  topAssessorsInRange: { name: string; events: number }[]
  /** Sample of people in the current report filters (names only). */
  peopleSample: { name: string; team: string; roles: string }[]
}

export type ReportAdvisorChartSpec = {
  kind: 'bar'
  title: string
  data: { name: string; value: number }[]
}

type PersonIn = {
  id: string
  display_name: string
  team_id: string | null
  teams: unknown
  person_roles: { role_id: string }[] | null
}

type PsIn = {
  person_id: string
  skill_id: string
  actual_level: number | null
  is_extra: boolean
  skills: unknown
}

export function buildReportAdvisorSnapshot(params: {
  rangeStart: string
  rangeEnd: string
  filterName: string
  filterRoleId: string
  filterTeamId: string
  filterGroupId: string
  peopleInView: PersonIn[]
  roles: { id: string; name: string }[]
  teams: { id: string; name: string }[]
  groups: { id: string; name: string }[]
  skillCatalog: { id: string; name: string }[]
  rsrRows: { role_id: string; skill_id: string; required_level: number }[]
  psRows: PsIn[]
  l12Buckets: ReportBucket[]
  l12Values: number[]
  l23Buckets: ReportBucket[]
  l23Values: number[]
  roleChartStats: { roleId: string; roleName: string; assigned: number; gapCells: number }[]
  l12AttemptsCount: number
  l23EventsCount: number
  topTrainers: { name: string; n: number }[]
  topL23Learners: { name: string; n: number }[]
  topL23Assessors: { name: string; n: number }[]
  l23Note: string | null
}): ReportAdvisorContext {
  const roleNameById = new Map(params.roles.map((r) => [r.id, r.name]))
  const teamNameById = new Map(params.teams.map((t) => [t.id, t.name]))
  const groupNameById = new Map(params.groups.map((g) => [g.id, g.name]))
  const skillNameById = new Map(params.skillCatalog.map((s) => [s.id, s.name]))

  const psMap = new Map<string, PsIn>()
  for (const r of params.psRows) {
    psMap.set(`${r.person_id}\0${r.skill_id}`, r)
  }

  const filterRoleLabel = params.filterRoleId ? (roleNameById.get(params.filterRoleId) ?? params.filterRoleId) : 'All'
  const filterTeamLabel = params.filterTeamId ? (teamNameById.get(params.filterTeamId) ?? params.filterTeamId) : 'All'
  const filterGroupLabel = params.filterGroupId ? (groupNameById.get(params.filterGroupId) ?? params.filterGroupId) : 'All'

  const trainingNeedsL12: ReportAdvisorContext['trainingNeedsL12'] = []
  const readyForAssessmentL23: ReportAdvisorContext['readyForAssessmentL23'] = []
  const seenTrain = new Set<string>()
  const seenAssess = new Set<string>()

  const MAX_ROWS = 100
  for (const p of params.peopleInView) {
    const roleIds = p.person_roles?.map((x) => x.role_id) ?? []
    for (const rid of roleIds) {
      for (const rsr of params.rsrRows) {
        if (rsr.role_id !== rid) continue
        const ps = psMap.get(`${p.id}\0${rsr.skill_id}`)
        const kind = ps ? skillKindFromPs(ps.skills) : 'numeric'
        const groupId =
          (asSingle(ps?.skills as { skill_group_id?: string | null } | null)?.skill_group_id as string | null) ??
          null
        if (params.filterGroupId && groupId !== params.filterGroupId) continue

        const actual = ps?.actual_level ?? null
        const skillName = ps ? skillNameFromPs(ps.skills, rsr.skill_id, skillNameById) : (skillNameById.get(rsr.skill_id) ?? '—')
        const rowKey = `${p.display_name}\0${skillName}`

        if (kind === 'numeric' && rsr.required_level >= 2 && actual === 1 && !seenTrain.has(rowKey)) {
          if (trainingNeedsL12.length >= MAX_ROWS) break
          seenTrain.add(rowKey)
          trainingNeedsL12.push({
            person: p.display_name,
            skill: skillName,
            requiredLevel: rsr.required_level,
            actualLevel: actual,
          })
        }
        if (kind === 'numeric' && rsr.required_level >= 3 && actual === 2 && !seenAssess.has(rowKey)) {
          if (readyForAssessmentL23.length >= MAX_ROWS) break
          seenAssess.add(rowKey)
          readyForAssessmentL23.push({
            person: p.display_name,
            skill: skillName,
            requiredLevel: rsr.required_level,
            actualLevel: 2,
          })
        }
      }
    }
  }

  const peopleSample = params.peopleInView.slice(0, 40).map((p) => ({
    name: p.display_name,
    team: p.team_id ? (teamNameById.get(p.team_id) ?? '—') : teamNameFromEmbed(p.teams) || '—',
    roles: (p.person_roles?.map((pr) => roleNameById.get(pr.role_id) ?? '').filter(Boolean) ?? []).join(' · ') || '—',
  }))

  const dataNotes: string[] = [
    'Read-only snapshot from the Report page (respects your current filters and date range).',
    'L1→2 counts are passed training attempts in the selected date range (not failed attempts).',
    'L2→3 counts are recorded progression events in range (matrix moves with assessor attribution when available).',
    'Training needs list: numeric skills where required ≥ 2 and actual level is 1.',
    'Assessment queue: numeric skills where required ≥ 3 and actual level is 2.',
  ]
  if (params.l23Note) dataNotes.push(`Note: ${params.l23Note}`)

  return {
    generatedAt: new Date().toISOString(),
    dateRange: { start: params.rangeStart, end: params.rangeEnd },
    filters: {
      nameContains: params.filterName.trim(),
      roleId: params.filterRoleId,
      teamId: params.filterTeamId,
      skillGroupId: params.filterGroupId,
      roleLabel: filterRoleLabel,
      teamLabel: filterTeamLabel,
      groupLabel: filterGroupLabel,
    },
    summary: {
      peopleInView: params.peopleInView.length,
      passedL12AttemptsInRange: params.l12AttemptsCount,
      l23ProgressionEventsInRange: params.l23EventsCount,
    },
    dataNotes,
    periodTrendL12: params.l12Buckets.map((b, i) => ({ label: b.label, count: params.l12Values[i] ?? 0 })),
    periodTrendL23: params.l23Buckets.map((b, i) => ({ label: b.label, count: params.l23Values[i] ?? 0 })),
    gapsByRole: params.roleChartStats.map((x) => ({
      roleName: x.roleName,
      assignedPeople: x.assigned,
      gapCellCount: x.gapCells,
    })),
    trainingNeedsL12,
    readyForAssessmentL23,
    topL12Completers: params.topTrainers.map((t) => ({ person: t.name, completions: t.n })),
    topL23Promotions: params.topL23Learners.map((t) => ({ person: t.name, events: t.n })),
    topAssessorsInRange: params.topL23Assessors.map((t) => ({ name: t.name, events: t.n })),
    peopleSample,
  }
}

export function parseAdvisorChartsFromMarkdown(content: string): { text: string; charts: ReportAdvisorChartSpec[] } {
  const charts: ReportAdvisorChartSpec[] = []
  const re = /```advisor-chart\s*([\s\S]*?)```/gi
  let text = content
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const raw = m[1]?.trim()
    if (!raw) continue
    try {
      const j = JSON.parse(raw) as Record<string, unknown>
      if (j.kind !== 'bar') continue
      const title = typeof j.title === 'string' ? j.title : 'Chart'
      const data = Array.isArray(j.data)
        ? (j.data as unknown[])
            .map((row) => {
              const o = row as Record<string, unknown>
              const name = typeof o.name === 'string' ? o.name : String(o.name ?? '')
              const value = typeof o.value === 'number' && Number.isFinite(o.value) ? o.value : Number(o.value)
              return { name, value: Number.isFinite(value) ? value : 0 }
            })
            .filter((d) => d.name.length > 0)
        : []
      if (data.length > 0) charts.push({ kind: 'bar', title, data: data.slice(0, 24) })
    } catch {
      /* ignore malformed */
    }
  }
  text = content.replace(re, '').trim()
  return { text, charts }
}
