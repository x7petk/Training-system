import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { SkillKind } from './gapLogic'

export type CellEditorContext = {
  personId: string
  personName: string
  skillId: string
  skillName: string
  kind: SkillKind
  required: number | null
  actual: number | null
  isExtra: boolean
  dueDate: string | null
}

type MatrixCellEditorProps = {
  ctx: CellEditorContext | null
  onDismiss: () => void
  onSaved: () => void
}

function hasGap(required: number | null, actual: number | null, kind: SkillKind): boolean {
  if (required == null) return false
  if (kind === 'certification') {
    return required >= 1 && (actual == null || actual < 1)
  }
  return actual == null || actual < required
}

export function MatrixCellEditor({ ctx, onDismiss, onSaved }: MatrixCellEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [actualNum, setActualNum] = useState<string>('')
  const [certYes, setCertYes] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hadRow, setHadRow] = useState(false)

  useEffect(() => {
    if (!ctx) return
    const el = dialogRef.current
    el?.showModal()
    setError(null)
    setHadRow(ctx.actual != null || ctx.isExtra)
    if (ctx.kind === 'certification') {
      setCertYes(ctx.actual != null && ctx.actual >= 1)
      setActualNum('')
    } else {
      setActualNum(ctx.actual == null ? '' : String(ctx.actual))
      setCertYes(false)
    }
    setDueDate(ctx.dueDate ? ctx.dueDate.slice(0, 10) : '')
    return () => {
      el?.close()
    }
  }, [ctx])

  if (!ctx) return null

  const cur = ctx

  const showDueHint = hasGap(cur.required, cur.actual, cur.kind)

  function close() {
    dialogRef.current?.close()
    onDismiss()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      let actualLevel: number | null = null

      if (cur.kind === 'certification') {
        actualLevel = certYes ? 1 : 0
      } else {
        if (actualNum === '') {
          if (hadRow) {
            const { error: delErr } = await supabase
              .from('person_skills')
              .delete()
              .eq('person_id', cur.personId)
              .eq('skill_id', cur.skillId)
            if (delErr) throw delErr
            onSaved()
            close()
          } else {
            close()
          }
          setSaving(false)
          return
        }
        const n = Number.parseInt(actualNum, 10)
        if (Number.isNaN(n) || n < 1 || n > 4) {
          setError('Pick a level from 1 to 4.')
          setSaving(false)
          return
        }
        actualLevel = n
      }

      const isExtra = cur.required == null
      const due = dueDate.trim() ? dueDate.trim() : null

      const { error: upErr } = await supabase.from('person_skills').upsert(
        {
          person_id: cur.personId,
          skill_id: cur.skillId,
          actual_level: actualLevel,
          due_date: due,
          is_extra: isExtra,
        },
        { onConflict: 'person_id,skill_id' },
      )
      if (upErr) throw upErr

      onSaved()
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    if (!hadRow) {
      close()
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { error: delErr } = await supabase
        .from('person_skills')
        .delete()
        .eq('person_id', cur.personId)
        .eq('skill_id', cur.skillId)
      if (delErr) throw delErr
      onSaved()
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="w-[min(100%,24rem)] rounded-2xl border border-border bg-surface-raised p-0 text-fg shadow-glow backdrop:bg-black/70"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="p-6">
        <h3 className="font-display text-lg font-semibold">Update skill</h3>
        <p className="mt-1 text-sm text-muted">
          <span className="font-medium text-fg">{cur.personName}</span>
          <span className="mx-1">·</span>
          {cur.skillName}
        </p>
        <p className="mt-2 text-xs text-muted">
          Required:{' '}
          <span className="font-mono text-fg">
            {cur.kind === 'certification'
              ? cur.required != null && cur.required >= 1
                ? 'Yes'
                : '—'
              : cur.required ?? '—'}
          </span>
        </p>

        <div className="mt-4 space-y-4">
          {cur.kind === 'certification' ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={certYes}
                onChange={(e) => setCertYes(e.target.checked)}
                className="size-4 rounded border-border text-accent focus:ring-accent"
              />
              Qualified / licensed (Yes)
            </label>
          ) : (
            <div>
              <label htmlFor="cell-level" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Actual level (1–4)
              </label>
              <select
                id="cell-level"
                value={actualNum}
                onChange={(e) => setActualNum(e.target.value)}
                className="w-full rounded-xl border border-border bg-canvas/60 px-3 py-2.5 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2"
              >
                <option value="">Not recorded</option>
                <option value="1">1 — No knowledge</option>
                <option value="2">2 — Theoretical</option>
                <option value="3">3 — Practical</option>
                <option value="4">4 — Expert / trainer</option>
              </select>
            </div>
          )}

          <div>
            <label htmlFor="cell-due" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
              Target date {showDueHint ? '(gap — optional)' : '(optional)'}
            </label>
            <input
              id="cell-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-canvas/60 px-3 py-2.5 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2"
            />
          </div>

          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          {hadRow ? (
            <button
              type="button"
              onClick={() => void handleClear()}
              disabled={saving}
              className="text-sm text-danger hover:underline disabled:opacity-40"
            >
              Remove record
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted hover:bg-white/5 hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-canvas hover:brightness-110 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
