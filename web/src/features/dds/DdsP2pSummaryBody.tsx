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
import { ddsErr } from './ddsAdminCompactClasses'
import {
  buildP2pPlanFamilyTrends,
  buildP2pPlanRoleIssueCounts,
  countUnlinkedCilDefectsForRole,
  p2pPlanCompletionTone,
  p2pPlanRaisedCountClass,
  planDateUtcBounds,
  type P2pPlanEventRow,
} from './ddsP2pPlanDayStats'

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
  roleIds: Set<string>
}

type CellSnapshot = {
  responseKind: DdsP2pResponseKind
  yesNo: boolean | null
  num: number | null
  comment: string
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
    { id: string; cil_template_id: string | null; cil_template_task_id: string | null }[]
  >([])
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
        const [evRes, defRes] = await Promise.all([
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
            .select('id, title, description, status, priority, cil_template_id, cil_template_task_id, created_at')
            .eq('master_cell_id', cellId)
            .is('deleted_at', null)
            .gte('created_at', start)
            .lt('created_at', end),
        ])
        if (cancelled) return
        if (evRes.error) throw evRes.error
        if (defRes.error) throw defRes.error
        const evs = (evRes.data ?? []) as PlanStatsEventRow[]
        const defects = (defRes.data ?? []) as {
          id: string
          title: string
          description: string | null
          status: string
          priority: string
          cil_template_id: string | null
          cil_template_task_id: string | null
        }[]
        setPlanStatsEvents(evs)
        setPlanStatsDefects(defects)

        const devIds = [...new Set(evs.filter((e) => (e.linked_issue_kind ?? '').toLowerCase() === 'deviation' && e.linked_issue_id).map((e) => e.linked_issue_id as string))]
        const failIds = [
          ...new Set(evs.filter((e) => (e.linked_issue_kind ?? '').toLowerCase() === 'quality_fail' && e.linked_issue_id).map((e) => e.linked_issue_id as string)),
        ]
        const linkedDefectIds = [
          ...new Set(evs.filter((e) => (e.linked_issue_kind ?? '').toLowerCase() === 'dh_defect' && e.linked_issue_id).map((e) => e.linked_issue_id as string)),
        ]

        const [devRes, qfRes] = await Promise.all([
          devIds.length
            ? supabase.from('deviations').select('id, title, description, status, priority').in('id', devIds)
            : Promise.resolve({ data: [], error: null }),
          failIds.length
            ? supabase.from('quality_fails').select('id, title, description, status, priority').in('id', failIds)
            : Promise.resolve({ data: [], error: null }),
        ])
        if (cancelled) return
        const derr = devRes.error ?? qfRes.error
        if (derr) throw derr

        const devMap: Record<string, { id: string; title: string; description: string | null; status: string; priority: string }> = {}
        for (const row of (devRes.data ?? []) as any[]) devMap[String(row.id)] = row
        setPlanStatsDeviationById(devMap)

        const failMap: Record<string, { id: string; title: string; description: string | null; status: string; priority: string }> = {}
        for (const row of (qfRes.data ?? []) as any[]) failMap[String(row.id)] = row
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
    const rows = planStatsEvents.filter((e) => (e.role_name ?? '').trim() === roleName.trim())
    const ids = rows
      .filter((e) => (e.linked_issue_kind ?? '').toLowerCase() === kind && e.linked_issue_id)
      .map((e) => e.linked_issue_id as string)
    const uniq = [...new Set(ids)]
    if (kind === 'dh_defect') {
      // Include task-level unlinked defects for the same CIL templates on this day.
      const tplIds = new Set(
        rows
          .filter((e) => e.event_type === 'cil_check' && e.cil_template_id)
          .map((e) => e.cil_template_id as string),
      )
      for (const d of planStatsDefects) {
        if (!d.cil_template_id || !d.cil_template_task_id) continue
        if (!tplIds.has(d.cil_template_id)) continue
        if (!uniq.includes(d.id)) uniq.push(d.id)
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
        ? supabase.from('dds_p2p_standard_questions').select('id, kpi_group_id, prompt, sort_order, response_kind, target_number').in('id', stdIds)
        : Promise.resolve({ data: [], error: null }),
      softIds.length
        ? supabase
            .from('dds_p2p_cell_soft_point_questions')
            .select('id, kpi_group_id, prompt, sort_order, response_kind, target_number')
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
    }
    const stdRows = (stdRes.data ?? []) as QRow[]
    const softRows = (softRes.data ?? []) as QRow[]
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
          roleIds,
        })
      }
      for (const q of softs) {
        const rk = q.response_kind === 'number_with_target' ? 'number_with_target' : 'yes_no'
        const tn = rk === 'number_with_target' && q.target_number != null ? Number(q.target_number) : null
        const key = ddsP2pQuestionKey('soft', q.id)
        const roleIds = assignByKey.get(key)
        if (!roleIds || roleIds.size === 0) continue
        matrixQ.push({
          key,
          source: 'soft',
          questionId: q.id,
          groupName: gn,
          prompt: q.prompt,
          responseKind: rk,
          targetNumber: Number.isFinite(tn as number) ? (tn as number) : null,
          roleIds,
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
      const { data: ansRows, error: ansErr } = await supabase
        .from('dds_p2p_audit_answers')
        .select('audit_id, question_kind, standard_question_id, soft_question_id, answer_yes_no, answer_number, question_comment')
        .in('audit_id', auditIds)
      if (ansErr) {
        setError(ansErr.message)
        setMatrixLoading(false)
        return
      }

      const auditToRole = new Map<string, string>()
      for (const [rid, v] of latestByRole) auditToRole.set(v.id, rid)

      const byAudit = new Map<string, typeof ansRows>()
      for (const ar of ansRows ?? []) {
        const aid = ar.audit_id as string
        if (!byAudit.has(aid)) byAudit.set(aid, [])
        byAudit.get(aid)!.push(ar)
      }

      for (const [auditId, rows] of byAudit) {
        const rid = auditToRole.get(auditId)
        if (!rid || !nextCells[rid]) continue
        for (const row of rows ?? []) {
          const kind = row.question_kind as 'standard' | 'soft'
          const qid = kind === 'standard' ? (row.standard_question_id as string) : (row.soft_question_id as string)
          const qk = ddsP2pQuestionKey(kind, qid)
          const mq = matrixQ.find((x) => x.key === qk)
          if (!mq) continue
          nextCells[rid][qk] = {
            responseKind: mq.responseKind,
            yesNo: typeof row.answer_yes_no === 'boolean' ? row.answer_yes_no : null,
            num: (() => {
              const n = row.answer_number
              if (n == null) return null
              const v = Number(n)
              return Number.isFinite(v) ? v : null
            })(),
            comment: (row.question_comment as string | null) ?? '',
          }
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
    'shadow-[inset_0_0_0_2px_rgba(5,150,105,0.55)] bg-emerald-500/[0.07] dark:shadow-[inset_0_0_0_2px_rgba(52,211,153,0.45)] dark:bg-emerald-500/[0.12]'

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
        <div className="rounded-lg border border-dashed border-border bg-surface-raised/30 p-4 text-center text-xs text-muted">
          <p className="text-fg/80">All roles or questions are hidden.</p>
          {prefsHint}
        </div>
      ) : (
        <>
          <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-lg border border-border/70">
            <table className="w-max min-w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-border bg-surface-raised/50">
                  <th
                    className="sticky left-0 z-[2] min-w-[10rem] max-w-[14rem] border-r border-border/80 bg-surface-raised/95 px-2 py-1.5 font-semibold text-muted backdrop-blur-sm"
                    scope="col"
                  >
                    Question
                  </th>
                  {roleCols.map((r) => {
                    const submitted = submittedRoleIds.has(r.id)
                    return (
                      <th
                        key={r.id}
                        className={`min-w-[4.5rem] whitespace-nowrap px-1.5 py-1.5 text-center font-semibold text-fg ${
                          submitted ? roleColSubmittedClass : ''
                        }`}
                        scope="col"
                        title={submitted ? 'P2P submitted for this role' : 'P2P not submitted yet'}
                      >
                        {r.name}
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
                  <tr
                    key={`${r.label}-${ix}`}
                    className="border-b border-border/50 odd:bg-surface/40 bg-surface-raised/20"
                  >
                    <th
                      scope="row"
                      className="sticky left-0 z-[1] max-w-[14rem] border-r border-border/80 bg-surface px-2 py-1.5 text-left align-middle font-semibold leading-snug backdrop-blur-sm"
                    >
                      {r.label}
                    </th>
                    {roleCols.map((rc) => {
                      const rn = rc.name.trim()
                      const issueRow = planIssueCountByRole.get(rn)
                      const extraDef = planExtraDefectsByRole.get(rn) ?? 0
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
                          <td
                            key={rc.id}
                            className="border-l border-border/40 px-0.5 py-1 text-center align-middle text-[10px]"
                          >
                            {pct == null || tone == null ? (
                              <span className="text-muted">—</span>
                            ) : (
                              <button
                                type="button"
                                className="inline-flex items-center justify-center gap-1 rounded px-1 py-0.5 hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 dark:hover:bg-white/[0.06]"
                                title="Click to view incomplete checks"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const pos = placeDetailPanel(e.currentTarget, 360)
                                  const lines = buildIncompleteList(rn, eventType)
                                  setDetailPop({ ...pos, body: [`${rc.name} — ${r.label}`, '', ...lines].join('\n') })
                                }}
                              >
                                <span className={`inline-block h-2 w-2 rounded ${tone.bar}`} aria-hidden />
                                <span className="tabular-nums font-bold text-black dark:text-black">{pct}%</span>
                              </button>
                            )}
                          </td>
                        )
                      }

                      const count =
                        r.kind === 'deviations'
                          ? issueRow?.deviations ?? 0
                          : r.kind === 'defects'
                            ? (issueRow?.defects ?? 0) + extraDef
                            : r.kind === 'qualityFails'
                              ? issueRow?.qualityFails ?? 0
                              : 0
                      return (
                        <td
                          key={rc.id}
                          className="border-l border-border/40 px-0.5 py-1 text-center align-middle text-[10px]"
                        >
                          {showLoading ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <button
                              type="button"
                              className={`rounded px-1 py-0.5 tabular-nums font-bold hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 dark:hover:bg-white/[0.06] ${p2pPlanRaisedCountClass(count)}`}
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
                  <tr key={q.key} className="border-b border-border/50 odd:bg-surface/40">
                    <th
                      scope="row"
                      className="sticky left-0 z-[1] max-w-[14rem] border-r border-border/80 bg-surface px-2 py-1 text-left align-top font-normal leading-snug backdrop-blur-sm"
                      title={`${q.groupName} — ${q.prompt}`}
                    >
                      <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted">{q.groupName}</span>
                      <span className="text-fg">{q.prompt}</span>
                    </th>
                    {roleCols.map((r) => {
                      const submitted = submittedRoleIds.has(r.id)
                      const colClass = submitted ? roleColSubmittedClass : ''
                      if (!q.roleIds.has(r.id)) {
                        return (
                          <td
                            key={r.id}
                            className={`border-l border-border/40 px-1 py-1 text-center align-middle text-[10px] text-muted ${colClass}`}
                          >
                            N/A
                          </td>
                        )
                      }
                      const snap = cells[r.id]?.[q.key]
                      const cmt = snap?.comment?.trim() ?? ''
                      const hasCmt = Boolean(cmt)
                      let main: ReactNode = '\u00a0'
                      if (q.responseKind === 'yes_no') {
                        if (snap && typeof snap.yesNo === 'boolean') {
                          main =
                            snap.yesNo === true ? (
                              <span className="font-bold text-emerald-600">Y</span>
                            ) : (
                              <span className="font-bold text-rose-600">N</span>
                            )
                        }
                      } else if (snap != null && snap.num != null && Number.isFinite(snap.num)) {
                        main = <span className="tabular-nums text-fg">{formatNum(snap.num)}</span>
                      }
                      return (
                        <td
                          key={r.id}
                          className={`border-l border-border/40 px-0.5 py-0.5 text-center align-middle ${colClass}`}
                        >
                          <div className="inline-flex min-h-[1.75rem] min-w-[3.25rem] items-center justify-center gap-0.5 rounded-md px-1 py-0.5">
                            <span className="tabular-nums">{main}</span>
                            <button
                              type="button"
                              className="inline-flex rounded p-0.5 text-muted hover:bg-black/[0.06] hover:text-fg dark:hover:bg-white/[0.06]"
                              aria-label="Show question comment"
                              onClick={(e) => {
                                e.stopPropagation()
                                const pos = placeDetailPanel(e.currentTarget, 280)
                                setDetailPop({
                                  ...pos,
                                  body: hasCmt ? cmt : '—',
                                })
                              }}
                            >
                              <MessageSquare className={`size-3.5 shrink-0 ${hasCmt ? 'text-accent' : 'text-muted/30'}`} aria-hidden />
                            </button>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="border-b border-border bg-surface-raised/25">
                  <th
                    scope="row"
                    className="sticky left-0 z-[1] max-w-[14rem] border-r border-border/80 bg-surface px-2 py-1.5 text-left align-middle font-semibold text-fg backdrop-blur-sm"
                  >
                    <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted">P2P</span>
                    Overall comment
                  </th>
                  {roleCols.map((r) => {
                    const sheet = sheetCommentByRoleId[r.id]?.trim() ?? ''
                    const hasSheet = Boolean(sheet)
                    const submitted = submittedRoleIds.has(r.id)
                    const colClass = submitted ? roleColSubmittedClass : ''
                    return (
                      <td
                        key={r.id}
                        className={`border-l border-border/40 px-0.5 py-0.5 text-center align-middle ${colClass}`}
                      >
                        <div className="inline-flex min-h-[1.75rem] min-w-[3.25rem] items-center justify-center gap-0.5 rounded-md px-1 py-0.5">
                          {hasSheet ? (
                            <span className="font-bold text-rose-600">N</span>
                          ) : (
                            <span className="font-bold text-emerald-600">Y</span>
                          )}
                          <button
                            type="button"
                            className="inline-flex rounded p-0.5 text-muted hover:bg-black/[0.06] hover:text-fg dark:hover:bg-white/[0.06]"
                            aria-label="Show overall comment"
                            onClick={(e) => {
                              e.stopPropagation()
                              const pos = placeDetailPanel(e.currentTarget, 280)
                              setDetailPop({
                                ...pos,
                                body: hasSheet ? sheet : '—',
                              })
                            }}
                          >
                            <MessageSquare className={`size-3.5 shrink-0 ${hasSheet ? 'text-accent' : 'text-muted/30'}`} aria-hidden />
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
