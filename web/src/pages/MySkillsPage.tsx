import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpenCheck, Check, ChevronDown, ChevronRight, Pencil, UserCircle, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { addDays, compareYMD, localYMD, startOfDay } from '../lib/dueDateUtils'
import { useAuth } from '../hooks/useAuth'
import {
  MatrixCellEditor,
  type CellEditorAnchor,
  type CellEditorContext,
} from '../features/matrix/MatrixCellEditor'
import {
  classifyCell,
  formatLevel,
  gapKindClasses,
  gapKindLegendLabel,
  type GapKind,
  type SkillKind,
} from '../features/matrix/gapLogic'
import {
  standardPageImageClass,
  standardPageOuterClass,
  standardPageProseClass,
  standardPageStageClass,
  standardPageTitleClass,
} from '../features/training/standardPageCanvas'
import {
  extractStandardContentLinks,
  removeAnchorsForCanvasPreview,
} from '../features/training/trainingLinkUtils'

type SkillRaw = {
  id: string
  name: string
  kind: SkillKind
  sort_order: number
  skill_groups: { name: string } | { name: string }[] | null
}

type TeamEmbed = { name: string } | { name: string }[] | null

type PersonRoleEmbed = {
  role_id: string
  roles?: { name: string } | { name: string }[] | null
}

type PersonRow = {
  id: string
  display_name: string
  team_id: string | null
  teams: TeamEmbed
  person_roles: PersonRoleEmbed[] | null
}

function teamNameFromEmbed(teams: TeamEmbed): string {
  if (teams == null) return ''
  return Array.isArray(teams) ? (teams[0]?.name ?? '') : teams.name
}

function roleNameFromEmbed(
  v: { name: string } | { name: string }[] | null | undefined,
): string {
  if (!v) return ''
  return Array.isArray(v) ? (v[0]?.name ?? '') : v.name
}

function jobRoleLabelFromPersonRole(pr: PersonRoleEmbed): string {
  return roleNameFromEmbed(pr.roles) || 'Role'
}

type RsrRaw = { role_id: string; skill_id: string; required_level: number }
type PsRaw = {
  person_id: string
  skill_id: string
  actual_level: number | null
  is_extra: boolean
  due_date: string | null
}

type TrainingPackRaw = {
  skill_id: string
  document_path: string | null
  document_name: string | null
  document_mime: string | null
  pass_score_percent: number
}

type TrainingQuestionRaw = {
  id: string
  skill_id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: 'A' | 'B' | 'C' | 'D'
  option_count: number
  sort_order: number
}

type TrainingStandardRaw = {
  skill_id: string
  title: string
  pages: Array<{
    id: string
    contentHtml: string
    images: Array<{
      id: string
      path: string
      x?: number
      y?: number
      w?: number
      h?: number
    }>
  }>
}

type AssessorProfileRaw = { id: string; display_name: string | null; role: string }
type AssessorPersonRaw = {
  id: string
  user_id: string | null
  display_name: string
  teams: TeamEmbed
  person_roles: { roles: { name: string } | { name: string }[] | null }[] | null
}
type AssessorCard = {
  profileId: string
  name: string
  team: string
  roles: string[]
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

function groupRowsByGroupLabel(rows: SkillRowModel[]): { label: string; rows: SkillRowModel[] }[] {
  const order: string[] = []
  const map = new Map<string, SkillRowModel[]>()
  for (const row of rows) {
    const label = row.groupLabel?.trim() || 'Skills'
    if (!map.has(label)) {
      order.push(label)
      map.set(label, [])
    }
    map.get(label)!.push(row)
  }
  return order.map((label) => ({ label, rows: map.get(label)! }))
}

function summarizeSkillGroup(rows: SkillRowModel[]) {
  let level1 = 0
  let level2 = 0
  let level3 = 0
  let level4 = 0
  let certYes = 0
  let certNo = 0
  let withGap = 0
  for (const r of rows) {
    if (r.kind === 'numeric') {
      if (r.actual === 1) level1 += 1
      else if (r.actual === 2) level2 += 1
      else if (r.actual === 3) level3 += 1
      else if (r.actual === 4) level4 += 1
    } else {
      if (r.actual != null && r.actual >= 1) certYes += 1
      else certNo += 1
    }
    if (r.gap === 'critical' || r.gap === 'minor') withGap += 1
  }
  return { level1, level2, level3, level4, certYes, certNo, withGap }
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

const selectFilterClass =
  'min-w-0 flex-1 rounded-lg border border-border bg-canvas/90 px-2 py-1 text-xs outline-none ring-accent/30 focus:border-accent/50 focus:ring-1'

const GAP_FILTER_ORDER: GapKind[] = ['critical', 'minor', 'meet', 'exceed', 'extra', 'na']
const TRAINING_DOC_BUCKET = 'skill-training-docs'
const TRAINING_STANDARD_IMG_BUCKET = 'skill-training-standard-images'

type GapFilterValue = 'all' | GapKind

type MySkillsDueQuickFilter =
  | { kind: 'none' }
  | { kind: 'tile'; id: 'overdue' | 'next7' | 'next30' | 'noTarget' }

function rowMatchesDueQuickFilter(
  row: SkillRowModel,
  f: MySkillsDueQuickFilter,
  todayStr: string,
  today: Date,
): boolean {
  if (f.kind === 'none') return true
  const d = row.dueDate?.trim() || ''
  const hasDue = d.length > 0

  if (f.id === 'overdue') return hasDue && compareYMD(d, todayStr) < 0
  if (f.id === 'next7') {
    const end = localYMD(addDays(today, 6))
    return hasDue && compareYMD(d, todayStr) >= 0 && compareYMD(d, end) <= 0
  }
  if (f.id === 'next30') {
    const end = localYMD(addDays(today, 29))
    return hasDue && compareYMD(d, todayStr) >= 0 && compareYMD(d, end) <= 0
  }
  if (f.id === 'noTarget') {
    return !hasDue && (row.gap === 'critical' || row.gap === 'minor')
  }
  return true
}

export function MySkillsPage() {
  const { user, isAdmin, isAssessor, isOperator } = useAuth()
  const readOnly = isOperator
  /** Pick anyone on the roster and edit their skills (incl. extra skills). */
  const canManageAnyPerson = isAdmin || isAssessor
  const [dataVersion, setDataVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [person, setPerson] = useState<PersonRow | null>(null)
  const [noLink, setNoLink] = useState(false)
  const [adminNoPeople, setAdminNoPeople] = useState(false)
  const [peopleOptions, setPeopleOptions] = useState<PersonRow[]>([])
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [skillsRaw, setSkillsRaw] = useState<SkillRaw[]>([])
  const [rsr, setRsr] = useState<RsrRaw[]>([])
  const [psRows, setPsRows] = useState<PsRaw[]>([])
  const [trainingPacks, setTrainingPacks] = useState<TrainingPackRaw[]>([])
  const [trainingQuestions, setTrainingQuestions] = useState<TrainingQuestionRaw[]>([])
  const [trainingSkillId, setTrainingSkillId] = useState<string | null>(null)
  const [assessors, setAssessors] = useState<AssessorCard[]>([])
  const [assessorSkillInfo, setAssessorSkillInfo] = useState<{ skillName: string; required: number } | null>(null)
  const [editorCtx, setEditorCtx] = useState<CellEditorContext | null>(null)
  const [gapFilter, setGapFilter] = useState<GapFilterValue>('all')
  const [dueQuickFilter, setDueQuickFilter] = useState<MySkillsDueQuickFilter>({ kind: 'none' })
  const [skillGroupFilter, setSkillGroupFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [jobRoleFilter, setJobRoleFilter] = useState('')

  const bumpData = useCallback(() => setDataVersion((v) => v + 1), [])

  useEffect(() => {
    if (!user?.id) {
      void Promise.resolve().then(() => {
        setPerson(null)
        setPeopleOptions([])
        setSelectedPersonId(null)
        setNoLink(false)
        setAdminNoPeople(false)
        setTrainingPacks([])
        setTrainingQuestions([])
        setAssessors([])
        setTrainingSkillId(null)
        setLoading(false)
      })
      return
    }

    let cancelled = false

    void Promise.resolve().then(() => {
      void (async () => {
        setLoading(true)
        setLoadError(null)

        const { data: linked, error: linkErr } = await supabase
          .from('people')
          .select('id, display_name, team_id, teams(name), person_roles(role_id, roles(name))')
          .eq('user_id', user.id)
          .maybeSingle()

        if (cancelled) return
        if (linkErr) {
          setLoadError(linkErr.message)
          setPerson(null)
          setLoading(false)
          return
        }

        const linkedRow = linked as PersonRow | null
        let people: PersonRow[] = []

        if (canManageAnyPerson) {
          const { data: plist, error: pe } = await supabase
            .from('people')
            .select('id, display_name, team_id, teams(name), person_roles(role_id, roles(name))')
            .order('display_name')
          if (cancelled) return
          if (pe) {
            setLoadError(pe.message)
            setLoading(false)
            return
          }
          people = (plist ?? []) as PersonRow[]
          setPeopleOptions(people)

          if (people.length === 0) {
            setAdminNoPeople(true)
            setNoLink(false)
            setPerson(null)
            setSkillsRaw([])
            setRsr([])
            setPsRows([])
            setTrainingPacks([])
            setTrainingQuestions([])
            setAssessors([])
            setTrainingSkillId(null)
            setSelectedPersonId(null)
            setLoading(false)
            return
          }
          setAdminNoPeople(false)

          let targetId: string | null = null
          if (selectedPersonId && people.some((p) => p.id === selectedPersonId)) {
            targetId = selectedPersonId
          } else {
            targetId = linkedRow?.id ?? people[0]?.id ?? null
            if (targetId !== selectedPersonId) {
              void Promise.resolve().then(() => setSelectedPersonId(targetId))
              return
            }
          }

          await loadPersonSkills(targetId, cancelled)
          return
        }

        setPeopleOptions([])
        setAdminNoPeople(false)
        setSelectedPersonId(null)

        if (!linkedRow) {
          setPerson(null)
          setNoLink(true)
          setSkillsRaw([])
          setRsr([])
          setPsRows([])
          setTrainingPacks([])
          setTrainingQuestions([])
          setAssessors([])
          setTrainingSkillId(null)
          setLoading(false)
          return
        }

        setNoLink(false)
        await loadPersonSkills(linkedRow.id, cancelled)
      })()
    })

    async function loadPersonSkills(pid: string, cancel: boolean) {
      const { data: pRow, error: pErr } = await supabase
        .from('people')
        .select('id, display_name, team_id, teams(name), person_roles(role_id, roles(name))')
        .eq('id', pid)
        .single()

      if (cancel) return
      if (pErr || !pRow) {
        setLoadError(pErr?.message ?? 'Person not found')
        setPerson(null)
        setSkillsRaw([])
        setRsr([])
        setPsRows([])
        setTrainingPacks([])
        setTrainingQuestions([])
        setAssessors([])
        setTrainingSkillId(null)
        setLoading(false)
        return
      }

      setPerson(pRow as PersonRow)
      setNoLink(false)

      const [sk, rs, ps, tp, tq, assessorProfiles] = await Promise.all([
        supabase.from('skills').select('id, name, kind, sort_order, skill_groups(name)').order('sort_order', {
          ascending: true,
        }),
        supabase.from('role_skill_requirements').select('role_id, skill_id, required_level'),
        supabase.from('person_skills').select('person_id, skill_id, actual_level, is_extra, due_date').eq('person_id', pid),
        supabase
          .from('skill_training_packs')
          .select('skill_id, document_path, document_name, document_mime, pass_score_percent'),
        supabase
          .from('skill_training_questions')
          .select(
            'id, skill_id, question_text, option_a, option_b, option_c, option_d, correct_option, option_count, sort_order',
          )
          .order('sort_order', { ascending: true }),
        supabase.from('profiles').select('id, display_name, role').eq('role', 'assessor').order('display_name'),
      ])

      if (cancel) return
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
      if (!tp.error && tp.data) setTrainingPacks(tp.data as TrainingPackRaw[])
      else setTrainingPacks([])
      if (!tq.error && tq.data) setTrainingQuestions(tq.data as TrainingQuestionRaw[])
      else setTrainingQuestions([])
      const assessorProfileRows = (assessorProfiles.data ?? []) as AssessorProfileRaw[]
      if (assessorProfiles.error || assessorProfileRows.length === 0) {
        setAssessors([])
      } else {
        const assessorIds = assessorProfileRows.map((x) => x.id)
        const peopleRes = await supabase
          .from('people')
          .select('id, user_id, display_name, teams(name), person_roles(roles(name))')
          .in('user_id', assessorIds)
        if (peopleRes.error) {
          setAssessors([])
        } else {
          const peopleRows = (peopleRes.data ?? []) as AssessorPersonRaw[]
          const peopleByUserId = new Map<string, AssessorPersonRaw>()
          for (const p of peopleRows) if (p.user_id) peopleByUserId.set(p.user_id, p)
          const merged: AssessorCard[] = assessorProfileRows.map((p) => {
            const personRow = peopleByUserId.get(p.id)
            const roles = (personRow?.person_roles ?? [])
              .map((r) => roleNameFromEmbed(r.roles))
              .filter((x) => x.length > 0)
            return {
              profileId: p.id,
              name: personRow?.display_name || p.display_name || 'Assessor',
              team: personRow ? teamNameFromEmbed(personRow.teams) : '',
              roles,
            }
          })
          merged.sort((a, b) => a.name.localeCompare(b.name))
          setAssessors(merged)
        }
      }
      setLoading(false)
    }

    return () => {
      cancelled = true
    }
  }, [user, isAdmin, isAssessor, canManageAnyPerson, selectedPersonId, dataVersion])

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

  const gapCounts = useMemo(() => {
    const c: Record<GapKind, number> = {
      critical: 0,
      minor: 0,
      meet: 0,
      exceed: 0,
      extra: 0,
      na: 0,
    }
    for (const r of requiredRows) c[r.gap] += 1
    for (const r of optionalRows) c[r.gap] += 1
    return c
  }, [requiredRows, optionalRows])

  const totalSkillRows = requiredRows.length + optionalRows.length

  const filteredRequiredRows = useMemo(() => {
    if (gapFilter === 'all') return requiredRows
    return requiredRows.filter((r) => r.gap === gapFilter)
  }, [requiredRows, gapFilter])

  const filteredOptionalRows = useMemo(() => {
    if (gapFilter === 'all') return optionalRows
    return optionalRows.filter((r) => r.gap === gapFilter)
  }, [optionalRows, gapFilter])

  const filteredPeopleForSelect = useMemo(() => {
    return peopleOptions.filter((p) => {
      const tn = teamNameFromEmbed(p.teams)
      if (teamFilter === '__none__') {
        if (tn) return false
      } else if (teamFilter) {
        if (tn !== teamFilter) return false
      }
      if (jobRoleFilter && !(p.person_roles ?? []).some((x) => x.role_id === jobRoleFilter)) return false
      return true
    })
  }, [peopleOptions, teamFilter, jobRoleFilter])

  const teamNameOptions = useMemo(() => {
    const named = new Set<string>()
    let hasNoTeam = false
    for (const p of peopleOptions) {
      const t = teamNameFromEmbed(p.teams)
      if (!t) hasNoTeam = true
      else named.add(t)
    }
    return { names: [...named].sort((a, b) => a.localeCompare(b)), hasNoTeam }
  }, [peopleOptions])

  const jobRoleSelectOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of peopleOptions) {
      for (const pr of p.person_roles ?? []) {
        if (!m.has(pr.role_id)) m.set(pr.role_id, jobRoleLabelFromPersonRole(pr))
      }
    }
    return [...m.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [peopleOptions])

  const skillGroupOptions = useMemo(() => {
    const s = new Set<string>()
    for (const sk of skillsRaw) {
      s.add(groupName(sk).trim() || 'Skills')
    }
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [skillsRaw])

  useEffect(() => {
    if (!canManageAnyPerson) return
    if (filteredPeopleForSelect.length === 0) return
    if (selectedPersonId && filteredPeopleForSelect.some((p) => p.id === selectedPersonId)) return
    const nextId = filteredPeopleForSelect[0].id
    queueMicrotask(() => setSelectedPersonId(nextId))
  }, [canManageAnyPerson, teamFilter, jobRoleFilter, filteredPeopleForSelect, selectedPersonId])

  const groupFilteredRequired = useMemo(() => {
    if (!skillGroupFilter) return filteredRequiredRows
    return filteredRequiredRows.filter((r) => r.groupLabel === skillGroupFilter)
  }, [filteredRequiredRows, skillGroupFilter])

  const groupFilteredOptional = useMemo(() => {
    if (!skillGroupFilter) return filteredOptionalRows
    return filteredOptionalRows.filter((r) => r.groupLabel === skillGroupFilter)
  }, [filteredOptionalRows, skillGroupFilter])

  const today = useMemo(() => startOfDay(new Date()), [])
  const todayStr = localYMD(today)

  const allTrackedRows = useMemo(() => [...requiredRows, ...optionalRows], [requiredRows, optionalRows])

  const mySkillsDueCounts = useMemo(() => {
    const withDue = allTrackedRows.filter((r) => {
      const d = r.dueDate?.trim() ?? ''
      return d.length > 0
    })
    const overdue = withDue.filter((r) => compareYMD(r.dueDate!.trim(), todayStr) < 0)
    const end7 = localYMD(addDays(today, 6))
    const next7 = withDue.filter((r) => {
      const d = r.dueDate!.trim()
      return compareYMD(d, todayStr) >= 0 && compareYMD(d, end7) <= 0
    })
    const end30 = localYMD(addDays(today, 29))
    const next30 = withDue.filter((r) => {
      const d = r.dueDate!.trim()
      return compareYMD(d, todayStr) >= 0 && compareYMD(d, end30) <= 0
    })
    const noTarget = allTrackedRows.filter(
      (r) =>
        !(r.dueDate?.trim()) &&
        (r.gap === 'critical' || r.gap === 'minor'),
    )
    return {
      overdue: overdue.length,
      next7: next7.length,
      next30: next30.length,
      noTarget: noTarget.length,
    }
  }, [allTrackedRows, today, todayStr])

  const displayRequiredRows = useMemo(() => {
    if (dueQuickFilter.kind === 'none') return groupFilteredRequired
    return groupFilteredRequired.filter((r) => rowMatchesDueQuickFilter(r, dueQuickFilter, todayStr, today))
  }, [groupFilteredRequired, dueQuickFilter, todayStr, today])

  const displayOptionalRows = useMemo(() => {
    if (dueQuickFilter.kind === 'none') return groupFilteredOptional
    return groupFilteredOptional.filter((r) => rowMatchesDueQuickFilter(r, dueQuickFilter, todayStr, today))
  }, [groupFilteredOptional, dueQuickFilter, todayStr, today])

  function toggleDueTile(id: 'overdue' | 'next7' | 'next30' | 'noTarget') {
    setDueQuickFilter((prev) => {
      if (prev.kind === 'tile' && prev.id === id) return { kind: 'none' }
      return { kind: 'tile', id }
    })
  }

  function compactTileClass(n: number) {
    return n > 0
      ? 'border-rose-200/90 bg-rose-50/90 text-rose-950 ring-1 ring-rose-200/70'
      : 'border-emerald-200/90 bg-emerald-50/90 text-emerald-950 ring-1 ring-emerald-200/70'
  }

  const packBySkill = useMemo(() => {
    const m = new Map<string, TrainingPackRaw>()
    for (const p of trainingPacks) m.set(p.skill_id, p)
    return m
  }, [trainingPacks])

  const questionsBySkill = useMemo(() => {
    const m = new Map<string, TrainingQuestionRaw[]>()
    for (const q of trainingQuestions) {
      const arr = m.get(q.skill_id) ?? []
      arr.push(q)
      m.set(q.skill_id, arr)
    }
    return m
  }, [trainingQuestions])

  const trainingEligibleSkillIds = useMemo(() => {
    const s = new Set<string>()
    for (const r of [...requiredRows, ...optionalRows]) {
      if (r.kind !== 'numeric' || r.actual !== 1) continue
      if (!packBySkill.has(r.skillId)) continue
      if ((questionsBySkill.get(r.skillId) ?? []).length === 0) continue
      s.add(r.skillId)
    }
    return s
  }, [requiredRows, optionalRows, packBySkill, questionsBySkill])

  const needsAssessorRows = useMemo(
    () =>
      requiredRows.filter((r) => {
        if (r.kind === 'numeric' && r.actual === 2 && (r.required === 3 || r.required === 4)) return true
        if (
          r.kind === 'certification' &&
          r.required != null &&
          r.required >= 1 &&
          (r.actual == null || r.actual < 1)
        )
          return true
        return false
      }),
    [requiredRows],
  )
  const optionalAssessorRows = useMemo(
    () =>
      optionalRows.filter((r) => {
        if (r.kind === 'numeric' && r.actual === 2) return true
        if (r.kind === 'certification' && (r.actual == null || r.actual < 1)) return true
        return false
      }),
    [optionalRows],
  )

  function openEditor(row: SkillRowModel, anchor?: CellEditorAnchor | null) {
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
      anchorRect: anchor ?? null,
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
    <div className="space-y-3">
      <header className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-accent">
          <UserCircle className="size-5" aria-hidden />
        </span>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">My skills</h1>
      </header>

      {canManageAnyPerson && peopleOptions.length > 0 && loading && !person ? (
        <section
          aria-label="Person filter"
          className="rounded-xl border border-border bg-surface-raised/50 px-2.5 py-2 shadow-sm backdrop-blur-sm"
        >
          <div className="flex flex-row flex-wrap items-center gap-2">
            <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">Person</span>
            <select
              className={selectFilterClass}
              value={selectedPersonId ?? ''}
              onChange={(e) => setSelectedPersonId(e.target.value || null)}
              aria-label="View skills for person"
            >
              {filteredPeopleForSelect.map((p) => {
                const tn = teamNameFromEmbed(p.teams)
                return (
                  <option key={p.id} value={p.id}>
                    {tn ? `${p.display_name} · ${tn}` : p.display_name}
                  </option>
                )
              })}
            </select>
          </div>
        </section>
      ) : null}

      {loadError ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {loadError}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : adminNoPeople ? (
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-surface-raised/50 p-6 backdrop-blur-sm">
          <span className="flex size-12 items-center justify-center rounded-xl bg-accent-dim text-accent">
            <UserCircle className="size-7" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold">No people on the roster</h2>
            <p className="mt-2 max-w-lg text-sm text-muted">
              Add people in{' '}
              <Link to="/admin?tab=people" className="font-medium text-accent underline-offset-2 hover:underline">
                Admin → People
              </Link>{' '}
              before you can view skills here.
            </p>
          </div>
        </div>
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
                <Link to="/admin?tab=people" className="underline underline-offset-2">
                  Admin
                </Link>{' '}
                to create or link your person row (you can still use the person selector above once others exist).
              </p>
            ) : isAssessor ? (
              <p className="mt-2 text-sm text-muted">
                Ask an admin to link your login to a person if you need a default “you” on the roster. You can still
                select anyone above once people exist.
              </p>
            ) : null}
          </div>
        </div>
      ) : person ? (
        <>
          <section
            aria-label="Person, roster, and skill filters"
            className="rounded-xl border border-border bg-surface-raised/50 px-2.5 py-2 shadow-sm backdrop-blur-sm"
          >
            <div className="flex flex-row flex-wrap items-center gap-x-3 gap-y-2">
              {canManageAnyPerson && peopleOptions.length > 0 ? (
                <div className="flex min-w-0 max-w-full flex-1 basis-[min(100%,20rem)] items-center gap-2">
                  <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">Person</span>
                  <select
                    className={selectFilterClass}
                    value={selectedPersonId ?? ''}
                    onChange={(e) => setSelectedPersonId(e.target.value || null)}
                    aria-label="View skills for person"
                  >
                    {filteredPeopleForSelect.map((p) => {
                      const tn = teamNameFromEmbed(p.teams)
                      return (
                        <option key={p.id} value={p.id}>
                          {tn ? `${p.display_name} · ${tn}` : p.display_name}
                        </option>
                      )
                    })}
                  </select>
                </div>
              ) : null}
              {canManageAnyPerson && peopleOptions.length > 0 ? (
                <div className="flex min-w-0 max-w-full flex-1 basis-[min(100%,16rem)] items-center gap-2">
                  <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">Team</span>
                  <select
                    className={selectFilterClass}
                    value={teamFilter}
                    onChange={(e) => setTeamFilter(e.target.value)}
                    aria-label="Filter roster by team"
                  >
                    <option value="">All teams</option>
                    {teamNameOptions.hasNoTeam ? <option value="__none__">No team</option> : null}
                    {teamNameOptions.names.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {canManageAnyPerson && peopleOptions.length > 0 ? (
                <div className="flex min-w-0 max-w-full flex-1 basis-[min(100%,16rem)] items-center gap-2">
                  <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted" title="Job role">
                    Role
                  </span>
                  <select
                    className={selectFilterClass}
                    value={jobRoleFilter}
                    onChange={(e) => setJobRoleFilter(e.target.value)}
                    aria-label="Filter roster by job role"
                  >
                    <option value="">All roles</option>
                    {jobRoleSelectOptions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="flex min-w-0 max-w-full flex-1 basis-[min(100%,18rem)] items-center gap-2">
                <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">Gap</span>
                <select
                  className={selectFilterClass}
                  value={gapFilter}
                  onChange={(e) => setGapFilter(e.target.value as GapFilterValue)}
                  aria-label="Filter skills by gap"
                >
                  <option value="all">All ({totalSkillRows})</option>
                  {GAP_FILTER_ORDER.map((k) => (
                    <option key={k} value={k}>
                      {gapKindLegendLabel(k)} ({gapCounts[k]})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-0 max-w-full flex-1 basis-[min(100%,16rem)] items-center gap-2">
                <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">Group</span>
                <select
                  className={selectFilterClass}
                  value={skillGroupFilter}
                  onChange={(e) => setSkillGroupFilter(e.target.value)}
                  aria-label="Filter skills by group"
                >
                  <option value="">All groups</option>
                  {skillGroupOptions.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section
            aria-label="Target date summary"
            className="rounded-lg border border-border bg-surface-raised/50 px-2 py-2 shadow-sm backdrop-blur-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Targets</p>
              {dueQuickFilter.kind !== 'none' ? (
                <button
                  type="button"
                  onClick={() => setDueQuickFilter({ kind: 'none' })}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-muted hover:text-fg"
                >
                  <X className="size-3" aria-hidden />
                  Clear target filter
                </button>
              ) : null}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => toggleDueTile('overdue')}
                aria-pressed={dueQuickFilter.kind === 'tile' && dueQuickFilter.id === 'overdue'}
                className={`rounded-lg border px-2 py-1.5 text-left transition-[box-shadow] ${compactTileClass(mySkillsDueCounts.overdue)} ${
                  dueQuickFilter.kind === 'tile' && dueQuickFilter.id === 'overdue'
                    ? 'ring-2 ring-sky-600 ring-offset-1 ring-offset-canvas'
                    : ''
                }`}
              >
                <p className="text-[9px] font-semibold uppercase tracking-wide opacity-85">Overdue</p>
                <p className="font-display text-lg font-semibold tabular-nums leading-tight">{mySkillsDueCounts.overdue}</p>
              </button>
              <button
                type="button"
                onClick={() => toggleDueTile('next7')}
                aria-pressed={dueQuickFilter.kind === 'tile' && dueQuickFilter.id === 'next7'}
                className={`rounded-lg border px-2 py-1.5 text-left ${compactTileClass(mySkillsDueCounts.next7)} ${
                  dueQuickFilter.kind === 'tile' && dueQuickFilter.id === 'next7'
                    ? 'ring-2 ring-sky-600 ring-offset-1 ring-offset-canvas'
                    : ''
                }`}
              >
                <p className="text-[9px] font-semibold uppercase tracking-wide opacity-85">Next 7 days</p>
                <p className="font-display text-lg font-semibold tabular-nums leading-tight">{mySkillsDueCounts.next7}</p>
              </button>
              <button
                type="button"
                onClick={() => toggleDueTile('next30')}
                aria-pressed={dueQuickFilter.kind === 'tile' && dueQuickFilter.id === 'next30'}
                className={`rounded-lg border px-2 py-1.5 text-left ${compactTileClass(mySkillsDueCounts.next30)} ${
                  dueQuickFilter.kind === 'tile' && dueQuickFilter.id === 'next30'
                    ? 'ring-2 ring-sky-600 ring-offset-1 ring-offset-canvas'
                    : ''
                }`}
              >
                <p className="text-[9px] font-semibold uppercase tracking-wide opacity-85">Next 30 days</p>
                <p className="font-display text-lg font-semibold tabular-nums leading-tight">{mySkillsDueCounts.next30}</p>
              </button>
              <button
                type="button"
                onClick={() => toggleDueTile('noTarget')}
                aria-pressed={dueQuickFilter.kind === 'tile' && dueQuickFilter.id === 'noTarget'}
                className={`rounded-lg border px-2 py-1.5 text-left ${compactTileClass(mySkillsDueCounts.noTarget)} ${
                  dueQuickFilter.kind === 'tile' && dueQuickFilter.id === 'noTarget'
                    ? 'ring-2 ring-sky-600 ring-offset-1 ring-offset-canvas'
                    : ''
                }`}
              >
                <p className="text-[9px] font-semibold uppercase tracking-wide opacity-85">No target date</p>
                <p className="font-display text-lg font-semibold tabular-nums leading-tight">{mySkillsDueCounts.noTarget}</p>
              </button>
            </div>
          </section>

          <SkillSection
            title="Required for your roles"
            rows={displayRequiredRows}
            empty={
              dueQuickFilter.kind !== 'none'
                ? 'No required skills match this target filter (and current gap filter).'
                : skillGroupFilter
                  ? `No required skills in group “${skillGroupFilter}” for this view.`
                  : gapFilter === 'all'
                    ? 'Nothing required for this person’s current job roles.'
                    : `No required skills in “${gapKindLegendLabel(gapFilter)}”.`
            }
            onEdit={openEditor}
            requiredLabel={requiredLabel}
            readOnly={readOnly}
            trainingEligibleIds={trainingEligibleSkillIds}
            onStartTraining={(row) => setTrainingSkillId(row.skillId)}
            assessorNeededIds={new Set(needsAssessorRows.map((r) => r.skillId))}
            onShowAssessors={(row) =>
              setAssessorSkillInfo({
                skillName: row.skillName,
                required: row.required ?? 0,
              })
            }
          />

          <SkillSection
            title="Extra skills tracked"
            rows={displayOptionalRows}
            empty={
              dueQuickFilter.kind !== 'none'
                ? 'No extra skills match this target filter (and current gap filter).'
                : skillGroupFilter
                  ? `No extra skills in group “${skillGroupFilter}” for this view.`
                  : gapFilter === 'all'
                    ? 'No optional skills recorded yet.'
                    : `No extra skills in “${gapKindLegendLabel(gapFilter)}”.`
            }
            onEdit={openEditor}
            requiredLabel={requiredLabel}
            readOnly={readOnly}
            trainingEligibleIds={trainingEligibleSkillIds}
            onStartTraining={(row) => setTrainingSkillId(row.skillId)}
            assessorNeededIds={new Set(optionalAssessorRows.map((r) => r.skillId))}
            onShowAssessors={(row) =>
              setAssessorSkillInfo({
                skillName: row.skillName,
                required: row.required ?? Math.min(4, (row.actual ?? 2) + 1),
              })
            }
          />

          {!readOnly && addableSkillOptions.length > 0 ? (
            <section
              aria-label="Add extra skill"
              className="rounded-xl border border-border bg-surface-raised/40 px-2.5 py-2 backdrop-blur-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted sm:w-[4.5rem] sm:pt-0.5">
                  Add extra
                </span>
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
                  className={selectFilterClass}
                  aria-label="Add extra skill from catalog"
                >
                  <option value="">Select skill…</option>
                  {addableSkillOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {(groupName(s) || 'Skills') + ' · ' + s.name}
                    </option>
                  ))}
                </select>
              </div>
            </section>
          ) : null}

          {!readOnly && canManageAnyPerson && addableSkillOptions.length === 0 && skillsRaw.length > 0 ? (
            <p className="rounded-xl border border-border bg-surface-raised/50 px-3 py-2 text-xs text-muted">
              No extra skills left to add for this person.
            </p>
          ) : null}
        </>
      ) : null}

      {!readOnly ? (
        <MatrixCellEditor
          ctx={editorCtx}
          onDismiss={() => setEditorCtx(null)}
          onSaved={bumpData}
        />
      ) : null}
      {person && trainingSkillId ? (
        <TrainingDialog
          personId={person.id}
          personName={person.display_name}
          skillId={trainingSkillId}
          onDismiss={() => setTrainingSkillId(null)}
          onSaved={() => {
            setTrainingSkillId(null)
            bumpData()
          }}
        />
      ) : null}
      {assessorSkillInfo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-3 py-6">
          <div className="w-[min(100%,34rem)] rounded-2xl border border-border bg-surface-raised p-4 shadow-glow sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-semibold tracking-tight">Assessors for qualification</h3>
                <p className="text-xs text-muted">
                  {assessorSkillInfo.skillName} · required level {assessorSkillInfo.required}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssessorSkillInfo(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-black/[0.06] hover:text-fg"
              >
                Close
              </button>
            </div>
            {assessors.length === 0 ? (
              <p className="text-sm text-muted">No assessors found.</p>
            ) : (
              <ul className="max-h-[55vh] space-y-2 overflow-auto pr-1">
                {assessors.map((a) => (
                  <li key={a.profileId} className="rounded-lg border border-border bg-surface p-2.5">
                    <p className="font-medium text-fg">{a.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      Team: {a.team || '—'} · Role: {a.roles.length > 0 ? a.roles.join(', ') : 'Assessor'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SkillSection(props: {
  title: string
  rows: SkillRowModel[]
  empty: string
  onEdit: (row: SkillRowModel, anchor?: CellEditorAnchor | null) => void
  requiredLabel: (kind: SkillKind, req: number | null) => string
  readOnly?: boolean
  trainingEligibleIds?: Set<string>
  onStartTraining?: (row: SkillRowModel) => void
  assessorNeededIds?: Set<string>
  onShowAssessors?: (row: SkillRowModel) => void
}) {
  const {
    title,
    rows,
    empty,
    onEdit,
    requiredLabel,
    readOnly,
    trainingEligibleIds,
    onStartTraining,
    assessorNeededIds,
    onShowAssessors,
  } = props

  const grouped = useMemo(() => groupRowsByGroupLabel(rows), [rows])
  const sectionKey = title
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())

  function groupKey(label: string) {
    return `${sectionKey}::${label}`
  }

  function toggleGroup(label: string) {
    const k = groupKey(label)
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  function renderSkillRow(row: SkillRowModel) {
    return (
      <tr key={row.skillId} className="border-b border-border/60 bg-surface last:border-b-0">
        <th
          scope="row"
          className="sticky left-0 z-[1] max-w-[14rem] bg-surface px-2 py-1.5 align-middle font-normal shadow-[2px_0_6px_-4px_rgba(0,0,0,0.12)] sm:max-w-[18rem] sm:px-2.5"
        >
          <div className="truncate font-medium text-fg" title={row.skillName}>
            {row.skillName}
          </div>
          {row.groupLabel ? (
            <div className="truncate text-[10px] leading-tight text-muted" title={row.groupLabel}>
              {row.groupLabel}
            </div>
          ) : null}
        </th>
        <td className="whitespace-nowrap px-2 py-1.5 text-right align-middle font-mono text-xs font-semibold tabular-nums text-fg sm:px-2.5">
          {requiredLabel(row.kind, row.required)}
        </td>
        <td className="whitespace-nowrap px-2 py-1.5 text-right align-middle font-mono text-xs font-semibold tabular-nums text-fg sm:px-2.5">
          {formatLevel(row.kind, row.actual)}
        </td>
        <td className="whitespace-nowrap px-2 py-1.5 text-right align-middle font-mono text-xs font-semibold tabular-nums text-fg sm:px-2.5">
          {row.dueDate ?? '—'}
        </td>
        <td className="px-2 py-1.5 align-middle sm:px-2.5">
          <span
            className={`inline-flex max-w-full rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight ${gapKindClasses(row.gap)}`}
          >
            {gapLabel(row.gap)}
          </span>
        </td>
        <td className="whitespace-nowrap px-2 py-1.5 text-right align-middle sm:px-2.5">
          <div className="flex flex-wrap items-center justify-end gap-1">
            {trainingEligibleIds && onStartTraining && trainingEligibleIds.has(row.skillId) ? (
              <button
                type="button"
                onClick={() => onStartTraining(row)}
                className="inline-flex items-center justify-center gap-1 rounded-md border border-sky-300/80 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-950 hover:bg-sky-100/90"
              >
                <BookOpenCheck className="size-3 text-sky-700" aria-hidden />
                Training
              </button>
            ) : null}
            {assessorNeededIds && onShowAssessors && assessorNeededIds.has(row.skillId) ? (
              <button
                type="button"
                onClick={() => onShowAssessors(row)}
                className="inline-flex items-center justify-center gap-1 rounded-md border border-violet-300/80 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-950 hover:bg-violet-100/90"
              >
                Show assessors
              </button>
            ) : null}
            {readOnly ? null : (
              <button
                type="button"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect()
                  onEdit(row, {
                    top: r.top,
                    left: r.left,
                    width: r.width,
                    height: r.height,
                  })
                }}
                className="inline-flex items-center justify-center gap-1 rounded-md border border-border bg-surface-raised px-2 py-1 text-[11px] font-medium text-fg hover:border-border-strong"
              >
                <Pencil className="size-3 text-muted" aria-hidden />
                Edit
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-surface-raised/40 backdrop-blur-sm">
      <div className="border-b border-border px-2.5 py-2 sm:px-3">
        <h2 className="font-display text-sm font-semibold tracking-tight sm:text-base">{title}</h2>
      </div>
      <div className="p-1.5 sm:p-2">
        {rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted">{empty}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/80">
            <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th
                    scope="col"
                    className="sticky left-0 z-[1] bg-surface px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted shadow-[2px_0_6px_-4px_rgba(0,0,0,0.12)] sm:px-2.5"
                  >
                    Skill
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted sm:px-2.5"
                  >
                    Required
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted sm:px-2.5"
                  >
                    Actual
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted sm:px-2.5"
                  >
                    Target
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted sm:px-2.5"
                  >
                    Gap
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted sm:px-2.5"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              {grouped.map(({ label: groupLabel, rows: groupRows }) => {
                const collapsed = collapsedGroups.has(groupKey(groupLabel))
                const s = summarizeSkillGroup(groupRows)
                const summaryText = [
                  `Level 1: ${s.level1}`,
                  `Level 2: ${s.level2}`,
                  `Level 3: ${s.level3}`,
                  `Level 4: ${s.level4}`,
                  `Yes: ${s.certYes} · No: ${s.certNo}`,
                  `Gaps: ${s.withGap}`,
                ].join(' · ')
                return (
                  <tbody key={groupKey(groupLabel)}>
                    <tr className="border-b border-border/80 bg-black/[0.03] dark:bg-white/[0.04]">
                      <td colSpan={6} className="px-2 py-2 sm:px-2.5">
                        <button
                          type="button"
                          onClick={() => toggleGroup(groupLabel)}
                          className="flex w-full min-w-0 items-start gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                          aria-expanded={!collapsed}
                          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${groupLabel} skill group`}
                        >
                          <span className="mt-0.5 shrink-0 text-muted" aria-hidden>
                            {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold text-fg">{groupLabel}</span>
                            {collapsed ? (
                              <span className="mt-1 block text-[11px] leading-snug text-muted">{summaryText}</span>
                            ) : (
                              <span className="mt-1 block text-[10px] text-muted">{groupRows.length} skills</span>
                            )}
                          </span>
                        </button>
                      </td>
                    </tr>
                    {collapsed ? null : groupRows.map((row) => renderSkillRow(row))}
                  </tbody>
                )
              })}
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

function trainingQuestionOptionCount(q: TrainingQuestionRaw): 2 | 3 | 4 {
  const n = q.option_count
  return n === 2 || n === 3 || n === 4 ? n : 4
}

function trainingOptionText(q: TrainingQuestionRaw, opt: 'A' | 'B' | 'C' | 'D'): string {
  if (opt === 'A') return q.option_a
  if (opt === 'B') return q.option_b
  if (opt === 'C') return q.option_c
  return q.option_d
}

function TrainingDialog(props: {
  personId: string
  personName: string
  skillId: string
  onDismiss: () => void
  onSaved: () => void
}) {
  const { personId, personName, skillId, onDismiss, onSaved } = props
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pack, setPack] = useState<TrainingPackRaw | null>(null)
  const [standard, setStandard] = useState<TrainingStandardRaw | null>(null)
  const [questions, setQuestions] = useState<TrainingQuestionRaw[]>([])
  const [skillName, setSkillName] = useState('Skill')
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({})
  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [pageImageUrls, setPageImageUrls] = useState<Record<string, string>>({})
  /** Material pages are 0..pageCount-1; stepIdx === pageCount is the quiz step (when standards exist). */
  const [stepIdx, setStepIdx] = useState(0)
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [submitResult, setSubmitResult] = useState<{
    score: number
    passed: boolean
    threshold: number
    levelUp: boolean
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    const raf = requestAnimationFrame(() => {
      setSubmitResult(null)
      setAnswers({})
      setStepIdx(0)
      setCurrentQuestionIdx(0)
    })
    void (async () => {
      setLoading(true)
      setError(null)
      setDocUrl(null)
      setPageImageUrls({})
      const [sk, p, st, q] = await Promise.all([
        supabase.from('skills').select('name').eq('id', skillId).maybeSingle(),
        supabase
          .from('skill_training_packs')
          .select('skill_id, document_path, document_name, document_mime, pass_score_percent')
          .eq('skill_id', skillId)
          .maybeSingle(),
        supabase
          .from('skill_training_standards')
          .select('skill_id, title, pages')
          .eq('skill_id', skillId)
          .maybeSingle(),
        supabase
          .from('skill_training_questions')
          .select(
            'id, skill_id, question_text, option_a, option_b, option_c, option_d, correct_option, option_count, sort_order',
          )
          .eq('skill_id', skillId)
          .order('sort_order', { ascending: true }),
      ])
      if (cancelled) return
      setLoading(false)
      if (sk.error || p.error || st.error || q.error) {
        setError(sk.error?.message ?? p.error?.message ?? st.error?.message ?? q.error?.message ?? 'Failed to load training')
        return
      }
      setSkillName(sk.data?.name ?? 'Skill')
      const packData = (p.data as TrainingPackRaw | null) ?? null
      const stData = (st.data as TrainingStandardRaw | null) ?? null
      const qData = (q.data ?? []) as TrainingQuestionRaw[]
      setPack(packData)
      setStandard(stData)
      setQuestions(qData)
      if (!packData || qData.length === 0) {
        setError('Training pack is not configured for this skill yet.')
      } else {
        if (packData.document_path) {
          const signed = await supabase.storage.from(TRAINING_DOC_BUCKET).createSignedUrl(packData.document_path, 60 * 15)
          if (signed.error) {
            setError(signed.error.message)
          } else {
            setDocUrl(signed.data.signedUrl)
          }
        }
        const imagePaths = stData?.pages?.flatMap((pg) => (pg.images ?? []).map((img) => img.path)) ?? []
        if (imagePaths.length > 0) {
          const urls: Record<string, string> = {}
          await Promise.all(
            imagePaths.map(async (p) => {
              const { data } = await supabase.storage.from(TRAINING_STANDARD_IMG_BUCKET).createSignedUrl(p, 60 * 30)
              if (data?.signedUrl) urls[p] = data.signedUrl
            }),
          )
          if (!cancelled) setPageImageUrls(urls)
        }
      }
    })()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [skillId])

  const hasTrainingDoc = Boolean(pack?.document_path)
  const pageCount = standard?.pages?.length ?? 0
  const hasStandards = Boolean(standard && pageCount > 0)
  const quizAfterMaterial = hasStandards && questions.length > 0
  const onQuizStep = hasStandards && quizAfterMaterial && stepIdx === pageCount
  const onMaterialStep = hasStandards && stepIdx >= 0 && stepIdx < pageCount
  const currentPage = onMaterialStep ? (standard?.pages[stepIdx] ?? null) : null
  const lastMaterialIdx = Math.max(0, pageCount - 1)
  const maxStepIdx = hasStandards ? (quizAfterMaterial ? pageCount : lastMaterialIdx) : 0
  const isPdf =
    pack?.document_mime === 'application/pdf' ||
    (pack?.document_name?.toLowerCase().endsWith('.pdf') ?? false)
  const currentQuestion = questions[currentQuestionIdx] ?? null
  const answeredCount = Object.keys(answers).length
  const currentPageLinks = useMemo(
    () => extractStandardContentLinks(currentPage?.contentHtml || ''),
    [currentPage?.contentHtml],
  )

  async function submit() {
    if (!pack || questions.length === 0) return
    for (const q of questions) {
      if (!answers[q.id]) {
        setError(`Answer question ${q.sort_order} before submit.`)
        return
      }
    }
    setSaving(true)
    setError(null)
    let correct = 0
    for (const q of questions) {
      if (answers[q.id] === q.correct_option) correct += 1
    }
    const score = Math.round((correct / questions.length) * 100)
    const passed = score >= pack.pass_score_percent

    const { error: attemptErr } = await supabase.from('skill_training_attempts').insert({
      person_id: personId,
      skill_id: skillId,
      score_percent: score,
      passed,
      answers,
    })
    if (attemptErr) {
      setSaving(false)
      setError(attemptErr.message)
      return
    }

    let levelUp = false
    if (passed) {
      const { data: updatedRows, error: upErr } = await supabase
        .from('person_skills')
        .update({ actual_level: 2 })
        .eq('person_id', personId)
        .eq('skill_id', skillId)
        .eq('actual_level', 1)
        .select('person_id')
      if (upErr) {
        setSaving(false)
        setError(upErr.message)
        return
      }
      levelUp = (updatedRows?.length ?? 0) > 0
    }
    setSaving(false)
    setSubmitResult({ score, passed, threshold: pack.pass_score_percent, levelUp })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-6 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-[min(100%,42rem)] overflow-auto rounded-2xl border border-border bg-surface-raised shadow-glow sm:max-w-none sm:w-[min(100%,58rem)]">
        <div className="border-b border-border bg-gradient-to-r from-sky-500/10 via-transparent to-accent/10 px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-800/80">Level 1 → 2 training</p>
              <h3 className="font-display text-lg font-semibold tracking-tight text-fg sm:text-xl">{skillName}</h3>
              <p className="mt-0.5 text-xs text-muted">{personName}</p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:bg-black/[0.06] hover:text-fg"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {loading ? <p className="text-sm text-muted">Loading training…</p> : null}
          {error ? (
            <p className="rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-950">{error}</p>
          ) : null}

          {submitResult ? (
            <div
              className={`rounded-2xl border px-4 py-5 text-center ${
                submitResult.passed
                  ? 'border-emerald-300/80 bg-emerald-50/90 text-emerald-950'
                  : 'border-amber-300/80 bg-amber-50/90 text-amber-950'
              }`}
            >
              <p className="font-display text-lg font-semibold">{submitResult.passed ? 'Passed' : 'Not passed'}</p>
              <p className="mt-2 text-sm">
                Your score: <span className="font-mono font-semibold tabular-nums">{submitResult.score}%</span>
                {' · '}
                Required: <span className="font-mono font-semibold tabular-nums">{submitResult.threshold}%</span>
              </p>
              {submitResult.passed && submitResult.levelUp ? (
                <p className="mt-2 text-sm">Skill level updated to <strong>2</strong> for this person.</p>
              ) : null}
              {!submitResult.passed ? (
                <p className="mt-2 text-xs opacity-90">You can review the material and try again.</p>
              ) : null}
              <button
                type="button"
                onClick={() => onSaved()}
                className="mt-4 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
              >
                Done
              </button>
            </div>
          ) : null}

          {!loading && !submitResult && pack && hasStandards && onQuizStep ? (
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-raised/50 px-3 py-2">
              <button
                type="button"
                onClick={() => setStepIdx((s) => Math.max(0, s - 1))}
                disabled={stepIdx === 0}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-black/[0.06] hover:text-fg disabled:opacity-40"
              >
                Previous
              </button>
              <p className="text-center text-xs text-muted">
                <span className="font-medium text-fg">Quiz</span>
                <span className="text-muted">
                  {' '}
                  · step {stepIdx + 1} of {quizAfterMaterial ? pageCount + 1 : pageCount}
                </span>
              </p>
              <button
                type="button"
                onClick={() => setStepIdx((s) => Math.min(maxStepIdx, s + 1))}
                disabled={stepIdx >= maxStepIdx}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-black/[0.06] hover:text-fg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : null}

          {!loading && !submitResult && pack && hasStandards && onMaterialStep && currentPageLinks.length > 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-3 shadow-sm">
              <p className="mb-2 text-sm font-medium text-fg">Links</p>
              <div className="flex flex-wrap gap-2">
                {currentPageLinks.map((link, idx) => (
                  <a
                    key={`${link.href}-${idx}`}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm font-medium text-fg hover:bg-black/[0.04]"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          {!loading && !submitResult && pack && hasStandards && onMaterialStep ? (
            <div className="rounded-2xl border border-border bg-surface p-3 shadow-sm">
              <div className={standardPageOuterClass}>
                <div className={standardPageTitleClass}>{standard!.title || skillName}</div>
                <div className={standardPageStageClass}>
                  <div
                    className={standardPageProseClass}
                    dangerouslySetInnerHTML={{
                      __html: removeAnchorsForCanvasPreview(currentPage?.contentHtml || '<p></p>'),
                    }}
                  />
                  {(currentPage?.images ?? []).map((img) =>
                    pageImageUrls[img.path] ? (
                      <img
                        key={img.id}
                        src={pageImageUrls[img.path]}
                        alt=""
                        className={standardPageImageClass}
                        style={{
                          left: `${img.x ?? 68}%`,
                          top: `${img.y ?? 8}%`,
                          width: `${img.w ?? 24}%`,
                          height: `${img.h ?? 24}%`,
                        }}
                      />
                    ) : null,
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {!loading && !submitResult && pack && hasTrainingDoc && docUrl && (!hasStandards || onMaterialStep) ? (
            <div className="rounded-2xl border border-border bg-surface p-3 shadow-sm">
              <p className="mb-2 text-sm font-medium text-fg">
                Download attachment <span className="font-normal text-muted">({pack.document_name ?? 'document'})</span>
              </p>
              {isPdf ? (
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-fg hover:bg-black/[0.04]"
                >
                  Open / download PDF
                </a>
              ) : (
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-fg hover:bg-black/[0.04]"
                >
                  Download / open document
                </a>
              )}
            </div>
          ) : null}

          {!loading && !submitResult && pack && hasStandards && onMaterialStep ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-raised/50 px-3 py-2">
              <button
                type="button"
                onClick={() => setStepIdx((s) => Math.max(0, s - 1))}
                disabled={stepIdx === 0}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-black/[0.06] hover:text-fg disabled:opacity-40"
              >
                Previous
              </button>
              <p className="text-center text-xs text-muted">
                <span className="font-medium text-fg">Material</span>
                <span className="text-muted">
                  {' '}
                  · page {stepIdx + 1} of {pageCount}
                  {quizAfterMaterial ? ' (then quiz)' : ''}
                </span>
              </p>
              <button
                type="button"
                onClick={() => setStepIdx((s) => Math.min(maxStepIdx, s + 1))}
                disabled={stepIdx >= maxStepIdx}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-black/[0.06] hover:text-fg disabled:opacity-40"
              >
                {quizAfterMaterial && stepIdx === lastMaterialIdx ? 'Continue to quiz' : 'Next'}
              </button>
            </div>
          ) : null}

          {!loading && !submitResult && pack && questions.length > 0 && (!hasStandards || onQuizStep) ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-sky-200/80 bg-sky-50/50 px-3 py-2.5">
                <p className="text-sm font-medium text-sky-950">{hasStandards ? 'Step 2 — Quiz' : 'Quiz'}</p>
                <p className="text-xs text-sky-900/80">
                  Tap one choice per question (tick marks your answer). The pass requirement and your score are shown only after you submit.
                </p>
              </div>
              {currentQuestion ? (
                <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                  <p className="mb-2 text-xs font-medium text-muted">
                    Question {currentQuestionIdx + 1} of {questions.length} · answered {answeredCount}/{questions.length}
                  </p>
                  <p className="mb-3 text-sm font-semibold text-fg">
                    <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">
                      {currentQuestion.sort_order}
                    </span>
                    {currentQuestion.question_text}
                  </p>
                  <div className="flex flex-col gap-2">
                    {(['A', 'B', 'C', 'D'] as const)
                      .slice(0, trainingQuestionOptionCount(currentQuestion))
                      .map((opt) => {
                        const text = trainingOptionText(currentQuestion, opt)
                        const selected = answers[currentQuestion.id] === opt
                        return (
                          <button
                            key={opt}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => {
                              setAnswers((prev) => ({ ...prev, [currentQuestion.id]: opt }))
                              setCurrentQuestionIdx((prev) => Math.min(questions.length - 1, prev + 1))
                            }}
                            className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                              selected
                                ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-400/35'
                                : 'border-border hover:bg-black/[0.03]'
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border ${
                                selected ? 'border-sky-600 bg-sky-600 text-white' : 'border-border bg-surface'
                              }`}
                              aria-hidden
                            >
                              {selected ? <Check className="size-3.5 stroke-[3]" /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="mr-2 font-mono text-xs font-semibold text-muted">{opt}.</span>
                              {text}
                            </span>
                          </button>
                        )
                      })}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setCurrentQuestionIdx((prev) => Math.max(0, prev - 1))}
                      disabled={currentQuestionIdx === 0}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-black/[0.06] hover:text-fg disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentQuestionIdx((prev) => Math.min(questions.length - 1, prev + 1))}
                      disabled={currentQuestionIdx >= questions.length - 1}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-black/[0.06] hover:text-fg disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="flex justify-end border-t border-border pt-2">
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={saving || answeredCount < questions.length}
                  className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-40"
                >
                  {saving ? 'Submitting…' : 'Submit answers'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
