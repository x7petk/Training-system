import { useCallback, useEffect, useMemo, useRef, useState, type TextareaHTMLAttributes } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ClipboardList, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useAppSectionSidebarDockLeftClass } from '../hooks/useAppSectionSidebarDockInset'
import { useLdrWorkspace } from '../features/ldr/LdrWorkspaceContext'
import { ldrMasterCellJoinFromId, ldrMasterCellLabel } from '../features/ldr/types'
import { hcRagBadgeClass, hcRagFromPercent, hcRagLabel, hcScorePercent, type HcRag } from '../features/health-checks/hcScore'
import {
  findSubmittedObsDuplicateSameDay,
  isObsDuplicateSubmitDbError,
  obsDuplicateSubmitMessage,
} from '../features/observations/obsSubmitDuplicate'
import { ppoScoreAndRag, qosScoreAndRag, sosLevelToStatusAndScore, type SosLevel } from '../features/observations/obsScores'
import type { ObsKind } from '../features/observations/obsKind'
import { obsBasePath, obsLabel } from '../features/observations/obsKind'
import { ObsFramedImage } from '../features/observations/ObsFramedImage'
import { obsSignedImageUrl } from '../features/observations/obsStorage'
import { clearPendingObsLdrAssignment, hasPendingObsLdrAssignment } from '../features/observations/obsRosterAssignmentLink'

type AnyRecord = Record<string, unknown> & {
  id: string
  template_id: string
  master_cell_id: string
  completed_by_user_id: string
  completed_by_name: string
  completed_at: string | null
  score: number | null
  status: HcRag | null
  overall_comment: string | null
  operator_name: string | null
  ldr_assignment_id: string | null
  sos_level?: string | null
}

type QpLine = {
  answerId: string
  templateQuestionId: string
  questionText: string
  expectedStandard: string
  answer: 'pass' | 'fail' | 'na' | null
  comment: string
  operatorName: string
  sortOrder: number
  goodPath: string
  badPath: string
  goodUrl: string | null
  badUrl: string | null
}

type SosQRow = {
  id: string
  question_text: string
  expected_standard: string
  help_text: string | null
  sort_order: number
  good_image_path: string
  bad_image_path: string
}

function recTable(k: ObsKind) {
  return k === 'sos' ? 'sos_records' : k === 'qos' ? 'qos_records' : 'ppo_records'
}
function typeCol(k: ObsKind) {
  return k === 'sos' ? 'sos_type_id' : k === 'qos' ? 'qos_type_id' : 'ppo_type_id'
}
function typesTable(k: ObsKind) {
  return k === 'sos' ? 'sos_types' : k === 'qos' ? 'qos_types' : 'ppo_types'
}
function qTable(k: ObsKind) {
  return k === 'sos' ? 'sos_template_questions' : k === 'qos' ? 'qos_template_questions' : 'ppo_template_questions'
}
function ansTable(k: ObsKind) {
  return k === 'qos' ? 'qos_answers' : 'ppo_answers'
}

/** Admin-configured link: full https URL, bare host, or same-app path starting with `/`. */
function standardLinkHref(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim()
  if (!t) return null
  const lower = t.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) return null
  if (t.startsWith('/') && !t.startsWith('//')) {
    if (/[\0\r\n\\]/.test(t)) return null
    return t
  }
  let href = t
  if (!/^https?:\/\//i.test(href)) href = `https://${href}`
  try {
    const u = new URL(href)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.href
  } catch {
    return null
  }
}

const LDR_TOOLS_SIDEBAR_STORAGE_KEY = 'ldr-tools.sidebar-collapsed'

const DEFAULT_OBS_STANDARD_URL = 'https://www.google.com'

function obsSubmitBlockerMessage(
  kind: ObsKind,
  lines: QpLine[],
  operatorName: string,
  sosLevel: SosLevel | null,
): string | null {
  if (kind === 'sos') {
    if (!sosLevel) return 'Choose Full, Partly, or Not before submit.'
    if (!operatorName.trim()) return 'Enter the operator name (record) before submit.'
    return null
  }
  if (!lines.length) return 'This observation has no questions.'
  for (const l of lines) {
    if (l.answer !== 'pass' && l.answer !== 'fail' && l.answer !== 'na') {
      return 'Answer every question (Pass, Fail, or N/A) before submit.'
    }
    if (l.answer === 'fail' && !l.comment.trim()) return 'Each FAIL needs a comment.'
  }
  return null
}

function obsSosOutcomeNeedsAttention(gapUi: boolean, sosLevel: SosLevel | null) {
  return gapUi && !sosLevel
}

function obsSosRecordOperatorNeedsAttention(gapUi: boolean, operatorName: string) {
  return gapUi && !operatorName.trim()
}

/** Full / Partly / Not selected styling — matches `hcRagBadgeClass` (green / amber / red). */
function sosOutcomeLevelButtonSelectedClass(lvl: SosLevel): string {
  switch (lvl) {
    case 'full':
      return 'border-emerald-700/45 bg-emerald-300 text-emerald-950 ring-1 ring-emerald-700/45 dark:border-emerald-300/65 dark:bg-emerald-400 dark:text-emerald-950 dark:ring-emerald-300/65'
    case 'partly':
      return 'border-amber-700/55 bg-amber-300 text-amber-950 ring-1 ring-amber-700/55 dark:border-amber-300/65 dark:bg-amber-400 dark:text-amber-950 dark:ring-amber-300/65'
    case 'not':
      return 'border-rose-700/50 bg-rose-300 text-rose-950 ring-1 ring-rose-700/50 dark:border-rose-300/65 dark:bg-rose-400 dark:text-rose-950 dark:ring-rose-300/65'
  }
}

function obsQpLineNeedsAnswer(gapUi: boolean, l: QpLine) {
  return gapUi && l.answer !== 'pass' && l.answer !== 'fail' && l.answer !== 'na'
}

function obsQpLineNeedsFailComment(gapUi: boolean, l: QpLine) {
  return gapUi && l.answer === 'fail' && !l.comment.trim()
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

export function ObsRecordPage({ kind }: { kind: ObsKind }) {
  const { recordId } = useParams<{ recordId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isAdmin } = useAuth()
  const { masterCellJoinById } = useLdrWorkspace()

  const [record, setRecord] = useState<AnyRecord | null>(null)
  const [typeName, setTypeName] = useState('')
  const [typeStandardUrl, setTypeStandardUrl] = useState<string | null>(null)
  const [operatorName, setOperatorName] = useState('')
  const [overallComment, setOverallComment] = useState('')
  const [sosLevel, setSosLevel] = useState<SosLevel | null>(null)
  const [sosQuestions, setSosQuestions] = useState<SosQRow[]>([])
  const [sosImg, setSosImg] = useState<Record<string, { good: string | null; bad: string | null }>>({})
  const [lines, setLines] = useState<QpLine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [submitNotice, setSubmitNotice] = useState<string | null>(null)
  const [rosterLinkPending, setRosterLinkPending] = useState(false)
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedDraftRef = useRef('')

  const scheduledCompletionDate = searchParams.get('completionDate') ?? ''
  const base = obsBasePath(kind)
  const rt = recTable(kind)
  const tc = typeCol(kind)

  const load = useCallback(async () => {
    if (!recordId) return
    setLoading(true)
    setError(null)
    const recRes = await supabase.from(rt).select('*').eq('id', recordId).maybeSingle()
    if (recRes.error || !recRes.data) {
      setLoading(false)
      setError(recRes.error?.message ?? 'Record not found.')
      setRecord(null)
      setLines([])
      setSosQuestions([])
      setTypeStandardUrl(null)
      return
    }
    const rec = recRes.data as AnyRecord
    const tRes = await supabase.from(typesTable(kind)).select('name, standard_url').eq('id', rec[tc] as string).maybeSingle()
    const tdata = tRes.data as { name?: string; standard_url?: string | null } | null
    setTypeName(tdata?.name ?? '')
    setTypeStandardUrl(tdata?.standard_url ?? null)

    if (kind === 'sos') {
      const qRes = await supabase
        .from(qTable(kind))
        .select('id, question_text, expected_standard, help_text, sort_order, good_image_path, bad_image_path')
        .eq('template_id', rec.template_id)
        .eq('active', true)
        .order('sort_order')
      const qs = (qRes.data ?? []) as SosQRow[]
      setSosQuestions(qs)
      const img: Record<string, { good: string | null; bad: string | null }> = {}
      for (const q of qs) {
        img[q.id] = {
          good: await obsSignedImageUrl(supabase, q.good_image_path),
          bad: await obsSignedImageUrl(supabase, q.bad_image_path),
        }
      }
      setSosImg(img)
      setLines([])
      lastSavedDraftRef.current = JSON.stringify({
        operatorName: (rec.operator_name as string) ?? '',
        overallComment: (rec.overall_comment as string) ?? '',
        sosLevel: (rec.sos_level as SosLevel | null) ?? null,
        lines: [],
      })
    } else {
      const ansRes = await supabase.from(ansTable(kind)).select('*').eq(`${kind}_record_id`, recordId)
      if (ansRes.error) {
        setLoading(false)
        setError(ansRes.error.message)
        return
      }
      const answers = (ansRes.data ?? []) as Record<string, unknown>[]
      const submitted = !!rec.completed_at
      const qIds = [...new Set(answers.map((a) => a.template_question_id as string))]
      let qRows: Record<string, SosQRow> = {}
      if (qIds.length) {
        const qRes = await supabase.from(qTable(kind)).select('*').in('id', qIds).eq('template_id', rec.template_id)
        if (!qRes.error && qRes.data) {
          qRows = Object.fromEntries((qRes.data as SosQRow[]).map((q) => [q.id, q]))
        }
      }
      const built: QpLine[] = []
      for (const a of answers.sort((x, y) => (x.sort_order as number) - (y.sort_order as number))) {
        const qid = a.template_question_id as string
        const q = qRows[qid]
        const ans = a.answer as 'pass' | 'fail' | 'na'
        built.push({
          answerId: a.id as string,
          templateQuestionId: qid,
          questionText: submitted
            ? ((a.question_text_snapshot as string) ?? '—')
            : (q?.question_text ?? (a.question_text_snapshot as string) ?? '—'),
          expectedStandard: submitted
            ? ((a.expected_standard_snapshot as string) ?? '')
            : (q?.expected_standard ?? (a.expected_standard_snapshot as string) ?? ''),
          answer: ans,
          comment: (a.comment as string) ?? '',
          operatorName: (a.operator_name as string) ?? '',
          sortOrder: (a.sort_order as number) ?? 0,
          goodPath: q?.good_image_path ?? '',
          badPath: q?.bad_image_path ?? '',
          goodUrl: null,
          badUrl: null,
        })
      }
      const imgUpdates: QpLine[] = []
      for (const l of built) {
        const g = await obsSignedImageUrl(supabase, l.goodPath)
        const b = await obsSignedImageUrl(supabase, l.badPath)
        imgUpdates.push({ ...l, goodUrl: g, badUrl: b })
      }
      setLines(imgUpdates)
      setSosQuestions([])
      lastSavedDraftRef.current = JSON.stringify({
        overallComment: (rec.overall_comment as string) ?? '',
        sosLevel: null,
        lines: imgUpdates.map((l) => ({
          id: l.answerId,
          answer: l.answer,
          comment: l.comment,
          operatorName: l.operatorName,
        })),
      })
    }

    setRecord(rec)
    setOperatorName(kind === 'sos' ? ((rec.operator_name as string) ?? '') : '')
    setOverallComment((rec.overall_comment as string) ?? '')
    setSosLevel((rec.sos_level as SosLevel | null) ?? null)
    setLoading(false)
  }, [recordId, kind, rt, tc])

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
      setRosterLinkPending(hasPendingObsLdrAssignment(kind, recordId))
    })
  }, [recordId, kind])

  useEffect(() => {
    queueMicrotask(() => {
      if (!recordId || !record?.ldr_assignment_id) return
      clearPendingObsLdrAssignment(kind, recordId)
      setRosterLinkPending(false)
    })
  }, [record?.ldr_assignment_id, recordId, kind])

  const submitted = !!record?.completed_at
  const isOwner = user?.id && record?.completed_by_user_id === user.id
  const readOnly = submitted || !isOwner
  const canDelete = Boolean(isAdmin && recordId && record)
  const showActionDock = Boolean(!readOnly || canDelete)
  const dockLeftClass = useAppSectionSidebarDockLeftClass(LDR_TOOLS_SIDEBAR_STORAGE_KEY)

  const gapUiSos = !readOnly
  const gapUiQp = !readOnly && lines.length > 0
  const submitBlockedReason = useMemo(
    () => (readOnly ? null : obsSubmitBlockerMessage(kind, lines, operatorName, sosLevel)),
    [readOnly, kind, lines, operatorName, sosLevel],
  )

  const qpSummary = useMemo(() => {
    if (kind === 'sos') return { pct: 0, rag: 'green' as HcRag, scored: 0, passes: 0 }
    const scored = lines.filter((l) => l.answer === 'pass' || l.answer === 'fail')
    const passes = lines.filter((l) => l.answer === 'pass').length
    const t = scored.length
    const p = passes
    const pct = hcScorePercent(p, t)
    const rag = kind === 'ppo' ? ppoScoreAndRag(p, t).rag : hcRagFromPercent(pct)
    return { pct, rag, scored: t, passes: p }
  }, [kind, lines])

  const displayRag: HcRag | null =
    kind === 'sos'
      ? submitted && record?.status
        ? (record.status as HcRag)
        : sosLevel
          ? sosLevelToStatusAndScore(sosLevel).status
          : null
      : submitted && record?.status
        ? (record.status as HcRag)
        : !submitted
          ? qpSummary.rag
          : null

  const displayPct =
    kind === 'sos'
      ? submitted && record?.score != null
        ? record.score
        : sosLevel
          ? sosLevelToStatusAndScore(sosLevel).score
          : null
      : submitted && record?.score != null
        ? record.score
        : qpSummary.pct

  function setLine(id: string, patch: Partial<Pick<QpLine, 'answer' | 'comment' | 'operatorName'>>) {
    setLines((prev) => prev.map((l) => (l.answerId === id ? { ...l, ...patch } : l)))
  }

  const draftSnapshot = useMemo(
    () =>
      JSON.stringify(
        kind === 'sos'
          ? { operatorName, overallComment, sosLevel, lines: [] as const }
          : {
              overallComment,
              sosLevel: null,
              lines: lines.map((l) => ({
                id: l.answerId,
                answer: l.answer,
                comment: l.comment,
                operatorName: l.operatorName,
              })),
            },
      ),
    [kind, lines, operatorName, overallComment, sosLevel],
  )

  useEffect(() => {
    if (!recordId || !record || readOnly || loading) return
    if (draftSnapshot === lastSavedDraftRef.current) return
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    autoSaveTimeoutRef.current = setTimeout(() => {
      void (async () => {
        setAutoSaveState('saving')
        const recUp = await supabase
          .from(rt)
          .update({
            operator_name: kind === 'sos' ? operatorName.trim() || null : null,
            overall_comment: overallComment.trim() || null,
            ...(kind === 'sos' ? { sos_level: sosLevel } : {}),
          })
          .eq('id', recordId)
          .is('completed_at', null)
        if (recUp.error) {
          setAutoSaveState('error')
          return
        }
        if (kind !== 'sos') {
          const at = ansTable(kind)
          for (const l of lines) {
            const scoreVal = l.answer === 'pass' ? 1 : l.answer === 'fail' ? 0 : null
            const up = await supabase
              .from(at)
              .update({
                answer: l.answer,
                score_value: scoreVal,
                comment: l.comment.trim(),
                operator_name: l.operatorName.trim() || null,
              })
              .eq('id', l.answerId)
            if (up.error) {
              setAutoSaveState('error')
              return
            }
          }
        }
        lastSavedDraftRef.current = draftSnapshot
        setAutoSaveState('saved')
      })()
    }, 800)
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    }
  }, [draftSnapshot, kind, lines, loading, operatorName, overallComment, readOnly, record, recordId, rt, sosLevel])

  async function submit() {
    if (!recordId || !record || submitted || !isOwner) return
    setError(null)

    const blocker = obsSubmitBlockerMessage(kind, lines, operatorName, sosLevel)
    if (blocker) {
      setError(blocker)
      return
    }

    const tplRes = await supabase
      .from(kind === 'sos' ? 'sos_templates' : kind === 'qos' ? 'qos_templates' : 'ppo_templates')
      .select('version')
      .eq('id', record.template_id)
      .maybeSingle()
    const templateVersion = (tplRes.data as { version?: number } | null)?.version ?? 1

    const typeId = record[tc] as string
    const dup = await findSubmittedObsDuplicateSameDay(supabase, kind, {
      completedByUserId: record.completed_by_user_id,
      typeId,
      masterCellId: record.master_cell_id,
      ldrAssignmentId: record.ldr_assignment_id ?? null,
    })
    if (dup.error) {
      setError(dup.error)
      return
    }
    if (dup.duplicateId) {
      setError(obsDuplicateSubmitMessage(kind))
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

    if (kind === 'sos') {
      const { status, score } = sosLevelToStatusAndScore(sosLevel!)
      const done = await supabase
        .from(rt)
        .update({
          operator_name: operatorName.trim() || null,
          overall_comment: overallComment.trim() || null,
          completed_at: completedAt,
          score,
          status,
          sos_level: sosLevel,
          template_version_snapshot: templateVersion,
        })
        .eq('id', recordId)
        .is('completed_at', null)
      setSaving(false)
      if (done.error) {
        setError(isObsDuplicateSubmitDbError(kind, done.error.message) ? obsDuplicateSubmitMessage(kind) : done.error.message)
        return
      }
      setSubmitNotice(
        record.ldr_assignment_id || rosterLinkPending
          ? `Submitted. The leadership roster assignment RAG and comments now reflect this ${obsLabel(kind)} result.`
          : null,
      )
      await load()
      return
    }

    const qRes = await supabase
      .from(qTable(kind))
      .select('id, question_text, expected_standard, sort_order')
      .eq('template_id', record.template_id)
      .in(
        'id',
        lines.map((l) => l.templateQuestionId),
      )
    if (qRes.error) {
      setSaving(false)
      setError(qRes.error.message)
      return
    }
    const qMap = new Map((qRes.data as SosQRow[]).map((q) => [q.id, q]))
    const scored = lines.filter((l) => l.answer === 'pass' || l.answer === 'fail')
    const passes = lines.filter((l) => l.answer === 'pass').length
    const score =
      kind === 'ppo'
        ? ppoScoreAndRag(passes, scored.length).score
        : qosScoreAndRag(passes, scored.length).score
    const status =
      kind === 'ppo'
        ? ppoScoreAndRag(passes, scored.length).rag
        : qosScoreAndRag(passes, scored.length).rag

    for (const l of lines) {
      const q = qMap.get(l.templateQuestionId)
      const up = await supabase
        .from(ansTable(kind))
        .update({
          answer: l.answer,
          score_value: l.answer === 'pass' ? 1 : l.answer === 'fail' ? 0 : null,
          comment: l.comment.trim(),
          operator_name: l.operatorName.trim() || null,
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
      .from(rt)
      .update({
        operator_name: null,
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
        isObsDuplicateSubmitDbError(kind, done.error.message) ? obsDuplicateSubmitMessage(kind) : done.error.message,
      )
      return
    }
    setSubmitNotice(
      record.ldr_assignment_id || rosterLinkPending
        ? `Submitted. The leadership roster assignment RAG and comments now reflect this ${obsLabel(kind)} result.`
        : null,
    )
    await load()
  }

  async function deleteRecord() {
    if (!recordId || !isAdmin) return
    const n = obsLabel(kind)
    if (!window.confirm(`Delete this ${n} record? This cannot be undone.`)) return
    setSaving(true)
    const del = await supabase.from(rt).delete().eq('id', recordId)
    setSaving(false)
    if (del.error) {
      setError(del.error.message)
      return
    }
    navigate(base)
  }

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
        <Link to={base} className="text-sky-700 hover:underline dark:text-sky-300">
          Back to list
        </Link>
      </div>
    )
  }

  const locJoin = record ? ldrMasterCellJoinFromId(record.master_cell_id, masterCellJoinById) : undefined
  const locLabel = locJoin ? ldrMasterCellLabel(locJoin) : ''
  const standardHref = standardLinkHref(typeStandardUrl) ?? DEFAULT_OBS_STANDARD_URL
  const standardLinkIsExternal = /^https?:\/\//i.test(standardHref)

  return (
    <div className={`space-y-4 ${showActionDock ? 'pb-20 md:pb-24' : ''}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex items-start gap-2">
          <Link
            to={base}
            className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:bg-surface-raised"
            aria-label="Back"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-800 dark:text-sky-200">
            <ClipboardList className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">
              {typeName || obsLabel(kind)}
              {submitted ? null : <span className="ml-2 align-middle text-sm font-normal text-muted">(draft)</span>}
            </h1>
            <p className="text-xs text-muted">{locLabel}</p>
          </div>
        </div>
      </div>

      {submitNotice ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-400/70 bg-emerald-100 px-3 py-2 text-xs text-black dark:border-emerald-500 dark:bg-emerald-200 dark:text-black"
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
        <div className="rounded-xl border border-danger/35 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-surface p-3 shadow-sm sm:p-4">
        {kind === 'sos' ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="order-2 min-w-0 max-w-full flex-1 space-y-3 sm:order-1 sm:max-w-xl md:max-w-2xl">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[11px] font-medium text-muted">
                  Operator
                  <input
                    type="text"
                    disabled={readOnly}
                    autoComplete="name"
                    aria-required="true"
                    aria-invalid={obsSosRecordOperatorNeedsAttention(gapUiSos, operatorName)}
                    className={`mt-0.5 h-9 w-full rounded-lg border bg-surface px-2.5 text-sm disabled:opacity-60 ${
                      obsSosRecordOperatorNeedsAttention(gapUiSos, operatorName)
                        ? 'border-red-600 dark:border-red-500'
                        : 'border-border-strong'
                    }`}
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    placeholder="Name of the operator observed"
                  />
                </label>
                <div className="text-xs text-muted sm:pt-5">
                  Completed by: <span className="font-medium text-fg">{record.completed_by_name}</span>
                  {record.ldr_assignment_id || rosterLinkPending ? (
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted">Linked to leadership roster assignment.</span>
                  ) : null}
                </div>
              </div>
              <label className="block max-w-full text-[11px] font-medium text-muted">
                Overall comment
                <AutoGrowTextarea
                  disabled={readOnly}
                  className="mt-0.5 w-full rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-sm disabled:opacity-60"
                  value={overallComment}
                  onChange={(e) => setOverallComment(e.target.value)}
                />
              </label>
            </div>
            <div className="order-1 flex w-full max-w-full shrink-0 flex-col items-stretch gap-3 self-end sm:order-2 sm:w-auto sm:items-end sm:self-start">
              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
                <a
                  href={standardHref}
                  {...(standardLinkIsExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-xs font-semibold text-sky-800 shadow-sm hover:bg-surface-raised dark:text-sky-200"
                >
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  View Standard
                </a>
                <div className="w-max max-w-full rounded-lg border border-border-strong bg-surface-raised/60 px-3 py-2 text-xs shadow-sm">
                  <div className="flex flex-nowrap items-center justify-start gap-2.5">
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted">Outcome</span>
                    {displayRag ? (
                      <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${hcRagBadgeClass(displayRag)}`}>
                        {hcRagLabel(displayRag)}
                      </span>
                    ) : (
                      <span className="shrink-0 text-muted">—</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="w-full text-right sm:w-auto">
                <p className="text-xs font-semibold text-fg">Observation outcome</p>
                {!readOnly ? (
                  <div
                    className={`mt-1.5 flex flex-wrap justify-end gap-1.5 ${
                      obsSosOutcomeNeedsAttention(gapUiSos, sosLevel)
                        ? 'rounded-lg border border-red-600 p-0.5 dark:border-red-500'
                        : ''
                    }`}
                  >
                    {(['full', 'partly', 'not'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setSosLevel(lvl)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize ${
                          sosLevel === lvl
                            ? sosOutcomeLevelButtonSelectedClass(lvl)
                            : 'border-border bg-white hover:bg-surface-raised dark:bg-surface'
                        }`}
                      >
                        {lvl === 'full' ? 'Full' : lvl === 'partly' ? 'Partly' : 'Not'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted">
                    Outcome: <span className="font-medium capitalize text-fg">{record.sos_level ?? '—'}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="order-2 min-w-0 flex-1 space-y-3 sm:order-1">
              <div className="text-xs text-muted">
                Completed by: <span className="font-medium text-fg">{record.completed_by_name}</span>
                {record.ldr_assignment_id || rosterLinkPending ? (
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted">Linked to leadership roster assignment.</span>
                ) : null}
              </div>
              <label className="block text-[11px] font-medium text-muted">
                Overall comment
                <AutoGrowTextarea
                  disabled={readOnly}
                  className="mt-0.5 w-full rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-sm disabled:opacity-60"
                  value={overallComment}
                  onChange={(e) => setOverallComment(e.target.value)}
                />
              </label>
            </div>
            <div className="order-1 max-w-full shrink-0 self-end sm:order-2 sm:self-start">
              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
                <a
                  href={standardHref}
                  {...(standardLinkIsExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-xs font-semibold text-sky-800 shadow-sm hover:bg-surface-raised dark:text-sky-200"
                >
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  View Standard
                </a>
                <div className="w-max max-w-full rounded-lg border border-border-strong bg-surface-raised/60 px-3 py-2 text-xs shadow-sm">
                  <div className="flex flex-nowrap items-center justify-start gap-2.5">
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted">Score</span>
                    <span className="shrink-0 font-mono text-base font-semibold tabular-nums text-fg">
                      {displayPct != null ? `${displayPct}%` : '—'}{' '}
                      <span className="text-xs font-normal text-muted">
                        ({qpSummary.passes}/{qpSummary.scored || lines.length})
                      </span>
                    </span>
                    {displayRag ? (
                      <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${hcRagBadgeClass(displayRag)}`}>
                        {submitted && record.status ? hcRagLabel(record.status) : `Live: ${hcRagLabel(displayRag)}`}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {kind === 'sos' ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Checklist (reference)</h2>
            {sosQuestions.map((q) => (
              <article key={q.id} className="rounded-xl border border-border-strong bg-surface p-3 shadow-sm sm:p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex gap-2">
                    <ObsFramedImage variant="good" src={sosImg[q.id]?.good ?? null} label="Good" compact />
                    <ObsFramedImage variant="bad" src={sosImg[q.id]?.bad ?? null} label="Bad" compact />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold leading-snug text-fg">{q.question_text}</h3>
                    <p className="mt-1 text-xs text-muted whitespace-pre-wrap leading-snug">{q.expected_standard || '—'}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {lines.map((l) => {
            const needsAnswer = obsQpLineNeedsAnswer(gapUiQp, l)
            const needsFailC = obsQpLineNeedsFailComment(gapUiQp, l)
            return (
            <article key={l.answerId} className="rounded-xl border border-border-strong bg-surface p-3 shadow-sm sm:p-4">
              <h2 className="text-sm font-semibold leading-snug text-fg">{l.questionText}</h2>
              <div className="mt-2 flex flex-wrap items-stretch gap-2 sm:gap-3">
                <div className="flex shrink-0 gap-2">
                  <ObsFramedImage variant="good" src={l.goodUrl} label="Good" compact />
                  <ObsFramedImage variant="bad" src={l.badUrl} label="Bad" compact />
                </div>
                <div className="min-h-0 min-w-0 flex-1 basis-[8rem] rounded-lg border border-border bg-surface-raised/40 px-2.5 py-1.5 text-xs text-fg/85">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Expected standard</div>
                  <p className="mt-0.5 whitespace-pre-wrap leading-snug">{l.expectedStandard || '—'}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5 sm:ml-auto">
                  <div className="w-fit max-w-full">
                    <div
                      className={`flex rounded-lg border bg-white p-0.5 dark:bg-surface ${
                        needsAnswer ? 'border-red-600 dark:border-red-500' : 'border-border'
                      }`}
                    >
                      {(['pass', 'fail', 'na'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          disabled={readOnly}
                          onClick={() => setLine(l.answerId, { answer: opt })}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase ${
                            l.answer === opt
                              ? opt === 'pass'
                                ? 'bg-emerald-600 text-white'
                                : opt === 'fail'
                                  ? 'bg-red-600 text-white'
                                  : 'bg-zinc-700 text-white'
                              : 'text-fg/80 hover:bg-surface-raised'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    <div className="mt-1.5 w-full rounded-lg border border-border bg-white p-0.5 dark:bg-surface">
                      <input
                        type="text"
                        disabled={readOnly}
                        autoComplete="name"
                        placeholder="Operator"
                        aria-label="Operator for this question"
                        className="w-full rounded-md border-0 bg-transparent px-2.5 py-1 text-[11px] text-fg outline-none placeholder:text-muted/65 focus-visible:ring-2 focus-visible:ring-sky-500/30 disabled:opacity-60 dark:focus-visible:ring-sky-400/35"
                        value={l.operatorName}
                        onChange={(e) => setLine(l.answerId, { operatorName: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <label className="mt-3 block text-[11px] font-medium text-muted">
                Comment
                <AutoGrowTextarea
                  disabled={readOnly}
                  aria-invalid={needsFailC}
                  className={`mt-0.5 w-full rounded-lg border bg-surface px-2.5 py-1.5 text-sm disabled:opacity-60 ${
                    needsFailC ? 'border-red-600 dark:border-red-500' : 'border-border-strong'
                  }`}
                  value={l.comment}
                  onChange={(e) => setLine(l.answerId, { comment: e.target.value })}
                />
              </label>
            </article>
            )
          })}
        </div>
      )}

      {showActionDock ? (
        <div
          className={`fixed bottom-0 right-0 z-40 border-t border-border bg-surface/95 pt-2 shadow-[0_-6px_24px_rgba(0,0,0,0.06)] backdrop-blur-md pb-[max(0.5rem,env(safe-area-inset-bottom))] ${dockLeftClass}`}
          role="toolbar"
          aria-label={`${obsLabel(kind)} actions`}
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-2 px-3 md:px-6">
            {!readOnly ? (
              <>
                <span className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-900 dark:bg-surface dark:text-fg">
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
                  disabled={saving || submitBlockedReason != null}
                  title={submitBlockedReason ?? undefined}
                  onClick={() => void submit()}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 dark:bg-sky-500"
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
                className="rounded-lg border border-red-800 bg-white px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-50 dark:border-red-300 dark:bg-surface dark:text-red-200"
              >
                Delete {obsLabel(kind)}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function SosRecordPage() {
  return <ObsRecordPage kind="sos" />
}
export function QosRecordPage() {
  return <ObsRecordPage kind="qos" />
}
export function PpoRecordPage() {
  return <ObsRecordPage kind="ppo" />
}
