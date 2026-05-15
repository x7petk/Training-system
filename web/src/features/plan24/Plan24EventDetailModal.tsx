import { useLayoutEffect, useCallback, useEffect, useRef, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import type { NavigateFunction } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Plan24CilRoutePanel } from './Plan24CilRoutePanel'
import { Plan24ClQualityRoutePanel } from './Plan24ClQualityRoutePanel'
import { plan24ClQualitySubTaskComplete } from './plan24ClQualityRouteUtils'
import { parsePlan24SubTasks } from './plan24ParseSubTasks'
import { addMinutes, formatPlan24Clock, minutesBetween } from './plan24ShiftUtils'
import type { Plan24EventRow, Plan24SubTask } from './plan24Types'

const inputClass =
  'w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2'

const detailInputClass =
  'w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm outline-none focus:border-border focus:ring-1 focus:ring-fg/10 dark:focus:ring-white/10'

const detailSaveButtonClass =
  'rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-fg outline-none [-webkit-tap-highlight-color:transparent] transition-colors hover:bg-black/[0.05] active:border-border active:bg-black/[0.08] active:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border/60 focus-visible:ring-offset-0 dark:hover:bg-white/[0.05] dark:active:bg-white/[0.1]'

export type Plan24EventDetailModalProps = {
  event: Plan24EventRow | null
  cellId: string | null
  windowEnd: Date
  userId: string | undefined
  isAdmin: boolean
  navigate: NavigateFunction
  onClose: () => void
  onSaved: () => void
  onLoadError: (msg: string | null) => void
  onSuccessMsg: (msg: string | null) => void
}

export function Plan24EventDetailModal({
  event,
  cellId,
  windowEnd,
  userId,
  isAdmin,
  navigate,
  onClose,
  onSaved,
  onLoadError,
  onSuccessMsg,
}: Plan24EventDetailModalProps) {
  const onLoadErrorRef = useRef(onLoadError)
  const onCloseRef = useRef(onClose)
  const onSavedRef = useRef(onSaved)
  const onSuccessMsgRef = useRef(onSuccessMsg)

  useLayoutEffect(() => {
    onLoadErrorRef.current = onLoadError
    onCloseRef.current = onClose
    onSavedRef.current = onSaved
    onSuccessMsgRef.current = onSuccessMsg
  }, [onLoadError, onClose, onSaved, onSuccessMsg])

  const [detailEv, setDetailEv] = useState<Plan24EventRow | null>(() => event ?? null)
  const [detailSubs, setDetailSubs] = useState<Plan24SubTask[]>(() => parsePlan24SubTasks(event?.sub_tasks))
  const [detailOverride, setDetailOverride] = useState(false)
  const [detailDurationMin, setDetailDurationMin] = useState(() =>
    event ? String(Math.max(5, Math.round(minutesBetween(new Date(event.start_at), new Date(event.end_at))))) : '30',
  )
  const [detailCompleting, setDetailCompleting] = useState(false)

  const [areas, setAreas] = useState<{ id: string; name: string }[]>([])
  const [equipment, setEquipment] = useState<{ id: string; area_id: string; name: string }[]>([])
  const [deviationTypes, setDeviationTypes] = useState<{ id: string; label: string; is_active: boolean; sort_order: number }[]>([])
  const [dhTypes, setDhTypes] = useState<{ id: string; label: string; is_active: boolean; sort_order: number }[]>([])
  const [qualityFailTypes, setQualityFailTypes] = useState<{ id: string; label: string; is_active: boolean; sort_order: number }[]>([])

  const [raiseIssueOpen, setRaiseIssueOpen] = useState(false)
  const [issueTitle, setIssueTitle] = useState('')
  const [issueDescription, setIssueDescription] = useState('')
  const [issueAreaId, setIssueAreaId] = useState('')
  const [issueEquipmentId, setIssueEquipmentId] = useState('')
  const [issuePriority, setIssuePriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [issueForTaskId, setIssueForTaskId] = useState<string | null>(null)

  const [deleteEv, setDeleteEv] = useState<Plan24EventRow | null>(null)
  const [deleteComment, setDeleteComment] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  useLayoutEffect(() => {
    if (!event) {
      setDetailEv(null)
      return
    }
    setDetailEv(event)
    setDetailSubs(parsePlan24SubTasks(event.sub_tasks))
    setDetailOverride(false)
    setDetailCompleting(false)
    const dur = Math.max(5, Math.round(minutesBetween(new Date(event.start_at), new Date(event.end_at))))
    setDetailDurationMin(String(dur))
  }, [event])

  useEffect(() => {
    if (!event) {
      setRaiseIssueOpen(false)
      setDeleteEv(null)
    }
  }, [event])

  useEffect(() => {
    if (!cellId) return
    void (async () => {
      const [aRes, eRes, devRes, dhRes, qfRes] = await Promise.all([
        supabase.from('master_areas').select('id, name').eq('cell_id', cellId).order('sort_order').order('name'),
        supabase.from('master_equipment').select('id, area_id, name').order('sort_order').order('name'),
        supabase.from('deviation_types').select('id, label, is_active, sort_order').eq('is_active', true).order('sort_order').order('label'),
        supabase.from('dh_defect_types').select('id, label, is_active, sort_order').eq('is_active', true).order('sort_order').order('label'),
        supabase.from('quality_fail_types').select('id, label, is_active, sort_order').eq('is_active', true).order('sort_order').order('label'),
      ])
      const err = aRes.error ?? eRes.error ?? devRes.error ?? dhRes.error ?? qfRes.error
      if (err) {
        onLoadErrorRef.current(err.message)
        return
      }
      setAreas((aRes.data ?? []) as { id: string; name: string }[])
      setEquipment((eRes.data ?? []) as { id: string; area_id: string; name: string }[])
      setDeviationTypes((devRes.data ?? []) as { id: string; label: string; is_active: boolean; sort_order: number }[])
      setDhTypes((dhRes.data ?? []) as { id: string; label: string; is_active: boolean; sort_order: number }[])
      setQualityFailTypes((qfRes.data ?? []) as { id: string; label: string; is_active: boolean; sort_order: number }[])
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onLoadError kept fresh via ref
  }, [cellId])

  useEffect(() => {
    if (!detailEv || detailEv.event_type !== 'cil_check' || detailEv.cil_template_id || !detailEv.schedule_id) return
    let cancelled = false
    const sid = detailEv.schedule_id
    const eid = detailEv.id
    void (async () => {
      const { data, error } = await supabase.from('plan24_cil_check_schedules').select('template_id').eq('id', sid).maybeSingle()
      if (cancelled || error || !data?.template_id) return
      const tid = String(data.template_id)
      setDetailEv((prev) => (prev && prev.id === eid ? { ...prev, cil_template_id: tid } : prev))
      await supabase.from('plan24_events').update({ cil_template_id: tid }).eq('id', eid)
    })()
    return () => {
      cancelled = true
    }
  }, [detailEv?.id, detailEv?.event_type, detailEv?.schedule_id, detailEv?.cil_template_id])

  useEffect(() => {
    if (!detailEv || !['cil_check', 'cl_check', 'quality_check'].includes(String(detailEv.event_type))) return
    const eid = detailEv.id
    const title = detailEv.title
    const tmr = window.setTimeout(() => {
      void (async () => {
        const { error } = await supabase.from('plan24_events').update({ title: title.trim() }).eq('id', eid)
        if (error) onLoadErrorRef.current(error.message)
      })()
    }, 550)
    return () => window.clearTimeout(tmr)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onLoadError via ref
  }, [detailEv?.id, detailEv?.title, detailEv?.event_type])

  useEffect(() => {
    if (!event) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (raiseIssueOpen) {
        setRaiseIssueOpen(false)
        e.preventDefault()
        return
      }
      if (deleteEv) {
        setDeleteEv(null)
        e.preventDefault()
        return
      }
      if (event) {
        onCloseRef.current()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose via ref
  }, [event, raiseIssueOpen, deleteEv])

  const saveDetail = useCallback(async () => {
    if (!detailEv) return
    let status = detailEv.status
    let opened_at = detailEv.opened_at
    if (status === 'scheduled') {
      status = 'in_progress'
      opened_at = new Date().toISOString()
    }
    const isCheck = !detailEv.event_type || String(detailEv.event_type).toLowerCase() === 'check'
    const startAt = new Date(detailEv.start_at)
    const durRaw = Math.max(5, Math.round(Number(detailDurationMin)) || 5)
    const maxDurInWindow = Math.max(5, Math.floor(minutesBetween(startAt, windowEnd)))
    const dur = isCheck ? Math.min(maxDurInWindow, durRaw) : durRaw
    const endAt = isCheck ? addMinutes(startAt, dur).toISOString() : detailEv.end_at
    const { error } = await supabase
      .from('plan24_events')
      .update({
        title: detailEv.title,
        sub_tasks: detailSubs,
        status,
        opened_at,
        end_at: endAt,
      })
      .eq('id', detailEv.id)
    if (error) onLoadErrorRef.current(error.message)
    else {
      onCloseRef.current()
      onSavedRef.current()
    }
  }, [detailEv, detailSubs, detailDurationMin, windowEnd])

  const markComplete = useCallback(async () => {
    if (!detailEv || !userId) return
    const measured = detailEv.event_type === 'cl_check' || detailEv.event_type === 'quality_check'
    const measuredVariant = detailEv.event_type === 'quality_check' ? ('quality' as const) : ('cl' as const)
    const subsOk =
      detailSubs.length === 0 ||
      (measured
        ? detailSubs.every((s) => !s.required || plan24ClQualitySubTaskComplete(s, measuredVariant))
        : detailSubs.every((s) => s.done))
    if (!subsOk && !(isAdmin && detailOverride)) {
      onLoadErrorRef.current(
        measured
          ? detailEv.event_type === 'quality_check'
            ? 'Complete every required step (Pass or Fail for each). Or use admin override.'
            : 'Complete every required step (readings within limits or text filled). Or use admin override.'
          : 'Complete all sub-tasks, or use admin override.',
      )
      return
    }
    onLoadErrorRef.current(null)
    setDetailCompleting(true)
    try {
      const { error } = await supabase
        .from('plan24_events')
        .update({
          title: detailEv.title.trim(),
          status: 'complete',
          completed_at: new Date().toISOString(),
          completed_by: userId,
          opened_at: detailEv.opened_at ?? new Date().toISOString(),
          sub_tasks: detailSubs,
        })
        .eq('id', detailEv.id)
      if (error) onLoadErrorRef.current(error.message)
      else {
        onCloseRef.current()
        onSavedRef.current()
      }
    } finally {
      setDetailCompleting(false)
    }
  }, [detailEv, detailSubs, detailOverride, isAdmin, userId])

  const openRaiseIssueForCilTask = useCallback(
    (task: Plan24SubTask) => {
      if (!detailEv) return
      setIssueTitle(`Defect: ${detailEv.title} — ${task.label}`)
      setIssueDescription('')
      setIssueAreaId(detailEv.area_id ?? '')
      setIssueEquipmentId(detailEv.equipment_id ?? '')
      setIssuePriority('medium')
      setIssueForTaskId(task.id)
      setRaiseIssueOpen(true)
    },
    [detailEv],
  )

  const openRaiseIssueForMeasuredTask = useCallback(
    (task: Plan24SubTask) => {
      if (!detailEv) return
      const kind = detailEv.event_type
      const prefix = kind === 'cl_check' ? 'Deviation' : kind === 'quality_check' ? 'Quality fail' : 'Issue'
      setIssueTitle(`${prefix}: ${detailEv.title} — ${task.label}`)
      setIssueDescription('')
      setIssueAreaId(detailEv.area_id ?? '')
      setIssueEquipmentId(detailEv.equipment_id ?? '')
      setIssuePriority('medium')
      setIssueForTaskId(task.id)
      setRaiseIssueOpen(true)
    },
    [detailEv],
  )

  const submitRaisedIssue = useCallback(async () => {
    if (!detailEv || !cellId || !userId || !issueTitle.trim()) return
    const eventKind = String(detailEv.event_type || '')
    const areaName = issueAreaId ? areas.find((a) => a.id === issueAreaId)?.name ?? null : null
    const equipmentName = issueEquipmentId ? equipment.find((e) => e.id === issueEquipmentId)?.name ?? null : null

    let linkedIssueKind: string | null = null
    let linkedIssueId: string | null = null
    if (eventKind === 'cl_check') {
      const defectTypeId = deviationTypes[0]?.id
      if (!defectTypeId) {
        onLoadErrorRef.current('No active deviation types. Ask super admin to add one.')
        return
      }
      const { data, error } = await supabase
        .from('deviations')
        .insert({
          master_cell_id: cellId,
          defect_type_id: defectTypeId,
          title: issueTitle.trim(),
          description: issueDescription.trim() || null,
          area: areaName,
          equipment: equipmentName,
          priority: issuePriority,
          status: 'open',
          location_summary: [areaName, equipmentName].filter(Boolean).join(' / ') || null,
          created_by: userId,
        })
        .select('id')
        .single()
      if (error || !data) {
        onLoadErrorRef.current(error?.message ?? 'Could not create deviation.')
        return
      }
      if (issueForTaskId) {
        onSuccessMsgRef.current('Deviation recorded.')
        setRaiseIssueOpen(false)
        setIssueForTaskId(null)
        onSavedRef.current()
        return
      }
      linkedIssueKind = 'deviation'
      linkedIssueId = data.id as string
    } else if (eventKind === 'cil_check') {
      const defectTypeId = dhTypes[0]?.id
      if (!defectTypeId) {
        onLoadErrorRef.current('No active DH defect types. Ask super admin to add one.')
        return
      }
      const cilTpl = detailEv.cil_template_id ?? null
      const { data, error } = await supabase
        .from('dh_defects')
        .insert({
          master_cell_id: cellId,
          defect_type_id: defectTypeId,
          title: issueTitle.trim(),
          description: issueDescription.trim() || null,
          area: areaName,
          equipment: equipmentName,
          area_id: issueAreaId || null,
          equipment_id: issueEquipmentId || null,
          cil_template_id: cilTpl,
          cil_template_task_id: issueForTaskId || null,
          priority: issuePriority,
          status: 'open',
          location_summary: [areaName, equipmentName].filter(Boolean).join(' / ') || null,
          created_by: userId,
        })
        .select('id')
        .single()
      if (error || !data) {
        onLoadErrorRef.current(error?.message ?? 'Could not create defect.')
        return
      }
      if (issueForTaskId) {
        onSuccessMsgRef.current('Defect created.')
        setRaiseIssueOpen(false)
        setIssueForTaskId(null)
        onSavedRef.current()
        return
      }
      linkedIssueKind = 'dh_defect'
      linkedIssueId = data.id as string
    } else if (eventKind === 'quality_check') {
      const defectTypeId = qualityFailTypes[0]?.id
      if (!defectTypeId) {
        onLoadErrorRef.current('No active quality fail types. Ask super admin to add one.')
        return
      }
      const { data, error } = await supabase
        .from('quality_fails')
        .insert({
          master_cell_id: cellId,
          defect_type_id: defectTypeId,
          title: issueTitle.trim(),
          description: issueDescription.trim() || null,
          area: areaName,
          equipment: equipmentName,
          priority: issuePriority,
          status: 'open',
          location_summary: [areaName, equipmentName].filter(Boolean).join(' / ') || null,
          created_by: userId,
        })
        .select('id')
        .single()
      if (error || !data) {
        onLoadErrorRef.current(error?.message ?? 'Could not create quality fail.')
        return
      }
      if (issueForTaskId) {
        onSuccessMsgRef.current('Quality fail recorded.')
        setRaiseIssueOpen(false)
        setIssueForTaskId(null)
        onSavedRef.current()
        return
      }
      linkedIssueKind = 'quality_fail'
      linkedIssueId = data.id as string
    } else {
      onLoadErrorRef.current('Raise issue is only available for CL, CIL, and Quality checks.')
      return
    }

    const { error: eventErr } = await supabase
      .from('plan24_events')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString(),
        completed_by: userId,
        linked_issue_kind: linkedIssueKind,
        linked_issue_id: linkedIssueId,
        linked_issue_created_at: new Date().toISOString(),
        area_id: issueAreaId || null,
        equipment_id: issueEquipmentId || null,
      })
      .eq('id', detailEv.id)
    if (eventErr) {
      onLoadErrorRef.current(eventErr.message)
      return
    }
    onSuccessMsgRef.current(
      linkedIssueKind === 'deviation'
        ? 'Deviation created and linked.'
        : linkedIssueKind === 'dh_defect'
          ? 'Defect created and linked.'
          : 'Quality fail created and linked.',
    )
    setRaiseIssueOpen(false)
    setIssueForTaskId(null)
    onCloseRef.current()
    onSavedRef.current()
  }, [
    areas,
    cellId,
    detailEv,
    deviationTypes,
    dhTypes,
    equipment,
    issueAreaId,
    issueDescription,
    issueEquipmentId,
    issueForTaskId,
    issuePriority,
    issueTitle,
    qualityFailTypes,
    userId,
  ])

  const openLinkedIssue = useCallback(() => {
    if (!detailEv?.linked_issue_id) return
    const kind = detailEv.linked_issue_kind
    let path = '/rtt-systems/defect-handling'
    if (kind === 'deviation') path = '/rtt-systems/deviations'
    else if (kind === 'quality_fail') path = '/rtt-systems/quality-fails'
    else if (kind === 'dh_defect') path = '/rtt-systems/defect-handling'
    navigate(`${path}?linkedIssueId=${detailEv.linked_issue_id}`)
    onCloseRef.current()
  }, [detailEv, navigate])

  const confirmDelete = useCallback(async () => {
    if (!deleteEv || !userId || !deleteComment.trim()) return
    setDeleteBusy(true)
    const { error } = await supabase
      .from('plan24_events')
      .update({
        deleted_at: new Date().toISOString(),
        delete_comment: deleteComment.trim(),
        deleted_by: userId,
      })
      .eq('id', deleteEv.id)
    setDeleteBusy(false)
    if (error) onLoadErrorRef.current(error.message)
    else {
      setDeleteEv(null)
      setDeleteComment('')
      onCloseRef.current()
      onSavedRef.current()
    }
  }, [deleteEv, deleteComment, userId])

  if (!event || !detailEv) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
        <div
          className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border-strong bg-surface p-5 shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="plan24-check-detail-title"
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h2 id="plan24-check-detail-title" className="font-display text-lg font-semibold">
                Check
              </h2>
              <button
                type="button"
                className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-black/[0.06] hover:text-fg dark:hover:bg-white/10"
                aria-label="Close"
                onClick={() => onCloseRef.current()}
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <label className="block text-xs font-medium text-muted">
              Title
              <input
                className={`${detailInputClass} mt-1`}
                value={detailEv.title}
                onChange={(e) => setDetailEv({ ...detailEv, title: e.target.value })}
              />
            </label>
            {!detailEv.event_type || String(detailEv.event_type).toLowerCase() === 'check' ? (
              <label className="block text-xs font-medium text-muted">
                Duration (minutes)
                <input
                  type="number"
                  min={5}
                  step={1}
                  className={`${detailInputClass} mt-1`}
                  inputMode="numeric"
                  value={detailDurationMin}
                  onChange={(e) => setDetailDurationMin(e.target.value)}
                />
                <span className="mt-1 block text-[10px] text-muted/90">
                  Starts {formatPlan24Clock(new Date(detailEv.start_at))} · end updates from duration
                </span>
              </label>
            ) : null}
            <div className="text-xs text-muted">
              {detailEv.role_name ? `Role: ${detailEv.role_name}` : 'Unassigned'} · {detailEv.source === 'ad_hoc' ? 'Ad hoc' : 'Scheduled'}
            </div>
            {detailEv.linked_issue_id ? (
              <div className="rounded-lg border border-border bg-surface-raised/40 px-2.5 py-2 text-xs text-muted">
                Linked issue: {detailEv.linked_issue_kind ?? 'issue'} · {detailEv.linked_issue_id}
              </div>
            ) : null}
            {detailEv.event_type === 'cil_check' && cellId ? (
              <Plan24CilRoutePanel
                event={detailEv}
                cellId={cellId}
                subs={detailSubs}
                onSubsChange={setDetailSubs}
                onMarkFullComplete={() => void markComplete()}
                routeSubmitting={detailCompleting}
                onOpenDefectForTask={openRaiseIssueForCilTask}
              />
            ) : detailEv.event_type === 'cl_check' || detailEv.event_type === 'quality_check' ? (
              <Plan24ClQualityRoutePanel
                variant={detailEv.event_type === 'cl_check' ? 'cl' : 'quality'}
                event={detailEv}
                subs={detailSubs}
                onSubsChange={setDetailSubs}
                onMarkFullComplete={() => void markComplete()}
                routeSubmitting={detailCompleting}
                onOpenIssueForTask={openRaiseIssueForMeasuredTask}
              />
            ) : (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-fg/80">Sub-tasks</span>
                {detailSubs.map((s, idx) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={s.done}
                      onChange={() => {
                        const next = [...detailSubs]
                        next[idx] = { ...s, done: !s.done }
                        setDetailSubs(next)
                      }}
                    />
                    <input
                      className={`${detailInputClass} flex-1 py-1.5`}
                      value={s.label}
                      onChange={(e) => {
                        const next = [...detailSubs]
                        next[idx] = { ...s, label: e.target.value }
                        setDetailSubs(next)
                      }}
                    />
                  </label>
                ))}
                <button
                  type="button"
                  className="text-xs font-semibold text-accent hover:underline"
                  onClick={() =>
                    setDetailSubs((prev) => [...prev, { id: crypto.randomUUID(), label: 'New step', done: false }])
                  }
                >
                  + Add sub-task
                </button>
              </div>
            )}
            {isAdmin ? (
              <label className="flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={detailOverride} onChange={(e) => setDetailOverride(e.target.checked)} />
                Admin: complete without all sub-tasks
              </label>
            ) : null}
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              {detailEv.event_type !== 'cil_check' &&
              detailEv.event_type !== 'cl_check' &&
              detailEv.event_type !== 'quality_check' ? (
                <>
                  <button type="button" className={detailSaveButtonClass} onClick={() => void saveDetail()}>
                    Save
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 dark:bg-emerald-600"
                    onClick={() => void markComplete()}
                  >
                    Mark complete
                  </button>
                </>
              ) : null}
              {detailEv.linked_issue_id ? (
                <button
                  type="button"
                  className="rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-raised/60"
                  onClick={openLinkedIssue}
                >
                  View linked issue
                </button>
              ) : null}
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger/10"
                onClick={() => {
                  setDeleteEv(detailEv)
                  setDeleteComment('')
                }}
              >
                <Trash2 className="size-4" aria-hidden />
                Remove…
              </button>
            </div>
          </div>
        </div>
      </div>

      {raiseIssueOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border-strong bg-surface p-5 shadow-xl" role="dialog" aria-modal="true">
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold">
                {detailEv?.event_type === 'cl_check'
                  ? 'Raise deviation'
                  : detailEv?.event_type === 'cil_check'
                    ? 'Raise defect'
                    : 'Record quality fail'}
              </h2>
              <label className="block text-xs font-medium text-muted">
                Title
                <input className={`${inputClass} mt-1`} value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} />
              </label>
              <label className="block text-xs font-medium text-muted">
                Description
                <textarea
                  className={`${inputClass} mt-1 min-h-[88px] py-2`}
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-muted">
                  Area
                  <select className={inputClass} value={issueAreaId} onChange={(e) => setIssueAreaId(e.target.value)}>
                    <option value="">-- None --</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-muted">
                  Equipment
                  <select className={inputClass} value={issueEquipmentId} onChange={(e) => setIssueEquipmentId(e.target.value)}>
                    <option value="">-- None --</option>
                    {equipment
                      .filter((e) => !issueAreaId || e.area_id === issueAreaId)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <label className="block text-xs font-medium text-muted">
                Priority
                <select
                  className={inputClass}
                  value={issuePriority}
                  onChange={(e) => setIssuePriority(e.target.value as 'low' | 'medium' | 'high' | 'critical')}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-black/[0.06]" onClick={() => setRaiseIssueOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={!issueTitle.trim()}
                  onClick={() => void submitRaisedIssue()}
                >
                  Save and link
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteEv ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-strong bg-surface p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold">Remove from plan</h2>
              <p className="text-xs text-muted">Soft delete with a required comment (audit).</p>
              <textarea
                className={`${inputClass} min-h-[5rem]`}
                value={deleteComment}
                onChange={(e) => setDeleteComment(e.target.value)}
                placeholder="Why is this being removed?"
              />
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-black/[0.06]" onClick={() => setDeleteEv(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteBusy || !deleteComment.trim()}
                  className="rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={() => void confirmDelete()}
                >
                  Confirm remove
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
