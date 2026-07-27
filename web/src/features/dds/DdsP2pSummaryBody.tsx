import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, Loader2, MessageSquare, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { ddsP2pQuestionKey } from './ddsP2pQuestionKey'
import { type DdsP2pResponseKind } from './ddsP2pResponseKind'
import {
  buildDefaultP2pSummaryPrefs,
  loadP2pSummaryViewPrefs,
  mergeP2pSummaryViewPrefs,
  saveP2pSummaryViewPrefs,
  type DdsP2pSummaryViewPrefs,
} from './ddsP2pSummaryViewPrefs'
import { subscribeDdsP2pKpiRollupDone } from './ddsP2pKpiRollupEvents'
import {
  buildP2pShiftNarrative,
  formatPlanIssueGapParts,
  type P2pNarrativeAnswerSnapshot,
  type P2pNarrativeQuestionContext,
  type P2pRoleNarrativeInput,
  type P2pShiftNarrative,
} from './ddsP2pShiftNarrative'
import {
  buildP2pPlanFamilyTrends,
  buildP2pPlanRoleIssueCounts,
  countUnlinkedCilDefectsForRole,
  countUnlinkedTaskIssuesForRole,
  cilDefectBelongsToRole,
  planTaskIssueBelongsToRole,
  p2pPlanCompletionTone,
  p2pPlanEventMatchesRole,
  p2pPlanRaisedCountClass,
  planDateUtcBounds,
  type P2pPlanEventRow,
  type P2pPlanTaskIssueRow,
} from './ddsP2pPlanDayStats'
import { ddsErr } from './ddsAdminCompactClasses'
import {
  buildSubNoHoverLines,
  buildSubYesDetailLines,
  sortSoftSubQuestions,
  type DdsP2pSoftSubQuestion,
  type DdsP2pSubAnswerSnapshot,
} from './ddsP2pSoftSubQuestions'
import { DdsP2pSubYesNoSummary } from './DdsP2pSubYesNoSummary'

export type DdsP2pSummaryShiftRow = {
  kind: string
  display_name: string | null
  sort_order: number
  start_local?: string
  end_local?: string
}

export type DdsP2pSummaryRosterRole = { id: string; name: string; sort_order: number; is_active: boolean }

type KpiGroup = { id: string; name: string; sort_order: number }

type MatrixQuestion = {
  key: string
  source: 'standard' | 'soft'
  questionId: string
  groupName: string
  prompt: string
  responseKind: DdsP2pResponseKind
  targetNumber: number | null
  linkedKpiLabel: string | null
  roleIds: Set<string>
  subQuestions: DdsP2pSoftSubQuestion[]
  hasSubQuestions: boolean
  /** Role id → assigned sub-question ids for checklist visibility. */
  assignedSubIdsByRole: Record<string, string[]>
}

type CellSnapshot = {
  responseKind: DdsP2pResponseKind
  yesNo: boolean | null
  num: number | null
  comment: string
  subAnswers: DdsP2pSubAnswerSnapshot[]
  yesCount: number | null
  noCount: number | null
}

function sortGroups<T extends { sort_order: number; name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function placeDetailPanel(anchor: HTMLElement, maxW: number): { top: number; left: number; maxW: number } {
  const rect = anchor.getBoundingClientRect()
  const w = typeof window !== 'undefined' ? window.innerWidth : 400
  const left = Math.max(8, Math.min(rect.left, w - maxW - 8))
  return { top: rect.bottom + 6, left, maxW }
}

const P2P_SUMMARY_TABLE_CLASS = 'w-max min-w-full border-separate border-spacing-0 text-left text-[10px] leading-tight'
const P2P_SUMMARY_QUESTION_TH_CLASS =
  'sticky left-0 top-0 z-[4] min-w-[9rem] max-w-[12rem] border-b border-r border-border/80 bg-surface-raised/95 px-1.5 py-0.5 font-semibold text-muted shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-sm'
const P2P_SUMMARY_ROW_LABEL_CLASS =
  'sticky left-0 z-[1] max-w-[12rem] border-b border-r border-border/70 bg-surface px-1.5 py-0.5 text-left align-middle font-semibold leading-tight backdrop-blur-sm'
const P2P_SUMMARY_QUESTION_ROW_CLASS =
  'sticky left-0 z-[1] max-w-[12rem] border-b border-r border-border/70 bg-surface px-1.5 py-px text-left align-middle font-normal leading-tight backdrop-blur-sm'
const P2P_SUMMARY_ROLE_TH_CLASS =
  'sticky top-0 z-[3] min-w-[3.5rem] max-w-[4.75rem] border-b border-l border-border/50 bg-surface-raised/95 px-1 py-0.5 text-center font-semibold text-[10px] text-fg shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-sm'
const P2P_SUMMARY_CELL_CLASS = 'border-b border-l border-border/35 px-0.5 py-px text-center align-middle text-[10px]'
const P2P_SUMMARY_VALUE_WRAP_CLASS =
  'group inline-flex min-h-[1.125rem] min-w-[2.75rem] items-center justify-center gap-0.5 rounded-sm px-0.5 py-0'

export type DdsP2pSummaryBodyHandle = {
  openPrefs: () => void
}

export type DdsP2pSummaryBodyProps = {
  cellId: string
  userId: string | undefined
  planDate: string
  shiftKind: string
  shifts: DdsP2pSummaryShiftRow[]
  roles: DdsP2pSummaryRosterRole[]
  shellLoading: boolean
  error: string | null
  setError: (msg: string | null) => void
  prefsHelpStandalone?: boolean
  className?: string
}

type PlanStatsEventRow = P2pPlanEventRow & {
  id?: string
  title?: string
  start_at?: string
  end_at?: string
  sub_tasks?: unknown
}

function fmtClock(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function eventTypeLabel(t: string): string {
  const k = String(t ?? '').toLowerCase()
  if (k === 'cl_check') return 'CL'
  if (k === 'cil_check') return 'CIL'
  if (k === 'quality_check') return 'Quality'
  return 'Check'
}

function subTaskDescriptionLines(subTasks: unknown, maxLines = 6): string[] {
  const rows = Array.isArray(subTasks) ? (subTasks as any[]) : []
  const out: string[] = []
  for (const t of rows) {
    const label = String(t?.label ?? '').trim()
    if (!label) continue
    const std = String(t?.standard_description ?? '').trim()
    const text = std ? `${label} — ${std}` : label
    out.push(`  - ${text}`)
    if (out.length >= maxLines) break
  }
  return out
}

type ShiftNarrative = P2pShiftNarrative

function compactText(text: string, max = 110): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trim()}…`
}

export const DdsP2pSummaryBody = forwardRef(function DdsP2pSummaryBody(
  {
    cellId,
    userId,
    planDate,
    shiftKind,
    shifts,
    roles,
    shellLoading,
    error,
    setError,
    prefsHelpStandalone = true,
    className = '',
  }: DdsP2pSummaryBodyProps,
  ref: Ref<DdsP2pSummaryBodyHandle>,
) {
  const [matrixQuestions, setMatrixQuestions] = useState<MatrixQuestion[]>([])
  const [cells, setCells] = useState<Record<string, Record<string, CellSnapshot>>>({})
  const [sheetCommentByRoleId, setSheetCommentByRoleId] = useState<Record<string, string>>({})
  const [planStatsEvents, setPlanStatsEvents] = useState<PlanStatsEventRow[]>([])
  const [planStatsDefects, setPlanStatsDefects] = useState<
    { id: string; cil_template_id: string | null; cil_template_task_id: string | null; plan24_event_id?: string | null; role_name?: string | null }[]
  >([])
  const [planStatsTaskDeviations, setPlanStatsTaskDeviations] = useState<P2pPlanTaskIssueRow[]>([])
  const [planStatsTaskQualityFails, setPlanStatsTaskQualityFails] = useState<P2pPlanTaskIssueRow[]>([])
  const [planStatsDeviationById, setPlanStatsDeviationById] = useState<
    Record<string, { id: string; title: string; description: string | null; status: string; priority: string }>
  >({})
  const [planStatsDefectById, setPlanStatsDefectById] = useState<
    Record<string, { id: string; title: string; description: string | null; status: string; priority: string }>
  >({})
  const [planStatsFailById, setPlanStatsFailById] = useState<
    Record<string, { id: string; title: string; description: string | null; status: string; priority: string }>
  >({})
  const [planStatsLoading, setPlanStatsLoading] = useState(false)
  const [planStatsError, setPlanStatsError] = useState<string | null>(null)
  /** Roles with a P2P audit submitted for this cell, date, and shift. */
  const [submittedRoleIds, setSubmittedRoleIds] = useState<Set<string>>(() => new Set())

  const [detailPop, setDetailPop] = useState<{
    top: number
    left: number
    maxW: number
    body: string
  } | null>(null)
  const detailPanelRef = useRef<HTMLDivElement | null>(null)

  const [matrixLoading, setMatrixLoading] = useState(false)

  const [viewPrefs, setViewPrefs] = useState<DdsP2pSummaryViewPrefs>(() => buildDefaultP2pSummaryPrefs([], []))
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [prefsDraft, setPrefsDraft] = useState<DdsP2pSummaryViewPrefs>(() => buildDefaultP2pSummaryPrefs([], []))
  const [narrativeCollapsed, setNarrativeCollapsed] = useState(true)

  const activeRoles = useMemo(() => sortGroups(roles.filter((r) => r.is_active)), [roles])

  const roleCols = useMemo(
    () => activeRoles.filter((r) => viewPrefs.roles[r.name.trim()] !== false),
    [activeRoles, viewPrefs.roles],
  )

  const questionRows = useMemo(
    () => matrixQuestions.filter((q) => viewPrefs.questions[q.key] !== false),
    [matrixQuestions, viewPrefs.questions],
  )

  const roleNames = useMemo(() => roleCols.map((r) => r.name.trim()).filter(Boolean), [roleCols])

  useEffect(() => {
    if (!cellId || !planDate || !shiftKind || roleNames.length === 0) return
    let cancelled = false
    async function loadPlanStats() {
      setPlanStatsLoading(true)
      setPlanStatsError(null)
      try {
        const { start, end } = planDateUtcBounds(planDate)
        const [evRes, defRes, devRes, qfRes] = await Promise.all([
          supabase
            .from('plan24_events')
            .select(
              'id, title, start_at, end_at, sub_tasks, plan_date, shift_kind, event_type, status, role_name, linked_issue_kind, linked_issue_id, cil_template_id',
            )
            .eq('master_cell_id', cellId)
            .eq('shift_kind', shiftKind)
            .eq('plan_date', planDate)
            .is('deleted_at', null)
            .in('event_type', ['check', 'cl_check', 'cil_check', 'quality_check']),
          supabase
            .from('dh_defects')
            .select('id, title, description, status, priority, cil_template_id, cil_template_task_id, plan24_event_id, role_name, created_at')
            .eq('master_cell_id', cellId)
            .is('deleted_at', null)
            .gte('created_at', start)
            .lt('created_at', end),
          supabase
            .from('deviations')
            .select('id, title, description, status, priority, plan24_event_id, role_name, plan24_sub_task_id, created_at')
            .eq('master_cell_id', cellId)
            .is('deleted_at', null)
            .gte('created_at', start)
            .lt('created_at', end),
          supabase
            .from('quality_fails')
            .select('id, title, description, status, priority, plan24_event_id, role_name, plan24_sub_task_id, created_at')
            .eq('master_cell_id', cellId)
            .is('deleted_at', null)
            .gte('created_at', start)
            .lt('created_at', end),
        ])
        if (cancelled) return
        if (evRes.error) throw evRes.error
        if (defRes.error) throw defRes.error
        if (devRes.error) throw devRes.error
        if (qfRes.error) throw qfRes.error
        const evs = (evRes.data ?? []) as PlanStatsEventRow[]
        const defects = (defRes.data ?? []) as {
          id: string
          title: string
          description: string | null
          status: string
          priority: string
          cil_template_id: string | null
          cil_template_task_id: string | null
          plan24_event_id: string | null
          role_name: string | null
        }[]
        const deviations = (devRes.data ?? []) as {
          id: string
          title: string
          description: string | null
          status: string
          priority: string
          plan24_event_id: string | null
          role_name: string | null
          plan24_sub_task_id: string | null
        }[]
        const qualityFails = (qfRes.data ?? []) as {
          id: string
          title: string
          description: string | null
          status: string
          priority: string
          plan24_event_id: string | null
          role_name: string | null
          plan24_sub_task_id: string | null
        }[]
        setPlanStatsEvents(evs)
        setPlanStatsDefects(defects)
        setPlanStatsTaskDeviations(
          deviations.map((d) => ({
            id: d.id,
            plan24_event_id: d.plan24_event_id,
            role_name: d.role_name,
            plan24_sub_task_id: d.plan24_sub_task_id,
          })),
        )
        setPlanStatsTaskQualityFails(
          qualityFails.map((f) => ({
            id: f.id,
            plan24_event_id: f.plan24_event_id,
            role_name: f.role_name,
            plan24_sub_task_id: f.plan24_sub_task_id,
          })),
        )

        const devIds = [...new Set(evs.filter((e) => (e.linked_issue_kind ?? '').toLowerCase() === 'deviation' && e.linked_issue_id).map((e) => e.linked_issue_id as string))]
        const failIds = [
          ...new Set(evs.filter((e) => (e.linked_issue_kind ?? '').toLowerCase() === 'quality_fail' && e.linked_issue_id).map((e) => e.linked_issue_id as string)),
        ]
        const linkedDefectIds = [
          ...new Set(evs.filter((e) => (e.linked_issue_kind ?? '').toLowerCase() === 'dh_defect' && e.linked_issue_id).map((e) => e.linked_issue_id as string)),
        ]

        const [linkedDevRes, linkedQfRes] = await Promise.all([
          devIds.length
            ? supabase.from('deviations').select('id, title, description, status, priority').in('id', devIds)
            : Promise.resolve({ data: [], error: null }),
          failIds.length
            ? supabase.from('quality_fails').select('id, title, description, status, priority').in('id', failIds)
            : Promise.resolve({ data: [], error: null }),
        ])
        if (cancelled) return
        const derr = linkedDevRes.error ?? linkedQfRes.error
        if (derr) throw derr

        const devMap: Record<string, { id: string; title: string; description: string | null; status: string; priority: string }> = {}
        for (const row of deviations) devMap[String(row.id)] = row
        for (const row of (linkedDevRes.data ?? []) as any[]) {
          if (!devMap[String(row.id)]) devMap[String(row.id)] = row
        }
        setPlanStatsDeviationById(devMap)

        const failMap: Record<string, { id: string; title: string; description: string | null; status: string; priority: string }> = {}
        for (const row of qualityFails) failMap[String(row.id)] = row
        for (const row of (linkedQfRes.data ?? []) as any[]) {
          if (!failMap[String(row.id)]) failMap[String(row.id)] = row
        }
        setPlanStatsFailById(failMap)

        const defectMap: Record<string, { id: string; title: string; description: string | null; status: string; priority: string }> = {}
        for (const row of defects) defectMap[String(row.id)] = row
        // Ensure linked defects not in today-created range still resolve.
        if (linkedDefectIds.length) {
          for (const id of linkedDefectIds) {
            if (defectMap[id]) continue
            const extra = await supabase.from('dh_defects').select('id, title, description, status, priority').eq('id', id).maybeSingle()
            if (extra.error) throw extra.error
            if (extra.data) defectMap[String(extra.data.id)] = extra.data as any
          }
        }
        if (cancelled) return
        setPlanStatsDefectById(defectMap)
      } catch (e) {
        if (cancelled) return
        setPlanStatsError(e instanceof Error ? e.message : 'Could not load plan stats')
        setPlanStatsEvents([])
        setPlanStatsDefects([])
        setPlanStatsTaskDeviations([])
        setPlanStatsTaskQualityFails([])
        setPlanStatsDeviationById({})
        setPlanStatsDefectById({})
        setPlanStatsFailById({})
      } finally {
        if (!cancelled) setPlanStatsLoading(false)
      }
    }
    void loadPlanStats()
    return () => {
      cancelled = true
    }
  }, [cellId, planDate, shiftKind, roleNames.length])

  function buildIncompleteList(roleName: string, eventType: string): string[] {
    const rows = planStatsEvents.filter((e) => (e.role_name ?? '').trim() === roleName.trim() && e.event_type === eventType)
    const open = rows.filter((e) => e.status !== 'complete' && e.status !== 'not_required')
    if (rows.length === 0) return ['No checks scheduled.']
    if (open.length === 0) return ['All complete.']
    const out: string[] = []
    for (const e of open) {
      const fam = eventTypeLabel(e.event_type)
      const title = String(e.title ?? '').trim() || 'Check'
      const when = `${fmtClock(e.start_at)}–${fmtClock(e.end_at)}`
      out.push(`• ${fam} — ${title} (${e.status}) · ${when}`)
      out.push(...subTaskDescriptionLines(e.sub_tasks))
    }
    return out
  }

  function buildIssueList(roleName: string, kind: 'deviation' | 'dh_defect' | 'quality_fail'): string[] {
    const rows = planStatsEvents.filter((e) => p2pPlanEventMatchesRole(e.role_name, roleName))
    const ids = rows
      .filter((e) => (e.linked_issue_kind ?? '').toLowerCase() === kind && e.linked_issue_id)
      .map((e) => e.linked_issue_id as string)
    const uniq = [...new Set(ids)]
    if (kind === 'deviation') {
      for (const d of planStatsTaskDeviations) {
        if (!planTaskIssueBelongsToRole(d, planStatsEvents, planDate, roleName, 'cl_check')) continue
        if (!uniq.includes(d.id)) uniq.push(d.id)
      }
    } else if (kind === 'dh_defect') {
      for (const d of planStatsDefects) {
        if (!cilDefectBelongsToRole(d, planStatsEvents, planDate, roleName)) continue
        if (!uniq.includes(d.id)) uniq.push(d.id)
      }
    } else if (kind === 'quality_fail') {
      for (const f of planStatsTaskQualityFails) {
        if (!planTaskIssueBelongsToRole(f, planStatsEvents, planDate, roleName, 'quality_check')) continue
        if (!uniq.includes(f.id)) uniq.push(f.id)
      }
    }
    if (uniq.length === 0) return ['None raised.']

    const map =
      kind === 'deviation'
        ? planStatsDeviationById
        : kind === 'quality_fail'
          ? planStatsFailById
          : planStatsDefectById
    return uniq.map((id) => {
      const row = map[id]
      if (!row) return `• ${id}`
      const desc = row.description?.trim()
      const tail = desc ? ` — ${desc}` : ''
      return `• ${row.title}${tail} (${row.status}, ${row.priority})`
    })
  }

  const planRoleIssueCounts = useMemo(() => {
    if (planStatsEvents.length === 0 || roleNames.length === 0) return []
    return buildP2pPlanRoleIssueCounts(planStatsEvents, planDate, roleNames)
  }, [planStatsEvents, planDate, roleNames])

  const planExtraDefectsByRole = useMemo(() => {
    const map = new Map<string, number>()
    if (planStatsDefects.length === 0 || planStatsEvents.length === 0) return map
    for (const rn of roleNames) {
      map.set(rn, countUnlinkedCilDefectsForRole(planStatsDefects, planStatsEvents, planDate, rn))
    }
    return map
  }, [planStatsDefects, planStatsEvents, planDate, roleNames])

  const planExtraDeviationsByRole = useMemo(() => {
    const map = new Map<string, number>()
    if (planStatsTaskDeviations.length === 0 || planStatsEvents.length === 0) return map
    for (const rn of roleNames) {
      map.set(
        rn,
        countUnlinkedTaskIssuesForRole(planStatsTaskDeviations, planStatsEvents, planDate, rn, 'cl_check'),
      )
    }
    return map
  }, [planStatsTaskDeviations, planStatsEvents, planDate, roleNames])

  const planExtraQualityFailsByRole = useMemo(() => {
    const map = new Map<string, number>()
    if (planStatsTaskQualityFails.length === 0 || planStatsEvents.length === 0) return map
    for (const rn of roleNames) {
      map.set(
        rn,
        countUnlinkedTaskIssuesForRole(planStatsTaskQualityFails, planStatsEvents, planDate, rn, 'quality_check'),
      )
    }
    return map
  }, [planStatsTaskQualityFails, planStatsEvents, planDate, roleNames])

  const planCompletionByRole = useMemo(() => {
    const map = new Map<string, { cl: number; cil: number; quality: number; check: number }>()
    if (planStatsEvents.length === 0 || roleNames.length === 0) return map
    for (const rn of roleNames) {
      const fams = buildP2pPlanFamilyTrends(planStatsEvents, planDate, rn)
      const get = (key: 'cl' | 'cil' | 'quality' | 'check') => fams.find((f) => f.key === key)?.todayPct ?? 0
      map.set(rn, { cl: get('cl'), cil: get('cil'), quality: get('quality'), check: get('check') })
    }
    return map
  }, [planStatsEvents, planDate, roleNames])

  const planIssueCountByRole = useMemo(() => {
    const map = new Map<string, { deviations: number; defects: number; qualityFails: number }>()
    for (const row of planRoleIssueCounts) {
      map.set(row.roleName, { deviations: row.deviations, defects: row.defects, qualityFails: row.qualityFails })
    }
    return map
  }, [planRoleIssueCounts])

  const syncPrefsKeys = useCallback(
    (qKeys: string[]) => {
      const roleNames = sortGroups(roles.filter((r) => r.is_active)).map((r) => r.name.trim())
      const stored = loadP2pSummaryViewPrefs(userId, cellId)
      const merged = mergeP2pSummaryViewPrefs(stored, roleNames, qKeys)
      setViewPrefs(merged)
    },
    [cellId, roles, userId],
  )

  const loadMatrix = useCallback(async () => {
    if (!cellId || !shiftKind) {
      setMatrixQuestions([])
      setCells({})
      setSheetCommentByRoleId({})
      setSubmittedRoleIds(new Set())
      setMatrixLoading(false)
      return
    }
    setMatrixLoading(true)
    setError(null)

    const { data: assignsRaw, error: aErr } = await supabase
      .from('dds_p2p_cell_question_role_assignments')
      .select('question_kind, standard_question_id, soft_question_id, roster_role_id')
      .eq('master_cell_id', cellId)
    if (aErr) {
      setError(aErr.message)
      setMatrixLoading(false)
      return
    }
    const assigns = assignsRaw ?? []
    const roleIdsForCell = new Set(assigns.map((r) => r.roster_role_id as string))
    const assignByKey = new Map<string, Set<string>>()
    for (const row of assigns) {
      const qk =
        row.question_kind === 'standard'
          ? ddsP2pQuestionKey('standard', row.standard_question_id as string)
          : ddsP2pQuestionKey('soft', row.soft_question_id as string)
      if (!assignByKey.has(qk)) assignByKey.set(qk, new Set())
      assignByKey.get(qk)!.add(row.roster_role_id as string)
    }

    const stdIds = [...new Set(assigns.filter((r) => r.question_kind === 'standard').map((r) => r.standard_question_id as string))]
    const softIds = [...new Set(assigns.filter((r) => r.question_kind === 'soft').map((r) => r.soft_question_id as string))]

    if (stdIds.length === 0 && softIds.length === 0) {
      setMatrixQuestions([])
      setCells({})
      setSheetCommentByRoleId({})
      setSubmittedRoleIds(new Set())
      syncPrefsKeys([])
      setMatrixLoading(false)
      return
    }

    const [grpRes, stdRes, softRes] = await Promise.all([
      supabase.from('dds_kpi_groups').select('id, name, sort_order').order('sort_order').order('name'),
      stdIds.length
        ? supabase
            .from('dds_p2p_standard_questions')
            .select('id, kpi_group_id, prompt, sort_order, response_kind, target_number, linked_kpi_id')
            .in('id', stdIds)
        : Promise.resolve({ data: [], error: null }),
      softIds.length
        ? supabase
            .from('dds_p2p_cell_soft_point_questions')
            .select('id, kpi_group_id, prompt, sort_order, response_kind, target_number, linked_kpi_id')
            .eq('master_cell_id', cellId)
            .in('id', softIds)
        : Promise.resolve({ data: [], error: null }),
    ])
    const e = grpRes.error ?? stdRes.error ?? softRes.error
    if (e) {
      setError(e.message)
      setMatrixLoading(false)
      return
    }

    const groups = sortGroups((grpRes.data ?? []) as KpiGroup[])
    const gName = new Map(groups.map((g) => [g.id, g.name]))
    type QRow = {
      id: string
      kpi_group_id: string
      prompt: string
      sort_order: number
      response_kind: string
      target_number: number | string | null
      linked_kpi_id: string | null
    }
    const stdRows = (stdRes.data ?? []) as QRow[]
    const softRows = (softRes.data ?? []) as QRow[]
    const softQuestionIds = softRows.map((q) => q.id)
    const subBySoftId = new Map<string, DdsP2pSoftSubQuestion[]>()
    /** softQuestionId → roleId → subQuestionIds */
    const subAssignBySoftRole = new Map<string, Map<string, string[]>>()
    if (softQuestionIds.length > 0) {
      const [subRes, subAssignRes] = await Promise.all([
        supabase
          .from('dds_p2p_cell_soft_point_sub_questions')
          .select('id, soft_question_id, prompt, sort_order')
          .in('soft_question_id', softQuestionIds)
          .order('sort_order', { ascending: true })
          .order('prompt', { ascending: true }),
        supabase
          .from('dds_p2p_cell_soft_sub_question_role_assignments')
          .select('roster_role_id, soft_question_id, sub_question_id')
          .eq('master_cell_id', cellId)
          .in('soft_question_id', softQuestionIds),
      ])
      if (subRes.error || subAssignRes.error) {
        setError(subRes.error?.message ?? subAssignRes.error?.message ?? 'Load failed')
        setMatrixLoading(false)
        return
      }
      for (const row of subRes.data ?? []) {
        const parentId = row.soft_question_id as string
        const entry: DdsP2pSoftSubQuestion = {
          id: row.id as string,
          softQuestionId: parentId,
          prompt: row.prompt as string,
          sortOrder: Number(row.sort_order ?? 0),
        }
        if (!subBySoftId.has(parentId)) subBySoftId.set(parentId, [])
        subBySoftId.get(parentId)!.push(entry)
      }
      for (const [parentId, subs] of subBySoftId) {
        subBySoftId.set(parentId, sortSoftSubQuestions(subs))
      }
      for (const row of subAssignRes.data ?? []) {
        const softId = row.soft_question_id as string
        const roleId = row.roster_role_id as string
        const subId = row.sub_question_id as string
        if (!subAssignBySoftRole.has(softId)) subAssignBySoftRole.set(softId, new Map())
        const byRole = subAssignBySoftRole.get(softId)!
        if (!byRole.has(roleId)) byRole.set(roleId, [])
        byRole.get(roleId)!.push(subId)
      }
    }
    const linkedKpiIds = [
      ...new Set(
        [...stdRows, ...softRows].map((q) => q.linked_kpi_id).filter((id): id is string => Boolean(id)),
      ),
    ]
    const kpiLabelById = new Map<string, string>()
    if (linkedKpiIds.length > 0) {
      const { data: kpiRows, error: kpiErr } = await supabase.from('dds_kpis').select('id, label').in('id', linkedKpiIds)
      if (kpiErr) {
        setError(kpiErr.message)
        setMatrixLoading(false)
        return
      }
      for (const row of (kpiRows ?? []) as { id: string; label: string }[]) {
        kpiLabelById.set(row.id, row.label.trim())
      }
    }
    const stdSet = new Set(stdIds)
    const softSet = new Set(softIds)

    const matrixQ: MatrixQuestion[] = []
    for (const g of groups) {
      const stds = stdRows
        .filter((q) => q.kpi_group_id === g.id && stdSet.has(q.id))
        .sort((a, b) => a.sort_order - b.sort_order || a.prompt.localeCompare(b.prompt))
      const softs = softRows
        .filter((q) => q.kpi_group_id === g.id && softSet.has(q.id))
        .sort((a, b) => a.sort_order - b.sort_order || a.prompt.localeCompare(b.prompt))
      const gn = gName.get(g.id) ?? 'Group'
      for (const q of stds) {
        const rk = q.response_kind === 'number_with_target' ? 'number_with_target' : 'yes_no'
        const tn = rk === 'number_with_target' && q.target_number != null ? Number(q.target_number) : null
        const key = ddsP2pQuestionKey('standard', q.id)
        const roleIds = assignByKey.get(key)
        if (!roleIds || roleIds.size === 0) continue
        matrixQ.push({
          key,
          source: 'standard',
          questionId: q.id,
          groupName: gn,
          prompt: q.prompt,
          responseKind: rk,
          targetNumber: Number.isFinite(tn as number) ? (tn as number) : null,
          linkedKpiLabel: q.linked_kpi_id ? kpiLabelById.get(q.linked_kpi_id) ?? null : null,
          roleIds,
          subQuestions: [],
          hasSubQuestions: false,
          assignedSubIdsByRole: {},
        })
      }
      for (const q of softs) {
        const rk = q.response_kind === 'number_with_target' ? 'number_with_target' : 'yes_no'
        const tn = rk === 'number_with_target' && q.target_number != null ? Number(q.target_number) : null
        const key = ddsP2pQuestionKey('soft', q.id)
        const roleIds = assignByKey.get(key)
        if (!roleIds || roleIds.size === 0) continue
        const subs = subBySoftId.get(q.id) ?? []
        const byRole = subAssignBySoftRole.get(q.id)
        const assignedSubIdsByRole: Record<string, string[]> = {}
        if (byRole) {
          for (const [rid, ids] of byRole) {
            if (roleIds.has(rid)) assignedSubIdsByRole[rid] = ids
          }
        }
        matrixQ.push({
          key,
          source: 'soft',
          questionId: q.id,
          groupName: gn,
          prompt: q.prompt,
          responseKind: rk,
          targetNumber: Number.isFinite(tn as number) ? (tn as number) : null,
          linkedKpiLabel: q.linked_kpi_id ? kpiLabelById.get(q.linked_kpi_id) ?? null : null,
          roleIds,
          subQuestions: subs,
          hasSubQuestions: subs.length > 0,
          assignedSubIdsByRole,
        })
      }
    }

    const qKeys = matrixQ.map((q) => q.key)
    syncPrefsKeys(qKeys)

    const { data: auditsRaw, error: audErr } = await supabase
      .from('dds_p2p_audits')
      .select('id, roster_role_id, submitted_at, sheet_comment')
      .eq('master_cell_id', cellId)
      .eq('plan_date', planDate)
      .eq('shift_kind', shiftKind)
      .order('submitted_at', { ascending: false })
    if (audErr) {
      setError(audErr.message)
      setMatrixLoading(false)
      return
    }

    const latestByRole = new Map<string, { id: string; sheet_comment: string | null }>()
    for (const row of auditsRaw ?? []) {
      const rid = row.roster_role_id as string
      if (!roleIdsForCell.has(rid)) continue
      if (!latestByRole.has(rid)) {
        latestByRole.set(rid, { id: row.id as string, sheet_comment: (row.sheet_comment as string | null) ?? null })
      }
    }

    const auditIds = [...new Set([...latestByRole.values()].map((v) => v.id))]
    const sheetMap: Record<string, string> = {}
    for (const [rid, v] of latestByRole) {
      const t = v.sheet_comment?.trim()
      if (t) sheetMap[rid] = t
    }
    setSheetCommentByRoleId(sheetMap)
    setSubmittedRoleIds(new Set(latestByRole.keys()))

    const nextCells: Record<string, Record<string, CellSnapshot>> = {}
    for (const rid of roleIdsForCell) {
      nextCells[rid] = {}
    }

    if (auditIds.length > 0) {
      const subQuestionIds = [
        ...new Set(matrixQ.flatMap((q) => (q.hasSubQuestions ? q.subQuestions.map((s) => s.id) : []))),
      ]
      const [ansRes, subAnsRes] = await Promise.all([
        supabase
          .from('dds_p2p_audit_answers')
          .select(
            'audit_id, question_kind, standard_question_id, soft_question_id, answer_yes_no, answer_number, question_comment, kpi_link_comment, kpi_link_value',
          )
          .in('audit_id', auditIds),
        subQuestionIds.length > 0
          ? supabase
              .from('dds_p2p_audit_sub_answers')
              .select('audit_id, sub_question_id, answer_yes_no, question_comment')
              .in('audit_id', auditIds)
              .in('sub_question_id', subQuestionIds)
          : Promise.resolve({ data: [], error: null }),
      ])
      const ansRows = ansRes.data
      const ansErr = ansRes.error
      type SubAnsRow = {
        audit_id: string
        sub_question_id: string
        answer_yes_no: boolean
        question_comment: string | null
      }
      const subAnsRows = (subAnsRes.data ?? []) as SubAnsRow[]
      const subAnsErr = subAnsRes.error
      if (ansErr || subAnsErr) {
        setError(ansErr?.message ?? subAnsErr?.message ?? 'Load failed')
        setMatrixLoading(false)
        return
      }

      const subPromptById = new Map<string, string>()
      for (const q of matrixQ) {
        for (const sq of q.subQuestions) subPromptById.set(sq.id, sq.prompt)
      }

      const auditToRole = new Map<string, string>()
      for (const [rid, v] of latestByRole) auditToRole.set(v.id, rid)

      const byAudit = new Map<string, typeof ansRows>()
      for (const ar of ansRows ?? []) {
        const aid = ar.audit_id as string
        if (!byAudit.has(aid)) byAudit.set(aid, [])
        byAudit.get(aid)!.push(ar)
      }

      const subByAudit = new Map<string, SubAnsRow[]>()
      for (const ar of subAnsRows ?? []) {
        const aid = ar.audit_id as string
        if (!subByAudit.has(aid)) subByAudit.set(aid, [])
        subByAudit.get(aid)!.push(ar)
      }

      for (const [auditId, rows] of byAudit) {
        const rid = auditToRole.get(auditId)
        if (!rid || !nextCells[rid]) continue
        for (const row of rows ?? []) {
          const kind = row.question_kind as 'standard' | 'soft'
          const qid = kind === 'standard' ? (row.standard_question_id as string) : (row.soft_question_id as string)
          const qk = ddsP2pQuestionKey(kind, qid)
          const mq = matrixQ.find((x) => x.key === qk)
          if (!mq || mq.hasSubQuestions) continue
          const qc = String((row.question_comment as string | null) ?? '').trim()
          const klc = String((row.kpi_link_comment as string | null) ?? '').trim()
          nextCells[rid][qk] = {
            responseKind: mq.responseKind,
            yesNo: typeof row.answer_yes_no === 'boolean' ? row.answer_yes_no : null,
            num: (() => {
              const n = row.answer_number ?? row.kpi_link_value
              if (n == null) return null
              const v = Number(n)
              return Number.isFinite(v) ? v : null
            })(),
            comment: qc || klc,
            subAnswers: [],
            yesCount: null,
            noCount: null,
          }
        }
      }

      for (const [auditId, rows] of subByAudit) {
        const rid = auditToRole.get(auditId)
        if (!rid || !nextCells[rid]) continue
        const byQuestionKey = new Map<string, DdsP2pSubAnswerSnapshot[]>()
        for (const row of rows ?? []) {
          const subId = row.sub_question_id as string
          const prompt = subPromptById.get(subId) ?? 'Sub-question'
          const parentQ = matrixQ.find((q) => q.subQuestions.some((s) => s.id === subId))
          if (!parentQ) continue
          const snap: DdsP2pSubAnswerSnapshot = {
            subQuestionId: subId,
            prompt,
            yesNo: row.answer_yes_no === true,
            comment: String((row.question_comment as string | null) ?? '').trim(),
          }
          if (!byQuestionKey.has(parentQ.key)) byQuestionKey.set(parentQ.key, [])
          byQuestionKey.get(parentQ.key)!.push(snap)
        }
        for (const [qk, subSnaps] of byQuestionKey) {
          const mq = matrixQ.find((x) => x.key === qk)
          if (!mq) continue
          const allowed = new Set(mq.assignedSubIdsByRole[rid] ?? [])
          const filtered = subSnaps.filter((s) => allowed.has(s.subQuestionId))
          const yesCount = filtered.filter((s) => s.yesNo === true).length
          const noCount = filtered.filter((s) => s.yesNo === false).length
          nextCells[rid][qk] = {
            responseKind: mq.responseKind,
            yesNo: null,
            num: null,
            comment: '',
            subAnswers: filtered,
            yesCount,
            noCount,
          }
        }
      }
    }

    for (const q of matrixQ) {
      if (q.hasSubQuestions) {
        for (const rid of q.roleIds) {
          if (!latestByRole.has(rid) || nextCells[rid]?.[q.key]) continue
          nextCells[rid]![q.key] = {
            responseKind: q.responseKind,
            yesNo: null,
            num: null,
            comment: '',
            subAnswers: [],
            yesCount: 0,
            noCount: 0,
          }
        }
        continue
      }
      if (q.responseKind !== 'yes_no') continue
      for (const rid of q.roleIds) {
        if (!latestByRole.has(rid) || nextCells[rid]?.[q.key]) continue
        nextCells[rid]![q.key] = {
          responseKind: 'yes_no',
          yesNo: false,
          num: null,
          comment: '',
          subAnswers: [],
          yesCount: null,
          noCount: null,
        }
      }
    }

    setMatrixQuestions(matrixQ)
    setCells(nextCells)
    setMatrixLoading(false)
  }, [cellId, planDate, shiftKind, syncPrefsKeys, setError])

  useEffect(() => {
    void loadMatrix()
  }, [loadMatrix])

  useEffect(() => {
    return subscribeDdsP2pKpiRollupDone((d) => {
      if (d.masterCellId !== cellId || d.planDate !== planDate || d.shiftKind !== shiftKind) return
      void loadMatrix()
    })
  }, [cellId, planDate, shiftKind, loadMatrix])

  useEffect(() => {
    setDetailPop(null)
  }, [planDate, shiftKind, cellId])

  useLayoutEffect(() => {
    if (!detailPop) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (detailPanelRef.current?.contains(t)) return
      setDetailPop(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailPop(null)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [detailPop])

  const openPrefs = useCallback(() => {
    setDetailPop(null)
    const roleNames = activeRoles.map((r) => r.name.trim())
    const qKeys = matrixQuestions.map((q) => q.key)
    setPrefsDraft(mergeP2pSummaryViewPrefs(viewPrefs, roleNames, qKeys))
    setPrefsOpen(true)
  }, [activeRoles, matrixQuestions, viewPrefs])

  useImperativeHandle(ref, () => ({ openPrefs }), [openPrefs])

  const roleColSubmittedClass =
    'bg-emerald-500/[0.06] shadow-[inset_0_0_0_1px_rgba(5,150,105,0.28)] dark:bg-emerald-500/[0.11] dark:shadow-[inset_0_0_0_1px_rgba(52,211,153,0.32)]'

  const visibleSubmittedCount = roleCols.filter((r) => submittedRoleIds.has(r.id)).length

  const shiftNarrative = useMemo<ShiftNarrative>(() => {
    const narrativeQuestions: P2pNarrativeQuestionContext[] = questionRows.map((q) => ({
      key: q.key,
      groupName: q.groupName,
      prompt: q.prompt,
      responseKind: q.responseKind,
      targetNumber: q.targetNumber,
      linkedKpiLabel: q.linkedKpiLabel,
    }))

    const roleInputs: P2pRoleNarrativeInput[] = roleCols.map((r) => {
      const roleName = r.name.trim()
      const submitted = submittedRoleIds.has(r.id)
      const gaps: string[] = []
      const comp = planCompletionByRole.get(roleName)
      const issueRow = planIssueCountByRole.get(roleName)
      const deviations = (issueRow?.deviations ?? 0) + (planExtraDeviationsByRole.get(roleName) ?? 0)
      const cilDefects = (issueRow?.defects ?? 0) + (planExtraDefectsByRole.get(roleName) ?? 0)
      const qualityFails = (issueRow?.qualityFails ?? 0) + (planExtraQualityFailsByRole.get(roleName) ?? 0)
      const issueTotal = deviations + cilDefects + qualityFails

      if (!submitted) gaps.push('P2P not submitted')
      if (comp) {
        const checks = [
          { label: 'CL', pct: comp.cl },
          { label: 'CIL', pct: comp.cil },
          { label: 'Quality', pct: comp.quality },
          { label: 'Checks', pct: comp.check },
        ]
        checks
          .filter((c) => c.pct < 100)
          .sort((a, b) => a.pct - b.pct)
          .slice(0, 3)
          .forEach((c) => gaps.push(`${c.label} ${c.pct}%`))
      }
      const planGap = formatPlanIssueGapParts(deviations, cilDefects, qualityFails)
      if (planGap) gaps.push(planGap)

      const answers: Record<string, P2pNarrativeAnswerSnapshot | undefined> = {}
      for (const q of questionRows) {
        if (!q.roleIds.has(r.id)) continue
        const snap = cells[r.id]?.[q.key]
        if (!snap) continue
        answers[q.key] = {
          yesNo: snap.yesNo,
          num: snap.num,
          comment: snap.comment,
        }
      }

      return {
        roleId: r.id,
        roleName,
        submitted,
        sheetComment: sheetCommentByRoleId[r.id] ?? '',
        gaps,
        planIssueTotal: issueTotal,
        planDeviations: deviations,
        planCilDefects: cilDefects,
        planQualityFails: qualityFails,
        completionMinPct: comp ? Math.min(comp.cl, comp.cil, comp.quality, comp.check) : null,
        questions: narrativeQuestions.filter((q) => {
          const mq = questionRows.find((row) => row.key === q.key)
          return mq?.roleIds.has(r.id)
        }),
        answers,
      }
    })

    return buildP2pShiftNarrative(roleInputs)
  }, [
    cells,
    planCompletionByRole,
    planExtraDefectsByRole,
    planExtraDeviationsByRole,
    planExtraQualityFailsByRole,
    planIssueCountByRole,
    questionRows,
    roleCols,
    sheetCommentByRoleId,
    submittedRoleIds,
  ])

  const prefsHint =
    prefsHelpStandalone ? (
      <p className="mt-1">Open view preferences and enable at least one role and one question.</p>
    ) : (
      <p className="mt-1">
        Use <Link to="/dds-process/p2p-summary" className="font-medium text-accent underline-offset-2 hover:underline">P2P Summary</Link> to
        adjust visible roles and questions.
      </p>
    )

  return (
    <div className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${className}`.trim()}>
      {error ? <p className={ddsErr}>{error}</p> : null}

      {shellLoading ? (
        <p className="flex items-center gap-1 text-xs text-muted" role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading roster…
        </p>
      ) : shifts.length === 0 || activeRoles.length === 0 ? (
        <p className="text-xs text-muted">
          No Plan 24 shifts or roles for this cell. Configure roster under RTT systems → Admin → Plan 24.
        </p>
      ) : matrixLoading ? (
        <p className="flex items-center gap-1 text-xs text-muted" role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading matrix…
        </p>
      ) : matrixQuestions.length === 0 ? (
        <p className="text-xs text-muted">
          No P2P question assignments for this cell. Configure under{' '}
          <Link to="/dds-process/admin/p2p-setup" className="font-medium text-accent underline-offset-2 hover:underline">
            Admin → P2P set-up
          </Link>
          .
        </p>
      ) : roleCols.length === 0 || questionRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-raised/30 p-2 text-center text-xs text-muted">
          <p className="text-fg/80">All roles or questions are hidden.</p>
          {prefsHint}
        </div>
      ) : (
        <>
          <div className="mt-1 min-h-0 flex-1 overflow-auto rounded-lg border border-border/70 bg-surface shadow-inner">
            <table className={P2P_SUMMARY_TABLE_CLASS}>
              <thead>
                <tr>
                  <th className={P2P_SUMMARY_QUESTION_TH_CLASS} scope="col">
                    <span className="block text-[9px] uppercase tracking-wide">P2P matrix</span>
                    <span className="block text-[9px] font-medium normal-case text-muted/80">
                      {visibleSubmittedCount}/{roleCols.length} submitted · {questionRows.length} Q
                    </span>
                  </th>
                  {roleCols.map((r) => {
                    const submitted = submittedRoleIds.has(r.id)
                    return (
                      <th
                        key={r.id}
                        className={`${P2P_SUMMARY_ROLE_TH_CLASS} ${submitted ? roleColSubmittedClass : ''}`}
                        scope="col"
                        title={submitted ? 'P2P submitted for this role' : 'P2P not submitted yet'}
                      >
                        <span className="mx-auto flex min-w-0 items-center justify-center gap-1">
                          <span
                            className={`size-1.5 shrink-0 rounded-full ${submitted ? 'bg-emerald-500' : 'bg-amber-400'}`}
                            aria-hidden
                          />
                          <span className="min-w-0 truncate">{r.name}</span>
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    { label: 'CL Completion', kind: 'cl' as const },
                    { label: 'Deviations', kind: 'deviations' as const },
                    { label: 'CIL Completion', kind: 'cil' as const },
                    { label: 'Defects', kind: 'defects' as const },
                    { label: 'Quality checks', kind: 'quality' as const },
                    { label: 'Fails', kind: 'qualityFails' as const },
                    { label: 'Checks completion', kind: 'check' as const },
                  ] as const
                ).map((r, ix) => (
                  <tr key={`${r.label}-${ix}`} className="odd:bg-surface/40 bg-surface-raised/20">
                    <th scope="row" className={P2P_SUMMARY_ROW_LABEL_CLASS}>
                      {r.label}
                    </th>
                    {roleCols.map((rc) => {
                      const rn = rc.name.trim()
                      const issueRow = planIssueCountByRole.get(rn)
                      const extraDef = planExtraDefectsByRole.get(rn) ?? 0
                      const extraDev = planExtraDeviationsByRole.get(rn) ?? 0
                      const extraQf = planExtraQualityFailsByRole.get(rn) ?? 0
                      const comp = planCompletionByRole.get(rn)
                      const showLoading = planStatsLoading && !planStatsError
                      if (r.kind === 'cl' || r.kind === 'cil' || r.kind === 'quality' || r.kind === 'check') {
                        const pct = showLoading ? null : comp ? comp[r.kind] : 0
                        const tone = pct == null ? null : p2pPlanCompletionTone(pct)
                        const eventType =
                          r.kind === 'cl'
                            ? 'cl_check'
                            : r.kind === 'cil'
                              ? 'cil_check'
                              : r.kind === 'quality'
                                ? 'quality_check'
                                : 'check'
                        return (
                          <td key={rc.id} className={P2P_SUMMARY_CELL_CLASS}>
                            {pct == null || tone == null ? (
                              <span className="text-muted">—</span>
                            ) : (
                              <button
                                type="button"
                                className="inline-flex items-center justify-center gap-0.5 rounded px-0.5 py-0 hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 dark:hover:bg-white/[0.06]"
                                title="Click to view incomplete checks"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const pos = placeDetailPanel(e.currentTarget, 360)
                                  const lines = buildIncompleteList(rn, eventType)
                                  setDetailPop({ ...pos, body: [`${rc.name} — ${r.label}`, '', ...lines].join('\n') })
                                }}
                              >
                                <span className={`inline-block h-1.5 w-1.5 rounded ${tone.bar}`} aria-hidden />
                                <span className="tabular-nums font-bold text-fg">{pct}%</span>
                              </button>
                            )}
                          </td>
                        )
                      }

                      const count =
                        r.kind === 'deviations'
                          ? (issueRow?.deviations ?? 0) + extraDev
                          : r.kind === 'defects'
                            ? (issueRow?.defects ?? 0) + extraDef
                            : r.kind === 'qualityFails'
                              ? (issueRow?.qualityFails ?? 0) + extraQf
                              : 0
                      return (
                        <td key={rc.id} className={P2P_SUMMARY_CELL_CLASS}>
                          {showLoading ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <button
                              type="button"
                              className={`rounded px-0.5 py-0 tabular-nums font-bold hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 dark:hover:bg-white/[0.06] ${p2pPlanRaisedCountClass(count)}`}
                              title="Click to view raised items"
                              onClick={(e) => {
                                e.stopPropagation()
                                const pos = placeDetailPanel(e.currentTarget, 420)
                                const kind =
                                  r.kind === 'deviations'
                                    ? ('deviation' as const)
                                    : r.kind === 'defects'
                                      ? ('dh_defect' as const)
                                      : ('quality_fail' as const)
                                const lines = buildIssueList(rn, kind)
                                setDetailPop({ ...pos, body: [`${rc.name} — ${r.label}`, '', ...lines].join('\n') })
                              }}
                            >
                              {count}
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {questionRows.map((q) => (
                  <tr key={q.key} className="odd:bg-surface/40">
                    <th
                      scope="row"
                      className={P2P_SUMMARY_QUESTION_ROW_CLASS}
                      title={`${q.groupName} — ${q.prompt}`}
                    >
                      <span className="line-clamp-2 text-[10px]">
                        <span className="font-semibold text-muted">{q.groupName}: </span>
                        <span className="text-fg">{q.prompt}</span>
                      </span>
                    </th>
                    {roleCols.map((r) => {
                      const submitted = submittedRoleIds.has(r.id)
                      const colClass = submitted ? roleColSubmittedClass : ''
                      if (!q.roleIds.has(r.id)) {
                        return (
                          <td
                            key={r.id}
                            className={`${P2P_SUMMARY_CELL_CLASS} text-muted ${colClass}`}
                          >
                            <span title="Not assigned to this role">—</span>
                          </td>
                        )
                      }
                      const snap = cells[r.id]?.[q.key]
                      const cmt = snap?.comment?.trim() ?? ''
                      const hasCmt = Boolean(cmt)
                      const hoverLines = q.hasSubQuestions ? buildSubNoHoverLines(snap?.subAnswers ?? []) : []
                      const hoverTitle = hoverLines.join('\n')
                      const yesDetailLines = q.hasSubQuestions
                        ? buildSubYesDetailLines(snap?.subAnswers ?? [])
                        : []
                      let main: ReactNode = '\u00a0'
                      if (q.hasSubQuestions) {
                        if (submitted || snap != null) {
                          const yesCount = snap?.yesCount ?? 0
                          const noCount = snap?.noCount ?? 0
                          main = (
                            <DdsP2pSubYesNoSummary
                              yesCount={yesCount}
                              noCount={noCount}
                              title="Click for Yes answers and comments"
                              onClick={(e) => {
                                e.stopPropagation()
                                const pos = placeDetailPanel(e.currentTarget, 320)
                                setDetailPop({
                                  ...pos,
                                  body: [`Yes — ${q.prompt}`, '', ...yesDetailLines].join('\n'),
                                })
                              }}
                            />
                          )
                        }
                      } else if (q.responseKind === 'yes_no') {
                        if (snap?.yesNo === true) {
                          main = <span className="font-bold text-rose-600">Y</span>
                        } else if (submitted || snap != null) {
                          main = <span className="font-bold text-emerald-600">N</span>
                        }
                      } else if (snap != null && snap.num != null && Number.isFinite(snap.num)) {
                        main = <span className="tabular-nums text-fg">{formatNum(snap.num)}</span>
                      }
                      return (
                        <td key={r.id} className={`${P2P_SUMMARY_CELL_CLASS} ${colClass}`}>
                          <div
                            className={`${P2P_SUMMARY_VALUE_WRAP_CLASS} ${q.hasSubQuestions && hoverTitle ? 'relative' : ''}`}
                            title={q.hasSubQuestions ? hoverTitle : undefined}
                          >
                            <span className="tabular-nums">{main}</span>
                            {q.hasSubQuestions && hoverTitle ? (
                              <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-max max-w-[16rem] -translate-x-1/2 rounded-md border border-border bg-surface px-2 py-1 text-left text-[9px] leading-snug text-fg shadow-lg group-hover:block">
                                {hoverLines.map((line, i) => (
                                  <div key={i}>{line}</div>
                                ))}
                              </div>
                            ) : null}
                            {!q.hasSubQuestions ? (
                              <button
                                type="button"
                                className={`inline-flex rounded p-px text-muted hover:bg-black/[0.06] hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 dark:hover:bg-white/[0.06] ${
                                  hasCmt ? '' : 'opacity-25 group-hover:opacity-70 focus-visible:opacity-100'
                                }`}
                                aria-label={hasCmt ? 'Show question comment' : 'No question comment'}
                                title={hasCmt ? 'Show question comment' : 'No comment'}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const pos = placeDetailPanel(e.currentTarget, 280)
                                  setDetailPop({
                                    ...pos,
                                    body: hasCmt ? cmt : '—',
                                  })
                                }}
                              >
                                <MessageSquare className={`size-3 shrink-0 ${hasCmt ? 'text-accent' : 'text-muted/30'}`} aria-hidden />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="bg-surface-raised/25">
                  <th scope="row" className={P2P_SUMMARY_ROW_LABEL_CLASS}>
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-muted">P2P </span>
                    Overall comment
                  </th>
                  {roleCols.map((r) => {
                    const sheet = sheetCommentByRoleId[r.id]?.trim() ?? ''
                    const hasSheet = Boolean(sheet)
                    const submitted = submittedRoleIds.has(r.id)
                    const colClass = submitted ? roleColSubmittedClass : ''
                    return (
                      <td key={r.id} className={`${P2P_SUMMARY_CELL_CLASS} ${colClass}`}>
                        <div className={P2P_SUMMARY_VALUE_WRAP_CLASS}>
                          {hasSheet ? (
                            <span className="font-bold text-rose-600">N</span>
                          ) : (
                            <span className="font-bold text-emerald-600">Y</span>
                          )}
                          <button
                            type="button"
                            className={`inline-flex rounded p-px text-muted hover:bg-black/[0.06] hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 dark:hover:bg-white/[0.06] ${
                              hasSheet ? '' : 'opacity-25 group-hover:opacity-70 focus-visible:opacity-100'
                            }`}
                            aria-label={hasSheet ? 'Show overall comment' : 'No overall comment'}
                            title={hasSheet ? 'Show overall comment' : 'No comment'}
                            onClick={(e) => {
                              e.stopPropagation()
                              const pos = placeDetailPanel(e.currentTarget, 280)
                              setDetailPop({
                                ...pos,
                                body: hasSheet ? sheet : '—',
                              })
                            }}
                          >
                            <MessageSquare className={`size-3 shrink-0 ${hasSheet ? 'text-accent' : 'text-muted/30'}`} aria-hidden />
                          </button>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <section className="mt-1 shrink-0 overflow-hidden rounded-lg border border-violet-500/25 bg-violet-500/[0.06] text-[10px] leading-snug text-fg shadow-sm dark:bg-violet-500/[0.12]">
            <div className="flex items-center gap-1.5 border-b border-violet-500/20 px-2 py-1">
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-violet-600/10 text-violet-700 dark:text-violet-200">
                <Sparkles className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <h2 className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-200">
                    AI shift narrative by role
                  </h2>
                  <span className="rounded-full bg-surface/80 px-1.5 py-px text-[9px] font-semibold text-muted">
                    {shiftNarrative.attentionCount} need follow-up · {shiftNarrative.insightCount} insights
                  </span>
                  {planStatsLoading ? (
                    <span className="inline-flex items-center gap-1 text-[9px] text-muted">
                      <Loader2 className="size-3 animate-spin" aria-hidden /> refreshing
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-[10px] font-medium" title={shiftNarrative.summary}>
                  {shiftNarrative.summary}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-500/20 bg-surface/70 px-1.5 py-0.5 text-[9px] font-semibold text-muted hover:text-fg"
                onClick={() => setNarrativeCollapsed((v) => !v)}
                aria-expanded={!narrativeCollapsed}
              >
                {narrativeCollapsed ? (
                  <>
                    <ChevronDown className="size-3" aria-hidden /> Show
                  </>
                ) : (
                  <>
                    <ChevronUp className="size-3" aria-hidden /> Hide
                  </>
                )}
              </button>
            </div>

            {!narrativeCollapsed ? (
              <div className="max-h-72 overflow-auto">
                <table className="min-w-full border-separate border-spacing-0 text-left text-[10px]">
                  <thead className="sticky top-0 z-[1] bg-surface-raised/95 text-[8px] uppercase tracking-wide text-muted backdrop-blur-sm">
                    <tr>
                      <th className="border-b border-violet-500/20 px-2 py-1 font-bold">Priority</th>
                      <th className="border-b border-violet-500/20 px-2 py-1 font-bold">Role</th>
                      <th className="border-b border-violet-500/20 px-2 py-1 font-bold">Gaps</th>
                      <th className="border-b border-violet-500/20 px-2 py-1 font-bold">P2P analysis</th>
                      <th className="border-b border-violet-500/20 px-2 py-1 font-bold">Suggested action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shiftNarrative.roles.map((role) => {
                      const rowClass =
                        role.tone === 'urgent'
                          ? 'bg-rose-500/[0.08]'
                          : role.tone === 'watch'
                            ? 'bg-amber-500/[0.08]'
                            : 'bg-emerald-500/[0.06]'
                      const badgeClass =
                        role.tone === 'urgent'
                          ? 'bg-rose-600 text-white'
                          : role.tone === 'watch'
                            ? 'bg-amber-500 text-black'
                            : 'bg-emerald-600 text-white'
                      const gaps = role.gaps.length > 0 ? role.gaps.slice(0, 3).join(' · ') : 'No visible gaps'
                      return (
                        <tr key={role.roleId} className={`${rowClass} align-top`}>
                          <td className="border-b border-violet-500/10 px-2 py-1">
                            <span className={`inline-flex rounded-full px-1.5 py-px text-[8px] font-bold uppercase tracking-wide ${badgeClass}`}>
                              {role.tone === 'urgent' ? 'Act' : role.tone === 'watch' ? 'Watch' : 'OK'}
                            </span>
                          </td>
                          <th className="border-b border-violet-500/10 px-2 py-1 font-semibold text-fg" scope="row">
                            <span className="flex min-w-[5rem] items-center gap-1">
                              <span className={`size-1.5 shrink-0 rounded-full ${role.submitted ? 'bg-emerald-500' : 'bg-amber-400'}`} title={role.submitted ? 'P2P submitted' : 'P2P not submitted'} />
                              <span className="max-w-[8rem] truncate" title={role.roleName}>{role.roleName}</span>
                            </span>
                            <span className="block max-w-[8rem] truncate text-[9px] font-medium text-muted" title={role.headline}>
                              {role.headline}
                            </span>
                          </th>
                          <td className="max-w-[14rem] border-b border-violet-500/10 px-2 py-1 text-fg/90">
                            <span className="line-clamp-2" title={gaps}>{gaps}</span>
                          </td>
                          <td className="max-w-[22rem] border-b border-violet-500/10 px-2 py-1 text-muted">
                            {role.insights.length > 0 ? (
                              <ul className="space-y-1">
                                {role.insights.map((insight, idx) => (
                                  <li key={`${role.roleId}-${idx}`} className="leading-snug" title={insight.finding}>
                                    <span
                                      className={`mr-1 inline-flex rounded px-1 py-px text-[8px] font-bold uppercase tracking-wide ${
                                        insight.highPriority
                                          ? 'bg-rose-600/15 text-rose-800 dark:text-rose-200'
                                          : 'bg-surface-raised text-muted'
                                      }`}
                                    >
                                      {insight.topicLabel}
                                    </span>
                                    <span className={insight.highPriority ? 'font-medium text-fg/90' : ''}>
                                      {compactText(insight.finding, 180)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              'No P2P signals'
                            )}
                          </td>
                          <td className="max-w-[18rem] border-b border-violet-500/10 px-2 py-1 font-medium">
                            {role.insights.length > 0 ? (
                              <ul className="space-y-1 text-[10px] leading-snug">
                                {role.insights.map((insight, idx) => (
                                  <li key={`${role.roleId}-s-${idx}`} title={insight.suggestion}>
                                    {compactText(insight.suggestion, 160)}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span title={role.action}>{compactText(role.action, 160)}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          {detailPop ? (
            <div
              ref={detailPanelRef}
              role="dialog"
              aria-modal="false"
              className="fixed z-[60] max-h-[min(50vh,20rem)] overflow-y-auto rounded-lg border border-border-strong bg-surface px-3 py-2 text-xs shadow-xl"
              style={{ top: detailPop.top, left: detailPop.left, maxWidth: detailPop.maxW, width: detailPop.maxW }}
            >
              <div className="whitespace-pre-wrap break-words leading-snug text-fg">{detailPop.body}</div>
            </div>
          ) : null}
        </>
      )}

      {prefsOpen ? (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/45 p-4" role="presentation" onClick={() => setPrefsOpen(false)}>
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-strong bg-surface p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="p2p-sum-prefs-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="p2p-sum-prefs-title" className="font-display text-lg font-semibold">
              P2P Summary view
            </h2>
            <p className="mt-1 text-xs text-muted">Choose which roles and questions appear in the matrix. Saved per cell on this device.</p>

            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Roles</p>
              {activeRoles.length === 0 ? (
                <p className="text-sm text-muted">No active roles on this roster.</p>
              ) : (
                <div className="max-h-[28vh] space-y-2 overflow-y-auto rounded-xl border border-border bg-surface-raised/40 p-3">
                  {activeRoles.map((r) => (
                    <label key={r.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-border accent-violet-600"
                        checked={prefsDraft.roles[r.name.trim()] !== false}
                        onChange={() =>
                          setPrefsDraft((d) => ({
                            ...d,
                            roles: { ...d.roles, [r.name.trim()]: !(d.roles[r.name.trim()] !== false) },
                          }))
                        }
                      />
                      {r.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Questions</p>
              <div className="max-h-[36vh] space-y-2 overflow-y-auto rounded-xl border border-border bg-surface-raised/40 p-3">
                {matrixQuestions.map((q) => (
                  <label key={q.key} className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 rounded border-border accent-violet-600"
                      checked={prefsDraft.questions[q.key] !== false}
                      onChange={() =>
                        setPrefsDraft((d) => ({
                          ...d,
                          questions: { ...d.questions, [q.key]: !(d.questions[q.key] !== false) },
                        }))
                      }
                    />
                    <span>
                      <span className="block text-[10px] font-medium text-muted">{q.groupName}</span>
                      <span className="leading-snug">{q.prompt}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-black/[0.06]" onClick={() => setPrefsOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
                disabled={!userId || !cellId}
                onClick={() => {
                  if (!userId || !cellId) return
                  saveP2pSummaryViewPrefs(userId, cellId, prefsDraft)
                  setViewPrefs({ roles: { ...prefsDraft.roles }, questions: { ...prefsDraft.questions } })
                  setPrefsOpen(false)
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
})
