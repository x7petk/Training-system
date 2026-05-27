import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, ZoomIn } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cilTaskPhotoPublicUrl } from '../../lib/cilTaskPhotos'
import type { Plan24EventRow, Plan24SubTask } from './plan24Types'

type DefectRow = {
  id: string
  title: string
  status: string
  created_at: string
  cil_template_task_id: string | null
  plan24_event_id: string | null
  role_name: string | null
}

const WHEN_OPTS: { v: NonNullable<Plan24SubTask['when_condition']>; label: string }[] = [
  { v: 'running', label: 'Running' },
  { v: 'down', label: 'Down' },
  { v: 'other', label: 'Other' },
]

function whenConditionLabel(v: Plan24SubTask['when_condition']): string {
  if (v == null) return 'Not set'
  return WHEN_OPTS.find((o) => o.v === v)?.label ?? String(v)
}

const TYPE_LABEL: Record<string, string> = {
  cleaning: 'Cleaning',
  inspection: 'Inspection',
  lubrication: 'Lubrication',
}

function formatCheckTypes(types: string[] | undefined): string {
  if (!types?.length) return '—'
  return types.map((t) => TYPE_LABEL[t] ?? t).join(' · ')
}

export function Plan24CilRoutePanel(props: {
  event: Plan24EventRow
  cellId: string
  subs: Plan24SubTask[]
  onSubsChange: (subs: Plan24SubTask[]) => void
  onMarkFullComplete: () => void | Promise<void>
  routeSubmitting?: boolean
  onOpenDefectForTask: (task: Plan24SubTask) => void
}) {
  const { event, cellId, subs, onSubsChange, onMarkFullComplete, routeSubmitting = false, onOpenDefectForTask } = props
  const [defects, setDefects] = useState<DefectRow[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [zoomUrl, setZoomUrl] = useState<string | null>(null)

  const tplId = event.cil_template_id ?? null
  const busy = routeSubmitting

  const loadDefects = useCallback(async () => {
    if (!tplId) {
      setDefects([])
      return
    }
    const { data, error } = await supabase
      .from('dh_defects')
      .select('id, title, status, created_at, cil_template_task_id, plan24_event_id, role_name')
      .eq('master_cell_id', cellId)
      .eq('cil_template_id', tplId)
      .in('status', ['open', 'in_progress'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) {
      console.warn(error.message)
      setDefects([])
      return
    }
    const rows = (data ?? []) as DefectRow[]
    const roleKey = (event.role_name ?? '').trim().toLowerCase()
    setDefects(
      rows.filter((d) => {
        if (d.plan24_event_id) return d.plan24_event_id === event.id
        if (d.role_name?.trim()) {
          return d.role_name.trim().toLowerCase() === roleKey
        }
        return true
      }),
    )
  }, [cellId, event.id, event.role_name, tplId])

  useEffect(() => {
    void loadDefects()
  }, [loadDefects])

  const toggleTaskDone = async (id: string) => {
    if (busy) return
    const next = subs.map((s) => (s.id === id ? { ...s, done: !s.done } : s))
    onSubsChange(next)
    const opening = event.status === 'scheduled'
    const patch: Record<string, unknown> = { sub_tasks: next }
    if (opening) {
      patch.status = 'in_progress'
      patch.opened_at = new Date().toISOString()
    }
    await supabase.from('plan24_events').update(patch).eq('id', event.id)
    void loadDefects()
  }

  const allDone = subs.length > 0 && subs.every((s) => s.done)

  return (
    <div className="space-y-4">
      {tplId ? (
        <div className="rounded-xl border border-teal-900/25 bg-teal-950/[0.04] px-3 py-2 dark:border-teal-800/30 dark:bg-teal-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-900/80 dark:text-teal-200/90">Open defects for this CIL</p>
          {defects.length === 0 ? (
            <p className="mt-1 text-xs text-muted">None open (resolved/closed defects are hidden).</p>
          ) : (
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
              {defects.map((d) => (
                <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border/60 bg-surface px-2 py-1">
                  <span className="font-medium text-fg">{d.title}</span>
                  <span className="text-muted">
                    {d.status}
                    {d.cil_template_task_id ? ` · task ${d.cil_template_task_id.slice(0, 8)}…` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Route tasks · {subs.length}</h4>
        {subs.map((t) => {
          const photo = cilTaskPhotoPublicUrl(t.photo_path)
          const descOpen = expanded[t.id] ?? false
          const desc = (t.standard_description ?? '').trim()
          return (
            <div
              key={t.id}
              className="rounded-xl border border-border bg-surface-raised/40 shadow-sm dark:bg-surface-raised/20"
            >
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
                        Types: <span className="text-fg/90">{formatCheckTypes(t.check_types)}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-start">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleTaskDone(t.id)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
                          t.done ? 'border border-border bg-surface text-muted' : 'bg-teal-700 text-white hover:bg-teal-600'
                        }`}
                      >
                        {t.done ? 'Completed' : 'Complete'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onOpenDefectForTask(t)}
                        className="rounded-lg border border-amber-600/50 bg-amber-600/10 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-amber-950 hover:bg-amber-600/20 dark:text-amber-100"
                      >
                        Report defect
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted">
                    When: <span className="font-medium text-fg/90">{whenConditionLabel(t.when_condition)}</span>
                  </p>
                  {desc ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpanded((m) => ({ ...m, [t.id]: !descOpen }))}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                      >
                        {descOpen ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
                        Standard description
                      </button>
                      {descOpen ? <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-fg/90">{desc}</p> : null}
                    </div>
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
          disabled={busy || !allDone}
          title={allDone ? 'Submit completed route' : 'Complete every task first'}
          onClick={() => void onMarkFullComplete()}
        >
          Submit
        </button>
        {!allDone ? <span className="text-xs text-muted">Finish all tasks to submit.</span> : null}
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
