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

const LEVEL_HINTS = [
  { n: 1, short: 'None', sub: 'No knowledge' },
  { n: 2, short: 'Theory', sub: 'Theoretical' },
  { n: 3, short: 'Practice', sub: 'Practical' },
  { n: 4, short: 'Expert', sub: 'Trainer level' },
] as const

export function MatrixCellEditor({ ctx, onDismiss, onSaved }: MatrixCellEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
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

  async function persist(actualLevel: number | null, deleteRow: boolean) {
    setError(null)
    setSaving(true)
    try {
      if (deleteRow) {
        const { error: delErr } = await supabase
          .from('person_skills')
          .delete()
          .eq('person_id', cur.personId)
          .eq('skill_id', cur.skillId)
        if (delErr) throw delErr
      } else {
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
      }
      onSaved()
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function onPickNumericLevel(n: number) {
    if (n < 1 || n > 4) return
    await persist(n, false)
  }

  async function onPickCert(yes: boolean) {
    await persist(yes ? 1 : 0, false)
  }

  async function onClear() {
    if (!hadRow) {
      close()
      return
    }
    await persist(null, true)
  }

  async function handleDateOnly(e: FormEvent) {
    e.preventDefault()
    if (!hadRow && cur.actual == null) {
      setError('Set a level with the buttons above first, then you can add a target date.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const due = dueDate.trim() ? dueDate.trim() : null
      let actual_level: number
      if (cur.kind === 'certification') {
        actual_level = cur.actual != null && cur.actual >= 1 ? 1 : 0
      } else {
        if (cur.actual == null || cur.actual < 1) {
          setError('Set a level using the grid first.')
          setSaving(false)
          return
        }
        actual_level = cur.actual
      }
      const isExtra = cur.required == null
      const { error: upErr } = await supabase.from('person_skills').upsert(
        {
          person_id: cur.personId,
          skill_id: cur.skillId,
          actual_level,
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

  return (
    <dialog
      ref={dialogRef}
      className="w-[min(100%,26rem)] rounded-2xl border border-border bg-surface-raised p-0 text-fg shadow-glow backdrop:bg-black/30"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
    >
      <div className="p-5">
        <h3 className="font-display text-lg font-semibold">Set level</h3>
        <p className="mt-1 text-sm text-muted">
          <span className="font-medium text-fg">{cur.personName}</span>
          <span className="mx-1">·</span>
          {cur.skillName}
        </p>
        <p className="mt-1.5 text-xs text-muted">
          Required:{' '}
          <span className="font-mono text-fg">
            {cur.kind === 'certification'
              ? cur.required != null && cur.required >= 1
                ? 'Yes'
                : '—'
              : cur.required ?? '—'}
          </span>
        </p>

        <div className="mt-4">
          {cur.kind === 'certification' ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void onPickCert(true)}
                className="rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition-[filter] hover:brightness-105 active:brightness-95 disabled:opacity-40"
              >
                Yes — qualified
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void onPickCert(false)}
                className="rounded-xl border border-border bg-surface px-4 py-3.5 text-sm font-semibold text-fg shadow-sm transition-colors hover:bg-surface-raised disabled:opacity-40"
              >
                Not yet
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {LEVEL_HINTS.map(({ n, short, sub }) => {
                const active = cur.actual === n
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={saving}
                    onClick={() => void onPickNumericLevel(n)}
                    className={`flex flex-col items-center justify-center rounded-xl border px-2 py-3 text-center transition-[filter,box-shadow] disabled:opacity-40 ${
                      active
                        ? 'border-accent bg-accent-dim ring-2 ring-accent/40'
                        : 'border-border bg-surface hover:border-border-strong hover:bg-surface-raised'
                    }`}
                  >
                    <span className="font-display text-xl font-bold tabular-nums text-fg">{n}</span>
                    <span className="text-[11px] font-semibold text-fg">{short}</span>
                    <span className="mt-0.5 text-[10px] leading-tight text-muted">{sub}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {cur.kind === 'numeric' && hadRow ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void onClear()}
            className="mt-3 w-full rounded-lg py-2 text-center text-xs font-medium text-danger hover:underline disabled:opacity-40"
          >
            Remove level (clear cell)
          </button>
        ) : null}

        {cur.kind === 'certification' && hadRow ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void onClear()}
            className="mt-3 w-full rounded-lg py-2 text-center text-xs font-medium text-danger hover:underline disabled:opacity-40"
          >
            Remove record
          </button>
        ) : null}

        <details className="group mt-4 rounded-xl border border-border bg-surface px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-muted marker:text-muted">
            Target date {showDueHint ? '(gap — optional)' : '(optional)'}
          </summary>
          <form onSubmit={(e) => void handleDateOnly(e)} className="mt-3 space-y-2 pb-1">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2"
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg border border-border bg-surface-raised py-2 text-xs font-medium text-fg hover:bg-surface disabled:opacity-40"
            >
              Save date only
            </button>
          </form>
        </details>

        {error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={close}
          disabled={saving}
          className="mt-4 w-full rounded-xl border border-border py-2.5 text-sm font-medium text-muted hover:bg-surface disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </dialog>
  )
}
