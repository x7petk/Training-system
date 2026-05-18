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

export type DdsP2pSummaryShiftRow = { kind: string; display_name: string | null; sort_order: number }

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
          <p className="text-[10px] leading-snug text-muted">
            Latest P2P submit per role for this date and shift. Columns with a{' '}
            <span className="font-medium text-emerald-700 dark:text-emerald-400">green frame</span> = form submitted for that role; no frame = not
            submitted yet. Blank = not answered · <span className="text-fg/70">N/A</span> = not assigned to that role ·{' '}
            <span className="font-semibold text-emerald-600">Y</span> / <span className="font-semibold text-rose-600">N</span> in question rows =
            yes / no. <strong className="font-medium text-fg/80">Overall comment</strong> row:{' '}
            <span className="font-semibold text-emerald-600">Y</span> = no overall comment,{' '}
            <span className="font-semibold text-rose-600">N</span> = has overall comment (open the icon to read it).
          </p>
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
