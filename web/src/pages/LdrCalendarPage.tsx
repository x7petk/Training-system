import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  addDays,
  dateInRange,
  formatWeekTitle,
  parseYMD,
  startOfWeekMonday,
  toYMD,
  weekDaysMondayFirst,
} from '../features/ldr/ldrWeekUtils'
import type { LdrEventRow } from '../features/ldr/types'
import { EVENT_COLOR_PRESETS } from '../features/ldr/types'

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type WeekSegment = {
  event: LdrEventRow
  startIdx: number
  endIdx: number
  lane: number
  displayStart: string
}

export function LdrCalendarPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()))
  const [events, setEvents] = useState<LdrEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<
    | { mode: 'create'; day: string }
    | { mode: 'edit'; event: LdrEventRow; grabDate: string }
    | null
  >(null)
  const [dragCtx, setDragCtx] = useState<{ eventId: string; grabDate: string } | null>(null)
  const [dragOverYmd, setDragOverYmd] = useState<string | null>(null)

  const weekDays = useMemo(() => weekDaysMondayFirst(weekStart), [weekStart])
  const weekStartYmd = toYMD(weekStart)
  const weekEndYmd = toYMD(addDays(weekStart, 6))
  const loadEnd = toYMD(addDays(weekStart, 27))

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    const { data, error: eErr } = await supabase
      .from('ldr_events')
      .select('id, title, site_id, start_date, end_date, color, notes')
      .lte('start_date', loadEnd)
      .gte('end_date', weekStartYmd)
      .order('start_date')
    if (eErr) setError(eErr.message)
    else setEvents((data ?? []) as LdrEventRow[])
    setLoading(false)
  }, [loadEnd, weekStartYmd])

  useEffect(() => {
    void load()
  }, [load])

  function shiftWeek(delta: number) {
    setWeekStart((w) => addDays(w, delta * 7))
  }

  function openCreate(day: string) {
    setModal({ mode: 'create', day })
  }

  function openEdit(ev: LdrEventRow, grabDate: string) {
    setModal({ mode: 'edit', event: ev, grabDate })
  }

  async function saveEvent(payload: {
    id?: string
    title: string
    start_date: string
    end_date: string
    color: string
    notes: string
  }) {
    setError(null)
    const normalized = {
      ...payload,
      start_date: payload.start_date <= payload.end_date ? payload.start_date : payload.end_date,
      end_date: payload.start_date <= payload.end_date ? payload.end_date : payload.start_date,
    }
    if (normalized.id) {
      const { error: uErr } = await supabase.from('ldr_events').update(normalized).eq('id', normalized.id)
      if (uErr) {
        setError(uErr.message)
        return
      }
    } else {
      const { error: iErr } = await supabase.from('ldr_events').insert({
        title: normalized.title,
        site_id: null,
        start_date: normalized.start_date,
        end_date: normalized.end_date,
        color: normalized.color,
        notes: normalized.notes,
      })
      if (iErr) {
        setError(iErr.message)
        return
      }
    }
    setModal(null)
    await load()
  }

  async function deleteEvent(id: string) {
    setError(null)
    const { error: dErr } = await supabase.from('ldr_events').delete().eq('id', id)
    if (dErr) {
      setError(dErr.message)
      return
    }
    setModal(null)
    await load()
  }

  function onDropOnDay(targetYmd: string) {
    if (!dragCtx) return
    const ev = events.find((e) => e.id === dragCtx.eventId)
    if (!ev) return
    const grab = parseYMD(dragCtx.grabDate)
    const target = parseYMD(targetYmd)
    const delta = Math.round((target.getTime() - grab.getTime()) / (24 * 60 * 60 * 1000))
    const ns = parseYMD(ev.start_date)
    const ne = parseYMD(ev.end_date)
    ns.setDate(ns.getDate() + delta)
    ne.setDate(ne.getDate() + delta)
    void saveEvent({
      id: ev.id,
      title: ev.title,
      start_date: toYMD(ns),
      end_date: toYMD(ne),
      color: ev.color,
      notes: ev.notes,
    })
    setDragCtx(null)
    setDragOverYmd(null)
  }

  const { segments, laneCount } = useMemo(() => {
    const overlap = events
      .filter((ev) => !(ev.end_date < weekStartYmd || ev.start_date > weekEndYmd))
      .map((ev) => {
        const visibleStart = ev.start_date < weekStartYmd ? weekStartYmd : ev.start_date
        const visibleEnd = ev.end_date > weekEndYmd ? weekEndYmd : ev.end_date
        const startIdx = weekDays.findIndex((d) => toYMD(d) === visibleStart)
        const endIdx = weekDays.findIndex((d) => toYMD(d) === visibleEnd)
        return { event: ev, visibleStart, startIdx, endIdx }
      })
      .filter((x) => x.startIdx >= 0 && x.endIdx >= 0)
      .sort((a, b) => a.startIdx - b.startIdx || b.endIdx - a.endIdx)

    const lanesEnd: number[] = []
    const out: WeekSegment[] = []
    for (const x of overlap) {
      let lane = lanesEnd.findIndex((end) => x.startIdx > end)
      if (lane < 0) {
        lane = lanesEnd.length
        lanesEnd.push(-1)
      }
      lanesEnd[lane] = x.endIdx
      out.push({
        event: x.event,
        startIdx: x.startIdx,
        endIdx: x.endIdx,
        lane,
        displayStart: x.visibleStart,
      })
    }
    return { segments: out, laneCount: Math.max(1, lanesEnd.length) }
  }, [events, weekDays, weekEndYmd, weekStartYmd])

  const previewWeekStarts = [addDays(weekStart, 7), addDays(weekStart, 14), addDays(weekStart, 21)]

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
            <CalendarDays className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Calendar</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Create one-day or multi-day events to keep the leadership team informed about this week and the following
              weeks.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openCreate(toYMD(weekStart))}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-fg hover:border-accent/40"
        >
          <Plus className="size-4" aria-hidden />
          Add event
        </button>
      </header>

      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-border bg-surface-raised/60 shadow-sm backdrop-blur-sm">
        <div className="border-b border-border bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.12),_transparent_60%)] p-4 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => shiftWeek(-1)}
                className="rounded-lg border border-border p-2 text-muted hover:bg-black/[0.04] hover:text-fg"
                aria-label="Previous week"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => shiftWeek(1)}
                className="rounded-lg border border-border p-2 text-muted hover:bg-black/[0.04] hover:text-fg"
                aria-label="Next week"
              >
                <ChevronRight className="size-5" />
              </button>
              <h2 className="min-w-0 px-2 font-display text-lg font-semibold tracking-tight">
                {formatWeekTitle(weekStart)}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted">
                Jump
                <input
                  type="date"
                  value={toYMD(addDays(weekStart, 3))}
                  onChange={(e) => {
                    if (!e.target.value) return
                    setWeekStart(startOfWeekMonday(parseYMD(e.target.value)))
                  }}
                  className="rounded-lg border border-border bg-canvas px-2 py-1.5 text-sm text-fg"
                />
              </label>
              <p className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
                Click a day to add an event. Drag event blocks to reschedule.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-muted">Loading…</p>
        ) : (
          <>
            <div className="overflow-x-auto p-4 md:p-6">
              <div className="min-w-[860px] space-y-3">
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((d, i) => {
                    const ymd = toYMD(d)
                    return (
                      <button
                        key={ymd}
                        type="button"
                        onClick={() => openCreate(ymd)}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnter={() => setDragOverYmd(ymd)}
                        onDragLeave={() => {
                          if (dragOverYmd === ymd) setDragOverYmd(null)
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          onDropOnDay(ymd)
                        }}
                        className={`rounded-xl border px-2 py-2 text-left ${
                          dragOverYmd === ymd
                            ? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-400/50'
                            : 'border-border bg-surface hover:border-violet-400/40'
                        }`}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{dayLabels[i]}</p>
                        <p className="text-lg font-semibold text-fg">{d.getDate()}</p>
                      </button>
                    )
                  })}
                </div>

                <div className="rounded-2xl border border-border bg-canvas/35 p-2">
                  {segments.length === 0 ? (
                    <div className="flex min-h-[5rem] items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-muted">
                      No events this week yet.
                    </div>
                  ) : (
                    Array.from({ length: laneCount }).map((_, lane) => (
                      <div key={lane} className="grid grid-cols-7 gap-2 py-1">
                        {segments
                          .filter((s) => s.lane === lane)
                          .map((s) => (
                            <button
                              key={`${s.event.id}-${lane}`}
                              type="button"
                              draggable
                              onDragStart={() => setDragCtx({ eventId: s.event.id, grabDate: s.displayStart })}
                              onDragEnd={() => {
                                setDragCtx(null)
                                setDragOverYmd(null)
                              }}
                              onClick={() => openEdit(s.event, s.displayStart)}
                              className="rounded-xl px-3 py-2 text-left text-xs font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:opacity-95"
                              style={{
                                backgroundColor: s.event.color,
                                gridColumn: `${s.startIdx + 1} / ${s.endIdx + 2}`,
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate">{s.event.title}</span>
                                <span className="shrink-0 text-[10px] opacity-90">
                                  {s.event.start_date === s.event.end_date
                                    ? s.event.start_date
                                    : `${s.event.start_date} → ${s.event.end_date}`}
                                </span>
                              </div>
                            </button>
                          ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-border p-4 md:p-6">
              <h3 className="font-display text-sm font-semibold tracking-tight text-muted">Next 3 weeks</h3>
              <div className="mt-3 space-y-3">
                {previewWeekStarts.map((ws) => {
                  const days = weekDaysMondayFirst(ws)
                  return (
                    <div key={toYMD(ws)} className="overflow-x-auto">
                      <p className="mb-1 text-xs text-muted">{formatWeekTitle(ws)}</p>
                      <div className="grid min-w-[640px] grid-cols-7 gap-px rounded-lg bg-border ring-1 ring-border">
                        {days.map((d) => {
                          const ymd = toYMD(d)
                          const dayEvents = events.filter((ev) => dateInRange(ymd, ev.start_date, ev.end_date))
                          return (
                            <div
                              key={ymd}
                              onDragOver={(e) => e.preventDefault()}
                              onDragEnter={() => setDragOverYmd(ymd)}
                              onDragLeave={() => {
                                if (dragOverYmd === ymd) setDragOverYmd(null)
                              }}
                              onDrop={(e) => {
                                e.preventDefault()
                                onDropOnDay(ymd)
                              }}
                              className={`min-h-[4.75rem] p-1.5 ${
                                dragOverYmd === ymd
                                  ? 'bg-violet-500/10 ring-1 ring-inset ring-violet-400/50'
                                  : 'bg-surface'
                              }`}
                            >
                              <p className="text-center text-[10px] font-medium text-muted">{d.getDate()}</p>
                              <div className="mt-1 space-y-1">
                                {dayEvents.slice(0, 3).map((ev) => (
                                  <button
                                    key={ev.id}
                                    type="button"
                                    draggable
                                    onDragStart={() => setDragCtx({ eventId: ev.id, grabDate: ymd })}
                                    onDragEnd={() => {
                                      setDragCtx(null)
                                      setDragOverYmd(null)
                                    }}
                                    onClick={() => openEdit(ev, ymd)}
                                    className="truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white"
                                    style={{ backgroundColor: ev.color }}
                                    title={ev.title}
                                  >
                                    {ev.title}
                                  </button>
                                ))}
                                {dayEvents.length > 3 ? (
                                  <p className="text-[10px] text-muted">+{dayEvents.length - 3}</p>
                                ) : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </section>

      {modal ? (
        <EventModal
          initial={
            modal.mode === 'create'
              ? {
                  title: '',
                  start_date: modal.day,
                  end_date: modal.day,
                  color: EVENT_COLOR_PRESETS[0],
                  notes: '',
                }
              : {
                  title: modal.event.title,
                  start_date: modal.event.start_date,
                  end_date: modal.event.end_date,
                  color: modal.event.color,
                  notes: modal.event.notes,
                }
          }
          eventId={modal.mode === 'edit' ? modal.event.id : undefined}
          onClose={() => setModal(null)}
          onSave={saveEvent}
          onDelete={modal.mode === 'edit' ? () => void deleteEvent(modal.event.id) : undefined}
        />
      ) : null}
    </div>
  )
}

function EventModal(props: {
  initial: {
    title: string
    start_date: string
    end_date: string
    color: string
    notes: string
  }
  eventId?: string
  onClose: () => void
  onSave: (p: {
    id?: string
    title: string
    start_date: string
    end_date: string
    color: string
    notes: string
  }) => void
  onDelete?: () => void
}) {
  const [title, setTitle] = useState(props.initial.title)
  const [start, setStart] = useState(props.initial.start_date)
  const [end, setEnd] = useState(props.initial.end_date)
  const [color, setColor] = useState(props.initial.color)
  const [notes, setNotes] = useState(props.initial.notes)

  return (
    <dialog open className="fixed inset-0 z-50 flex max-h-none max-w-none items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-glow">
        <h3 className="font-display text-lg font-semibold">{props.eventId ? 'Edit event' : 'New event'}</h3>
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted">
              Start
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium uppercase tracking-wider text-muted">
              End
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Color</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EVENT_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  className={`size-8 rounded-full ring-2 ring-offset-2 ring-offset-surface ${
                    color === c ? 'ring-accent' : 'ring-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              props.onSave({
                id: props.eventId,
                title: title.trim(),
                start_date: start,
                end_date: end,
                color,
                notes,
              })
            }
            disabled={!title.trim()}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Save
          </button>
          {props.onDelete ? (
            <button
              type="button"
              onClick={props.onDelete}
              className="rounded-xl border border-danger/40 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10"
            >
              Delete
            </button>
          ) : null}
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm text-fg"
          >
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  )
}
