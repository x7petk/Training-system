import { useCallback, useEffect, useMemo, useRef, useState, type TextareaHTMLAttributes } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ClipboardList } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useAppSectionSidebarDockLeftClass } from '../hooks/useAppSectionSidebarDockInset'
import { useLdrWorkspace } from '../features/ldr/LdrWorkspaceContext'
import { ldrMasterCellJoinFromId, ldrMasterCellLabel } from '../features/ldr/types'
import {
  hcRagBadgeClass,
  hcRagFromPercent,
  hcRagLabel,
  hcScorePercent,
  type HcRag,
} from '../features/health-checks/hcScore'
import type { HcAnswerRow, HcRecordRow, HcTemplateQuestionRow } from '../features/health-checks/types'
import {
  findSubmittedHcDuplicateSameDay,
  HC_DUPLICATE_SUBMIT_MESSAGE,
  isHcDuplicateSubmitDbError,
} from '../features/health-checks/hcSubmitDuplicate'
import {
  applyPendingRosterRagAfterHcSubmit,
  clearPendingHcLdrAssignment,
  hasPendingHcLdrAssignment,
} from '../features/health-checks/hcRosterAssignmentLink'

const LDR_TOOLS_SIDEBAR_STORAGE_KEY = 'ldr-tools.sidebar-collapsed'

type Line = {
  answerId: string
  templateQuestionId: string
  questionText: string
  expectedStandard: string
  isCritical: boolean
  helpText: string | null
  answer: 'pass' | 'fail' | null
  comment: string
  sortOrder: number
}

function AutoGrowTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const value = props.value
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      {...props}
      ref={ref}
      rows={1}
      className={`${props.className ?? ''} resize-none overflow-hidden`}
      onInput={(e) => {
        const el = e.currentTarget
        el.style.height = '0px'
        el.style.height = `${el.scrollHeight}px`
        props.onInput?.(e)
      }}
    />
  )
}

function buildLines(
  answers: HcAnswerRow[],
  submitted: boolean,
  qById: Map<string, HcTemplateQuestionRow>,
): Line[] {
  const sorted = [...answers].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
  return sorted.map((a) => {
    const q = qById.get(a.template_question_id)
    const questionText = submitted
      ? (a.question_text_snapshot ?? '—')
      : (q?.question_text ?? a.question_text_snapshot ?? '—')
    const expectedStandard = submitted
      ? (a.expected_standard_snapshot ?? '')
      : (q?.expected_standard ?? a.expected_standard_snapshot ?? '')
    return {
      answerId: a.id,
      templateQuestionId: a.template_question_id,
      questionText,
      expectedStandard,
      isCritical: q?.is_critical ?? false,
      helpText: q?.help_text ?? null,
      answer: a.answer,
      comment: a.comment ?? '',
      sortOrder: a.sort_order,
    }
  })
}

export function HcRecordPage() {
  const { recordId } = useParams<{ recordId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isAdmin } = useAuth()
  const { masterCellJoinById } = useLdrWorkspace()

  const [record, setRecord] = useState<HcRecordRow | null>(null)
  const [typeName, setTypeName] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [operatorName, setOperatorName] = useState('')
  const [overallComment, setOverallComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [expandedHelp, setExpandedHelp] = useState<Record<string, boolean>>({})
  const [submitNotice, setSubmitNotice] = useState<string | null>(null)
  const [rosterLinkPending, setRosterLinkPending] = useState(false)
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedDraftRef = useRef('')

  const scheduledCompletionDate = searchParams.get('completionDate') ?? ''

  const load = useCallback(async () => {
    if (!recordId) return
    setLoading(true)
    setError(null)
    const recRes = await supabase.from('hc_records').select('*').eq('id', recordId).maybeSingle()
    if (recRes.error || !recRes.data) {
      setLoading(false)
      setError(recRes.error?.message ?? 'Record not found.')
      setRecord(null)
      setLines([])
      return
    }
    const rec = recRes.data as HcRecordRow
    const typeRes = await supabase.from('hc_types').select('name').eq('id', rec.hc_type_id).maybeSingle()
    setTypeName((typeRes.data as { name?: string } | null)?.name ?? '')

    const ansRes = await supabase.from('hc_answers').select('*').eq('hc_record_id', recordId)
    if (ansRes.error) {
      setLoading(false)
      setError(ansRes.error.message)
      return
    }
    const answers = (ansRes.data ?? []) as HcAnswerRow[]
    const submitted = !!rec.completed_at

    const qIds = [...new Set(answers.map((a) => a.template_question_id))]
    let qById = new Map<string, HcTemplateQuestionRow>()
    if (!submitted && qIds.length) {
      const qRes = await supabase
        .from('hc_template_questions')
        .select('*')
        .in('id', qIds)
        .eq('template_id', rec.template_id)
      if (!qRes.error && qRes.data) {
        qById = new Map((qRes.data as HcTemplateQuestionRow[]).map((q) => [q.id, q]))
      }
    }

    setRecord(rec)
    setOperatorName(rec.operator_name ?? '')
    setOverallComment(rec.overall_comment ?? '')
    setLines(buildLines(answers, submitted, qById))
    lastSavedDraftRef.current = JSON.stringify({
      operatorName: rec.operator_name ?? '',
      overallComment: rec.overall_comment ?? '',
      lines: buildLines(answers, submitted, qById).map((l) => ({ id: l.answerId, answer: l.answer, comment: l.comment })),
    })
    setLoading(false)
  }, [recordId])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  useEffect(() => {
    queueMicrotask(() => {
      if (!recordId) {
        setRosterLinkPending(false)
        return
      }
      setRosterLinkPending(hasPendingHcLdrAssignment(recordId))
    })
  }, [recordId])

  useEffect(() => {
    queueMicrotask(() => {
      if (!recordId || !record?.ldr_assignment_id) return
      clearPendingHcLdrAssignment(recordId)
      setRosterLinkPending(false)
    })
  }, [record?.ldr_assignment_id, recordId])

  const submitted = !!record?.completed_at
  const isOwner = user?.id && record?.completed_by_user_id === user.id
  const readOnly = submitted || !isOwner

  const { passes, total, pct, rag } = useMemo(() => {
    const t = lines.length
    const p = lines.filter((l) => l.answer === 'pass').length
    const pc = hcScorePercent(p, t)
    return { passes: p, total: t, pct: pc, rag: hcRagFromPercent(pc) }
  }, [lines])

  const displayRag: HcRag | null = submitted && record?.status ? record.status : !submitted ? rag : null
  const displayPct = submitted && record?.score != null ? record.score : pct

  function setLine(id: string, patch: Partial<Pick<Line, 'answer' | 'comment'>>) {
    setLines((prev) => prev.map((l) => (l.answerId === id ? { ...l, ...patch } : l)))
  }

  const draftSnapshot = useMemo(
    () =>
      JSON.stringify({
        operatorName,
        overallComment,
        lines: lines.map((l) => ({ id: l.answerId, answer: l.answer, comment: l.comment })),
      }),
    [operatorName, overallComment, lines],
  )

  useEffect(() => {
    if (!recordId || !record || readOnly || loading) return
    if (draftSnapshot === lastSavedDraftRef.current) return
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    autoSaveTimeoutRef.current = setTimeout(() => {
      void (async () => {
        setAutoSaveState('saving')
        const recUp = await supabase
          .from('hc_records')
          .update({
            operator_name: operatorName.trim() || null,
            overall_comment: overallComment.trim() || null,
          })
          .eq('id', recordId)
          .is('completed_at', null)
        if (recUp.error) {
          setAutoSaveState('error')
          return
        }
        for (const l of lines) {
          const scoreVal = l.answer === 'pass' ? 1 : l.answer === 'fail' ? 0 : null
          const up = await supabase
            .from('hc_answers')
            .update({
              answer: l.answer,
              score_value: scoreVal,
              comment: l.comment.trim(),
            })
            .eq('id', l.answerId)
          if (up.error) {
            setAutoSaveState('error')
            return
          }
        }
        lastSavedDraftRef.current = draftSnapshot
        setAutoSaveState('saved')
      })()
    }, 800)
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    }
  }, [draftSnapshot, loading, readOnly, recordId, record, operatorName, overallComment, lines])

  async function submitCheck() {
    if (!recordId || !record || submitted || !isOwner) return
    setError(null)
    for (const l of lines) {
      if (l.answer !== 'pass' && l.answer !== 'fail') {
        setError('Answer every question before submit.')
        return
      }
      if (l.answer === 'fail' && !l.comment.trim()) {
        setError('Each FAIL needs a comment.')
        return
      }
    }

    const qRes = await supabase
      .from('hc_template_questions')
      .select('id, question_text, expected_standard, sort_order')
      .eq('template_id', record.template_id)
      .in(
        'id',
        lines.map((l) => l.templateQuestionId),
      )
    if (qRes.error) {
      setError(qRes.error.message)
      return
    }
    const qMap = new Map((qRes.data as HcTemplateQuestionRow[]).map((q) => [q.id, q]))

    const p = lines.filter((l) => l.answer === 'pass').length
    const t = lines.length
    const score = hcScorePercent(p, t)
    const status = hcRagFromPercent(score)

    const tplRes = await supabase.from('hc_templates').select('version').eq('id', record.template_id).maybeSingle()
    const templateVersion = (tplRes.data as { version?: number } | null)?.version ?? 1
    const hadPendingRoster = hasPendingHcLdrAssignment(recordId)
    const rosterLinked = !!record.ldr_assignment_id || hadPendingRoster

    const dup = await findSubmittedHcDuplicateSameDay(supabase, {
      completedByUserId: record.completed_by_user_id,
      hcTypeId: record.hc_type_id,
      masterCellId: record.master_cell_id,
      ldrAssignmentId: record.ldr_assignment_id ?? null,
    })
    if (dup.error) {
      setError(dup.error)
      return
    }
    if (dup.duplicateId) {
      setError(HC_DUPLICATE_SUBMIT_MESSAGE)
      return
    }

    const completedAt = (() => {
      const m = scheduledCompletionDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (!m) return new Date().toISOString()
      const now = new Date()
      const y = Number(m[1])
      const mo = Number(m[2]) - 1
      const d = Number(m[3])
      return new Date(
        Date.UTC(y, mo, d, now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds()),
      ).toISOString()
    })()

    setSaving(true)
    for (const l of lines) {
      const q = qMap.get(l.templateQuestionId)
      const up = await supabase
        .from('hc_answers')
        .update({
          answer: l.answer,
          score_value: l.answer === 'pass' ? 1 : 0,
          comment: l.comment.trim(),
          question_text_snapshot: q?.question_text ?? l.questionText,
          expected_standard_snapshot: q?.expected_standard ?? l.expectedStandard,
          sort_order: q?.sort_order ?? l.sortOrder,
        })
        .eq('id', l.answerId)
      if (up.error) {
        setSaving(false)
        setError(up.error.message)
        return
      }
    }

    const done = await supabase
      .from('hc_records')
      .update({
        operator_name: operatorName.trim() || null,
        overall_comment: overallComment.trim() || null,
        completed_at: completedAt,
        score,
        status,
        template_version_snapshot: templateVersion,
      })
      .eq('id', recordId)
      .is('completed_at', null)

    setSaving(false)
    if (done.error) {
      setError(
        isHcDuplicateSubmitDbError(done.error.message)
          ? HC_DUPLICATE_SUBMIT_MESSAGE
          : done.error.message,
      )
      return
    }
    const pendingSync = await applyPendingRosterRagAfterHcSubmit(supabase, recordId, {
      hcTypeId: record.hc_type_id,
      completedAtIso: completedAt,
      hcStatus: status,
      score,
      completedByName: record.completed_by_name,
      overallComment,
      answerComments: lines
        .map((l) => ({ question: qMap.get(l.templateQuestionId)?.question_text ?? l.questionText, comment: l.comment }))
        .filter((x) => x.comment.trim().length > 0),
    })

    if (rosterLinked) {
      setSubmitNotice(
        pendingSync.ran && !pendingSync.ok
          ? `Submitted. Could not update roster feedback: ${pendingSync.error ?? 'Unknown error'}.`
          : 'Submitted. The leadership roster assignment RAG and comments now reflect this HC result.',
      )
    }
    setRosterLinkPending(false)
    await load()
  }

  const canDelete = Boolean(isAdmin && recordId && record)
  const showActionDock = Boolean(!readOnly || canDelete)
  const dockLeftClass = useAppSectionSidebarDockLeftClass(LDR_TOOLS_SIDEBAR_STORAGE_KEY)

  async function deleteRecord() {
    if (!recordId || !canDelete) return
    if (!window.confirm('Delete this health check record? This cannot be undone.')) return
    setSaving(true)
    const del = await supabase.from('hc_records').delete().eq('id', recordId)
    setSaving(false)
    if (del.error) {
      setError(del.error.message)
      return
    }
    navigate('/ldr-tools/health-checks')
  }

  const locJoin = record ? ldrMasterCellJoinFromId(record.master_cell_id, masterCellJoinById) : undefined
  const locLabel = locJoin ? ldrMasterCellLabel(locJoin) : ''

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-3 text-muted">
        <span className="size-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        Loading…
      </div>
    )
  }

  if (!record) {
    return (
      <div className="space-y-4">
        <p className="text-danger">{error ?? 'Not found.'}</p>
        <Link to="/ldr-tools/health-checks" className="text-teal-700 hover:underline dark:text-teal-300">
          Back to list
        </Link>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${showActionDock ? 'pb-24 md:pb-28' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            to="/ldr-tools/health-checks"
            className="mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted hover:bg-surface-raised"
            aria-label="Back"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300">
            <ClipboardList className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {typeName || 'Health check'}
              {submitted ? null : (
                <span className="ml-2 align-middle text-base font-normal text-muted">(draft)</span>
              )}
            </h1>
            <p className="text-sm text-muted">{locLabel}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <div className="rounded-xl border border-border-strong bg-surface-raised/60 px-4 py-2 text-right text-sm shadow-sm">
            <div className="text-xs font-medium text-muted">Score</div>
            <div className="font-mono text-lg font-semibold tabular-nums text-fg">
              {displayPct}%{' '}
              <span className="text-sm font-normal text-muted">
                ({passes}/{total})
              </span>
            </div>
            {displayRag ? (
              <span
                className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${hcRagBadgeClass(displayRag)}`}
              >
                {submitted ? hcRagLabel(record.status!) : `Live: ${hcRagLabel(displayRag)}`}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {submitNotice ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/70 bg-emerald-100 px-4 py-3 text-sm text-black dark:border-emerald-500 dark:bg-emerald-200 dark:text-black"
          role="status"
        >
          <span>{submitNotice}</span>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-black/30 bg-white/70 px-2 py-1 text-xs font-medium text-black hover:bg-white dark:bg-white/80 dark:text-black"
            onClick={() => setSubmitNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:grid-cols-2">
        <label className="block text-xs font-medium text-muted">
          Operator
          <input
            type="text"
            disabled={readOnly}
            className="mt-1 h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm disabled:opacity-60"
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
          />
        </label>
        <div className="text-sm text-muted sm:pt-6">
          Completed by: <span className="font-medium text-fg">{record.completed_by_name}</span>
          {record.ldr_assignment_id || rosterLinkPending ? (
            <span className="mt-1 block text-xs text-muted">
              {record.ldr_assignment_id
                ? submitted
                  ? 'Roster assignment RAG and comment log were updated from this HC.'
                  : 'Started from the roster — when you submit, roster RAG and comment log will reflect this HC.'
                : submitted
                  ? 'Roster link was stored in this browser — RAG and comment log were updated on submit if validation passed.'
                  : 'Started from the roster (run the HC migration to persist the link on the server). When you submit, roster RAG and comment log will reflect this HC.'}
            </span>
          ) : null}
        </div>
        <label className="block text-xs font-medium text-muted sm:col-span-2">
          Overall comment (optional)
          <AutoGrowTextarea
            disabled={readOnly}
            className="mt-1 w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm disabled:opacity-60"
            value={overallComment}
            onChange={(e) => setOverallComment(e.target.value)}
          />
        </label>
      </div>

      <div className="space-y-4">
        {lines.map((l) => (
          <article
            key={l.answerId}
            className="rounded-2xl border border-border-strong bg-surface p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="min-w-0 flex-1 text-base font-semibold text-fg">{l.questionText}</h2>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {l.isCritical ? (
                  <span className="shrink-0 rounded-full border border-red-800 bg-white px-2 py-0.5 text-xs font-semibold text-red-900 dark:border-red-300 dark:bg-surface dark:text-red-200">
                    Critical
                  </span>
                ) : null}
                <div className="inline-flex rounded-xl border border-border bg-white p-1 dark:bg-surface">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => setLine(l.answerId, { answer: 'pass' })}
                    className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
                      l.answer === 'pass'
                        ? 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500'
                        : 'text-fg/80 hover:bg-surface-raised'
                    }`}
                  >
                    PASS
                  </button>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => setLine(l.answerId, { answer: 'fail' })}
                    className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
                      l.answer === 'fail'
                        ? 'bg-red-600 text-white shadow-sm dark:bg-red-500'
                        : 'text-fg/80 hover:bg-surface-raised'
                    }`}
                  >
                    FAIL
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-border bg-surface-raised/40 px-4 py-3 text-sm text-fg/85">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Expected standard</div>
              <p className="mt-1 whitespace-pre-wrap">{l.expectedStandard || '—'}</p>
            </div>
            {l.helpText ? (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setExpandedHelp((h) => ({ ...h, [l.answerId]: !h[l.answerId] }))}
                  className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-300"
                >
                  {expandedHelp[l.answerId] ? 'Hide help' : 'Show help'}
                </button>
                {expandedHelp[l.answerId] ? (
                  <p className="mt-2 text-sm text-muted whitespace-pre-wrap">{l.helpText}</p>
                ) : null}
              </div>
            ) : null}

            <label className="mt-4 block text-xs font-medium text-muted">
              Comment{l.answer === 'fail' ? ' (required if FAIL)' : ' (optional if PASS)'}
              <AutoGrowTextarea
                disabled={readOnly}
                placeholder="Required if FAIL – describe issue or action"
                className="mt-1 w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm disabled:opacity-60"
                value={l.comment}
                onChange={(e) => setLine(l.answerId, { comment: e.target.value })}
              />
            </label>

            {l.answer === 'fail' ? (
              <button
                type="button"
                className="mt-3 rounded-lg border border-dashed border-border px-4 py-2 text-sm font-medium text-muted"
                disabled
                title="Coming soon"
              >
                + Create Action
              </button>
            ) : null}
          </article>
        ))}
      </div>

      {showActionDock ? (
        <div
          className={`fixed bottom-0 right-0 z-40 border-t border-border bg-surface/95 pt-3 shadow-[0_-6px_24px_rgba(0,0,0,0.06)] backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] ${dockLeftClass}`}
          role="toolbar"
          aria-label="Health check actions"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-2 px-4 md:px-8">
            {!readOnly ? (
              <>
                <span className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-slate-900 dark:bg-surface dark:text-fg">
                  {autoSaveState === 'saving'
                    ? 'Autosaving...'
                    : autoSaveState === 'saved'
                      ? 'Draft saved'
                      : autoSaveState === 'error'
                        ? 'Autosave failed'
                        : 'Autosave on'}
                </span>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submitCheck()}
                  className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 dark:bg-teal-500"
                >
                  Submit
                </button>
              </>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void deleteRecord()}
                className="rounded-xl border border-red-800 bg-white px-4 py-2 text-sm font-semibold text-red-900 hover:bg-red-50 dark:border-red-300 dark:bg-surface dark:text-red-200"
              >
                Delete HC
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
