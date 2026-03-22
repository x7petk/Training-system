import { useMemo, useState, useEffect, useCallback } from 'react'
import { Filter, Search } from 'lucide-react'
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

type PersonRaw = {
  id: string
  display_name: string
  person_roles: { role_id: string }[] | null
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

function groupName(s: SkillRaw): string {
  const g = s.skill_groups
  if (g == null) return ''
  return Array.isArray(g) ? (g[0]?.name ?? '') : g.name
}

export function MatrixPage() {
  const { user, isAdmin } = useAuth()
  const [myPersonId, setMyPersonId] = useState<string | null>(null)
  const [dataVersion, setDataVersion] = useState(0)
  const [skillsRaw, setSkillsRaw] = useState<SkillRaw[]>([])
  const [peopleRaw, setPeopleRaw] = useState<PersonRaw[]>([])
  const [rsr, setRsr] = useState<RsrRaw[]>([])
  const [psRows, setPsRows] = useState<PsRaw[]>([])
  const [roles, setRoles] = useState<RoleRaw[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [personQuery, setPersonQuery] = useState('')
  const [skillQuery, setSkillQuery] = useState('')

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
    (personId: string) => isAdmin || (myPersonId != null && personId === myPersonId),
    [isAdmin, myPersonId],
  )

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      supabase
        .from('skills')
        .select('id, name, kind, sort_order, skill_groups(name)')
        .order('sort_order', { ascending: true }),
      supabase.from('people').select('id, display_name, person_roles(role_id)').order('display_name'),
      supabase.from('role_skill_requirements').select('role_id, skill_id, required_level'),
      supabase.from('person_skills').select('person_id, skill_id, actual_level, is_extra, due_date'),
      supabase.from('roles').select('id, name').order('sort_order', { ascending: true }),
    ]).then(([sk, pe, rs, ps, ro]) => {
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

  const skillColumns: MatrixSkillColumn[] = useMemo(() => {
    const q = skillQuery.trim().toLowerCase()
    return sortedSkills
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        groupName: groupName(s) || 'Skills',
      }))
  }, [sortedSkills, skillQuery])

  const matrixRows: MatrixRowModel[] = useMemo(() => {
    function maxRequired(roleIds: string[], skillId: string): number | null {
      let max: number | null = null
      for (const rid of roleIds) {
        const v = rsrMap.get(`${rid}\0${skillId}`)
        if (v != null) max = max == null ? v : Math.max(max, v)
      }
      return max
    }

    const pq = personQuery.trim().toLowerCase()
    const people = pq
      ? peopleRaw.filter((p) => p.display_name.toLowerCase().includes(pq))
      : peopleRaw

    return people.map((p) => {
      const roleIds = (p.person_roles ?? []).map((x) => x.role_id)
      const roleText =
        roleIds.length === 0
          ? 'No job roles'
          : roleIds.map((id) => roleNameById.get(id) ?? '…').join(' · ')

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
  }, [peopleRaw, personQuery, skillColumns, psMap, rsrMap, roleNameById])

  const counts = useMemo(
    () => ({
      skills: skillsRaw.length,
      roles: roles.length,
      people: peopleRaw.length,
      requirements: rsr.length,
    }),
    [skillsRaw.length, roles.length, peopleRaw.length, rsr.length],
  )

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Skill matrix</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Wide heatmap: people × skills. <strong className="text-fg/90">Click a cell</strong> to set actual level
            and optional target date (admins: any person; others: only your linked row in Admin).
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ['Skills', counts.skills],
            ['Roles', counts.roles],
            ['People', counts.people],
            ['Requirements', counts.requirements],
          ] as const
        ).map(([label, n]) => (
          <div
            key={label}
            className="rounded-2xl border border-border bg-surface-raised/50 px-4 py-3 backdrop-blur-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-fg">{n}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface-raised px-3 py-2">
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            value={personQuery}
            onChange={(e) => setPersonQuery(e.target.value)}
            placeholder="Filter people…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/60"
          />
        </label>
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface-raised px-3 py-2">
          <Filter className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            value={skillQuery}
            onChange={(e) => setSkillQuery(e.target.value)}
            placeholder="Filter skills…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/60"
          />
        </label>
      </div>

      {loadError ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
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

      <div className="flex flex-wrap gap-3 text-[11px] text-muted">
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
          <span className="size-2.5 rounded-sm bg-white/10" /> N/A
        </span>
      </div>
    </div>
  )
}
