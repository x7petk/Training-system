import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { DdsRrBehaviourOption, DdsRrEntryRow, DdsRrNameMode, DdsRrValueOption } from './ddsRewardRecognition'
import { DDS_RR_NAME_MODE_OPTIONS } from './ddsRewardRecognition'

const inputClass =
  'w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2'

type PersonLite = {
  id: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
}

function personLabel(p: PersonLite): string {
  const a = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  return a || p.display_name || p.id.slice(0, 8)
}

export type DdsRrEntryDraft = {
  nameMode: DdsRrNameMode
  personIds: string[]
  freeTextNames: string
  reason: string
  valueOptionId: string
  behaviourOptionId: string
}

type Props = {
  open: boolean
  title: string
  values: DdsRrValueOption[]
  behaviours: DdsRrBehaviourOption[]
  people: PersonLite[]
  initial: DdsRrEntryDraft | null
  saving: boolean
  onClose: () => void
  onSave: (draft: DdsRrEntryDraft) => void
}

export function DdsRewardRecognitionEntryModal({
  open,
  title,
  values,
  behaviours,
  people,
  initial,
  saving,
  onClose,
  onSave,
}: Props) {
  const [nameMode, setNameMode] = useState<DdsRrNameMode>('one_person')
  const [personIds, setPersonIds] = useState<string[]>([])
  const [freeTextNames, setFreeTextNames] = useState('')
  const [reason, setReason] = useState('')
  const [valueOptionId, setValueOptionId] = useState('')
  const [behaviourOptionId, setBehaviourOptionId] = useState('')

  useEffect(() => {
    if (!open) return
    if (initial) {
      setNameMode(initial.nameMode)
      setPersonIds(initial.personIds)
      setFreeTextNames(initial.freeTextNames)
      setReason(initial.reason)
      setValueOptionId(initial.valueOptionId)
      setBehaviourOptionId(initial.behaviourOptionId)
    } else {
      setNameMode('one_person')
      setPersonIds([])
      setFreeTextNames('')
      setReason('')
      setValueOptionId(values[0]?.id ?? '')
      setBehaviourOptionId('')
    }
  }, [open, initial, values])

  const behavioursForValue = useMemo(
    () => behaviours.filter((b) => b.value_option_id === valueOptionId).sort((a, b) => a.sort_order - b.sort_order),
    [behaviours, valueOptionId],
  )

  useEffect(() => {
    if (!valueOptionId) return
    if (!behavioursForValue.some((b) => b.id === behaviourOptionId)) {
      setBehaviourOptionId(behavioursForValue[0]?.id ?? '')
    }
  }, [valueOptionId, behavioursForValue, behaviourOptionId])

  const sortedPeople = useMemo(() => {
    const copy = [...people]
    copy.sort((a, b) => personLabel(a).localeCompare(personLabel(b), undefined, { sensitivity: 'base' }))
    return copy
  }, [people])

  if (!open) return null

  const valid =
    reason.trim() &&
    valueOptionId &&
    behaviourOptionId &&
    (nameMode === 'free_text'
      ? freeTextNames.trim()
      : nameMode === 'one_person'
        ? personIds.length === 1
        : personIds.length >= 1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-strong bg-surface p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dds-rr-entry-title"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="dds-rr-entry-title" className="font-display text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-black/[0.06] hover:text-fg dark:hover:bg-white/10"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid) return
            onSave({
              nameMode,
              personIds: nameMode === 'free_text' ? [] : nameMode === 'one_person' ? personIds.slice(0, 1) : personIds,
              freeTextNames: nameMode === 'free_text' ? freeTextNames.trim() : '',
              reason: reason.trim(),
              valueOptionId,
              behaviourOptionId,
            })
          }}
        >
          <fieldset>
            <legend className="text-xs font-medium text-muted">Names</legend>
            <div className="mt-1.5 flex flex-wrap gap-3">
              {DDS_RR_NAME_MODE_OPTIONS.map((opt) => (
                <label key={opt.value} className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-fg">
                  <input
                    type="radio"
                    name="dds-rr-name-mode"
                    checked={nameMode === opt.value}
                    onChange={() => {
                      setNameMode(opt.value)
                      if (opt.value === 'one_person' && personIds.length > 1) {
                        setPersonIds(personIds.slice(0, 1))
                      }
                    }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          {nameMode === 'free_text' ? (
            <label className="block text-xs font-medium text-muted">
              Guest name(s)
              <textarea
                className={`${inputClass} mt-1 min-h-[4rem] py-2`}
                value={freeTextNames}
                onChange={(e) => setFreeTextNames(e.target.value)}
                placeholder="People not in the directory"
                rows={2}
              />
            </label>
          ) : nameMode === 'one_person' ? (
            <label className="block text-xs font-medium text-muted">
              Person
              <select
                className={`${inputClass} mt-1`}
                value={personIds[0] ?? ''}
                onChange={(e) => setPersonIds(e.target.value ? [e.target.value] : [])}
                required
              >
                <option value="">Select person…</option>
                {sortedPeople.map((p) => (
                  <option key={p.id} value={p.id}>
                    {personLabel(p)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border/70 bg-canvas/30 p-2">
              {sortedPeople.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={personIds.includes(p.id)}
                    onChange={() => {
                      setPersonIds((prev) =>
                        prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id],
                      )
                    }}
                  />
                  {personLabel(p)}
                </label>
              ))}
            </div>
          )}

          <label className="block text-xs font-medium text-muted">
            Reason
            <textarea
              className={`${inputClass} mt-1 min-h-[4rem] py-2`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={2}
            />
          </label>

          <label className="block text-xs font-medium text-muted">
            Value
            <select
              className={`${inputClass} mt-1`}
              value={valueOptionId}
              onChange={(e) => setValueOptionId(e.target.value)}
              required
            >
              {values.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-muted">
            Behaviour
            <select
              className={`${inputClass} mt-1`}
              value={behaviourOptionId}
              onChange={(e) => setBehaviourOptionId(e.target.value)}
              required
            >
              {behavioursForValue.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-black/[0.06]"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid || saving}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function entryToDraft(row: DdsRrEntryRow): DdsRrEntryDraft {
  return {
    nameMode: row.name_mode,
    personIds: row.person_ids,
    freeTextNames: row.free_text_names ?? '',
    reason: row.reason,
    valueOptionId: row.value_option_id,
    behaviourOptionId: row.behaviour_option_id,
  }
}
