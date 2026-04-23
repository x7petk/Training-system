import { useState } from 'react'
import { ChevronDown, ChevronUp, ZoomIn } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cilTaskPhotoPublicUrl } from '../../lib/cilTaskPhotos'
import type { Plan24EventRow, Plan24SubTask } from './plan24Types'
import {
  plan24ClQualityEffectiveStepKind,
  plan24ClQualitySubTaskComplete,
  valueOutsideLimits,
  type Plan24ClQualityVariant,
} from './plan24ClQualityRouteUtils'

export function Plan24ClQualityRoutePanel(props: {
  variant: Plan24ClQualityVariant
  event: Plan24EventRow
  subs: Plan24SubTask[]
  onSubsChange: (subs: Plan24SubTask[]) => void
  onMarkFullComplete: () => void | Promise<void>
  routeSubmitting?: boolean
  onOpenIssueForTask: (task: Plan24SubTask) => void
}) {
  const { variant, event, subs, onSubsChange, onMarkFullComplete, routeSubmitting = false, onOpenIssueForTask } = props
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [zoomUrl, setZoomUrl] = useState<string | null>(null)
  const busy = routeSubmitting

  const patchTask = (id: string, patch: Partial<Plan24SubTask>) => {
    onSubsChange(subs.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const persistSubs = async (next: Plan24SubTask[]) => {
    const opening = event.status === 'scheduled'
    const row: Record<string, unknown> = { sub_tasks: next }
    if (opening) {
      row.status = 'in_progress'
      row.opened_at = new Date().toISOString()
    }
    await supabase.from('plan24_events').update(row).eq('id', event.id)
  }

  const allAnswered =
    subs.length > 0 &&
    subs.every((t) => (!t.required || plan24ClQualitySubTaskComplete(t, variant)) && (t.required || true))

  const accent =
    variant === 'cl'
      ? 'border-emerald-900/20 bg-emerald-950/[0.04] dark:border-emerald-800/25 dark:bg-emerald-950/15'
      : 'border-violet-900/20 bg-violet-950/[0.04] dark:border-violet-800/25 dark:bg-violet-950/15'

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border px-3 py-2 text-xs ${accent}`}>
        <p className="font-semibold text-fg">
          {variant === 'cl' ? 'Cleaning-level (CL) checklist' : 'Quality checklist'}
        </p>
        <p className="mt-1 text-muted">
          {variant === 'cl'
            ? 'Enter numeric readings or text per step. Values outside min/max are deviations — use Raise deviation.'
            : 'Record Pass or Fail per step. Use Record quality fail if any step fails.'}
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Steps · {subs.length}</h4>
        {subs.map((t) => {
          const photo = cilTaskPhotoPublicUrl(t.photo_path)
          const descOpen = expanded[t.id] ?? false
          const desc = (t.standard_description ?? '').trim()
          const ik = plan24ClQualityEffectiveStepKind(variant, t.input_kind)
          const tgt = t.target_value
          const hasLimits = t.min_value != null || t.max_value != null
          const ev = t.entered_value
          const out =
            ev != null && !Number.isNaN(Number(ev)) && hasLimits
              ? valueOutsideLimits(Number(ev), t.min_value, t.max_value)
              : false

          return (
            <div key={t.id} className="rounded-xl border border-border bg-surface-raised/40 shadow-sm dark:bg-surface-raised/20">
              <div className="flex gap-3 p-3">
                <div className="flex shrink-0 flex-col gap-2">
                  {photo ? (
                    <button
                      type="button"
                      onClick={() => setZoomUrl(photo)}
                      className="group relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-black/5"
                      aria-label={`Zoom image for ${t.label}`}
                    >
                      <img src={photo} alt="" className="size-full object-cover transition group-hover:opacity-90" />
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
                        <ZoomIn className="size-6 text-white drop-shadow" aria-hidden />
                      </span>
                    </button>
                  ) : (
                    <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted">
                      No photo
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-fg">{t.label}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {ik === 'number' || ik === 'range' ? (
                          <>
                            Input: <span className="text-fg/90">{ik}</span>
                            {tgt != null && Number.isFinite(tgt) ? (
                              <>
                                {' '}
                                · Target <span className="font-medium text-fg/90">{tgt}</span>
                              </>
                            ) : null}
                            {hasLimits ? (
                              <>
                                {' '}
                                · Limits{' '}
                                <span className="font-medium text-fg/90">
                                  {t.min_value ?? '—'} … {t.max_value ?? '—'}
                                </span>
                              </>
                            ) : null}
                          </>
                        ) : ik === 'text' ? (
                          <>Input: text</>
                        ) : (
                          <>Input: pass / fail</>
                        )}
                      </p>
                    </div>
                  </div>

                  {desc ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpanded((m) => ({ ...m, [t.id]: !descOpen }))}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                      >
                        {descOpen ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
                        Standard
                      </button>
                      {descOpen ? <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-fg/90">{desc}</p> : null}
                    </div>
                  ) : null}

                  {ik === 'pass_fail' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const next = subs.map((s) =>
                            s.id === t.id ? { ...s, result: 'pass' as const, done: true } : s,
                          )
                          onSubsChange(next)
                          void persistSubs(next)
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          t.result === 'pass' ? 'bg-emerald-700 text-white' : 'border border-border bg-surface text-muted hover:bg-surface-raised/60'
                        }`}
                      >
                        Pass
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const next = subs.map((s) =>
                            s.id === t.id ? { ...s, result: 'fail' as const, done: true } : s,
                          )
                          onSubsChange(next)
                          void persistSubs(next)
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          t.result === 'fail' ? 'bg-rose-700 text-white' : 'border border-border bg-surface text-muted hover:bg-surface-raised/60'
                        }`}
                      >
                        Fail
                      </button>
                      {t.result === 'fail' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onOpenIssueForTask(t)}
                          className="rounded-lg border border-amber-600/50 bg-amber-600/10 px-2.5 py-1 text-xs font-semibold text-amber-950 dark:text-amber-100"
                        >
                          {variant === 'cl' ? 'Raise deviation' : 'Record quality fail'}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {ik === 'number' || ik === 'range' ? (
                    <div className="space-y-2">
                      <label className="block text-[11px] font-medium text-muted">
                        Reading
                        <input
                          type="number"
                          step="any"
                          disabled={busy}
                          className="mt-1 w-full max-w-[14rem] rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
                          value={ev === null || ev === undefined ? '' : String(ev)}
                          onChange={(e) => {
                            const raw = e.target.value
                            const val = raw === '' ? null : Number(raw)
                            onSubsChange(subs.map((s) => (s.id === t.id ? { ...s, entered_value: val, done: false } : s)))
                          }}
                          onBlur={(e) => {
                            const raw = e.target.value
                            const val = raw === '' ? null : Number(raw)
                            const next = subs.map((s) => {
                              if (s.id !== t.id) return s
                              const inBand =
                                val != null &&
                                !Number.isNaN(val) &&
                                !valueOutsideLimits(val, s.min_value, s.max_value)
                              return { ...s, entered_value: val, done: inBand }
                            })
                            onSubsChange(next)
                            void persistSubs(next)
                          }}
                        />
                      </label>
                      {out ? (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
                          <span>Outside limits.</span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onOpenIssueForTask(t)}
                            className="font-semibold underline"
                          >
                            {variant === 'cl' ? 'Raise deviation' : 'Record quality fail'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {ik === 'text' ? (
                    <label className="block text-[11px] font-medium text-muted">
                      Entry
                      <textarea
                        disabled={busy}
                        className="mt-1 min-h-[72px] w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
                        value={t.text_value ?? ''}
                        onChange={(e) => patchTask(t.id, { text_value: e.target.value, done: false })}
                        onBlur={() => {
                          const next = subs.map((s) =>
                            s.id === t.id
                              ? { ...s, done: Boolean((s.text_value ?? '').trim()) }
                              : s,
                          )
                          onSubsChange(next)
                          void persistSubs(next)
                        }}
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <button
          type="button"
          className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40 dark:bg-emerald-600"
          disabled={busy || !allAnswered}
          title={
            allAnswered
              ? 'Submit completed checklist'
              : variant === 'quality'
                ? 'Pass or Fail every required step'
                : 'Complete every required step (readings within limits or text)'
          }
          onClick={() => void onMarkFullComplete()}
        >
          Submit
        </button>
        {!allAnswered ? <span className="text-xs text-muted">Finish all required steps to submit.</span> : null}
      </div>

      {zoomUrl ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setZoomUrl(null)
          }}
        >
          <div className="relative max-h-[min(92vh,900px)] max-w-[min(96vw,1200px)] overflow-auto rounded-xl border border-border-strong bg-surface p-2 shadow-2xl">
            <button
              type="button"
              className="absolute right-2 top-2 z-[1] rounded-full border border-border bg-surface px-2 py-1 text-xs font-semibold shadow"
              onClick={() => setZoomUrl(null)}
            >
              Close
            </button>
            <img src={zoomUrl} alt="" className="max-h-[85vh] w-auto max-w-full object-contain" />
          </div>
        </div>
      ) : null}
    </div>
  )
}
