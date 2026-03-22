import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, UserCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { MatrixCellEditor, type CellEditorContext } from '../features/matrix/MatrixCellEditor'
import {
  classifyCell,
  formatLevel,
  gapKindClasses,
  type GapKind,
  type SkillKind,
} from '../features/matrix/gapLogic'

type SkillRaw = {
  id: string
  name: string
  kind: SkillKind
  sort_order: number
  skill_groups: { name: string } | { name: string }[] | null
}

type PersonRow = {
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

function groupName(s: SkillRaw): string {
  const g = s.skill_groups
  if (g == null) return ''
  return Array.isArray(g) ? (g[0]?.name ?? '') : g.name
}

function maxRequiredForRoles(rsrMap: Map<string, number>, roleIds: string[], skillId: string): number | null {
  let max: number | null = null
  for (const rid of roleIds) {
    const v = rsrMap.get(`${rid}\0${skillId}`)
    if (v != null) max = max == null ? v : Math.max(max, v)
  }
  return max
}

function gapLabel(k: GapKind): string {
  switch (k) {
    case 'critical':
      return 'Critical gap'
    case 'minor':
      return 'Minor gap'
    case 'meet':
      return 'Meets'
    case 'exceed':
      return 'Exceeds'
    case 'extra':
      return 'Extra'
    case 'na':
    default:
      return 'N/A'
  }
}

type SkillRowModel = {
  skillId: string
  skillName: string
  kind: SkillKind
  groupLabel: string
  required: number | null
  actual: number | null
  isExtra: boolean
  dueDate: string | null
  gap: GapKind
}

export function MySkillsPage() {
  const { user, isAdmin } = useAuth()
  const [dataVersion, setDataVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [person, setPerson] = useState<PersonRow | null>(null)
  const [noLink, setNoLink] = useState(false)
  const [skillsRaw, setSkillsRaw] = useState<SkillRaw[]>([])
  const [rsr, setRsr] = useState<RsrRaw[]>([])
  const [psRows, setPsRows] = useState<PsRaw[]>([])
  const [editorCtx, setEditorCtx] = useState<CellEditorContext | null>(null)

  const bumpData = useCallback(() => setDataVersion((v) => v + 1), [])

  const load = useCallback(async () => {
    if (!user?.id) {
      setPerson(null)
      setNoLink(false)
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    setNoLink(false)

    const { data: pRow, error: pErr } = await supabase
      .from('people')
      .select('id, display_name, person_roles(role_id)')
      .eq('user_id', user.id)
      .maybeSingle()

    if (pErr) {
      setLoadError(pErr.message)
      setPerson(null)
      setNoLink(false)
      setLoading(false)
      return
    }

    if (!pRow) {
      setPerson(null)
      setNoLink(true)
      setSkillsRaw([])
      setRsr([])
      setPsRows([])
      setLoading(false)
      return
    }

    const pr = pRow as unknown as PersonRow
    setPerson(pr)

    const pid = pr.id
    const [sk, rs, ps] = await Promise.all([
      supabase.from('skills').select('id, name, kind, sort_order, skill_groups(name)').order('sort_order', {
        ascending: true,
      }),
      supabase.from('role_skill_requirements').select('role_id, skill_id, required_level'),
      supabase.from('person_skills').select('person_id, skill_id, actual_level, is_extra, due_date').eq('person_id', pid),
    ])

    if (sk.error) {
      setLoadError(sk.error.message)
      setSkillsRaw([])
    } else {
      setSkillsRaw((sk.data ?? []) as SkillRaw[])
    }
    if (!rs.error && rs.data) setRsr(rs.data as RsrRaw[])
    else setRsr([])
    if (!ps.error && ps.data) setPsRows(ps.data as PsRaw[])
    else setPsRows([])

    setLoading(false)
  }, [user])

  useEffect(() => {
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      void load()
    })
    return () => {
      cancelled = true
    }
  }, [load, dataVersion])

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
      m.set(row.skill_id, {
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

  const roleIds = useMemo(() => (person?.person_roles ?? []).map((x) => x.role_id), [person])

  const { requiredRows, optionalRows, addableSkillOptions } = useMemo(() => {
    const required: SkillRowModel[] = []
    const optional: SkillRowModel[] = []

    for (const s of sortedSkills) {
      const req = maxRequiredForRoles(rsrMap, roleIds, s.id)
      const ps = psMap.get(s.id)
      const actual = ps?.actual ?? null
      const isExtra = ps?.isExtra ?? false
      const dueDate = ps?.dueDate ?? null
      const gap = classifyCell({ kind: s.kind, required: req, actual, isExtra })
      const groupLabel = groupName(s) || 'Skills'

      const row: SkillRowModel = {
        skillId: s.id,
        skillName: s.name,
        kind: s.kind,
        groupLabel,
        required: req,
        actual,
        isExtra,
        dueDate,
        gap,
      }

      if (req != null) {
        required.push(row)
      } else if (actual != null || isExtra) {
        optional.push(row)
      }
    }

    const addable = sortedSkills.filter((s) => {
      const req = maxRequiredForRoles(rsrMap, roleIds, s.id)
      if (req != null) return false
      const ps = psMap.get(s.id)
      if (ps != null && (ps.actual != null || ps.isExtra)) return false
      return true
    })

    return { requiredRows: required, optionalRows: optional, addableSkillOptions: addable }
  }, [sortedSkills, roleIds, rsrMap, psMap])

  function openEditor(row: SkillRowModel) {
    if (!person) return
    setEditorCtx({
      personId: person.id,
      personName: person.display_name,
      skillId: row.skillId,
      skillName: row.skillName,
      kind: row.kind,
      required: row.required,
      actual: row.actual,
      isExtra: row.isExtra,
      dueDate: row.dueDate,
    })
  }

  function openEditorForSkill(s: SkillRaw) {
    if (!person) return
    const req = maxRequiredForRoles(rsrMap, roleIds, s.id)
    const ps = psMap.get(s.id)
    setEditorCtx({
      personId: person.id,
      personName: person.display_name,
      skillId: s.id,
      skillName: s.name,
      kind: s.kind,
      required: req,
      actual: ps?.actual ?? null,
      isExtra: ps?.isExtra ?? false,
      dueDate: ps?.dueDate ?? null,
    })
  }

  function requiredLabel(kind: SkillKind, req: number | null): string {
    if (req == null) return '—'
    if (kind === 'certification') return req >= 1 ? 'Yes' : 'No'
    return String(req)
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">My skills</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Your levels and target dates for skills required by your job roles, plus any extra skills you choose to
            track. Admins still manage the roster and catalog.
          </p>
        </div>
      </header>

      {loadError ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {loadError}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : noLink ? (
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-surface-raised/50 p-6 backdrop-blur-sm">
          <span className="flex size-12 items-center justify-center rounded-xl bg-accent-dim text-accent">
            <UserCircle className="size-7" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold">No person record linked</h2>
            <p className="mt-2 max-w-lg text-sm text-muted">
              Your account is not linked to anyone on the skill matrix yet. An admin can add you in{' '}
              <strong className="text-fg/90">Admin → People</strong> and attach your login.
            </p>
            {isAdmin ? (
              <p className="mt-2 text-sm text-accent">
                You’re an admin — open{' '}
                <Link to="/admin" className="underline underline-offset-2">
                  Admin
                </Link>{' '}
                to create or link your person row.
              </p>
            ) : null}
          </div>
        </div>
      ) : person ? (
        <>
          <p className="text-sm text-muted">
            Signed in as <span className="font-medium text-fg/90">{person.display_name}</span>
            {roleIds.length === 0 ? (
              <span className="text-muted"> · No job roles assigned yet — requirements may be empty.</span>
            ) : null}
          </p>

          <SkillSection
            title="Required for your roles"
            description="From role skill requirements. Update your actual level or certification status."
            rows={requiredRows}
            empty="Nothing required for your current job roles."
            onEdit={openEditor}
            requiredLabel={requiredLabel}
          />

          <SkillSection
            title="Extra skills you track"
            description="Skills not required by your roles but recorded on your profile."
            rows={optionalRows}
            empty="You have no optional skills recorded yet."
            onEdit={openEditor}
            requiredLabel={requiredLabel}
          />

          {addableSkillOptions.length > 0 ? (
            <section className="rounded-2xl border border-border bg-surface-raised/40 p-4 backdrop-blur-sm">
              <h2 className="font-display text-lg font-semibold tracking-tight">Track another skill</h2>
              <p className="mt-1 text-xs text-muted">Add a skill that is not required for your roles.</p>
              <label htmlFor="add-skill" className="mt-4 block text-xs font-medium uppercase tracking-wider text-muted">
                Choose skill
              </label>
              <select
                id="add-skill"
                defaultValue=""
                onChange={(e) => {
                  const id = e.target.value
                  e.target.value = ''
                  if (!id) return
                  const s = sortedSkills.find((x) => x.id === id)
                  if (s) openEditorForSkill(s)
                }}
                className="mt-1.5 w-full max-w-md rounded-xl border border-border bg-canvas/60 px-3 py-2.5 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2 md:w-auto md:min-w-[16rem]"
              >
                <option value="">Select…</option>
                {addableSkillOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {(groupName(s) || 'Skills') + ' · ' + s.name}
                  </option>
                ))}
              </select>
            </section>
          ) : null}
        </>
      ) : null}

      <MatrixCellEditor
        ctx={editorCtx}
        onDismiss={() => setEditorCtx(null)}
        onSaved={bumpData}
      />
    </div>
  )
}

function SkillSection(props: {
  title: string
  description: string
  rows: SkillRowModel[]
  empty: string
  onEdit: (row: SkillRowModel) => void
  requiredLabel: (kind: SkillKind, req: number | null) => string
}) {
  const { title, description, rows, empty, onEdit, requiredLabel } = props

  return (
    <section className="rounded-2xl border border-border bg-surface-raised/40 backdrop-blur-sm">
      <div className="border-b border-border px-4 py-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-xs text-muted">{description}</p>
      </div>
      <div className="divide-y divide-border p-2 sm:p-4">
        {rows.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted">{empty}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.skillId}
                className="flex flex-col gap-3 rounded-xl border border-border/60 bg-canvas/20 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-fg">{row.skillName}</p>
                  <p className="text-xs text-muted">{row.groupLabel}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md bg-white/[0.06] px-2 py-1 text-muted">
                      Required:{' '}
                      <span className="font-mono text-fg">{requiredLabel(row.kind, row.required)}</span>
                    </span>
                    <span className="rounded-md bg-white/[0.06] px-2 py-1 text-muted">
                      Actual:{' '}
                      <span className="font-mono text-fg">{formatLevel(row.kind, row.actual)}</span>
                    </span>
                    {row.dueDate ? (
                      <span className="rounded-md bg-white/[0.06] px-2 py-1 text-muted">
                        Target: <span className="font-mono text-fg">{row.dueDate}</span>
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${gapKindClasses(row.gap)}`}
                    >
                      {gapLabel(row.gap)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(row)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-fg hover:border-border-strong sm:self-center"
                >
                  <Pencil className="size-4 text-muted" aria-hidden />
                  Edit
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
