import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { localYMD } from '../../lib/dueDateUtils'
import { activeAdminItems, activeOwners } from './eplanAdminService'
import { EPLAN_STATUS_LABEL, EPLAN_STATUS_ORDER } from './eplanConstants'
import type { EPlanAction, EPlanActionStatus, EPlanAdminStore } from './eplanTypes'
import { eplanAddDaysYmd, eplanFormatDisplayDate } from './eplanUtils'

const inputClass =
  'mt-0.5 w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2'

type Props = {
  open: boolean
  mode: 'create' | 'edit'
  action: EPlanAction | null
  admin: EPlanAdminStore
  siteId: string
  plantId: string
  cellId: string
  defaultRaisedById: string
  parentActionId?: string
  onClose: () => void
  onSave: (action: EPlanAction) => void
  onSaveAndSub?: (parent: EPlanAction) => void
  onMarkNotRequired?: (action: EPlanAction) => void
  onDelete?: (id: string) => void
}

export function EPlanActionModal({
  open,
  mode,
  action,
  admin,
  siteId,
  plantId,
  cellId,
  defaultRaisedById,
  parentActionId,
  onClose,
  onSave,
  onSaveAndSub,
  onMarkNotRequired,
  onDelete,
}: Props) {
  const today = localYMD(new Date())
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(eplanAddDaysYmd(today, 30))
  const [ogsmPillarId, setOgsmPillarId] = useState('')
  const [forumId, setForumId] = useState('')
  const [status, setStatus] = useState<EPlanActionStatus>('NOT_STARTED')
  const [actionOwnerId, setActionOwnerId] = useState('')
  const [labelId, setLabelId] = useState('')
  const [lossTypeId, setLossTypeId] = useState('')
  const [progress, setProgress] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setErr(null)
    if (mode === 'edit' && action) {
      setTitle(action.title)
      setDescription(action.description ?? '')
      setStartDate(action.startDate)
      setEndDate(action.endDate)
      setOgsmPillarId(action.ogsmPillarId)
      setForumId(action.forumId)
      setStatus(action.status)
      setActionOwnerId(action.actionOwnerId)
      setLabelId(action.labelId ?? '')
      setLossTypeId(action.lossTypeId ?? '')
      setProgress(action.progress != null ? String(action.progress) : '')
    } else {
      const ogsm = activeAdminItems(admin.ogsmPillars)[0]
      const forum = activeAdminItems(admin.forums)[0]
      const owner = activeOwners(admin.owners)[0]
      setTitle('')
      setDescription('')
      setStartDate(today)
      setEndDate(eplanAddDaysYmd(today, 30))
      setOgsmPillarId(ogsm?.id ?? '')
      setForumId(forum?.id ?? '')
      setStatus('NOT_STARTED')
      setActionOwnerId(owner?.id ?? '')
      setLabelId('')
      setLossTypeId('')
      setProgress('')
    }
  }, [open, mode, action, admin, today])

  if (!open) return null

  function validate(): string | null {
    if (!title.trim()) return 'Title is required.'
    if (!startDate || !endDate) return 'Start and end dates are required.'
    if (endDate < startDate) return 'End date cannot be before start date.'
    if (!cellId) return 'Select a cell in the scope bar.'
    if (!actionOwnerId) return 'Owner is required.'
    if (!ogsmPillarId) return 'OGSM category is required.'
    if (!forumId) return 'Forum is required.'
    return null
  }

  function buildAction(): EPlanAction | null {
    const v = validate()
    if (v) {
      setErr(v)
      return null
    }
    const raisedById = mode === 'edit' && action ? action.raisedById : defaultRaisedById
    const progressNum = progress.trim() ? Math.min(100, Math.max(0, Number(progress))) : undefined
    const base = {
      title: title.trim(),
      description: description.trim() || undefined,
      siteId,
      plantId,
      cellId,
      startDate,
      endDate,
      ogsmPillarId,
      forumId,
      status,
      actionOwnerId,
      labelId: labelId || undefined,
      lossTypeId: lossTypeId || undefined,
      raisedById,
      progress: Number.isFinite(progressNum) ? progressNum : undefined,
      parentActionId: parentActionId ?? action?.parentActionId,
    }
    if (mode === 'edit' && action) {
      return { ...action, ...base, updatedAt: new Date().toISOString() }
    }
    const t = new Date().toISOString()
    return { id: crypto.randomUUID(), ...base, createdAt: t, updatedAt: t }
  }

  function handleSave(andSub = false) {
    const next = buildAction()
    if (!next) return
    onSave(next)
    if (andSub && onSaveAndSub) onSaveAndSub(next)
    else onClose()
  }

  const ogsm = activeAdminItems(admin.ogsmPillars)
  const forums = activeAdminItems(admin.forums)
  const labels = activeAdminItems(admin.labels)
  const lossTypes = activeAdminItems(admin.lossTypes)
  const owners = activeOwners(admin.owners)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">
            {mode === 'create' ? (parentActionId ? 'New sub-action' : 'New e-Plan action') : 'Edit e-Plan action'}
          </h2>
          <button type="button" className="rounded-lg p-1 text-muted hover:bg-black/[0.06]" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        {err ? <p className="mb-2 rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive">{err}</p> : null}

        <div className="space-y-3 text-sm">
          <label className="block font-medium text-muted">
            Title
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block font-medium text-muted">
            Description
            <textarea className={`${inputClass} min-h-[4rem]`} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block font-medium text-muted">
              Start
              <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="block font-medium text-muted">
              End
              <input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </div>
          <label className="block font-medium text-muted">
            OGSM / category
            <select className={inputClass} value={ogsmPillarId} onChange={(e) => setOgsmPillarId(e.target.value)}>
              <option value="">Select…</option>
              {ogsm.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-medium text-muted">
            Forum
            <select className={inputClass} value={forumId} onChange={(e) => setForumId(e.target.value)}>
              <option value="">Select…</option>
              {forums.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-medium text-muted">
            Status
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as EPlanActionStatus)}>
              {EPLAN_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {EPLAN_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-medium text-muted">
            Owner
            <select className={inputClass} value={actionOwnerId} onChange={(e) => setActionOwnerId(e.target.value)}>
              <option value="">Select…</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block font-medium text-muted">
              Label
              <select className={inputClass} value={labelId} onChange={(e) => setLabelId(e.target.value)}>
                <option value="">None</option>
                {labels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block font-medium text-muted">
              Loss type
              <select className={inputClass} value={lossTypeId} onChange={(e) => setLossTypeId(e.target.value)}>
                <option value="">None</option>
                {lossTypes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!action?.parentActionId && !parentActionId ? (
            <label className="block font-medium text-muted">
              Progress %
              <input
                type="number"
                min={0}
                max={100}
                className={inputClass}
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                placeholder="Optional for in-progress statuses"
              />
            </label>
          ) : null}
          {mode === 'edit' && action ? (
            <div className="rounded-lg border border-border bg-surface-raised/50 px-3 py-2 text-xs text-muted">
              <p>Raised by: {eplanOwnerLabel(admin, action.raisedById)}</p>
              <p>Created: {eplanFormatDisplayDate(action.createdAt.slice(0, 10))}</p>
              <p>Updated: {eplanFormatDisplayDate(action.updatedAt.slice(0, 10))}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-fg hover:opacity-90"
            onClick={() => handleSave(false)}
          >
            {mode === 'edit' ? 'Save changes' : 'Save'}
          </button>
          {mode === 'create' && onSaveAndSub && !parentActionId ? (
            <button
              type="button"
              className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-black/[0.04]"
              onClick={() => handleSave(true)}
            >
              Save and add sub-action
            </button>
          ) : null}
          {mode === 'edit' && action && !action.parentActionId && onSaveAndSub ? (
            <button
              type="button"
              className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-black/[0.04]"
              onClick={() => {
                const next = buildAction()
                if (next) onSaveAndSub(next)
              }}
            >
              Add sub-action
            </button>
          ) : null}
          <button type="button" className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted" onClick={onClose}>
            Cancel
          </button>
          {mode === 'edit' && action && onMarkNotRequired ? (
            <button
              type="button"
              className="ml-auto rounded-xl border border-border px-3 py-2 text-xs text-muted hover:bg-black/[0.04]"
              onClick={() => onMarkNotRequired({ ...action, status: 'NOT_REQUIRED', updatedAt: new Date().toISOString() })}
            >
              Mark Not Required
            </button>
          ) : null}
          {mode === 'edit' && action && onDelete ? (
            <button
              type="button"
              className="rounded-xl border border-destructive/40 px-3 py-2 text-xs text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (window.confirm('Delete this action and its sub-actions?')) onDelete(action.id)
              }}
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function eplanOwnerLabel(admin: EPlanAdminStore, id: string): string {
  return admin.owners.find((o) => o.id === id)?.name ?? id.slice(0, 8)
}
