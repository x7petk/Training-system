import { useMemo, useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { Filter, Grid3X3, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { classifyCell, type SkillKind } from '../features/matrix/gapLogic'
import { MatrixGrid, type MatrixRowModel, type MatrixSkillColumn } from '../features/matrix/MatrixGrid'

type SkillRaw = {
  id: string
  name: string
  kind: SkillKind
  sort_order: number
  skill_groups: { name: string } | { name: string }[] | null
}

type TeamEmbed = { name: string } | { name: string }[] | null

type PersonRaw = {
  id: string
  display_name: string
  team_id: string | null
  teams: TeamEmbed
  person_roles: { role_id: string }[] | null
}

function teamNameFromEmbed(teams: TeamEmbed): string {
  if (teams == null) return ''
  return Array.isArray(teams) ? (teams[0]?.name ?? '') : teams.name
}

type RsrRaw = { role_id: string; skill_id: string; required_level: number }
type PsRaw = {
  person_id: string
  skill_id: string
  actual_level: number | null
  is_extra: boolean
  due_date: string | null
}

type RoleRaw = { id: string; name: string }
type TeamRaw = { id: string; name: string }

function groupName(s: SkillRaw): string {
  const g = s.skill_groups
  if (g == null) return ''
  return Array.isArray(g) ? (g[0]?.name ?? '') : g.name
}

export function MatrixPage() {
  const { user, isAdmin, isAssessor, isOperator, adminLoading } = useAuth()
  const [myPersonId, setMyPersonId] = useState<string | null>(null)
  const [dataVersion, setDataVersion] = useState(0)
  const [skillsRaw, setSkillsRaw] = useState<SkillRaw[]>([])
  const [peopleRaw, setPeopleRaw] = useState<PersonRaw[]>([])
  const [rsr, setRsr] = useState<RsrRaw[]>([])
  const [psRows, setPsRows] = useState<PsRaw[]>([])
  const [roles, setRoles] = useState<RoleRaw[]>([])
  const [teams, setTeams] = useState<TeamRaw[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [personQuery, setPersonQuery] = useState('')
  const [skillQuery, setSkillQuery] = useState('')
  /** People must have at least one of these job roles (empty = all). */
  const [filterRoleIds, setFilterRoleIds] = useState<string[]>([])
  /** Columns limited to these skill groups (empty = all). */
  const [filterSkillGroups, setFilterSkillGroups] = useState<string[]>([])
  /** People must belong to one of these teams (empty = all). */
  const [filterTeamIds, setFilterTeamIds] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    if (!user?.id) {
      void Promise.resolve().then(() => {
        if (!cancelled) setMyPersonId(null)
      })
      return () => {
        cancelled = true
      }
    }
    void supabase
      .from('people')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error && data?.id) setMyPersonId(data.id)
        else setMyPersonId(null)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const bumpData = useCallback(() => setDataVersion((v) => v + 1), [])

  const canEditPerson = useCallback(
    (personId: string) =>
      isAdmin ||
      isAssessor ||
      (!isOperator && myPersonId != null && personId === myPersonId),
    [isAdmin, isAssessor, isOperator, myPersonId],
  )

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      supabase
        .from('skills')
        .select('id, name, kind, sort_order, skill_groups(name)')
        .order('sort_order', { ascending: true }),
      supabase
        .from('people')
        .select('id, display_name, team_id, teams(name), person_roles(role_id)')
        .order('display_name'),
      supabase.from('role_skill_requirements').select('role_id, skill_id, required_level'),
      supabase.from('person_skills').select('person_id, skill_id, actual_level, is_extra, due_date'),
      supabase.from('roles').select('id, name').order('sort_order', { ascending: true }),
      supabase.from('teams').select('id, name').order('sort_order', { ascending: true }),
    ]).then(([sk, pe, rs, ps, ro, tm]) => {
      if (cancelled) return
      if (sk.error) {
        setLoadError(sk.error.message)
        setSkillsRaw([])
      } else {
        setSkillsRaw((sk.data ?? []) as SkillRaw[])
      }
      if (pe.error) {
        setLoadError(pe.error.message)
        setPeopleRaw([])
      } else {
        setPeopleRaw((pe.data ?? []) as PersonRaw[])
      }
      if (!rs.error && rs.data) setRsr(rs.data as RsrRaw[])
      if (!ps.error && ps.data) setPsRows(ps.data as PsRaw[])
      if (!ro.error && ro.data) setRoles(ro.data as RoleRaw[])
      if (!tm.error && tm.data) setTeams(tm.data as TeamRaw[])
      else setTeams([])
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [dataVersion])

  const roleNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of roles) m.set(r.id, r.name)
    return m
  }, [roles])

  const rsrMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const row of rsr) {
      m.set(`${row.role_id}\0${row.skill_id}`, row.required_level)
    }
    return m
  }, [rsr])

  const psMap = useMemo(() => {
    const m = new Map<string, { actual: number | null; isExtra: boolean; dueDate: string | null }>()
    for (const row of psRows) {
      m.set(`${row.person_id}\0${row.skill_id}`, {
        actual: row.actual_level,
        isExtra: row.is_extra,
        dueDate: row.due_date,
      })
    }
    return m
  }, [psRows])

  const sortedSkills = useMemo(() => {
    const copy = [...skillsRaw]
    copy.sort((a, b) => {
      const ga = groupName(a)
      const gb = groupName(b)
      if (ga !== gb) return ga.localeCompare(gb)
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
      return a.name.localeCompare(b.name)
    })
    return copy
  }, [skillsRaw])

  const skillGroupOptions = useMemo(() => {
    const names = new Set<string>()
    for (const s of skillsRaw) names.add(groupName(s) || 'Skills')
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [skillsRaw])

  const skillColumns: MatrixSkillColumn[] = useMemo(() => {
    const q = skillQuery.trim().toLowerCase()
    return sortedSkills
      .filter((s) => {
        const g = groupName(s) || 'Skills'
        if (filterSkillGroups.length > 0 && !filterSkillGroups.includes(g)) return false
        return !q || s.name.toLowerCase().includes(q)
      })
      .map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        groupName: groupName(s) || 'Skills',
      }))
  }, [sortedSkills, skillQuery, filterSkillGroups])

  const peopleFiltered = useMemo(() => {
    const pq = personQuery.trim().toLowerCase()
    let people = pq
      ? peopleRaw.filter((p) => p.display_name.toLowerCase().includes(pq))
      : peopleRaw
    if (filterRoleIds.length > 0) {
      people = people.filter((p) =>
        (p.person_roles ?? []).some((pr) => filterRoleIds.includes(pr.role_id)),
      )
    }
    if (filterTeamIds.length > 0) {
      people = people.filter((p) => p.team_id != null && filterTeamIds.includes(p.team_id))
    }
    return people
  }, [peopleRaw, personQuery, filterRoleIds, filterTeamIds])

  const matrixRows: MatrixRowModel[] = useMemo(() => {
    function maxRequired(roleIds: string[], skillId: string): number | null {
      let max: number | null = null
      for (const rid of roleIds) {
        const v = rsrMap.get(`${rid}\0${skillId}`)
        if (v != null) max = max == null ? v : Math.max(max, v)
      }
      return max
    }

    return peopleFiltered.map((p) => {
      const roleIds = (p.person_roles ?? []).map((x) => x.role_id)
      const roleLine =
        roleIds.length === 0 ? '' : roleIds.map((id) => roleNameById.get(id) ?? '…').join(' · ')
      const teamName = teamNameFromEmbed(p.teams)
      const roleText = [teamName, roleLine].filter(Boolean).join(' · ') || '—'

      const cells: MatrixRowModel['cells'] = {}
      for (const s of skillColumns) {
        const required = maxRequired(roleIds, s.id)
        const ps = psMap.get(`${p.id}\0${s.id}`)
        const actual = ps?.actual ?? null
        const isExtra = ps?.isExtra ?? false
        const gap = classifyCell({
          kind: s.kind,
          required,
          actual,
          isExtra,
        })
        cells[s.id] = {
          gap,
          kind: s.kind,
          required,
          actual,
          isExtra,
          dueDate: ps?.dueDate ?? null,
        }
      }

      return {
        personId: p.id,
        displayName: p.display_name,
        roleText,
        cells,
      }
    })
  }, [peopleFiltered, skillColumns, psMap, rsrMap, roleNameById])

  const filtersActive =
    filterRoleIds.length > 0 ||
    filterTeamIds.length > 0 ||
    filterSkillGroups.length > 0 ||
    personQuery.trim().length > 0 ||
    skillQuery.trim().length > 0

  function toggleRoleFilter(id: string) {
    setFilterRoleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleTeamFilter(id: string) {
    setFilterTeamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleSkillGroupFilter(name: string) {
    setFilterSkillGroups((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    )
  }

  function clearAllFilters() {
    setFilterRoleIds([])
    setFilterTeamIds([])
    setFilterSkillGroups([])
    setPersonQuery('')
    setSkillQuery('')
  }

  const chipOn =
    'border-accent/50 bg-accent-dim text-fg shadow-[0_0_12px_-4px_color-mix(in_oklab,var(--color-accent)_40%,transparent)]'
  const chipOff =
    'border-border bg-canvas/80 text-muted hover:border-border-strong hover:text-fg/90'
  const searchInputClass =
    'min-w-0 flex-1 bg-transparent py-1 text-xs outline-none placeholder:text-muted/55'
  const searchShellClass =
    'flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-border bg-canvas/90 px-2 py-0.5'

  if (!adminLoading && isOperator) {
    return <Navigate to="/my-skills" replace />
  }

  return (
    <div className="space-y-3">
      <header className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-accent">
          <Grid3X3 className="size-5" aria-hidden />
        </span>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Skill matrix</h1>
      </header>

      <section
        aria-label="Matrix filters"
        className="rounded-xl border border-border bg-surface-raised/50 px-2.5 py-2 shadow-sm backdrop-blur-sm"
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
            <label className={searchShellClass}>
              <Search className="size-3.5 shrink-0 text-muted" aria-hidden />
              <input
                type="search"
                value={personQuery}
                onChange={(e) => setPersonQuery(e.target.value)}
                placeholder="People…"
                aria-label="Filter people by name"
                className={searchInputClass}
              />
            </label>
            <label className={searchShellClass}>
              <Filter className="size-3.5 shrink-0 text-muted" aria-hidden />
              <input
                type="search"
                value={skillQuery}
                onChange={(e) => setSkillQuery(e.target.value)}
                placeholder="Skills…"
                aria-label="Filter skills by name"
                className={searchInputClass}
              />
            </label>
            {filtersActive ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="shrink-0 rounded-lg border border-border bg-canvas/90 px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-surface sm:ml-auto"
              >
                Reset all
              </button>
            ) : null}
          </div>

          <fieldset className="min-w-0 border-t border-border/70 pt-2">
            <legend className="sr-only">Job role</legend>
            <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
              <span className="w-full shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted sm:w-[4.5rem] sm:pt-1">
                Job role
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {roles.length === 0 ? (
                  <span className="text-[11px] text-muted">No roles</span>
                ) : (
                  roles.map((r) => {
                    const on = filterRoleIds.includes(r.id)
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleRoleFilter(r.id)}
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${on ? chipOn : chipOff}`}
                        aria-pressed={on}
                      >
                        {r.name}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </fieldset>

          <fieldset className="min-w-0 border-t border-border/70 pt-2">
            <legend className="sr-only">Team</legend>
            <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
              <span className="w-full shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted sm:w-[4.5rem] sm:pt-1">
                Team
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {teams.length === 0 ? (
                  <span className="text-[11px] text-muted">No teams</span>
                ) : (
                  teams.map((t) => {
                    const on = filterTeamIds.includes(t.id)
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTeamFilter(t.id)}
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${on ? chipOn : chipOff}`}
                        aria-pressed={on}
                      >
                        {t.name}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </fieldset>

          <fieldset className="min-w-0 border-t border-border/70 pt-2">
            <legend className="sr-only">Skill group</legend>
            <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
              <span className="w-full shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted sm:w-[4.5rem] sm:pt-1">
                Group
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {skillGroupOptions.length === 0 ? (
                  <span className="text-[11px] text-muted">No groups</span>
                ) : (
                  skillGroupOptions.map((name) => {
                    const on = filterSkillGroups.includes(name)
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleSkillGroupFilter(name)}
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${on ? chipOn : chipOff}`}
                        aria-pressed={on}
                      >
                        {name}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </fieldset>
        </div>
      </section>

      {loadError ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {loadError}
        </p>
      ) : null}

      <MatrixGrid
        skills={skillColumns}
        rows={matrixRows}
        loading={loading}
        emptyMessage="Add people in Admin and assign job roles to see rows here."
        canEditPerson={canEditPerson}
        onDataChanged={bumpData}
      />

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
        <span className="font-medium uppercase tracking-wider text-muted">Legend</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-rose-500/50 ring-1 ring-rose-400/40" /> Critical gap
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-amber-500/40 ring-1 ring-amber-400/35" /> Minor gap
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-emerald-500/35 ring-1 ring-emerald-400/30" /> Meets
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-teal-600/35 ring-1 ring-teal-400/35" /> Exceeds
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-sky-500/25 ring-1 ring-sky-400/25" /> Extra skill
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-zinc-200 ring-1 ring-zinc-300/80" /> N/A
        </span>
      </div>
    </div>
  )
}
