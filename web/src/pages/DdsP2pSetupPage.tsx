import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListChecks } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import {
  buildDefaultViewPrefs,
  loadViewPrefs,
  mergeViewPrefs,
  type Plan24ViewPrefs,
} from '../features/plan24/plan24ViewPrefs'
import { useAuth } from '../hooks/useAuth'
import { labelForDdsP2pResponseKind } from '../features/dds/ddsP2pResponseKind'
import {
  ddsErr,
  ddsHint,
  ddsSection,
  ddsStack,
} from '../features/dds/ddsAdminCompactClasses'

type KpiGroup = { id: string; name: string; sort_order: number }

type StdQ = {
  id: string
  kpi_group_id: string
  prompt: string
  sort_order: number
  response_kind: string
  target_number: number | string | null
}

type SoftQ = {
  id: string
  kpi_group_id: string
  prompt: string
  sort_order: number
  response_kind: string
  target_number: number | string | null
}

type SoftSubQ = {
  id: string
  soft_question_id: string
  prompt: string
  sort_order: number
}

type RosterRole = { id: string; name: string; sort_order: number; is_active: boolean }

type MatrixRow =
  | { rowKind: 'group'; groupId: string; groupName: string }
  | {
      rowKind: 'question'
      groupId: string
      source: 'standard' | 'soft'
      questionId: string
      prompt: string
      subtitle: string
    }
  | {
      rowKind: 'sub_question'
      groupId: string
      softQuestionId: string
      subQuestionId: string
      prompt: string
    }

type AssignmentPick = {
  roster_role_id: string
  question_kind: 'standard' | 'soft'
  standard_question_id: string | null
  soft_question_id: string | null
}

type SubAssignmentPick = {
  roster_role_id: string
  soft_question_id: string
  sub_question_id: string
}

function sortBySortThenName<T extends { sort_order: number; name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

function assignmentKey(roleId: string, source: 'standard' | 'soft', questionId: string): string {
  return `${roleId}:${source}:${questionId}`
}

function subAssignmentKey(roleId: string, subQuestionId: string): string {
  return `${roleId}:sub:${subQuestionId}`
}

export function DdsP2pSetupPage() {
  const { status: scopeStatus, error: scopeError, cellId } = usePlan24Workspace()
  const { isAdmin, user } = useAuth()

  const [kpiGroups, setKpiGroups] = useState<KpiGroup[]>([])
  const [stdByGroup, setStdByGroup] = useState<Map<string, StdQ[]>>(new Map())
  const [softByGroup, setSoftByGroup] = useState<Map<string, SoftQ[]>>(new Map())
  const [subsBySoftId, setSubsBySoftId] = useState<Map<string, SoftSubQ[]>>(new Map())
  const [rosterRoleRows, setRosterRoleRows] = useState<RosterRole[]>([])
  const [assignKeys, setAssignKeys] = useState<Set<string>>(() => new Set())
  const [subAssignKeys, setSubAssignKeys] = useState<Set<string>>(() => new Set())
  const [viewPrefs, setViewPrefs] = useState<Plan24ViewPrefs>(() => buildDefaultViewPrefs([]))

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (scopeStatus !== 'ready' || !cellId) {
      setKpiGroups([])
      setStdByGroup(new Map())
      setSoftByGroup(new Map())
      setSubsBySoftId(new Map())
      setRosterRoleRows([])
      setAssignKeys(new Set())
      setSubAssignKeys(new Set())
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const rosterRes = await supabase
      .from('plan24_rosters')
      .select('id')
      .eq('master_cell_id', cellId)
      .eq('is_active', true)
      .maybeSingle()

    if (rosterRes.error) {
      setError(rosterRes.error.message)
      setLoading(false)
      return
    }

    const rosterId = (rosterRes.data as { id: string } | null)?.id ?? null

    const [grpRes, stdRes, softRes, roleRes, assignRes, subAssignRes] = await Promise.all([
      supabase.from('dds_kpi_groups').select('id, name, sort_order').order('sort_order').order('name'),
      supabase.from('dds_p2p_standard_questions').select('id, kpi_group_id, prompt, sort_order, response_kind, target_number'),
      supabase
        .from('dds_p2p_cell_soft_point_questions')
        .select('id, kpi_group_id, prompt, sort_order, response_kind, target_number')
        .eq('master_cell_id', cellId),
      rosterId
        ? supabase
            .from('plan24_roster_roles')
            .select('id, name, sort_order, is_active')
            .eq('roster_id', rosterId)
            .order('sort_order')
            .order('name')
        : Promise.resolve({ data: [] as RosterRole[], error: null }),
      supabase
        .from('dds_p2p_cell_question_role_assignments')
        .select('roster_role_id, question_kind, standard_question_id, soft_question_id')
        .eq('master_cell_id', cellId),
      supabase
        .from('dds_p2p_cell_soft_sub_question_role_assignments')
        .select('roster_role_id, soft_question_id, sub_question_id')
        .eq('master_cell_id', cellId),
    ])

    const roleResTyped = roleRes as { data: RosterRole[] | null; error: { message: string } | null }
    const qErr = grpRes.error ?? stdRes.error ?? softRes.error ?? roleResTyped.error
    if (qErr) {
      setError(qErr.message)
      setLoading(false)
      return
    }

    if (assignRes.error || subAssignRes.error) {
      setError(assignRes.error?.message ?? subAssignRes.error?.message ?? 'Load failed')
      setLoading(false)
      return
    }

    const groups = sortBySortThenName((grpRes.data ?? []) as KpiGroup[])
    setKpiGroups(groups)

    const stdList = (stdRes.data ?? []) as StdQ[]
    const stdMap = new Map<string, StdQ[]>()
    for (const g of groups) stdMap.set(g.id, [])
    for (const q of stdList) {
      const arr = stdMap.get(q.kpi_group_id)
      if (arr) arr.push(q)
    }
    for (const [, arr] of stdMap) {
      arr.sort((a, b) => a.sort_order - b.sort_order || a.prompt.localeCompare(b.prompt))
    }
    setStdByGroup(stdMap)

    const softList = (softRes.data ?? []) as SoftQ[]
    const softMap = new Map<string, SoftQ[]>()
    for (const g of groups) softMap.set(g.id, [])
    for (const q of softList) {
      const arr = softMap.get(q.kpi_group_id)
      if (arr) arr.push(q)
    }
    for (const [, arr] of softMap) {
      arr.sort((a, b) => a.sort_order - b.sort_order || a.prompt.localeCompare(b.prompt))
    }
    setSoftByGroup(softMap)

    const softIds = softList.map((q) => q.id)
    const subsMap = new Map<string, SoftSubQ[]>()
    if (softIds.length > 0) {
      const { data: subRows, error: subErr } = await supabase
        .from('dds_p2p_cell_soft_point_sub_questions')
        .select('id, soft_question_id, prompt, sort_order')
        .in('soft_question_id', softIds)
        .order('sort_order', { ascending: true })
        .order('prompt', { ascending: true })
      if (subErr) {
        setError(subErr.message)
        setLoading(false)
        return
      }
      for (const row of (subRows ?? []) as SoftSubQ[]) {
        if (!subsMap.has(row.soft_question_id)) subsMap.set(row.soft_question_id, [])
        subsMap.get(row.soft_question_id)!.push(row)
      }
    }
    setSubsBySoftId(subsMap)

    const roleRows = (roleResTyped.data ?? []) as RosterRole[]
    setRosterRoleRows(roleRows)

    const nextKeys = new Set<string>()
    for (const row of (assignRes.data ?? []) as AssignmentPick[]) {
      if (row.question_kind === 'standard' && row.standard_question_id) {
        nextKeys.add(assignmentKey(row.roster_role_id, 'standard', row.standard_question_id))
      }
      if (row.question_kind === 'soft' && row.soft_question_id) {
        nextKeys.add(assignmentKey(row.roster_role_id, 'soft', row.soft_question_id))
      }
    }
    setAssignKeys(nextKeys)

    const nextSubKeys = new Set<string>()
    for (const row of (subAssignRes.data ?? []) as SubAssignmentPick[]) {
      nextSubKeys.add(subAssignmentKey(row.roster_role_id, row.sub_question_id))
    }
    setSubAssignKeys(nextSubKeys)
    setLoading(false)
  }, [cellId, scopeStatus])

  useEffect(() => {
    void load()
  }, [load])

  const matrixRows = useMemo(() => {
    const out: MatrixRow[] = []
    for (const g of kpiGroups) {
      const std = stdByGroup.get(g.id) ?? []
      const soft = softByGroup.get(g.id) ?? []
      if (std.length === 0 && soft.length === 0) continue
      out.push({ rowKind: 'group', groupId: g.id, groupName: g.name })
      for (const q of std) {
        const sub = labelForDdsP2pResponseKind(q.response_kind)
        const extra =
          q.response_kind === 'number_with_target' && q.target_number != null ? ` · target ${q.target_number}` : ''
        out.push({
          rowKind: 'question',
          groupId: g.id,
          source: 'standard',
          questionId: q.id,
          prompt: q.prompt,
          subtitle: sub + extra,
        })
      }
      for (const q of soft) {
        const sub = labelForDdsP2pResponseKind(q.response_kind)
        const extra =
          q.response_kind === 'number_with_target' && q.target_number != null ? ` · target ${q.target_number}` : ''
        const checklist = subsBySoftId.get(q.id) ?? []
        out.push({
          rowKind: 'question',
          groupId: g.id,
          source: 'soft',
          questionId: q.id,
          prompt: q.prompt,
          subtitle:
            checklist.length > 0
              ? `${sub + extra} · ${checklist.length} sub-question${checklist.length === 1 ? '' : 's'}`
              : sub + extra,
        })
        for (const sq of checklist) {
          out.push({
            rowKind: 'sub_question',
            groupId: g.id,
            softQuestionId: q.id,
            subQuestionId: sq.id,
            prompt: sq.prompt,
          })
        }
      }
    }
    return out
  }, [kpiGroups, stdByGroup, softByGroup, subsBySoftId])

  const activeRoles = useMemo(
    () => rosterRoleRows.filter((r) => r.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [rosterRoleRows],
  )

  useEffect(() => {
    if (!cellId) {
      setViewPrefs(buildDefaultViewPrefs([]))
      return
    }
    const roleNames = activeRoles.map((r) => r.name.trim())
    const stored = loadViewPrefs(user?.id, cellId)
    setViewPrefs(mergeViewPrefs(stored, roleNames))
  }, [user?.id, cellId, activeRoles])

  const plan24VisibleRoles = useMemo(
    () => activeRoles.filter((r) => viewPrefs.roles[r.name.trim()] !== false),
    [activeRoles, viewPrefs],
  )

  async function clearSubAssignmentsForSoft(roleId: string, softQuestionId: string) {
    if (!cellId) return
    const { error: delErr } = await supabase
      .from('dds_p2p_cell_soft_sub_question_role_assignments')
      .delete()
      .eq('master_cell_id', cellId)
      .eq('roster_role_id', roleId)
      .eq('soft_question_id', softQuestionId)
    if (delErr) throw new Error(delErr.message)
    const subs = subsBySoftId.get(softQuestionId) ?? []
    setSubAssignKeys((prev) => {
      const n = new Set(prev)
      for (const sq of subs) n.delete(subAssignmentKey(roleId, sq.id))
      return n
    })
  }

  async function assignAllSubsForSoft(roleId: string, softQuestionId: string) {
    if (!cellId) return
    const subs = subsBySoftId.get(softQuestionId) ?? []
    if (subs.length === 0) return
    const rows = subs.map((sq) => ({
      master_cell_id: cellId,
      roster_role_id: roleId,
      soft_question_id: softQuestionId,
      sub_question_id: sq.id,
    }))
    const { error: insErr } = await supabase.from('dds_p2p_cell_soft_sub_question_role_assignments').insert(rows)
    if (insErr) throw new Error(insErr.message)
    setSubAssignKeys((prev) => {
      const n = new Set(prev)
      for (const sq of subs) n.add(subAssignmentKey(roleId, sq.id))
      return n
    })
  }

  async function toggleCell(roleId: string, row: Extract<MatrixRow, { rowKind: 'question' }>, next: boolean) {
    if (!cellId || !isAdmin) return
    const k = assignmentKey(roleId, row.source, row.questionId)
    const opKey = `${k}:${next ? 'on' : 'off'}`
    setBusyKey(opKey)
    setError(null)

    try {
      if (next) {
        if (row.source === 'standard') {
          const { error: insErr } = await supabase.from('dds_p2p_cell_question_role_assignments').insert({
            master_cell_id: cellId,
            roster_role_id: roleId,
            question_kind: 'standard',
            standard_question_id: row.questionId,
            soft_question_id: null,
          })
          if (insErr) throw new Error(insErr.message)
        } else {
          const { error: insErr } = await supabase.from('dds_p2p_cell_question_role_assignments').insert({
            master_cell_id: cellId,
            roster_role_id: roleId,
            question_kind: 'soft',
            standard_question_id: null,
            soft_question_id: row.questionId,
          })
          if (insErr) throw new Error(insErr.message)
          await assignAllSubsForSoft(roleId, row.questionId)
        }
        setAssignKeys((prev) => new Set(prev).add(k))
      } else {
        if (row.source === 'soft') {
          await clearSubAssignmentsForSoft(roleId, row.questionId)
        }
        let q = supabase
          .from('dds_p2p_cell_question_role_assignments')
          .delete()
          .eq('master_cell_id', cellId)
          .eq('roster_role_id', roleId)
        if (row.source === 'standard') {
          q = q.eq('standard_question_id', row.questionId)
        } else {
          q = q.eq('soft_question_id', row.questionId)
        }
        const { error: delErr } = await q
        if (delErr) throw new Error(delErr.message)
        setAssignKeys((prev) => {
          const n = new Set(prev)
          n.delete(k)
          return n
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusyKey(null)
    }
  }

  async function toggleSubCell(
    roleId: string,
    row: Extract<MatrixRow, { rowKind: 'sub_question' }>,
    next: boolean,
  ) {
    if (!cellId || !isAdmin) return
    const parentKey = assignmentKey(roleId, 'soft', row.softQuestionId)
    if (!assignKeys.has(parentKey)) {
      setError('Assign the soft-point question to this role before selecting sub-questions.')
      return
    }
    const k = subAssignmentKey(roleId, row.subQuestionId)
    setBusyKey(`${k}:${next ? 'on' : 'off'}`)
    setError(null)
    try {
      if (next) {
        const { error: insErr } = await supabase.from('dds_p2p_cell_soft_sub_question_role_assignments').insert({
          master_cell_id: cellId,
          roster_role_id: roleId,
          soft_question_id: row.softQuestionId,
          sub_question_id: row.subQuestionId,
        })
        if (insErr) throw new Error(insErr.message)
        setSubAssignKeys((prev) => new Set(prev).add(k))
      } else {
        const { error: delErr } = await supabase
          .from('dds_p2p_cell_soft_sub_question_role_assignments')
          .delete()
          .eq('master_cell_id', cellId)
          .eq('roster_role_id', roleId)
          .eq('sub_question_id', row.subQuestionId)
        if (delErr) throw new Error(delErr.message)
        setSubAssignKeys((prev) => {
          const n = new Set(prev)
          n.delete(k)
          return n
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusyKey(null)
    }
  }

  if (scopeStatus === 'loading') {
    return (
      <div className="flex min-h-[10rem] items-center justify-center text-xs text-muted" role="status">
        Loading…
      </div>
    )
  }

  if (scopeStatus === 'error') {
    return <p className={ddsErr}>{scopeError ?? 'Could not load master data.'}</p>
  }

  if (scopeStatus === 'ready' && !cellId) {
    return (
      <p className={ddsHint}>
        Choose a site, plant, and cell in the scope bar. Columns use the same Plan 24 roster roles as the day grid for
        that cell (including your Plan 24 view preferences).
      </p>
    )
  }

  return (
    <div className={ddsStack}>
      <p className="max-w-2xl text-xs leading-snug text-muted">
        Tick the intersections where a question should appear in P2P for that roster role. Global standard questions are
        shown in <span className="font-bold text-fg">bold</span>; cell soft-point questions are normal weight. Soft-point
        sub-questions appear indented under their parent — assign the parent first, then choose which checklist items
        each role sees. Manage questions under{' '}
        <Link to="/dds-process/admin/p2p-standard" className="font-medium text-accent underline-offset-2 hover:underline">
          Admin → P2P standard
        </Link>{' '}
        and{' '}
        <Link to="/dds-process/admin/p2p-soft-points" className="font-medium text-accent underline-offset-2 hover:underline">
          Admin → P2P soft points
        </Link>
        .
      </p>

      {!isAdmin ? (
        <p className={ddsHint}>Only app admins can change ticks. You can review the matrix as read-only.</p>
      ) : null}

      {error ? <p className={ddsErr}>{error}</p> : null}

      <section className={ddsSection}>
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 shrink-0 text-accent" aria-hidden />
          <h2 className="text-xs font-semibold text-fg">Question × role matrix</h2>
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-muted">
          Columns are the same roster roles as the Plan 24 day grid for this cell: active roles on the roster, in
          sort order, minus roles you have hidden under Plan 24 view preferences. Soft-point parents stay shared; tick
          only the sub-questions each role should answer.
        </p>

        {loading ? (
          <p className="mt-2 text-xs text-muted">Loading…</p>
        ) : activeRoles.length === 0 ? (
          <p className="mt-2 text-xs text-muted">
            No active roster roles for this cell. Configure an active Plan 24 roster and roles for this cell first (Plan
            24).
          </p>
        ) : plan24VisibleRoles.length === 0 ? (
          <p className="mt-2 text-xs text-muted">
            Every roster role is hidden in your Plan 24 view preferences for this cell. Open{' '}
            <Link to="/dds-process/plan-24" className="font-medium text-accent underline-offset-2 hover:underline">
              Plan 24
            </Link>{' '}
            and show at least one role in the view options to configure P2P visibility here.
          </p>
        ) : matrixRows.length === 0 ? (
          <p className="mt-2 text-xs text-muted">
            No P2P questions are defined yet for any KPI group. Add standard questions and optional soft-point questions,
            then return here.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[28rem] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-raised/40">
                  <th className="sticky left-0 z-10 min-w-[12rem] max-w-[20rem] bg-surface-raised/95 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted backdrop-blur">
                    Question
                  </th>
                  {plan24VisibleRoles.map((r) => (
                    <th
                      key={r.id}
                      className="min-w-[4.5rem] max-w-[6rem] px-1 py-1.5 text-center text-[10px] font-semibold leading-tight text-muted"
                      title={r.name}
                    >
                      <span className="line-clamp-3">{r.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((row, idx) => {
                  if (row.rowKind === 'group') {
                    return (
                      <tr key={`g-${row.groupId}-${idx}`} className="border-b border-border bg-black/[0.03] dark:bg-white/[0.04]">
                        <td
                          colSpan={1 + plan24VisibleRoles.length}
                          className="sticky left-0 z-10 bg-inherit px-2 py-1 font-semibold text-fg"
                        >
                          {row.groupName}
                        </td>
                      </tr>
                    )
                  }
                  if (row.rowKind === 'sub_question') {
                    return (
                      <tr key={`sub-${row.subQuestionId}`} className="border-b border-border/70 bg-surface-raised/10 last:border-b-0">
                        <td className="sticky left-0 z-10 max-w-[20rem] bg-surface px-2 py-1 pl-6 align-top backdrop-blur">
                          <p className="text-[10px] leading-snug text-muted">↳ {row.prompt}</p>
                        </td>
                        {plan24VisibleRoles.map((r) => {
                          const parentOn = assignKeys.has(assignmentKey(r.id, 'soft', row.softQuestionId))
                          const k = subAssignmentKey(r.id, row.subQuestionId)
                          const checked = subAssignKeys.has(k)
                          const busy = busyKey?.startsWith(`${r.id}:sub:${row.subQuestionId}:`) ?? false
                          return (
                            <td key={r.id} className="border-l border-border/80 px-0 py-0.5 text-center align-middle">
                              <input
                                type="checkbox"
                                className="size-3.5 cursor-pointer rounded border-border accent-accent disabled:cursor-not-allowed disabled:opacity-40"
                                checked={checked}
                                disabled={!isAdmin || busy || !parentOn}
                                onChange={(e) => void toggleSubCell(r.id, row, e.target.checked)}
                                aria-label={`${row.prompt} — ${r.name}`}
                                title={
                                  parentOn
                                    ? undefined
                                    : 'Assign the soft-point question to this role first'
                                }
                              />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  }
                  return (
                    <tr key={`q-${row.source}-${row.questionId}`} className="border-b border-border last:border-b-0">
                      <td className="sticky left-0 z-10 max-w-[20rem] bg-surface px-2 py-1.5 align-top backdrop-blur">
                        <p className={row.source === 'standard' ? 'font-bold leading-snug text-fg' : 'leading-snug text-fg'}>
                          {row.prompt}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted">{row.subtitle}</p>
                      </td>
                      {plan24VisibleRoles.map((r) => {
                        const k = assignmentKey(r.id, row.source, row.questionId)
                        const checked = assignKeys.has(k)
                        const busy = busyKey?.startsWith(`${r.id}:${row.source}:${row.questionId}:`) ?? false
                        return (
                          <td key={r.id} className="border-l border-border/80 px-0 py-0.5 text-center align-middle">
                            <input
                              type="checkbox"
                              className="size-3.5 cursor-pointer rounded border-border accent-accent disabled:cursor-not-allowed disabled:opacity-50"
                              checked={checked}
                              disabled={!isAdmin || busy}
                              onChange={(e) => void toggleCell(r.id, row, e.target.checked)}
                              aria-label={`${row.prompt} — ${r.name}`}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
