import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localYMD } from '../lib/dueDateUtils'
import { useAuth } from '../hooks/useAuth'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import { ddsP2pQuestionKey } from '../features/dds/ddsP2pQuestionKey'
import { labelForDdsP2pResponseKind, type DdsP2pResponseKind } from '../features/dds/ddsP2pResponseKind'
import { DdsP2pPlanPanel } from '../features/dds/DdsP2pPlanPanel'
import { ddsErr, ddsHint, ddsInput, ddsSection, ddsSelect, ddsStack } from '../features/dds/ddsAdminCompactClasses'

type KpiGroup = { id: string; name: string; sort_order: number }

type RosterRole = { id: string; name: string; sort_order: number; is_active: boolean }

type ShiftRow = { kind: string; display_name: string | null; sort_order: number; start_local: string; end_local: string }

type P2pQuestion = {
  key: string
  source: 'standard' | 'soft'
  questionId: string
  groupName: string
  prompt: string
  responseKind: DdsP2pResponseKind
  targetNumber: number | null
}

type FormAns = { yesNo: boolean | null; num: string; comment: string }

type AuditHead = { id: string; submitted_at: string; sheet_comment: string | null }

function sortGroups<T extends { sort_order: number; name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

function emptyForm(questions: P2pQuestion[]): Record<string, FormAns> {
  const m: Record<string, FormAns> = {}
  for (const q of questions) {
    m[q.key] = { yesNo: null, num: '', comment: '' }
  }
  return m
}

function growTextarea(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${Math.min(Math.max(el.scrollHeight, 28), 120)}px`
}

export function DdsP2pPage() {
  const { status: scopeStatus, error: scopeError, cellId } = usePlan24Workspace()
  const { user } = useAuth()

  const [planDate, setPlanDate] = useState(() => localYMD(new Date()))
  const [shiftKind, setShiftKind] = useState('')
  const [roleId, setRoleId] = useState('')

  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [roles, setRoles] = useState<RosterRole[]>([])
  const [questions, setQuestions] = useState<P2pQuestion[]>([])
  const [form, setForm] = useState<Record<string, FormAns>>({})
  const [sheetComment, setSheetComment] = useState('')

  const [audits, setAudits] = useState<AuditHead[]>([])
  const [revisionIx, setRevisionIx] = useState(0)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [planErr, setPlanErr] = useState<string | null>(null)
  const [planSuccess, setPlanSuccess] = useState<string | null>(null)

  useEffect(() => {
    setPlanErr(null)
    setPlanSuccess(null)
  }, [cellId, planDate, shiftKind, roleId])

  useEffect(() => {
    if (!planSuccess) return
    const t = window.setTimeout(() => setPlanSuccess(null), 2600)
    return () => window.clearTimeout(t)
  }, [planSuccess])

  const selectedRole = useMemo(() => roles.find((r) => r.id === roleId), [roles, roleId])
  const roleName = selectedRole?.name ?? ''

  const handlePlanPanelError = useCallback((msg: string) => {
    setPlanErr(msg || null)
  }, [])

  const handlePlanPanelSuccess = useCallback((msg: string | null) => {
    setPlanSuccess(msg)
  }, [])

  const readOnlyRevision = revisionIx > 0

  const questionsByGroup = useMemo(() => {
    const out: { groupName: string; items: P2pQuestion[] }[] = []
    for (const q of questions) {
      const last = out[out.length - 1]
      if (!last || last.groupName !== q.groupName) {
        out.push({ groupName: q.groupName, items: [q] })
      } else {
        last.items.push(q)
      }
    }
    return out
  }, [questions])

  const auditSignature = audits.map((a) => a.id).join('|')

  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      document.querySelectorAll<HTMLTextAreaElement>('textarea.p2p-auto-comment').forEach((t) => {
        growTextarea(t)
      })
    })
  }, [revisionIx, auditSignature, questions.length])

  const loadRosterShell = useCallback(async () => {
    if (scopeStatus !== 'ready' || !cellId) {
      setShifts([])
      setRoles([])
      setShiftKind('')
      setRoleId('')
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
    const rid = (rosterRes.data as { id: string } | null)?.id ?? null
    if (!rid) {
      setShifts([])
      setRoles([])
      setShiftKind('')
      setRoleId('')
      setLoading(false)
      return
    }
    const [shRes, roRes] = await Promise.all([
      supabase.from('plan24_roster_shifts').select('kind, display_name, sort_order, start_local, end_local').eq('roster_id', rid).order('sort_order'),
      supabase.from('plan24_roster_roles').select('id, name, sort_order, is_active').eq('roster_id', rid).order('sort_order').order('name'),
    ])
    if (shRes.error || roRes.error) {
      setError(shRes.error?.message ?? roRes.error?.message ?? 'Load failed')
      setLoading(false)
      return
    }
    const raw = (shRes.data ?? []) as Partial<ShiftRow>[]
    const shList: ShiftRow[] = raw.map((s) => ({
      kind: String(s.kind ?? ''),
      display_name: s.display_name ?? null,
      sort_order: Number(s.sort_order ?? 0),
      start_local: String(s.start_local ?? '05:00:00'),
      end_local: String(s.end_local ?? '17:00:00'),
    }))
    setShifts(shList)
    setShiftKind((prev) => {
      if (prev && shList.some((s) => s.kind === prev)) return prev
      return shList[0]?.kind ?? ''
    })
    const rList = sortGroups((roRes.data ?? []) as RosterRole[]).filter((r) => r.is_active)
    setRoles(rList)
    setRoleId((prev) => {
      if (prev && rList.some((r) => r.id === prev)) return prev
      return rList[0]?.id ?? ''
    })
    setLoading(false)
  }, [cellId, scopeStatus])

  useEffect(() => {
    void loadRosterShell()
  }, [loadRosterShell])

  const loadQuestions = useCallback(async () => {
    if (!cellId || !roleId) {
      setQuestions([])
      setForm({})
      return
    }
    setError(null)
    setAudits([])
    const { data: assigns, error: aErr } = await supabase
      .from('dds_p2p_cell_question_role_assignments')
      .select('question_kind, standard_question_id, soft_question_id')
      .eq('master_cell_id', cellId)
      .eq('roster_role_id', roleId)
    if (aErr) {
      setError(aErr.message)
      return
    }
    const rows = assigns ?? []
    const stdIds = [...new Set(rows.filter((r) => r.question_kind === 'standard').map((r) => r.standard_question_id as string))]
    const softIds = [...new Set(rows.filter((r) => r.question_kind === 'soft').map((r) => r.soft_question_id as string))]
    if (stdIds.length === 0 && softIds.length === 0) {
      setQuestions([])
      setForm({})
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
      return
    }
    const groups = sortGroups((grpRes.data ?? []) as KpiGroup[])
    const gName = new Map(groups.map((g) => [g.id, g.name]))
    const stdRows = (stdRes.data ?? []) as {
      id: string
      kpi_group_id: string
      prompt: string
      sort_order: number
      response_kind: string
      target_number: number | string | null
    }[]
    const softRows = (softRes.data ?? []) as typeof stdRows
    const stdSet = new Set(stdIds)
    const softSet = new Set(softIds)
    const out: P2pQuestion[] = []
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
        out.push({
          key: ddsP2pQuestionKey('standard', q.id),
          source: 'standard',
          questionId: q.id,
          groupName: gn,
          prompt: q.prompt,
          responseKind: rk,
          targetNumber: Number.isFinite(tn as number) ? (tn as number) : null,
        })
      }
      for (const q of softs) {
        const rk = q.response_kind === 'number_with_target' ? 'number_with_target' : 'yes_no'
        const tn = rk === 'number_with_target' && q.target_number != null ? Number(q.target_number) : null
        out.push({
          key: ddsP2pQuestionKey('soft', q.id),
          source: 'soft',
          questionId: q.id,
          groupName: gn,
          prompt: q.prompt,
          responseKind: rk,
          targetNumber: Number.isFinite(tn as number) ? (tn as number) : null,
        })
      }
    }
    setQuestions(out)
    setForm(emptyForm(out))
    setSheetComment('')
    setRevisionIx(0)
  }, [cellId, roleId])

  useEffect(() => {
    void loadQuestions()
  }, [loadQuestions])

  const loadAudits = useCallback(async () => {
    if (!cellId || !roleId || !user?.id || !shiftKind) {
      setAudits([])
      return
    }
    const { data, error: qErr } = await supabase
      .from('dds_p2p_audits')
      .select('id, submitted_at, sheet_comment')
      .eq('master_cell_id', cellId)
      .eq('plan_date', planDate)
      .eq('shift_kind', shiftKind)
      .eq('roster_role_id', roleId)
      .eq('submitted_by', user.id)
      .order('submitted_at', { ascending: false })
    if (qErr) {
      setError(qErr.message)
      return
    }
    const list = (data ?? []) as AuditHead[]
    setAudits(list)
    setRevisionIx(0)
  }, [cellId, planDate, shiftKind, roleId, user])

  useEffect(() => {
    void loadAudits()
  }, [loadAudits])

  const applyAnswersForAudit = useCallback(async (auditId: string | null, qs: P2pQuestion[], sheet: string) => {
    if (!auditId) {
      setForm(emptyForm(qs))
      setSheetComment(sheet)
      return
    }
    const { data: ans, error: e } = await supabase
      .from('dds_p2p_audit_answers')
      .select('question_kind, standard_question_id, soft_question_id, answer_yes_no, answer_number, question_comment')
      .eq('audit_id', auditId)
    if (e) {
      setError(e.message)
      return
    }
    const next = emptyForm(qs)
    for (const row of ans ?? []) {
      const kind = row.question_kind as 'standard' | 'soft'
      const qid = kind === 'standard' ? (row.standard_question_id as string) : (row.soft_question_id as string)
      const k = ddsP2pQuestionKey(kind, qid)
      if (!next[k]) continue
      next[k] = {
        yesNo: typeof row.answer_yes_no === 'boolean' ? row.answer_yes_no : null,
        num: row.answer_number != null ? String(row.answer_number) : '',
        comment: row.question_comment ?? '',
      }
    }
    setForm(next)
    setSheetComment(sheet)
  }, [])

  useEffect(() => {
    if (questions.length === 0) return
    const head = audits[revisionIx]
    if (!head) {
      void applyAnswersForAudit(null, questions, '')
      return
    }
    void applyAnswersForAudit(head.id, questions, head.sheet_comment ?? '')
  }, [audits, revisionIx, questions, applyAnswersForAudit])

  async function submit() {
    if (!cellId || !roleId || !user?.id || !shiftKind || readOnlyRevision) return
    if (questions.length === 0) return
    for (const q of questions) {
      const f = form[q.key]
      if (!f) continue
      if (q.responseKind === 'yes_no' && f.yesNo === null) {
        setError(`Answer every question (${q.prompt.slice(0, 40)}…)`)
        return
      }
      if (q.responseKind === 'number_with_target') {
        const n = Number(String(f.num).trim().replace(',', '.'))
        if (!Number.isFinite(n)) {
          setError(`Enter a number for: ${q.prompt.slice(0, 40)}…`)
          return
        }
      }
    }
    setSaving(true)
    setError(null)
    const { data: ins, error: insErr } = await supabase
      .from('dds_p2p_audits')
      .insert({
        master_cell_id: cellId,
        plan_date: planDate,
        shift_kind: shiftKind,
        roster_role_id: roleId,
        submitted_by: user.id,
        sheet_comment: sheetComment.trim() || null,
      })
      .select('id')
      .single()
    if (insErr || !ins?.id) {
      setSaving(false)
      setError(insErr?.message ?? 'Submit failed')
      return
    }
    const auditId = ins.id as string
    for (const q of questions) {
      const f = form[q.key]!
      if (q.responseKind === 'yes_no') {
        const { error: ansErr } = await supabase.from('dds_p2p_audit_answers').insert({
          audit_id: auditId,
          question_kind: q.source,
          standard_question_id: q.source === 'standard' ? q.questionId : null,
          soft_question_id: q.source === 'soft' ? q.questionId : null,
          answer_yes_no: f.yesNo,
          answer_number: null,
          question_comment: f.comment.trim() || null,
        })
        if (ansErr) {
          setSaving(false)
          setError(ansErr.message)
          return
        }
      } else {
        const n = Number(String(f.num).trim().replace(',', '.'))
        const { error: ansErr } = await supabase.from('dds_p2p_audit_answers').insert({
          audit_id: auditId,
          question_kind: q.source,
          standard_question_id: q.source === 'standard' ? q.questionId : null,
          soft_question_id: q.source === 'soft' ? q.questionId : null,
          answer_yes_no: null,
          answer_number: n,
          question_comment: f.comment.trim() || null,
        })
        if (ansErr) {
          setSaving(false)
          setError(ansErr.message)
          return
        }
      }
    }
    setSaving(false)
    await loadAudits()
  }

  if (scopeStatus === 'loading') {
    return (
      <div className="flex min-h-[10rem] items-center justify-center text-xs text-muted" role="status">
        Loading…
      </div>
    )
  }
  if (scopeStatus === 'error') {
    return <p className={ddsErr}>{scopeError ?? 'Could not load scope.'}</p>
  }
  if (!cellId) {
    return <p className={ddsHint}>Select a cell in the scope bar to use P2P.</p>
  }
  if (!user?.id) {
    return <p className={ddsErr}>You must be signed in to submit P2P.</p>
  }

  return (
    <div className={`${ddsStack} min-h-0 flex-1`}>
      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:grid lg:max-h-[min(96dvh,1080px)] lg:min-h-[420px] lg:grid-cols-2 lg:gap-3">
        <section className={`${ddsSection} flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden`}>
          <div className="flex shrink-0 flex-wrap items-end gap-2 border-b border-border/60 pb-2">
            <div>
              <label className="text-[10px] font-medium text-muted">Date</label>
              <input type="date" className={ddsInput} value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted">Shift</label>
              <select className={ddsSelect} value={shiftKind} onChange={(e) => setShiftKind(e.target.value)}>
                {shifts.map((s) => (
                  <option key={s.kind} value={s.kind}>
                    {s.display_name?.trim() || s.kind}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[8rem] flex-1">
              <label className="text-[10px] font-medium text-muted">Role</label>
              <select className={ddsSelect} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error ? <p className={ddsErr}>{error}</p> : null}
          {loading ? (
            <div className="flex items-center gap-1 text-xs text-muted">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Loading roster…
            </div>
          ) : roles.length === 0 ? (
            <p className="text-xs text-muted">No active Plan 24 roles for this cell.</p>
          ) : questions.length === 0 ? (
            <p className="text-xs text-muted">
              No questions are assigned to this role for P2P. Configure under{' '}
              <Link to="/dds-process/admin/p2p-setup" className="font-medium text-accent underline-offset-2 hover:underline">
                Admin → P2P set-up
              </Link>
              .
            </p>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
                {questionsByGroup.map((g) => (
                  <div key={g.groupName}>
                    <div className="border-b border-border/60 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {g.groupName}
                    </div>
                    <ul className="mt-1 space-y-1.5">
                      {g.items.map((q) => {
                        const f = form[q.key] ?? { yesNo: null, num: '', comment: '' }
                        const kindHint =
                          q.responseKind === 'yes_no'
                            ? null
                            : q.responseKind === 'number_with_target' && q.targetNumber != null
                              ? `${labelForDdsP2pResponseKind(q.responseKind)} · tgt ${q.targetNumber}`
                              : labelForDdsP2pResponseKind(q.responseKind)
                        const compactControl =
                          'h-7 shrink-0 rounded-md border border-border bg-surface px-1.5 text-[11px] outline-none ring-accent/30 focus:border-accent/50 focus:ring-1'
                        return (
                          <li key={q.key} className="border-b border-border/35 pb-1.5 last:border-b-0 last:pb-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span
                                className={`min-w-0 flex-[1_1_10rem] text-[11px] leading-snug text-fg ${q.source === 'standard' ? 'font-bold' : ''}`}
                              >
                                {q.prompt}
                              </span>
                              {q.responseKind === 'yes_no' ? (
                                <div
                                  className="flex shrink-0 items-center gap-0.5 rounded-md border border-border/80 bg-surface-raised/30 p-0.5"
                                  role="group"
                                  aria-label="Yes or no"
                                >
                                  <button
                                    type="button"
                                    disabled={readOnlyRevision}
                                    onClick={() =>
                                      setForm((prev) => ({ ...prev, [q.key]: { ...f, yesNo: true } }))
                                    }
                                    className={`h-6 min-w-[2.35rem] rounded px-2 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                                      f.yesNo === true
                                        ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/40 dark:bg-emerald-600'
                                        : 'text-emerald-800 hover:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/20'
                                    }`}
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    disabled={readOnlyRevision}
                                    onClick={() =>
                                      setForm((prev) => ({ ...prev, [q.key]: { ...f, yesNo: false } }))
                                    }
                                    className={`h-6 min-w-[2.35rem] rounded px-2 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                                      f.yesNo === false
                                        ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-500/40 dark:bg-rose-600'
                                        : 'text-rose-800 hover:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/20'
                                    }`}
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <input
                                  className={`${compactControl} w-[4.5rem] text-right tabular-nums`}
                                  inputMode="decimal"
                                  placeholder="—"
                                  disabled={readOnlyRevision}
                                  value={f.num}
                                  onChange={(e) =>
                                    setForm((prev) => ({ ...prev, [q.key]: { ...f, num: e.target.value } }))
                                  }
                                />
                              )}
                              {kindHint ? (
                                <span className="shrink-0 text-[10px] text-muted">{kindHint}</span>
                              ) : null}
                            </div>
                            <textarea
                              className="p2p-auto-comment mt-0.5 w-full resize-none overflow-hidden rounded-md border border-border/80 bg-surface px-1.5 py-0.5 text-[11px] leading-snug outline-none ring-accent/30 focus:border-accent/50 focus:ring-1"
                              rows={1}
                              placeholder="Comment"
                              disabled={readOnlyRevision}
                              value={f.comment}
                              onChange={(e) =>
                                setForm((prev) => ({ ...prev, [q.key]: { ...f, comment: e.target.value } }))
                              }
                              onInput={(e) => growTextarea(e.currentTarget)}
                            />
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="mt-2 shrink-0 border-t border-border/60 pt-2">
                <label className="text-[10px] font-medium text-muted">Overall comment</label>
                <textarea
                  className="p2p-auto-comment mt-0.5 w-full resize-none overflow-hidden rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px] leading-snug outline-none ring-accent/30 focus:border-accent/50 focus:ring-1"
                  rows={1}
                  disabled={readOnlyRevision}
                  value={sheetComment}
                  onChange={(e) => setSheetComment(e.target.value)}
                  onInput={(e) => growTextarea(e.currentTarget)}
                />
                <button
                  type="button"
                  disabled={saving || readOnlyRevision || questions.length === 0}
                  onClick={() => void submit()}
                  className="mt-2 inline-flex h-8 items-center rounded-md bg-accent px-3 text-xs font-semibold text-accent-fg disabled:opacity-40"
                >
                  {saving ? 'Submitting…' : 'Submit'}
                </button>
                <p className="mt-1 text-[10px] text-muted">Each submit appends an immutable revision (audit trail).</p>
                {readOnlyRevision ? (
                  <p className="mt-1 text-[10px] text-amber-800 dark:text-amber-200">Read-only historical revision. Latest is editable.</p>
                ) : null}
                {audits.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <label htmlFor="p2p-revision" className="text-[9px] font-medium text-muted">
                      Revision
                    </label>
                    <select
                      id="p2p-revision"
                      className="h-7 max-w-[min(100%,16rem)] rounded-md border border-border/80 bg-surface px-1.5 text-[10px] outline-none ring-accent/30 focus:border-accent/50 focus:ring-1"
                      value={String(revisionIx)}
                      onChange={(e) => setRevisionIx(Number(e.target.value))}
                    >
                      {audits.map((a, i) => (
                        <option key={a.id} value={String(i)}>
                          {new Date(a.submitted_at).toLocaleString()} {i === 0 ? '(latest)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>
        {roleName && shiftKind ? (
          <DdsP2pPlanPanel
            cellId={cellId}
            planDate={planDate}
            shiftKind={shiftKind}
            rosterRoleId={roleId}
            roleName={roleName}
            userId={user.id}
            shifts={shifts}
            onError={handlePlanPanelError}
            onSuccessMsg={handlePlanPanelSuccess}
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-border p-4 text-[11px] text-muted">
            Select role and shift to load your plan.
          </div>
        )}
      </div>
      {planErr ? <p className={ddsErr}>{planErr}</p> : null}
      {planSuccess ? (
        <p className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">{planSuccess}</p>
      ) : null}
    </div>
  )
}
