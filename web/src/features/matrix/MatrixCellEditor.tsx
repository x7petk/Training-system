import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Check, CircleDashed } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  classifyCell,
  gapKindEditorOptionClasses,
  gapKindLegendLabel,
  type SkillKind,
} from './gapLogic'

export type CellEditorAnchor = {
  top: number
  left: number
  width: number
  height: number
}

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
  /** Omit or null to center the panel in the viewport */
  anchorRect?: CellEditorAnchor | null
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

function formatDueDisplay(ymd: string): string {
  const t = ymd.trim()
  if (!t) return ''
  const [y, m, d] = t.split('-').map(Number)
  if (!y || !m || !d) return t
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const PANEL_MAX_W = 416
const PANEL_MARGIN = 8

export function MatrixCellEditor({ ctx, onDismiss, onSaved }: MatrixCellEditorProps) {
  const { isAdmin, isAssessor } = useAuth()
  const panelRef = useRef<HTMLDivElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const [dueDate, setDueDate] = useState('')
  const [draftActual, setDraftActual] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hadRow, setHadRow] = useState(false)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})

  useEffect(() => {
    if (!ctx) return
    setError(null)
    setHadRow(ctx.actual != null || ctx.isExtra)
    setDueDate(ctx.dueDate ? ctx.dueDate.slice(0, 10) : '')
    setDraftActual(ctx.actual)
  }, [ctx])

  const certGaps = useMemo(() => {
    if (!ctx || ctx.kind !== 'certification') return null
    return {
      yes: classifyCell({
        kind: 'certification',
        required: ctx.required,
        actual: 1,
        isExtra: ctx.isExtra,
      }),
      no: classifyCell({
        kind: 'certification',
        required: ctx.required,
        actual: 0,
        isExtra: ctx.isExtra,
      }),
    }
  }, [ctx])

  const numericGaps = useMemo(() => {
    if (!ctx || ctx.kind !== 'numeric') return null
    const params = { kind: 'numeric' as const, required: ctx.required, isExtra: ctx.isExtra }
    return {
      1: classifyCell({ ...params, actual: 1 }),
      2: classifyCell({ ...params, actual: 2 }),
      3: classifyCell({ ...params, actual: 3 }),
      4: classifyCell({ ...params, actual: 4 }),
    }
  }, [ctx])
  const maxNumericLevel = isAdmin ? 4 : isAssessor ? 3 : 4

  const reposition = useCallback(() => {
    const panel = panelRef.current
    if (!panel || !ctx) return

    const vw = window.innerWidth
    const vh = window.innerHeight
    const rect = panel.getBoundingClientRect()
    const w = Math.min(PANEL_MAX_W, vw - PANEL_MARGIN * 2)
    const h = rect.height || 420

    const anchor = ctx.anchorRect
    if (!anchor) {
      setPanelStyle({
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: w,
        maxHeight: `min(85vh, ${vh - PANEL_MARGIN * 2}px)`,
        zIndex: 101,
      })
      return
    }

    let left = anchor.left + anchor.width + PANEL_MARGIN
    if (left + w > vw - PANEL_MARGIN) {
      left = anchor.left - w - PANEL_MARGIN
    }
    left = Math.max(PANEL_MARGIN, Math.min(left, vw - w - PANEL_MARGIN))

    let top = anchor.top
    if (top + h > vh - PANEL_MARGIN) {
      top = vh - h - PANEL_MARGIN
    }
    top = Math.max(PANEL_MARGIN, top)

    setPanelStyle({
      position: 'fixed',
      left,
      top,
      transform: 'none',
      width: w,
      maxHeight: `min(85vh, ${vh - PANEL_MARGIN * 2}px)`,
      zIndex: 101,
    })
  }, [ctx])

  useLayoutEffect(() => {
    if (!ctx) return
    reposition()
    const ro = new ResizeObserver(() => reposition())
    if (panelRef.current) ro.observe(panelRef.current)
    window.addEventListener('resize', reposition)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', reposition)
    }
  }, [ctx, reposition, dueDate, draftActual, error, saving])

  useEffect(() => {
    if (!ctx) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ctx, onDismiss])

  if (!ctx) return null

  const cur = ctx
  const showDueHint = hasGap(cur.required, cur.actual, cur.kind)
  const dueDisplay = formatDueDisplay(dueDate)

  function close() {
    onDismiss()
  }

  async function persistUpsert(actualLevel: number | null, due: string | null) {
    const isExtra = cur.required == null
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

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (cur.kind === 'certification') {
      if (draftActual == null) {
        setError('Choose Yes — qualified or Not yet, then save.')
        return
      }
    } else {
      if (draftActual == null || draftActual < 1) {
        setError('Choose a level (1–4), then save.')
        return
      }
      if (draftActual > maxNumericLevel) {
        setError(`Your role can set up to level ${maxNumericLevel}.`)
        return
      }
    }

    const due = dueDate.trim() ? dueDate.trim() : null
    const level = draftActual

    setSaving(true)
    try {
      await persistUpsert(level, due)
      onSaved()
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function onClear() {
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
      setError(err instanceof Error ? err.message : 'Remove failed')
    } finally {
      setSaving(false)
    }
  }

  const portal = (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/30"
        aria-hidden
        onClick={(e) => {
          if (e.target === e.currentTarget) close()
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cell-editor-title"
        className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised p-0 text-fg shadow-glow"
        style={panelStyle}
      >
        <form onSubmit={(e) => void handleSave(e)} className="flex max-h-[inherit] flex-col overflow-y-auto">
          <div className="p-5">
            <h3 id="cell-editor-title" className="font-display text-lg font-semibold">
              Set level
            </h3>
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
              {cur.kind === 'certification' && certGaps ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={saving}
                    aria-pressed={draftActual === 1}
                    onClick={() => setDraftActual(1)}
                    title={`Matrix: ${gapKindLegendLabel(certGaps.yes)}`}
                    className={`flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center text-sm font-semibold disabled:opacity-40 ${gapKindEditorOptionClasses(certGaps.yes, draftActual === 1)}`}
                  >
                    <span
                      className="flex size-9 items-center justify-center rounded-full bg-black/[0.06]"
                      aria-hidden
                    >
                      <Check className="size-5" strokeWidth={2.5} />
                    </span>
                    <span className="leading-tight">Yes — qualified</span>
                    <span className="text-[10px] font-semibold leading-tight opacity-90">
                      {gapKindLegendLabel(certGaps.yes)}
                    </span>
                    {draftActual === 1 ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Selected</span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    aria-pressed={draftActual === 0}
                    onClick={() => setDraftActual(0)}
                    title={`Matrix: ${gapKindLegendLabel(certGaps.no)}`}
                    className={`flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center text-sm font-semibold disabled:opacity-40 ${gapKindEditorOptionClasses(certGaps.no, draftActual === 0)}`}
                  >
                    <span
                      className="flex size-9 items-center justify-center rounded-full bg-black/[0.06]"
                      aria-hidden
                    >
                      <CircleDashed className="size-5" strokeWidth={2.25} />
                    </span>
                    <span className="leading-tight">Not yet</span>
                    <span className="text-[10px] font-semibold leading-tight opacity-90">
                      {gapKindLegendLabel(certGaps.no)}
                    </span>
                    {draftActual === 0 ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Selected</span>
                    ) : null}
                  </button>
                </div>
              ) : cur.kind === 'numeric' && numericGaps ? (
                <div className="grid grid-cols-2 gap-3">
                  {LEVEL_HINTS.filter(({ n }) => n <= maxNumericLevel).map(({ n, short, sub }) => {
                    const gap = numericGaps[n]
                    const active = draftActual === n
                    return (
                      <button
                        key={n}
                        type="button"
                        disabled={saving}
                        aria-pressed={active}
                        title={`Matrix: ${gapKindLegendLabel(gap)}`}
                        onClick={() => setDraftActual(n)}
                        className={`flex flex-col items-center justify-center rounded-xl px-2 py-3 text-center disabled:opacity-40 ${gapKindEditorOptionClasses(gap, active)}`}
                      >
                        <span className="font-display text-xl font-bold tabular-nums">{n}</span>
                        <span className="text-[11px] font-semibold">{short}</span>
                        <span className="mt-0.5 text-[10px] font-medium leading-tight opacity-85">
                          {gapKindLegendLabel(gap)}
                        </span>
                        <span className="mt-0.5 text-[10px] leading-tight opacity-75">{sub}</span>
                        {active ? (
                          <span className="mt-1 text-[10px] font-bold uppercase tracking-wider opacity-80">
                            Selected
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ) : null}
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

            <div className="mt-4 rounded-xl border border-border bg-surface px-3 py-3">
              <p className="text-xs font-medium text-muted">
                Target date {showDueHint ? '(gap — optional)' : '(optional)'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    const el = dateInputRef.current
                    if (!el) return
                    if (typeof el.showPicker === 'function') {
                      void el.showPicker()
                    } else {
                      el.click()
                    }
                  }}
                  className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border-strong bg-canvas p-2 text-accent transition-colors hover:bg-accent-dim hover:text-fg disabled:opacity-40"
                  aria-label="Open date picker"
                >
                  <CalendarDays className="size-5" strokeWidth={2} aria-hidden />
                </button>
                <div className="min-w-0 flex-1">
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    disabled={saving}
                    className="w-full min-w-0 rounded-lg border border-border bg-canvas px-2 py-2 text-sm text-fg outline-none ring-accent/30 focus:border-accent/50 focus:ring-2 [&::-webkit-calendar-picker-indicator]:ml-1 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-90 [&::-webkit-calendar-picker-indicator]:[filter:brightness(0.35)]"
                  />
                </div>
              </div>
              <p className="mt-2 text-sm font-medium tabular-nums text-fg">
                {dueDisplay ? (
                  <>
                    <span className="text-muted">Showing: </span>
                    {dueDisplay}
                  </>
                ) : (
                  <span className="text-muted">No target date selected</span>
                )}
              </p>
            </div>

            {error ? (
              <p className="mt-3 text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-[filter] hover:brightness-105 disabled:opacity-40"
              >
                Save
              </button>
              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="rounded-xl border border-border py-2.5 text-sm font-medium text-muted hover:bg-surface disabled:opacity-40 sm:px-4"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  )

  return createPortal(portal, document.body)
}
