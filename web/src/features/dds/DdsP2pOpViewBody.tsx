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
import { Loader2, MessageSquare } from 'lucide-react'
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
import type { DdsP2pSummaryShiftRow } from './DdsP2pSummaryBody'
import { parseYmdLocal, resolveLastNShifts, type ShiftScope } from '../plan24/plan24ShiftUtils'
import { plan24ShiftScopeKey, resolveRolePersonNamesForShifts } from '../plan24/plan24RolePerson'

const OP_SHIFT_COUNT = 8

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
  subQuestions: DdsP2pSoftSubQuestion[]
  hasSubQuestions: boolean
  assignedSubIds: string[]
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

type ShiftColumn = ShiftScope & {
  key: string
  displayName: string
  operatorName: string
  submitted: boolean
  sheetComment: string
}

type PlanStatsEventRow = P2pPlanEventRow & {
  id?: string
  title?: string
  start_at?: string
  end_at?: string
  sub_tasks?: unknown
  plan_date?: string
  shift_kind?: string
}

type ShiftPlanStats = {
  events: PlanStatsEventRow[]
  defects: {
    id: string
    cil_template_id: string | null
    cil_template_task_id: string | null
    plan24_event_id?: string | null
    role_name?: string | null
    created_at?: string
  }[]
  taskDeviations: P2pPlanTaskIssueRow[]
  taskQualityFails: P2pPlanTaskIssueRow[]
  deviationById: Record<string, { id: string; title: string; description: string | null; status: string; priority: string }>
  defectById: Record<string, { id: string; title: string; description: string | null; status: string; priority: string }>
  failById: Record<string, { id: string; title: string; description: string | null; status: string; priority: string }>
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

function formatShiftHeaderDate(ymd: string): string {
  const d = parseYmdLocal(ymd)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function shiftDisplayName(kind: string, shifts: DdsP2pSummaryShiftRow[]): string {
  const row = shifts.find((s) => s.kind === kind)
  return row?.display_name?.trim() || kind
}

const TABLE_CLASS = 'w-max min-w-full border-separate border-spacing-0 text-left text-[10px] leading-tight'
const QUESTION_TH_CLASS =
  'sticky left-0 top-0 z-[4] min-w-[9rem] max-w-[12rem] border-b border-r border-border/80 bg-surface-raised/95 px-1.5 py-0.5 font-semibold text-muted shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-sm'
const ROW_LABEL_CLASS =
  'sticky left-0 z-[1] max-w-[12rem] border-b border-r border-border/70 bg-surface px-1.5 py-0.5 text-left align-middle font-semibold leading-tight backdrop-blur-sm'
const QUESTION_ROW_CLASS =
  'sticky left-0 z-[1] max-w-[12rem] border-b border-r border-border/70 bg-surface px-1.5 py-px text-left align-middle font-normal leading-tight backdrop-blur-sm'
const SHIFT_TH_CLASS =
  'sticky top-0 z-[3] min-w-[4.25rem] max-w-[5.5rem] border-b border-l border-border/50 bg-surface-raised/95 px-1 py-0.5 text-center font-semibold text-[10px] text-fg shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-sm'
const CELL_CLASS = 'border-b border-l border-border/35 px-0.5 py-px text-center align-middle text-[10px]'
const VALUE_WRAP_CLASS =
  'group inline-flex min-h-[1.125rem] min-w-[2.75rem] items-center justify-center gap-0.5 rounded-sm px-0.5 py-0'

export type DdsP2pOpViewBodyHandle = {
  openPrefs: () => void
}

export type DdsP2pOpViewBodyProps = {
  cellId: string
  userId: string | undefined
  planDate: string
  shiftKind: string
  shifts: DdsP2pSummaryShiftRow[]
  roleId: string
  roleName: string
  shellLoading: boolean
  error: string | null
  setError: (msg: string | null) => void
  className?: string
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

export const DdsP2pOpViewBody = forwardRef(function DdsP2pOpViewBody(
  {
    cellId,
    userId,
    planDate,
    shiftKind,
    shifts,
    roleId,
    roleName,
    shellLoading,
    error,
    setError,
    className = '',
  }: DdsP2pOpViewBodyProps,
  ref: Ref<DdsP2pOpViewBodyHandle>,
) {
  const [matrixQuestions, setMatrixQuestions] = useState<MatrixQuestion[]>([])
  const [cellsByShift, setCellsByShift] = useState<Record<string, Record<string, CellSnapshot>>>({})
  const [shiftColumns, setShiftColumns] = useState<ShiftColumn[]>([])
  const [planStatsByShift, setPlanStatsByShift] = useState<Record<string, ShiftPlanStats>>({})
  const [planStatsLoading, setPlanStatsLoading] = useState(false)
  const [planStatsError, setPlanStatsError] = useState<string | null>(null)
  const [matrixLoading, setMatrixLoading] = useState(false)

  const [viewPrefs, setViewPrefs] = useState<DdsP2pSummaryViewPrefs>(() => buildDefaultP2pSummaryPrefs([], []))
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [prefsDraft, setPrefsDraft] = useState<DdsP2pSummaryViewPrefs>(() => buildDefaultP2pSummaryPrefs([], []))

  const [detailPop, setDetailPop] = useState<{
    top: number
    left: number
    maxW: number
    body: string
  } | null>(null)
  const detailPanelRef = useRef<HTMLDivElement | null>(null)

  const shiftScopes = useMemo(
    () => resolveLastNShifts(planDate, shiftKind, shifts, OP_SHIFT_COUNT),
    [planDate, shiftKind, shifts],
  )

  const questionRows = useMemo(
    () => matrixQuestions.filter((q) => viewPrefs.questions[q.key] !== false),
    [matrixQuestions, viewPrefs.questions],
  )

  const syncPrefsKeys = useCallback(
    (qKeys: string[]) => {
      const stored = loadP2pSummaryViewPrefs(userId, cellId)
      const merged = mergeP2pSummaryViewPrefs(stored, [], qKeys)
      setViewPrefs(merged)
    },
    [cellId, userId],
  )

  const loadMatrix = useCallback(async () => {
    if (!cellId || !shiftKind || !roleId || shiftScopes.length === 0) {
      setMatrixQuestions([])
      setCellsByShift({})
      setShiftColumns([])
      setMatrixLoading(false)
      return
    }
    setMatrixLoading(true)
    setError(null)

    const { data: assignsRaw, error: aErr } = await supabase
      .from('dds_p2p_cell_question_role_assignments')
      .select('question_kind, standard_question_id, soft_question_id, roster_role_id')
      .eq('master_cell_id', cellId)
      .eq('roster_role_id', roleId)
    if (aErr) {
      setError(aErr.message)
      setMatrixLoading(false)
      return
    }
    const assigns = assignsRaw ?? []
    const stdIds = [...new Set(assigns.filter((r) => r.question_kind === 'standard').map((r) => r.standard_question_id as string))]
    const softIds = [...new Set(assigns.filter((r) => r.question_kind === 'soft').map((r) => r.soft_question_id as string))]

    if (stdIds.length === 0 && softIds.length === 0) {
      setMatrixQuestions([])
      setCellsByShift({})
      setShiftColumns(
        shiftScopes.map((s) => ({
          ...s,
          key: plan24ShiftScopeKey(s.planDate, s.shiftKind),
          displayName: shiftDisplayName(s.shiftKind, shifts),
          operatorName: '—',
          submitted: false,
          sheetComment: '',
        })),
      )
      syncPrefsKeys([])
      setMatrixLoading(false)
      return
    }

    const [grpRes, stdRes, softRes, personNames] = await Promise.all([
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
      resolveRolePersonNamesForShifts(cellId, roleId, roleName, shiftScopes),
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
    const subAssignBySoft = new Map<string, string[]>()
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
          .select('soft_question_id, sub_question_id')
          .eq('master_cell_id', cellId)
          .eq('roster_role_id', roleId)
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
        const subId = row.sub_question_id as string
        if (!subAssignBySoft.has(softId)) subAssignBySoft.set(softId, [])
        subAssignBySoft.get(softId)!.push(subId)
      }
    }

    const linkedKpiIds = [...new Set([...stdRows, ...softRows].map((q) => q.linked_kpi_id).filter((id): id is string => Boolean(id)))]
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

    const matrixQ: MatrixQuestion[] = []
    for (const g of groups) {
      const gn = gName.get(g.id) ?? 'Group'
      const stds = stdRows
        .filter((q) => q.kpi_group_id === g.id)
        .sort((a, b) => a.sort_order - b.sort_order || a.prompt.localeCompare(b.prompt))
      const softs = softRows
        .filter((q) => q.kpi_group_id === g.id)
        .sort((a, b) => a.sort_order - b.sort_order || a.prompt.localeCompare(b.prompt))
      for (const q of stds) {
        const rk = q.response_kind === 'number_with_target' ? 'number_with_target' : 'yes_no'
        const tn = rk === 'number_with_target' && q.target_number != null ? Number(q.target_number) : null
        matrixQ.push({
          key: ddsP2pQuestionKey('standard', q.id),
          source: 'standard',
          questionId: q.id,
          groupName: gn,
          prompt: q.prompt,
          responseKind: rk,
          targetNumber: Number.isFinite(tn as number) ? (tn as number) : null,
          linkedKpiLabel: q.linked_kpi_id ? kpiLabelById.get(q.linked_kpi_id) ?? null : null,
          subQuestions: [],
          hasSubQuestions: false,
          assignedSubIds: [],
        })
      }
      for (const q of softs) {
        const rk = q.response_kind === 'number_with_target' ? 'number_with_target' : 'yes_no'
        const tn = rk === 'number_with_target' && q.target_number != null ? Number(q.target_number) : null
        const subs = subBySoftId.get(q.id) ?? []
        matrixQ.push({
          key: ddsP2pQuestionKey('soft', q.id),
          source: 'soft',
          questionId: q.id,
          groupName: gn,
          prompt: q.prompt,
          responseKind: rk,
          targetNumber: Number.isFinite(tn as number) ? (tn as number) : null,
          linkedKpiLabel: q.linked_kpi_id ? kpiLabelById.get(q.linked_kpi_id) ?? null : null,
          subQuestions: subs,
          hasSubQuestions: subs.length > 0,
          assignedSubIds: subAssignBySoft.get(q.id) ?? [],
        })
      }
    }

    syncPrefsKeys(matrixQ.map((q) => q.key))

    const orFilter = shiftScopes
      .map((s) => `and(plan_date.eq.${s.planDate},shift_kind.eq.${s.shiftKind})`)
      .join(',')
    const { data: auditsRaw, error: audErr } = await supabase
      .from('dds_p2p_audits')
      .select('id, plan_date, shift_kind, submitted_at, sheet_comment')
      .eq('master_cell_id', cellId)
      .eq('roster_role_id', roleId)
      .or(orFilter)
      .order('submitted_at', { ascending: false })
    if (audErr) {
      setError(audErr.message)
      setMatrixLoading(false)
      return
    }

    const latestByShift = new Map<string, { id: string; sheet_comment: string | null }>()
    for (const row of auditsRaw ?? []) {
      const key = plan24ShiftScopeKey(row.plan_date as string, row.shift_kind as string)
      if (!latestByShift.has(key)) {
        latestByShift.set(key, { id: row.id as string, sheet_comment: (row.sheet_comment as string | null) ?? null })
      }
    }

    const auditIds = [...new Set([...latestByShift.values()].map((v) => v.id))]
    const nextCells: Record<string, Record<string, CellSnapshot>> = {}
    for (const scope of shiftScopes) {
      nextCells[plan24ShiftScopeKey(scope.planDate, scope.shiftKind)] = {}
    }

    if (auditIds.length > 0) {
      const subQuestionIds = [...new Set(matrixQ.flatMap((q) => (q.hasSubQuestions ? q.subQuestions.map((s) => s.id) : [])))]
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
      if (ansRes.error || subAnsRes.error) {
        setError(ansRes.error?.message ?? subAnsRes.error?.message ?? 'Load failed')
        setMatrixLoading(false)
        return
      }

      type SubAnsRow = {
        audit_id: string
        sub_question_id: string
        answer_yes_no: boolean
        question_comment: string | null
      }
      const subAnsRows = (subAnsRes.data ?? []) as SubAnsRow[]
      const auditToShift = new Map<string, string>()
      for (const [key, v] of latestByShift) auditToShift.set(v.id, key)

      const subPromptById = new Map<string, string>()
      for (const q of matrixQ) {
        for (const sq of q.subQuestions) subPromptById.set(sq.id, sq.prompt)
      }

      const byAudit = new Map<string, NonNullable<typeof ansRes.data>>()
      for (const ar of ansRes.data ?? []) {
        const aid = ar.audit_id as string
        if (!byAudit.has(aid)) byAudit.set(aid, [])
        byAudit.get(aid)!.push(ar)
      }

      const subByAudit = new Map<string, SubAnsRow[]>()
      for (const ar of subAnsRows) {
        const aid = ar.audit_id as string
        if (!subByAudit.has(aid)) subByAudit.set(aid, [])
        subByAudit.get(aid)!.push(ar)
      }

      for (const [auditId, rows] of byAudit) {
        const shiftKey = auditToShift.get(auditId)
        if (!shiftKey || !nextCells[shiftKey]) continue
        for (const row of rows ?? []) {
          const kind = row.question_kind as 'standard' | 'soft'
          const qid = kind === 'standard' ? (row.standard_question_id as string) : (row.soft_question_id as string)
          const qk = ddsP2pQuestionKey(kind, qid)
          const mq = matrixQ.find((x) => x.key === qk)
          if (!mq || mq.hasSubQuestions) continue
          const qc = String((row.question_comment as string | null) ?? '').trim()
          const klc = String((row.kpi_link_comment as string | null) ?? '').trim()
          nextCells[shiftKey][qk] = {
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
        const shiftKey = auditToShift.get(auditId)
        if (!shiftKey || !nextCells[shiftKey]) continue
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
          const allowed = new Set(mq.assignedSubIds)
          const filtered = subSnaps.filter((s) => allowed.has(s.subQuestionId))
          const yesCount = filtered.filter((s) => s.yesNo === true).length
          const noCount = filtered.filter((s) => s.yesNo === false).length
          nextCells[shiftKey][qk] = {
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

    for (const scope of shiftScopes) {
      const shiftKey = plan24ShiftScopeKey(scope.planDate, scope.shiftKind)
      const submitted = latestByShift.has(shiftKey)
      if (!submitted) continue
      for (const q of matrixQ) {
        if (nextCells[shiftKey]?.[q.key]) continue
        if (q.hasSubQuestions) {
          nextCells[shiftKey][q.key] = {
            responseKind: q.responseKind,
            yesNo: null,
            num: null,
            comment: '',
            subAnswers: [],
            yesCount: 0,
            noCount: 0,
          }
        } else if (q.responseKind === 'yes_no') {
          nextCells[shiftKey][q.key] = {
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
    }

    const columns: ShiftColumn[] = shiftScopes.map((s) => {
      const key = plan24ShiftScopeKey(s.planDate, s.shiftKind)
      const audit = latestByShift.get(key)
      const sheet = audit?.sheet_comment?.trim() ?? ''
      return {
        ...s,
        key,
        displayName: shiftDisplayName(s.shiftKind, shifts),
        operatorName: personNames.get(key) ?? '—',
        submitted: Boolean(audit),
        sheetComment: sheet,
      }
    })

    setMatrixQuestions(matrixQ)
    setCellsByShift(nextCells)
    setShiftColumns(columns)
    setMatrixLoading(false)
  }, [cellId, roleId, roleName, setError, shiftKind, shiftScopes, shifts, syncPrefsKeys])

  useEffect(() => {
    void loadMatrix()
  }, [loadMatrix])

  useEffect(() => {
    return subscribeDdsP2pKpiRollupDone((d) => {
      if (d.masterCellId !== cellId) return
      if (!shiftScopes.some((s) => s.planDate === d.planDate && s.shiftKind === d.shiftKind)) return
      void loadMatrix()
    })
  }, [cellId, loadMatrix, shiftScopes])

  useEffect(() => {
    if (!cellId || !roleName.trim() || shiftScopes.length === 0) {
      setPlanStatsByShift({})
      return
    }
    let cancelled = false
    async function loadPlanStats() {
      setPlanStatsLoading(true)
      setPlanStatsError(null)
      try {
        const uniqueDates = [...new Set(shiftScopes.map((s) => s.planDate))]
        const boundsList = uniqueDates.map((d) => planDateUtcBounds(d))
        const rangeStart = boundsList.reduce((min, b) => (b.start < min ? b.start : min), boundsList[0]!.start)
        const rangeEnd = boundsList.reduce((max, b) => (b.end > max ? b.end : max), boundsList[0]!.end)
        const orEventFilter = shiftScopes
          .map((s) => `and(plan_date.eq.${s.planDate},shift_kind.eq.${s.shiftKind})`)
          .join(',')

        const [evRes, defRes, devRes, qfRes] = await Promise.all([
          supabase
            .from('plan24_events')
            .select(
              'id, title, start_at, end_at, sub_tasks, plan_date, shift_kind, event_type, status, role_name, linked_issue_kind, linked_issue_id, cil_template_id',
            )
            .eq('master_cell_id', cellId)
            .is('deleted_at', null)
            .in('event_type', ['check', 'cl_check', 'cil_check', 'quality_check'])
            .or(orEventFilter),
          supabase
            .from('dh_defects')
            .select('id, title, description, status, priority, cil_template_id, cil_template_task_id, plan24_event_id, role_name, created_at')
            .eq('master_cell_id', cellId)
            .is('deleted_at', null)
            .gte('created_at', rangeStart)
            .lt('created_at', rangeEnd),
          supabase
            .from('deviations')
            .select('id, title, description, status, priority, plan24_event_id, role_name, plan24_sub_task_id, created_at')
            .eq('master_cell_id', cellId)
            .is('deleted_at', null)
            .gte('created_at', rangeStart)
            .lt('created_at', rangeEnd),
          supabase
            .from('quality_fails')
            .select('id, title, description, status, priority, plan24_event_id, role_name, plan24_sub_task_id, created_at')
            .eq('master_cell_id', cellId)
            .is('deleted_at', null)
            .gte('created_at', rangeStart)
            .lt('created_at', rangeEnd),
        ])
        if (cancelled) return
        if (evRes.error) throw evRes.error
        if (defRes.error) throw defRes.error
        if (devRes.error) throw devRes.error
        if (qfRes.error) throw qfRes.error

        const allEvents = (evRes.data ?? []) as PlanStatsEventRow[]
        const allDefects = (defRes.data ?? []) as ShiftPlanStats['defects'] & {
          title: string
          description: string | null
          status: string
          priority: string
        }[]
        const allDeviations = (devRes.data ?? []) as {
          id: string
          title: string
          description: string | null
          status: string
          priority: string
          plan24_event_id: string | null
          role_name: string | null
          plan24_sub_task_id: string | null
        }[]
        const allQualityFails = (qfRes.data ?? []) as {
          id: string
          title: string
          description: string | null
          status: string
          priority: string
          plan24_event_id: string | null
          role_name: string | null
          plan24_sub_task_id: string | null
        }[]

        const next: Record<string, ShiftPlanStats> = {}
        for (const scope of shiftScopes) {
          const key = plan24ShiftScopeKey(scope.planDate, scope.shiftKind)
          const { start, end } = planDateUtcBounds(scope.planDate)
          const events = allEvents.filter((e) => e.plan_date === scope.planDate && e.shift_kind === scope.shiftKind)
          const defects = allDefects.filter((d) => {
            const created = d.created_at
            if (!created) return false
            return created >= start && created < end
          })
          const deviations = allDeviations.filter((d) => {
            const created = (d as { created_at?: string }).created_at
            if (!created) return false
            return created >= start && created < end
          })
          const qualityFails = allQualityFails.filter((f) => {
            const created = (f as { created_at?: string }).created_at
            if (!created) return false
            return created >= start && created < end
          })

          const devIds = [
            ...new Set(
              events
                .filter((e) => (e.linked_issue_kind ?? '').toLowerCase() === 'deviation' && e.linked_issue_id)
                .map((e) => e.linked_issue_id as string),
            ),
          ]
          const failIds = [
            ...new Set(
              events
                .filter((e) => (e.linked_issue_kind ?? '').toLowerCase() === 'quality_fail' && e.linked_issue_id)
                .map((e) => e.linked_issue_id as string),
            ),
          ]
          const linkedDefectIds = [
            ...new Set(
              events
                .filter((e) => (e.linked_issue_kind ?? '').toLowerCase() === 'dh_defect' && e.linked_issue_id)
                .map((e) => e.linked_issue_id as string),
            ),
          ]

          const devMap: ShiftPlanStats['deviationById'] = {}
          for (const row of deviations) devMap[String(row.id)] = row
          const failMap: ShiftPlanStats['failById'] = {}
          for (const row of qualityFails) failMap[String(row.id)] = row
          const defectMap: ShiftPlanStats['defectById'] = {}
          for (const row of defects) defectMap[String(row.id)] = row as any

          next[key] = {
            events,
            defects,
            taskDeviations: deviations.map((d) => ({
              id: d.id,
              plan24_event_id: d.plan24_event_id,
              role_name: d.role_name,
              plan24_sub_task_id: d.plan24_sub_task_id,
            })),
            taskQualityFails: qualityFails.map((f) => ({
              id: f.id,
              plan24_event_id: f.plan24_event_id,
              role_name: f.role_name,
              plan24_sub_task_id: f.plan24_sub_task_id,
            })),
            deviationById: devMap,
            defectById: defectMap,
            failById: failMap,
          }

          if (devIds.length || failIds.length || linkedDefectIds.length) {
            const [linkedDevRes, linkedQfRes] = await Promise.all([
              devIds.length
                ? supabase.from('deviations').select('id, title, description, status, priority').in('id', devIds)
                : Promise.resolve({ data: [], error: null }),
              failIds.length
                ? supabase.from('quality_fails').select('id, title, description, status, priority').in('id', failIds)
                : Promise.resolve({ data: [], error: null }),
            ])
            if (cancelled) return
            if (linkedDevRes.error || linkedQfRes.error) throw linkedDevRes.error ?? linkedQfRes.error
            for (const row of (linkedDevRes.data ?? []) as any[]) {
              if (!next[key].deviationById[String(row.id)]) next[key].deviationById[String(row.id)] = row
            }
            for (const row of (linkedQfRes.data ?? []) as any[]) {
              if (!next[key].failById[String(row.id)]) next[key].failById[String(row.id)] = row
            }
            for (const id of linkedDefectIds) {
              if (next[key].defectById[id]) continue
              const extra = await supabase.from('dh_defects').select('id, title, description, status, priority').eq('id', id).maybeSingle()
              if (extra.error) throw extra.error
              if (extra.data) next[key].defectById[String(extra.data.id)] = extra.data as any
            }
          }
        }
        if (cancelled) return
        setPlanStatsByShift(next)
      } catch (e) {
        if (cancelled) return
        setPlanStatsError(e instanceof Error ? e.message : 'Could not load plan stats')
        setPlanStatsByShift({})
      } finally {
        if (!cancelled) setPlanStatsLoading(false)
      }
    }
    void loadPlanStats()
    return () => {
      cancelled = true
    }
  }, [cellId, roleName, shiftScopes])

  useEffect(() => {
    setDetailPop(null)
  }, [planDate, shiftKind, cellId, roleId])

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
    const qKeys = matrixQuestions.map((q) => q.key)
    setPrefsDraft(mergeP2pSummaryViewPrefs(viewPrefs, [], qKeys))
    setPrefsOpen(true)
  }, [matrixQuestions, viewPrefs])

  useImperativeHandle(ref, () => ({ openPrefs }), [openPrefs])

  const roleColSubmittedClass =
    'bg-emerald-500/[0.06] shadow-[inset_0_0_0_1px_rgba(5,150,105,0.28)] dark:bg-emerald-500/[0.11] dark:shadow-[inset_0_0_0_1px_rgba(52,211,153,0.32)]'

  const visibleSubmittedCount = shiftColumns.filter((c) => c.submitted).length

  function buildIncompleteList(stats: ShiftPlanStats, eventType: string): string[] {
    const rows = stats.events.filter((e) => (e.role_name ?? '').trim() === roleName.trim() && e.event_type === eventType)
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

  function buildIssueList(stats: ShiftPlanStats, planDateForShift: string, kind: 'deviation' | 'dh_defect' | 'quality_fail'): string[] {
    const rows = stats.events.filter((e) => p2pPlanEventMatchesRole(e.role_name, roleName))
    const ids = rows
      .filter((e) => (e.linked_issue_kind ?? '').toLowerCase() === kind && e.linked_issue_id)
      .map((e) => e.linked_issue_id as string)
    const uniq = [...new Set(ids)]
    if (kind === 'deviation') {
      for (const d of stats.taskDeviations) {
        if (!planTaskIssueBelongsToRole(d, stats.events, planDateForShift, roleName, 'cl_check')) continue
        if (!uniq.includes(d.id)) uniq.push(d.id)
      }
    } else if (kind === 'dh_defect') {
      for (const d of stats.defects) {
        if (!cilDefectBelongsToRole(d, stats.events, planDateForShift, roleName)) continue
        if (!uniq.includes(d.id)) uniq.push(d.id)
      }
    } else if (kind === 'quality_fail') {
      for (const f of stats.taskQualityFails) {
        if (!planTaskIssueBelongsToRole(f, stats.events, planDateForShift, roleName, 'quality_check')) continue
        if (!uniq.includes(f.id)) uniq.push(f.id)
      }
    }
    if (uniq.length === 0) return ['None raised.']

    const map =
      kind === 'deviation' ? stats.deviationById : kind === 'quality_fail' ? stats.failById : stats.defectById
    return uniq.map((id) => {
      const row = map[id]
      if (!row) return `• ${id}`
      const desc = row.description?.trim()
      const tail = desc ? ` — ${desc}` : ''
      return `• ${row.title}${tail} (${row.status}, ${row.priority})`
    })
  }

  function planCompletionForShift(stats: ShiftPlanStats, planDateForShift: string) {
    const fams = buildP2pPlanFamilyTrends(stats.events, planDateForShift, roleName)
    const get = (key: 'cl' | 'cil' | 'quality' | 'check') => fams.find((f) => f.key === key)?.todayPct ?? 0
    return { cl: get('cl'), cil: get('cil'), quality: get('quality'), check: get('check') }
  }

  function planIssueCountsForShift(stats: ShiftPlanStats, planDateForShift: string) {
    const rows = buildP2pPlanRoleIssueCounts(stats.events, planDateForShift, [roleName])
    const base = rows.find((r) => r.roleName === roleName) ?? { deviations: 0, defects: 0, qualityFails: 0 }
    return {
      deviations: base.deviations + countUnlinkedTaskIssuesForRole(stats.taskDeviations, stats.events, planDateForShift, roleName, 'cl_check'),
      defects: base.defects + countUnlinkedCilDefectsForRole(stats.defects, stats.events, planDateForShift, roleName),
      qualityFails:
        base.qualityFails +
        countUnlinkedTaskIssuesForRole(stats.taskQualityFails, stats.events, planDateForShift, roleName, 'quality_check'),
    }
  }

  return (
    <div className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${className}`.trim()}>
      {error ? <p className={ddsErr}>{error}</p> : null}
      {planStatsError ? <p className={ddsErr}>{planStatsError}</p> : null}

      {shellLoading ? (
        <p className="flex items-center gap-1 text-xs text-muted" role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading roster…
        </p>
      ) : shifts.length === 0 || !roleId ? (
        <p className="text-xs text-muted">
          {!roleId ? 'Select a role to view operator P2P history.' : 'No Plan 24 shifts for this cell.'}
        </p>
      ) : matrixLoading ? (
        <p className="flex items-center gap-1 text-xs text-muted" role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading matrix…
        </p>
      ) : matrixQuestions.length === 0 ? (
        <p className="text-xs text-muted">
          No P2P questions assigned to {roleName || 'this role'}. Configure under{' '}
          <Link to="/dds-process/admin/p2p-setup" className="font-medium text-accent underline-offset-2 hover:underline">
            Admin → P2P set-up
          </Link>
          .
        </p>
      ) : questionRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-raised/30 p-2 text-center text-xs text-muted">
          <p className="text-fg/80">All questions are hidden.</p>
          <p className="mt-1">Open view preferences and enable at least one question.</p>
        </div>
      ) : (
        <>
          <div className="mt-1 min-h-0 flex-1 overflow-auto rounded-lg border border-border/70 bg-surface shadow-inner">
            <table className={TABLE_CLASS}>
              <thead>
                <tr>
                  <th className={QUESTION_TH_CLASS} scope="col">
                    <span className="block text-[9px] uppercase tracking-wide">{roleName}</span>
                    <span className="block text-[9px] font-medium normal-case text-muted/80">
                      {visibleSubmittedCount}/{shiftColumns.length} submitted · {questionRows.length} Q · last {OP_SHIFT_COUNT} shifts
                    </span>
                  </th>
                  {shiftColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`${SHIFT_TH_CLASS} ${col.submitted ? roleColSubmittedClass : ''}`}
                      scope="col"
                      title={col.submitted ? 'P2P submitted' : 'P2P not submitted'}
                    >
                      <span className="mx-auto flex min-w-0 flex-col items-center gap-0.5">
                        <span className="flex items-center gap-1">
                          <span
                            className={`size-1.5 shrink-0 rounded-full ${col.submitted ? 'bg-emerald-500' : 'bg-amber-400'}`}
                            aria-hidden
                          />
                          <span className="truncate font-semibold tabular-nums">{formatShiftHeaderDate(col.planDate)}</span>
                        </span>
                        <span className="truncate text-[9px] font-medium text-muted">{col.displayName}</span>
                        <span className="max-w-full truncate text-[9px] font-normal text-fg/80" title={col.operatorName}>
                          {col.operatorName}
                        </span>
                      </span>
                    </th>
                  ))}
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
                    <th scope="row" className={ROW_LABEL_CLASS}>
                      {r.label}
                    </th>
                    {shiftColumns.map((col) => {
                      const stats = planStatsByShift[col.key]
                      const showLoading = planStatsLoading && !stats
                      const comp = stats ? planCompletionForShift(stats, col.planDate) : null
                      const issueRow = stats ? planIssueCountsForShift(stats, col.planDate) : null
                      const colClass = col.submitted ? roleColSubmittedClass : ''
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
                          <td key={col.key} className={`${CELL_CLASS} ${colClass}`}>
                            {pct == null || tone == null || !stats ? (
                              <span className="text-muted">—</span>
                            ) : (
                              <button
                                type="button"
                                className="inline-flex items-center justify-center gap-0.5 rounded px-0.5 py-0 hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 dark:hover:bg-white/[0.06]"
                                title="Click to view incomplete checks"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const pos = placeDetailPanel(e.currentTarget, 360)
                                  const lines = buildIncompleteList(stats, eventType)
                                  setDetailPop({
                                    ...pos,
                                    body: [`${formatShiftHeaderDate(col.planDate)} ${col.displayName} — ${r.label}`, '', ...lines].join('\n'),
                                  })
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
                          ? issueRow?.deviations ?? 0
                          : r.kind === 'defects'
                            ? issueRow?.defects ?? 0
                            : r.kind === 'qualityFails'
                              ? issueRow?.qualityFails ?? 0
                              : 0
                      return (
                        <td key={col.key} className={`${CELL_CLASS} ${colClass}`}>
                          {showLoading || !stats ? (
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
                                const lines = buildIssueList(stats, col.planDate, kind)
                                setDetailPop({
                                  ...pos,
                                  body: [`${formatShiftHeaderDate(col.planDate)} ${col.displayName} — ${r.label}`, '', ...lines].join('\n'),
                                })
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
                    <th scope="row" className={QUESTION_ROW_CLASS} title={`${q.groupName} — ${q.prompt}`}>
                      <span className="line-clamp-2 text-[10px]">
                        <span className="font-semibold text-muted">{q.groupName}: </span>
                        <span className="text-fg">{q.prompt}</span>
                      </span>
                    </th>
                    {shiftColumns.map((col) => {
                      const snap = cellsByShift[col.key]?.[q.key]
                      const cmt = snap?.comment?.trim() ?? ''
                      const hasCmt = Boolean(cmt)
                      const hoverLines = q.hasSubQuestions ? buildSubNoHoverLines(snap?.subAnswers ?? []) : []
                      const hoverTitle = hoverLines.join('\n')
                      const yesDetailLines = q.hasSubQuestions ? buildSubYesDetailLines(snap?.subAnswers ?? []) : []
                      const colClass = col.submitted ? roleColSubmittedClass : ''
                      let main: ReactNode = '\u00a0'
                      if (q.hasSubQuestions) {
                        if (col.submitted || snap != null) {
                          main = (
                            <DdsP2pSubYesNoSummary
                              yesCount={snap?.yesCount ?? 0}
                              noCount={snap?.noCount ?? 0}
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
                        } else if (col.submitted || snap != null) {
                          main = <span className="font-bold text-emerald-600">N</span>
                        }
                      } else if (snap != null && snap.num != null && Number.isFinite(snap.num)) {
                        main = <span className="tabular-nums text-fg">{formatNum(snap.num)}</span>
                      }
                      return (
                        <td key={col.key} className={`${CELL_CLASS} ${colClass}`}>
                          <div
                            className={`${VALUE_WRAP_CLASS} ${q.hasSubQuestions && hoverTitle ? 'relative' : ''}`}
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
                  <th scope="row" className={ROW_LABEL_CLASS}>
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-muted">P2P </span>
                    Overall comment
                  </th>
                  {shiftColumns.map((col) => {
                    const hasSheet = Boolean(col.sheetComment)
                    const colClass = col.submitted ? roleColSubmittedClass : ''
                    return (
                      <td key={col.key} className={`${CELL_CLASS} ${colClass}`}>
                        <div className={VALUE_WRAP_CLASS}>
                          {hasSheet ? (
                            <span className="font-bold text-rose-600">N</span>
                          ) : col.submitted ? (
                            <span className="font-bold text-emerald-600">Y</span>
                          ) : (
                            <span className="text-muted">—</span>
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
                                body: hasSheet ? col.sheetComment : '—',
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
            aria-labelledby="p2p-op-prefs-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="p2p-op-prefs-title" className="font-display text-lg font-semibold">
              P2P Op view
            </h2>
            <p className="mt-1 text-xs text-muted">
              Choose which questions appear in the matrix. Uses the same saved preferences as P2P Summary (questions only).
            </p>

            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Questions</p>
              <div className="max-h-[50vh] space-y-2 overflow-y-auto rounded-xl border border-border bg-surface-raised/40 p-3">
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
