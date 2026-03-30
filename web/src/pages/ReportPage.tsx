import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileBarChart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { classifyCell, gapKindLegendLabel, type SkillKind } from '../features/matrix/gapLogic'
import {
  buildMonthBuckets,
  buildWeekBuckets,
  compareYMD,
  eventLocalDate,
  localYMD,
  normalizeRange,
  parseYMD,
  type ReportBucket,
} from '../features/report/reportBucketUtils'

const CHART_BAR_AREA_PX = 180
/** Role mini-chart: bar heights scale within this fixed track (keeps columns inside the card). */
const ROLE_CHART_BAR_MAX_PX = 36

type ChartMode = 'weeks' | 'months'

function chartYTicks(maxValue: number): number[] {
  const max = Math.max(0, maxValue)
  if (max === 0) return [0]
  const segments = 4
  const set = new Set<number>()
  for (let i = 0; i <= segments; i++) {
    set.add(Math.round((max * (segments - i)) / segments))
  }
  return [...set].sort((a, b) => b - a)
}

function asSingle<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

type PersonRow = {
  id: string
  display_name: string
  team_id: string | null
  teams: { name: string } | { name: string }[] | null
  person_roles: { role_id: string }[] | null
}

type SkillEmbed = { name: string; kind: SkillKind; skill_group_id: string | null } | null
type PsRow = {
  person_id: string
  skill_id: string
  actual_level: number | null
  is_extra: boolean
  skills: SkillEmbed | SkillEmbed[]
}

type RsrRow = { role_id: string; skill_id: string; required_level: number }

type AttemptRow = {
  id: string
  person_id: string
  skill_id: string
  passed: boolean
  score_percent: number
  created_at: string
  people: { display_name: string } | { display_name: string }[] | null
  skills:
    | { name: string; kind: SkillKind; skill_group_id: string | null }
    | { name: string; kind: SkillKind; skill_group_id: string | null }[]
    | null
}

type ProgressionRow = {
  id: string
  person_id: string
  skill_id: string
  created_at: string
  assessed_by: string | null
  people: { display_name: string } | { display_name: string }[] | null
  skills:
    | { name: string; kind: SkillKind; skill_group_id: string | null }
    | { name: string; kind: SkillKind; skill_group_id: string | null }[]
    | null
  assessor_profile?: { display_name: string | null } | { display_name: string | null }[] | null
}

function personNameAttempt(a: AttemptRow): string {
  return asSingle(a.people)?.display_name ?? '—'
}

function skillMetaAttempt(a: AttemptRow): { name: string; kind: SkillKind; groupId: string | null } {
  const s = asSingle(a.skills)
  return { name: s?.name ?? '—', kind: s?.kind ?? 'numeric', groupId: s?.skill_group_id ?? null }
}

function personNameProg(p: ProgressionRow): string {
  return asSingle(p.people)?.display_name ?? '—'
}

function skillMetaProg(p: ProgressionRow): { name: string; kind: SkillKind; groupId: string | null } {
  const s = asSingle(p.skills)
  return { name: s?.name ?? '—', kind: s?.kind ?? 'numeric', groupId: s?.skill_group_id ?? null }
}

function assessorNameProg(p: ProgressionRow): string {
  const pr = asSingle(p.assessor_profile)
  return pr?.display_name?.trim() ? pr.display_name : '—'
}

function skillKindPs(r: PsRow): SkillKind {
  return asSingle(r.skills)?.kind ?? 'numeric'
}

function skillNamePs(r: PsRow): string {
  return asSingle(r.skills)?.name ?? '—'
}

function defaultRange(): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 83)
  return { start: localYMD(start), end: localYMD(end) }
}

function rangeToIsoBounds(startYmd: string, endYmd: string): { from: string; to: string } {
  const { start, end } = normalizeRange(startYmd, endYmd)
  const fromD = new Date(parseYMD(start))
  fromD.setHours(0, 0, 0, 0)
  const toD = new Date(parseYMD(end))
  toD.setHours(23, 59, 59, 999)
  return { from: fromD.toISOString(), to: toD.toISOString() }
}

function PeriodBarBlock(props: {
  title: string
  mode: ChartMode
  onModeChange: (m: ChartMode) => void
  buckets: ReportBucket[]
  values: number[]
  selectedIndex: number | null
  onToggleBucket: (i: number) => void
  emptyHint?: string
}) {
  const { title, mode, onModeChange, buckets, values, selectedIndex, onToggleBucket, emptyHint } = props
  const maxChart = Math.max(1, ...values)
  const ticks = chartYTicks(maxChart)
  if (buckets.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface-raised/40 p-3">
        <h2 className="font-display text-sm font-semibold">{title}</h2>
        <p className="mt-2 text-xs text-muted">{emptyHint ?? 'No periods in this date range.'}</p>
      </section>
    )
  }
  return (
    <section className="rounded-xl border border-border bg-surface-raised/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">{title}</h2>
        <div className="flex rounded-lg border border-border bg-surface p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => onModeChange('weeks')}
            className={`rounded-md px-2 py-0.5 font-medium ${
              mode === 'weeks' ? 'bg-sky-600 text-white' : 'text-muted hover:text-fg'
            }`}
          >
            Weeks
          </button>
          <button
            type="button"
            onClick={() => onModeChange('months')}
            className={`rounded-md px-2 py-0.5 font-medium ${
              mode === 'months' ? 'bg-sky-600 text-white' : 'text-muted hover:text-fg'
            }`}
          >
            Months
          </button>
        </div>
      </div>
      <div className="mt-3 flex gap-1.5">
        <div className="flex shrink-0 flex-col justify-end" aria-hidden>
          <div className="h-4 shrink-0" />
          <div
            className="flex w-6 flex-col justify-between text-right text-[9px] tabular-nums text-muted"
            style={{ height: CHART_BAR_AREA_PX }}
          >
            {ticks.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto pb-0.5">
          <div className="flex items-end gap-0.5" role="group" aria-label={title}>
            {buckets.map((b, i) => {
              const v = values[i] ?? 0
              const barPx = Math.max(3, Math.round((v / maxChart) * CHART_BAR_AREA_PX))
              const selected = selectedIndex === i
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => onToggleBucket(i)}
                  aria-pressed={selected}
                  title={`${b.label}: ${v} (${b.start} → ${b.end})`}
                  className={`flex min-w-[1.75rem] flex-1 flex-col items-stretch gap-0.5 rounded-t-md outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    selected ? 'ring-2 ring-sky-600 ring-offset-1 ring-offset-canvas' : ''
                  }`}
                >
                  <span className="text-center text-[9px] font-semibold tabular-nums">{v}</span>
                  <div className="flex flex-col justify-end" style={{ height: CHART_BAR_AREA_PX }}>
                    <span
                      className="w-full rounded-t-sm bg-sky-500 hover:brightness-110"
                      style={{ height: `${barPx}px` }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className="mt-0.5 flex gap-1.5 border-t border-border/50 pt-1">
        <div className="w-6 shrink-0" aria-hidden />
        <div className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
          {buckets.map((b) => (
            <div key={`l-${b.key}`} className="min-w-[1.75rem] flex-1 text-center text-[8px] leading-tight text-muted">
              {b.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SimpleTable(props: { headers: string[]; rows: string[][]; empty: string }) {
  const { headers, rows, empty } = props
  if (rows.length === 0) return <p className="py-6 text-center text-xs text-muted">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-left text-xs">
        <thead className="border-b border-border text-[10px] font-medium uppercase tracking-wider text-muted">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-2 py-1.5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-black/[0.03]">
              {r.map((c, j) => (
                <td key={j} className="px-2 py-1.5 text-fg">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ReportPage() {
  const def = useMemo(() => defaultRange(), [])
  const [rangeStart, setRangeStart] = useState(def.start)
  const [rangeEnd, setRangeEnd] = useState(def.end)
  const [filterName, setFilterName] = useState('')
  const [filterRoleId, setFilterRoleId] = useState('')
  const [filterTeamId, setFilterTeamId] = useState('')
  const [filterGroupId, setFilterGroupId] = useState('')
  const [l12Mode, setL12Mode] = useState<ChartMode>('weeks')
  const [l23Mode, setL23Mode] = useState<ChartMode>('weeks')
  const [selL12, setSelL12] = useState<number | null>(null)
  const [selL23, setSelL23] = useState<number | null>(null)
  const [selRoleChart, setSelRoleChart] = useState<string | null>(null)
  const [assessmentRoleId, setAssessmentRoleId] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [people, setPeople] = useState<PersonRow[]>([])
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [rsrRows, setRsrRows] = useState<RsrRow[]>([])
  const [psRows, setPsRows] = useState<PsRow[]>([])
  const [attempts, setAttempts] = useState<AttemptRow[]>([])
  const [progressions, setProgressions] = useState<ProgressionRow[]>([])
  const [skillCatalog, setSkillCatalog] = useState<{ id: string; name: string }[]>([])
  const [l23Note, setL23Note] = useState<string | null>(null)

  const resolvedAssessmentRoleId = useMemo(
    () => assessmentRoleId || roles[0]?.id || '',
    [assessmentRoleId, roles],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { from, to } = rangeToIsoBounds(rangeStart, rangeEnd)
    const [
      peRes,
      roRes,
      teRes,
      grRes,
      skRes,
      rsrRes,
      psRes,
      attRes,
      progRes,
    ] = await Promise.all([
      supabase.from('people').select('id, display_name, team_id, teams ( name ), person_roles ( role_id )'),
      supabase.from('roles').select('id, name').order('sort_order'),
      supabase.from('teams').select('id, name').order('sort_order'),
      supabase.from('skill_groups').select('id, name').order('sort_order'),
      supabase.from('skills').select('id, name').order('sort_order'),
      supabase.from('role_skill_requirements').select('role_id, skill_id, required_level'),
      supabase.from('person_skills').select('person_id, skill_id, actual_level, is_extra, skills ( name, kind, skill_group_id )'),
      supabase
        .from('skill_training_attempts')
        .select(
          'id, person_id, skill_id, passed, score_percent, created_at, people ( display_name ), skills ( name, kind, skill_group_id )',
        )
        .eq('passed', true)
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: false }),
      supabase
        .from('skill_progression_events')
        .select(
          'id, person_id, skill_id, created_at, assessed_by, people ( display_name ), skills ( name, kind, skill_group_id ), assessor_profile:profiles!skill_progression_events_assessed_by_fkey ( display_name )',
        )
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: false }),
    ])
    setLoading(false)
    const err =
      peRes.error?.message ??
      roRes.error?.message ??
      teRes.error?.message ??
      grRes.error?.message ??
      skRes.error?.message ??
      rsrRes.error?.message ??
      psRes.error?.message ??
      attRes.error?.message
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setPeople((peRes.data ?? []) as unknown as PersonRow[])
    setRoles((roRes.data ?? []) as { id: string; name: string }[])
    setTeams((teRes.data ?? []) as { id: string; name: string }[])
    setGroups((grRes.data ?? []) as { id: string; name: string }[])
    setSkillCatalog((skRes.data ?? []) as { id: string; name: string }[])
    setRsrRows((rsrRes.data ?? []) as RsrRow[])
    setPsRows((psRes.data ?? []) as unknown as PsRow[])
    setAttempts((attRes.data ?? []) as unknown as AttemptRow[])
    if (progRes.error) {
      setProgressions([])
      const msg = progRes.error.message ?? ''
      setL23Note(
        /skill_progression_events|does not exist|schema cache/i.test(msg)
          ? 'L2→3 chart needs migration `skill_progression_events`. Apply Supabase migrations and refresh.'
          : msg,
      )
    } else {
      setL23Note(null)
      setProgressions((progRes.data ?? []) as unknown as ProgressionRow[])
    }
  }, [rangeStart, rangeEnd])

  useEffect(() => {
    const id = requestAnimationFrame(() => void load())
    return () => cancelAnimationFrame(id)
  }, [load])

  const filteredPersonIds = useMemo(() => {
    const q = filterName.trim().toLowerCase()
    return new Set(
      people
        .filter((p) => {
          if (q && !p.display_name.toLowerCase().includes(q)) return false
          if (filterTeamId && p.team_id !== filterTeamId) return false
          if (filterRoleId) {
            const ids = p.person_roles?.map((x) => x.role_id) ?? []
            if (!ids.includes(filterRoleId)) return false
          }
          return true
        })
        .map((p) => p.id),
    )
  }, [people, filterName, filterTeamId, filterRoleId])

  const passesSkillGroup = useCallback(
    (groupId: string | null) => {
      if (!filterGroupId) return true
      return groupId === filterGroupId
    },
    [filterGroupId],
  )

  const l12Attempts = useMemo(
    () =>
      attempts.filter(
        (a) => filteredPersonIds.has(a.person_id) && passesSkillGroup(skillMetaAttempt(a).groupId),
      ),
    [attempts, filteredPersonIds, passesSkillGroup],
  )

  const l23Events = useMemo(() => {
    return progressions.filter(
      (e) => filteredPersonIds.has(e.person_id) && passesSkillGroup(skillMetaProg(e).groupId),
    )
  }, [progressions, filteredPersonIds, passesSkillGroup])

  const l12Buckets = useMemo(() => {
    const { start, end } = normalizeRange(rangeStart, rangeEnd)
    return l12Mode === 'weeks' ? buildWeekBuckets(start, end) : buildMonthBuckets(start, end)
  }, [rangeStart, rangeEnd, l12Mode])

  const l23Buckets = useMemo(() => {
    const { start, end } = normalizeRange(rangeStart, rangeEnd)
    return l23Mode === 'weeks' ? buildWeekBuckets(start, end) : buildMonthBuckets(start, end)
  }, [rangeStart, rangeEnd, l23Mode])

  const l12Values = useMemo(() => {
    const dates = l12Attempts.map((a) => a.created_at)
    return l12Buckets.map((b) =>
      dates.filter((iso) => {
        const d = eventLocalDate(iso)
        return compareYMD(d, b.start) >= 0 && compareYMD(d, b.end) <= 0
      }).length,
    )
  }, [l12Attempts, l12Buckets])

  const l23Values = useMemo(() => {
    const dates = l23Events.map((e) => e.created_at)
    return l23Buckets.map((b) =>
      dates.filter((iso) => {
        const d = eventLocalDate(iso)
        return compareYMD(d, b.start) >= 0 && compareYMD(d, b.end) <= 0
      }).length,
    )
  }, [l23Events, l23Buckets])

  const l12TableRows = useMemo(() => {
    let rows = l12Attempts
    if (selL12 != null && l12Buckets[selL12]) {
      const b = l12Buckets[selL12]
      rows = rows.filter((a) => {
        const d = eventLocalDate(a.created_at)
        return compareYMD(d, b.start) >= 0 && compareYMD(d, b.end) <= 0
      })
    }
    const sm = (a: AttemptRow) => skillMetaAttempt(a)
    return [...rows]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((a) => [
        personNameAttempt(a),
        sm(a).name,
        eventLocalDate(a.created_at),
        `${a.score_percent}%`,
      ])
  }, [l12Attempts, selL12, l12Buckets])

  const l23TableRows = useMemo(() => {
    let rows = l23Events
    if (selL23 != null && l23Buckets[selL23]) {
      const b = l23Buckets[selL23]
      rows = rows.filter((e) => {
        const d = eventLocalDate(e.created_at)
        return compareYMD(d, b.start) >= 0 && compareYMD(d, b.end) <= 0
      })
    }
    return [...rows]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((e) => [
        personNameProg(e),
        skillMetaProg(e).name,
        eventLocalDate(e.created_at),
        assessorNameProg(e),
      ])
  }, [l23Events, selL23, l23Buckets])

  const skillNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of skillCatalog) m.set(s.id, s.name)
    return m
  }, [skillCatalog])

  const psMap = useMemo(() => {
    const m = new Map<string, PsRow>()
    for (const r of psRows) m.set(`${r.person_id}\0${r.skill_id}`, r)
    return m
  }, [psRows])

  const peopleFiltered = useMemo(
    () => people.filter((p) => filteredPersonIds.has(p.id)),
    [people, filteredPersonIds],
  )

  const roleChartStats = useMemo(() => {
    return roles.map((role) => {
      const inRole = peopleFiltered.filter((p) => (p.person_roles?.map((x) => x.role_id) ?? []).includes(role.id))
      let gapCells = 0
      for (const p of inRole) {
        for (const rsr of rsrRows) {
          if (rsr.role_id !== role.id) continue
          const ps = psMap.get(`${p.id}\0${rsr.skill_id}`)
          const kind = ps ? skillKindPs(ps) : 'numeric'
          const actual = ps?.actual_level ?? null
          const isExtra = ps?.is_extra ?? false
          const gap = classifyCell({
            kind,
            required: rsr.required_level,
            actual,
            isExtra,
          })
          if (gap === 'critical' || gap === 'minor') gapCells += 1
        }
      }
      return { roleId: role.id, roleName: role.name, assigned: inRole.length, gapCells }
    })
  }, [roles, peopleFiltered, rsrRows, psMap])

  const maxAssigned = Math.max(1, ...roleChartStats.map((x) => x.assigned))
  const maxGaps = Math.max(1, ...roleChartStats.map((x) => x.gapCells))

  const roleDetailRows = useMemo(() => {
    if (!selRoleChart) return []
    const role = roles.find((r) => r.id === selRoleChart)
    if (!role) return []
    const inRole = peopleFiltered.filter((p) => (p.person_roles?.map((x) => x.role_id) ?? []).includes(role.id))
    const rows: string[][] = []
    for (const p of inRole) {
      const gapSkills: string[] = []
      for (const rsr of rsrRows) {
        if (rsr.role_id !== role.id) continue
        const ps = psMap.get(`${p.id}\0${rsr.skill_id}`)
        const kind = ps ? skillKindPs(ps) : 'numeric'
        const gap = classifyCell({
          kind,
          required: rsr.required_level,
          actual: ps?.actual_level ?? null,
          isExtra: ps?.is_extra ?? false,
        })
        if (gap === 'critical' || gap === 'minor') {
          const sn = ps ? skillNamePs(ps) : (skillNameById.get(rsr.skill_id) ?? '—')
          gapSkills.push(`${sn} (${gapKindLegendLabel(gap)})`)
        }
      }
      rows.push([p.display_name, gapSkills.length === 0 ? '—' : gapSkills.join('; ')])
    }
    return rows.sort((a, b) => a[0].localeCompare(b[0]))
  }, [selRoleChart, roles, peopleFiltered, rsrRows, psMap, skillNameById])

  const assessmentRows = useMemo(() => {
    if (!resolvedAssessmentRoleId) return []
    const inRole = peopleFiltered.filter((p) =>
      (p.person_roles?.map((x) => x.role_id) ?? []).includes(resolvedAssessmentRoleId),
    )
    return inRole
      .map((p) => {
        const parts: string[] = []
        for (const rsr of rsrRows) {
          if (rsr.role_id !== resolvedAssessmentRoleId) continue
          const ps = psMap.get(`${p.id}\0${rsr.skill_id}`)
          const kind = ps ? skillKindPs(ps) : 'numeric'
          const gap = classifyCell({
            kind,
            required: rsr.required_level,
            actual: ps?.actual_level ?? null,
            isExtra: ps?.is_extra ?? false,
          })
          if (gap === 'critical' || gap === 'minor') {
            const sn = ps ? skillNamePs(ps) : (skillNameById.get(rsr.skill_id) ?? '—')
            parts.push(`${sn}: ${gapKindLegendLabel(gap)}`)
          }
        }
        return parts.length === 0
          ? ([p.display_name, 'Qualified'] as string[])
          : ([p.display_name, parts.join('; ')] as string[])
      })
      .sort((a, b) => a[0].localeCompare(b[0]))
  }, [resolvedAssessmentRoleId, peopleFiltered, rsrRows, psMap, skillNameById])

  const topTrainers = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of l12Attempts) {
      m.set(a.person_id, (m.get(a.person_id) ?? 0) + 1)
    }
    const list = [...m.entries()]
      .map(([personId, n]) => {
        const name = people.find((p) => p.id === personId)?.display_name ?? '—'
        return { personId, name, n }
      })
      .sort((a, b) => b.n - a.n)
    return list.slice(0, 25)
  }, [l12Attempts, people])

  const topL23Learners = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of l23Events) {
      m.set(e.person_id, (m.get(e.person_id) ?? 0) + 1)
    }
    return [...m.entries()]
      .map(([personId, n]) => ({
        personId,
        name: people.find((p) => p.id === personId)?.display_name ?? '—',
        n,
      }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 25)
  }, [l23Events, people])

  const topL23Assessors = useMemo(() => {
    const m = new Map<string, number>()
    const nameByUid = new Map<string, string>()
    for (const e of l23Events) {
      if (!e.assessed_by) continue
      const uid = e.assessed_by
      m.set(uid, (m.get(uid) ?? 0) + 1)
      if (!nameByUid.has(uid)) nameByUid.set(uid, assessorNameProg(e))
    }
    return [...m.entries()]
      .map(([uid, n]) => ({ name: nameByUid.get(uid) ?? '—', n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 25)
  }, [l23Events])

  const selectCls =
    'max-w-[8rem] truncate rounded border border-border bg-surface px-1.5 py-1 text-[11px] text-fg md:max-w-[10rem]'

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-violet-100 text-violet-800">
            <FileBarChart className="size-4" aria-hidden />
          </span>
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">Report</h1>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="self-start rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-raised sm:self-auto"
        >
          Refresh
        </button>
      </header>

      <div className="flex flex-wrap items-end gap-x-2 gap-y-1.5 rounded-lg border border-border bg-surface-raised/50 px-2 py-1.5">
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] font-medium uppercase tracking-wide text-muted">Name</span>
          <input
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder="Contains…"
            className="w-[6.5rem] rounded border border-border bg-surface px-1.5 py-1 text-[11px] md:w-28"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] font-medium uppercase tracking-wide text-muted">Role</span>
          <select
            value={filterRoleId}
            onChange={(e) => setFilterRoleId(e.target.value)}
            className={selectCls}
            aria-label="Filter by role"
          >
            <option value="">All</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] font-medium uppercase tracking-wide text-muted">Team</span>
          <select
            value={filterTeamId}
            onChange={(e) => setFilterTeamId(e.target.value)}
            className={selectCls}
            aria-label="Filter by team"
          >
            <option value="">All</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] font-medium uppercase tracking-wide text-muted">Group</span>
          <select
            value={filterGroupId}
            onChange={(e) => setFilterGroupId(e.target.value)}
            className={selectCls}
            aria-label="Filter by skill group"
          >
            <option value="">All</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] font-medium uppercase tracking-wide text-muted">From</span>
          <input
            type="date"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
            className="w-[9.25rem] rounded border border-border bg-surface px-1 py-1 text-[11px]"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] font-medium uppercase tracking-wide text-muted">To</span>
          <input
            type="date"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
            className="w-[9.25rem] rounded border border-border bg-surface px-1 py-1 text-[11px]"
          />
        </label>
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-950">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <PeriodBarBlock
                title="Level 1 → 2 (passed training attempts)"
                mode={l12Mode}
                onModeChange={(m) => {
                  setL12Mode(m)
                  setSelL12(null)
                }}
                buckets={l12Buckets}
                values={l12Values}
                selectedIndex={selL12}
                onToggleBucket={(i) => setSelL12((p) => (p === i ? null : i))}
              />
              <section className="rounded-xl border border-border bg-surface">
                <div className="border-b border-border px-2 py-1.5">
                  <h3 className="text-[11px] font-semibold text-muted">
                    Details{selL12 != null ? ` · selected period` : ` · full range`}
                  </h3>
                </div>
                <SimpleTable
                  headers={['Person', 'Skill', 'Date', 'Score']}
                  rows={l12TableRows}
                  empty="No completions in this view."
                />
              </section>
            </div>
            <div className="space-y-2">
              <PeriodBarBlock
                title="Level 2 → 3 (recorded when level moves 2→3 on matrix)"
                mode={l23Mode}
                onModeChange={(m) => {
                  setL23Mode(m)
                  setSelL23(null)
                }}
                buckets={l23Buckets}
                values={l23Values}
                selectedIndex={selL23}
                onToggleBucket={(i) => setSelL23((p) => (p === i ? null : i))}
              />
              <p className="text-[10px] text-muted">
                L2→3 rows appear after the DB migration is applied and assessors update skills from 2 to 3. Historical moves
                are not backfilled.
              </p>
              {l23Note ? <p className="text-[10px] text-amber-800">{l23Note}</p> : null}
              <section className="rounded-xl border border-border bg-surface">
                <div className="border-b border-border px-2 py-1.5">
                  <h3 className="text-[11px] font-semibold text-muted">
                    Details{selL23 != null ? ` · selected period` : ` · full range`}
                  </h3>
                </div>
                <SimpleTable
                  headers={['Person', 'Skill', 'Date', 'Assessor']}
                  rows={l23TableRows}
                  empty="No L2→3 events in this view."
                />
              </section>
            </div>
          </div>

          <section className="rounded-xl border border-border bg-surface-raised/40 p-3">
            <h2 className="font-display text-sm font-semibold">By job role (current matrix)</h2>
            <p className="mt-0.5 text-[10px] text-muted">
              People & gap cells (critical/minor vs role requirements). Click a role to see names and gap skills below.
            </p>
            <div className="mt-2 max-h-56 overflow-auto">
              <div className="flex min-w-max gap-2">
                {roleChartStats.map((x) => {
                  const selected = selRoleChart === x.roleId
                  const ah = Math.round((x.assigned / maxAssigned) * ROLE_CHART_BAR_MAX_PX)
                  const gh = Math.round((x.gapCells / maxGaps) * ROLE_CHART_BAR_MAX_PX)
                  return (
                    <button
                      key={x.roleId}
                      type="button"
                      onClick={() => setSelRoleChart((p) => (p === x.roleId ? null : x.roleId))}
                      className={`flex w-[4.5rem] shrink-0 flex-col items-stretch gap-1 rounded-lg border px-1 py-1.5 text-center transition-colors ${
                        selected ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-400/40' : 'border-border hover:bg-black/[0.03]'
                      }`}
                    >
                      <span className="line-clamp-2 min-h-8 text-[9px] font-medium leading-tight text-fg">{x.roleName}</span>
                      <div className="flex justify-center gap-1">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[8px] tabular-nums text-muted">{x.assigned}</span>
                          <div
                            className="flex w-5 items-end justify-center"
                            style={{ height: ROLE_CHART_BAR_MAX_PX }}
                          >
                            <span
                              className="w-3 rounded-t bg-zinc-400/90"
                              style={{ height: `${Math.max(2, ah)}px` }}
                              title="Assigned people"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[8px] tabular-nums text-rose-700">{x.gapCells}</span>
                          <div
                            className="flex w-5 items-end justify-center"
                            style={{ height: ROLE_CHART_BAR_MAX_PX }}
                          >
                            <span
                              className="w-3 rounded-t bg-rose-500/90"
                              style={{ height: `${Math.max(2, gh)}px` }}
                              title="Gap cells"
                            />
                          </div>
                        </div>
                      </div>
                      <span className="text-[8px] text-muted">P / G</span>
                    </button>
                  )
                })}
              </div>
            </div>
            {selRoleChart ? (
              <div className="mt-2 rounded-lg border border-border bg-surface">
                <div className="border-b border-border px-2 py-1">
                  <h3 className="text-[11px] font-semibold">
                    {roles.find((r) => r.id === selRoleChart)?.name ?? 'Role'} — people & gaps
                  </h3>
                </div>
                <SimpleTable headers={['Person', 'Gap skills']} rows={roleDetailRows} empty="No people in role." />
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-surface-raised/40 p-3">
            <h2 className="font-display text-sm font-semibold">Role assessment</h2>
            <p className="mt-0.5 text-[10px] text-muted">Choose a role to list assigned people and qualification vs gaps.</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] text-muted">Role</span>
              <select
                value={resolvedAssessmentRoleId}
                onChange={(e) => setAssessmentRoleId(e.target.value)}
                className="max-w-xs rounded border border-border bg-surface px-2 py-1 text-xs"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 rounded-lg border border-border bg-surface">
              <SimpleTable
                headers={['Person', 'Qualified / gaps']}
                rows={assessmentRows}
                empty="No people in this role."
              />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface-raised/40 p-3">
            <h2 className="font-display text-sm font-semibold">Training completion leaders (period)</h2>
            <p className="mt-0.5 text-[10px] text-muted">After filters. L1→2 = passed quiz attempts; L2→3 = matrix promotions recorded.</p>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface">
                <div className="border-b border-border px-2 py-1.5">
                  <h3 className="text-[11px] font-semibold text-muted">Most L1→2 completions</h3>
                </div>
                <SimpleTable
                  headers={['Person', 'Passed attempts']}
                  rows={topTrainers.map((t) => [t.name, String(t.n)])}
                  empty="No data."
                />
              </div>
              <div className="rounded-lg border border-border bg-surface">
                <div className="border-b border-border px-2 py-1.5">
                  <h3 className="text-[11px] font-semibold text-muted">Most L2→3 promotions (person)</h3>
                </div>
                <SimpleTable
                  headers={['Person', 'L2→3 events']}
                  rows={topL23Learners.map((t) => [t.name, String(t.n)])}
                  empty="No data."
                />
              </div>
              <div className="rounded-lg border border-border bg-surface md:col-span-2">
                <div className="border-b border-border px-2 py-1.5">
                  <h3 className="text-[11px] font-semibold text-muted">Most L2→3 assessments recorded (assessor)</h3>
                </div>
                <SimpleTable
                  headers={['Assessor', 'Events recorded']}
                  rows={topL23Assessors.map((t) => [t.name, String(t.n)])}
                  empty="No assessor attribution yet (needs assessed_by on events), or no data in range."
                />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
