import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react'
import { AlertTriangle, Bug, XCircle } from 'lucide-react'
import { addMinutes, minutesBetween } from './plan24ShiftUtils'
import { isPlan24DdsAction } from './plan24DdsUtils'
import type { Plan24EventRow } from './plan24Types'

const DRAG_DT = 'application/x-plan24-event'
/** Minimum duration when resizing a check (minutes). */
const MIN_EVENT_DURATION_MIN = 5
/** Major time grid: hour lines and labels (free-minute placement unchanged). */
const GRID_MAJOR_MIN = 60
/** Minor time grid: half-hour guide lines. */
const GRID_MINOR_MIN = 30

export type Plan24GridRoleCol = { name: string; subtitle?: string }

type LaneLayout = { lane: number; laneCount: number }

function maxOverlapDepth(items: { start: number; end: number }[]): number {
  type Pt = { t: number; d: number }
  const pts: Pt[] = []
  for (const it of items) {
    pts.push({ t: it.start, d: 1 })
    pts.push({ t: it.end, d: -1 })
  }
  pts.sort((a, b) => a.t - b.t || b.d - a.d)
  let cur = 0
  let max = 0
  for (const p of pts) {
    cur += p.d
    max = Math.max(max, cur)
  }
  return Math.max(1, max)
}

function assignLanes(items: { id: string; start: number; end: number }[]): Map<string, LaneLayout> {
  const laneCount = maxOverlapDepth(items)
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end)
  const laneEnds: number[] = []
  const out = new Map<string, LaneLayout>()
  for (const it of sorted) {
    let lane = laneEnds.findIndex((end) => end <= it.start)
    if (lane < 0) {
      lane = laneEnds.length
      laneEnds.push(it.end)
    } else {
      laneEnds[lane] = Math.max(laneEnds[lane], it.end)
    }
    out.set(it.id, { lane, laneCount })
  }
  return out
}

function formatClock(d: Date): string {
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function isPlan24EventCheck(ev: Plan24EventRow): boolean {
  if (!ev.event_type) return true
  return ['check', 'cl_check', 'cil_check', 'quality_check'].includes(String(ev.event_type).toLowerCase())
}

function familyScheduledClass(eventType: string | null | undefined): string {
  const t = String(eventType ?? 'check').toLowerCase()
  if (t === 'cl_check') return 'border-green-900/40 bg-green-700 text-green-50 dark:border-green-800/60 dark:bg-green-800 dark:text-green-50'
  if (t === 'cil_check') return 'border-teal-900/40 bg-teal-700 text-teal-50 dark:border-teal-800/60 dark:bg-teal-800 dark:text-teal-50'
  if (t === 'quality_check')
    return 'border-violet-900/40 bg-violet-700 text-violet-50 dark:border-violet-800/60 dark:bg-violet-800 dark:text-violet-50'
  return 'border-sky-950/40 bg-sky-950 text-sky-50 dark:border-sky-800/60 dark:bg-sky-950 dark:text-sky-100'
}

function raisedIssueInfo(ev: Plan24EventRow): { kind: 'deviation' | 'defect' | 'fail'; sourceLabel: string; icon: ReactElement } | null {
  if (!ev.linked_issue_id) return null
  const et = String(ev.event_type ?? '').toLowerCase()
  const lk = String(ev.linked_issue_kind ?? '').toLowerCase()

  // Prefer linked_issue_kind when available, but event_type is the most reliable indicator of which "engine" raised it.
  if (lk === 'deviation' || et === 'cl_check') {
    return {
      kind: 'deviation',
      sourceLabel: 'Raised Deviation (from CL)',
      icon: <AlertTriangle className="size-3.5 text-current" aria-hidden />,
    }
  }
  if (lk === 'dh_defect' || et === 'cil_check') {
    return {
      kind: 'defect',
      sourceLabel: 'Raised Defect (from CIL)',
      icon: <Bug className="size-3.5 text-current" aria-hidden />,
    }
  }
  if (lk === 'quality_fail' || et === 'quality_check') {
    return {
      kind: 'fail',
      sourceLabel: 'Raised Fail (from Quality)',
      icon: <XCircle className="size-3.5 text-current" aria-hidden />,
    }
  }

  return null
}

function isClCilQualityFamily(eventType: string | null | undefined): boolean {
  const t = String(eventType ?? '').toLowerCase()
  return t === 'cl_check' || t === 'cil_check' || t === 'quality_check'
}

/** Completed CL / CIL / Quality: same hue as scheduled, ~50% fill opacity, strikethrough text. */
function familyCompletedClass(eventType: string | null | undefined): string {
  const t = String(eventType ?? 'check').toLowerCase()
  if (t === 'cl_check')
    return 'border-green-900/35 bg-green-700/50 text-green-50 dark:border-green-700/45 dark:bg-green-800/50 dark:text-green-50'
  if (t === 'cil_check')
    return 'border-teal-900/35 bg-teal-700/50 text-teal-50 dark:border-teal-700/45 dark:bg-teal-800/50 dark:text-teal-50'
  if (t === 'quality_check')
    return 'border-violet-900/35 bg-violet-700/50 text-violet-50 dark:border-violet-700/45 dark:bg-violet-800/50 dark:text-violet-50'
  return familyScheduledClass(eventType)
}

function familyCompletedStripeStyle(): CSSProperties {
  return {
    backgroundImage:
      'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(0,0,0,0.2) 4px, rgba(0,0,0,0.2) 8px)',
  }
}

type DragSession = {
  pointerId: number
  eventId: string
  sourceRole: string
  hoverRole: string
  originY: number
  startMin: number
  previewMin: number
  durationMin: number
  blockHeightPx: number
  title: string
  moved: boolean
}

type ResizeSession = {
  pointerId: number
  eventId: string
  roleName: string
  originY: number
  startMin: number
  initialEndMin: number
  previewEndMin: number
  moved: boolean
}

/** Narrow time-scale gutter (hour labels + minor guides). */
const TIME_COL = '3rem'
/** Minimum width per role column when many roles force horizontal scroll. */
const ROLE_COL_MIN = '6.25rem'

export function Plan24Grid(props: {
  windowStart: Date
  windowEnd: Date
  roles: Plan24GridRoleCol[]
  events: Plan24EventRow[]
  /** Column key for layout / drag; defaults to `role_name`. */
  gridRoleKey?: (ev: Plan24EventRow) => string
  onBackgroundClick: (roleName: string, startAt: Date) => void
  onEventClick: (ev: Plan24EventRow) => void
  /** When role changes, updates `role_name` on the event. */
  onEventMove: (eventId: string, startAt: Date, endAt: Date, roleName: string) => void
  onDropUnassigned: (eventId: string, roleName: string, startAt: Date) => void
  onRoleHeaderClick?: (roleName: string) => void
}) {
  const {
    windowStart,
    windowEnd,
    roles,
    events,
    gridRoleKey = (ev: Plan24EventRow) => (ev.role_name ?? '').trim(),
    onBackgroundClick,
    onEventClick,
    onEventMove,
    onDropUnassigned,
    onRoleHeaderClick,
  } = props
  const totalMin = Math.max(15, minutesBetween(windowStart, windowEnd))

  const bodyMeasureRef = useRef<HTMLDivElement>(null)
  const [bodyHeightPx, setBodyHeightPx] = useState(320)

  useEffect(() => {
    const el = bodyMeasureRef.current
    if (!el) return
    const measure = () => {
      const h = Math.floor(el.getBoundingClientRect().height)
      if (h > 0) setBodyHeightPx(h)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /** Scale timeline so the full shift fits the measured body height (one screen, no inner vertical scroll). */
  const pixelsPerMinute = bodyHeightPx / totalMin

  const columnBodyRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const dragSessionRef = useRef<DragSession | null>(null)
  const resizeSessionRef = useRef<ResizeSession | null>(null)
  const rafRef = useRef<number | null>(null)
  const resizeRafRef = useRef<number | null>(null)
  const lastDragMovedIdRef = useRef<string | null>(null)
  const lastResizeMovedIdRef = useRef<string | null>(null)

  const [dragUi, setDragUi] = useState<null | {
    eventId: string
    sourceRole: string
    hoverRole: string
    previewMin: number
    ghostX: number
    ghostY: number
    title: string
    blockHeightPx: number
    moved: boolean
  }>(null)

  const [resizeUi, setResizeUi] = useState<null | { eventId: string; roleName: string; previewEndMin: number }>(null)

  const setColumnBodyRef = useCallback((roleName: string, el: HTMLDivElement | null) => {
    const m = columnBodyRefs.current
    if (el) m.set(roleName, el)
    else m.delete(roleName)
  }, [])

  const findRoleUnderPointer = useCallback((clientX: number, clientY: number): string | null => {
    for (const [name, el] of columnBodyRefs.current) {
      const rect = el.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) return name
    }
    return null
  }, [])

  const ticks = useMemo(
    () => buildHourTicks(windowStart, totalMin, pixelsPerMinute),
    [windowStart, totalMin, pixelsPerMinute],
  )

  const gridTemplateColumns =
    roles.length === 0 ? TIME_COL : `${TIME_COL} repeat(${roles.length}, minmax(${ROLE_COL_MIN}, 1fr))`
  const chartMinWidth =
    roles.length === 0 ? undefined : `max(100%, calc(${TIME_COL} + ${roles.length} * ${ROLE_COL_MIN}))`

  const byRole = useMemo(() => buildEventsByRole(roles, events, gridRoleKey), [roles, events, gridRoleKey])

  const flushDragUi = useCallback((s: DragSession, ghostX: number, ghostY: number) => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      setDragUi({
        eventId: s.eventId,
        sourceRole: s.sourceRole,
        hoverRole: s.hoverRole,
        previewMin: s.previewMin,
        ghostX,
        ghostY,
        title: s.title,
        blockHeightPx: s.blockHeightPx,
        moved: s.moved,
      })
    })
  }, [])

  const flushResizeUi = useCallback((eventId: string, roleName: string, previewEndMin: number) => {
    if (resizeRafRef.current != null) cancelAnimationFrame(resizeRafRef.current)
    resizeRafRef.current = requestAnimationFrame(() => {
      resizeRafRef.current = null
      setResizeUi({ eventId, roleName, previewEndMin })
    })
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      if (resizeRafRef.current != null) cancelAnimationFrame(resizeRafRef.current)
    }
  }, [])

  const activeDragListenersRef = useRef<{
    move: (e: PointerEvent) => void
    up: (e: PointerEvent) => void
  } | null>(null)

  const activeResizeListenersRef = useRef<{
    move: (e: PointerEvent) => void
    up: (e: PointerEvent) => void
  } | null>(null)

  const endDocumentDrag = useCallback(
    (move: (e: PointerEvent) => void, up: (e: PointerEvent) => void) => {
      document.removeEventListener('pointermove', move, true)
      document.removeEventListener('pointerup', up, true)
      document.removeEventListener('pointercancel', up, true)
      activeDragListenersRef.current = null
    },
    [],
  )

  useEffect(() => {
    return () => {
      const pair = activeDragListenersRef.current
      if (pair) {
        document.removeEventListener('pointermove', pair.move, true)
        document.removeEventListener('pointerup', pair.up, true)
        document.removeEventListener('pointercancel', pair.up, true)
        activeDragListenersRef.current = null
      }
      const rp = activeResizeListenersRef.current
      if (rp) {
        document.removeEventListener('pointermove', rp.move, true)
        document.removeEventListener('pointerup', rp.up, true)
        document.removeEventListener('pointercancel', rp.up, true)
        activeResizeListenersRef.current = null
      }
    }
  }, [])

  const startMove = useCallback(
    (ev: Plan24EventRow, roleName: string, e: ReactPointerEvent<Element>) => {
      if (!gridRoleKey(ev)) return
      e.preventDefault()
      e.stopPropagation()
      lastDragMovedIdRef.current = null

      const start = new Date(ev.start_at)
      const end = new Date(ev.end_at)
      const startMin = minutesBetween(windowStart, start)
      const durationMin = minutesBetween(start, end)
      const hMin = Math.max(2, durationMin)
      const blockHeightPx = hMin * pixelsPerMinute

      const session: DragSession = {
        pointerId: e.pointerId,
        eventId: ev.id,
        sourceRole: roleName,
        hoverRole: roleName,
        originY: e.clientY,
        startMin,
        previewMin: startMin,
        durationMin,
        blockHeightPx,
        title: ev.title,
        moved: false,
      }
      dragSessionRef.current = session
      flushDragUi(session, e.clientX, e.clientY)

      const move = (pe: PointerEvent) => {
        const s = dragSessionRef.current
        if (!s || pe.pointerId !== s.pointerId) return
        if (Math.hypot(pe.clientX - e.clientX, pe.clientY - e.clientY) > 5) s.moved = true
        const deltaMin = (pe.clientY - s.originY) / pixelsPerMinute
        s.previewMin = Math.max(0, Math.min(totalMin - s.durationMin, s.startMin + deltaMin))
        const hit = findRoleUnderPointer(pe.clientX, pe.clientY)
        if (hit) s.hoverRole = hit
        flushDragUi(s, pe.clientX, pe.clientY)
      }

      const up = (pe: PointerEvent) => {
        const s = dragSessionRef.current
        if (!s || pe.pointerId !== s.pointerId) return
        endDocumentDrag(move, up)
        dragSessionRef.current = null
        setDragUi(null)
        if (s.moved) {
          lastDragMovedIdRef.current = s.eventId
          const startAt = addMinutes(windowStart, s.previewMin)
          const endAt = addMinutes(startAt, s.durationMin)
          onEventMove(s.eventId, startAt, endAt, s.hoverRole)
          window.setTimeout(() => {
            if (lastDragMovedIdRef.current === s.eventId) lastDragMovedIdRef.current = null
          }, 400)
        }
      }

      activeDragListenersRef.current = { move, up }
      document.addEventListener('pointermove', move, true)
      document.addEventListener('pointerup', up, true)
      document.addEventListener('pointercancel', up, true)
    },
    [windowStart, pixelsPerMinute, totalMin, findRoleUnderPointer, flushDragUi, onEventMove, endDocumentDrag, gridRoleKey],
  )

  const endResizeDocumentDrag = useCallback(
    (move: (e: PointerEvent) => void, up: (e: PointerEvent) => void) => {
      document.removeEventListener('pointermove', move, true)
      document.removeEventListener('pointerup', up, true)
      document.removeEventListener('pointercancel', up, true)
      activeResizeListenersRef.current = null
    },
    [],
  )

  const startResizeEnd = useCallback(
    (ev: Plan24EventRow, roleName: string, e: ReactPointerEvent<Element>) => {
      if (!gridRoleKey(ev) || (!isPlan24EventCheck(ev) && !isPlan24DdsAction(ev))) return
      e.preventDefault()
      e.stopPropagation()
      lastResizeMovedIdRef.current = null
      const captureEl = e.currentTarget

      const start = new Date(ev.start_at)
      const end = new Date(ev.end_at)
      const startMin = minutesBetween(windowStart, start)
      const endMin = minutesBetween(windowStart, end)

      const session: ResizeSession = {
        pointerId: e.pointerId,
        eventId: ev.id,
        roleName,
        originY: e.clientY,
        startMin,
        initialEndMin: endMin,
        previewEndMin: endMin,
        moved: false,
      }
      resizeSessionRef.current = session
      flushResizeUi(ev.id, roleName, endMin)
      try {
        captureEl.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }

      const move = (pe: PointerEvent) => {
        const s = resizeSessionRef.current
        if (!s || pe.pointerId !== s.pointerId) return
        if (Math.hypot(pe.clientX - e.clientX, pe.clientY - e.clientY) > 0.5) s.moved = true
        const deltaMin = (pe.clientY - s.originY) / pixelsPerMinute
        const raw = s.initialEndMin + deltaMin
        const clamped = Math.max(s.startMin + MIN_EVENT_DURATION_MIN, Math.min(totalMin, raw))
        s.previewEndMin = clamped
        flushResizeUi(s.eventId, s.roleName, clamped)
      }

      const up = (pe: PointerEvent) => {
        const s = resizeSessionRef.current
        if (!s || pe.pointerId !== s.pointerId) return
        endResizeDocumentDrag(move, up)
        resizeSessionRef.current = null
        setResizeUi(null)
        try {
          captureEl.releasePointerCapture(pe.pointerId)
        } catch {
          /* ignore */
        }
        if (s.moved) {
          lastResizeMovedIdRef.current = s.eventId
          const startAt = addMinutes(windowStart, s.startMin)
          const endAt = addMinutes(windowStart, Math.round(s.previewEndMin))
          onEventMove(s.eventId, startAt, endAt, s.roleName)
          window.setTimeout(() => {
            if (lastResizeMovedIdRef.current === s.eventId) lastResizeMovedIdRef.current = null
          }, 400)
        }
      }

      activeResizeListenersRef.current = { move, up }
      document.addEventListener('pointermove', move, true)
      document.addEventListener('pointerup', up, true)
      document.addEventListener('pointercancel', up, true)
    },
    [windowStart, pixelsPerMinute, totalMin, flushResizeUi, onEventMove, endResizeDocumentDrag, gridRoleKey],
  )

  function roleBackgroundClick(roleName: string, e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-plan24-event]')) return
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const y = e.clientY - rect.top
    const minFromStart = Math.max(0, Math.min(totalMin - 1, y / pixelsPerMinute))
    const startAt = addMinutes(windowStart, minFromStart)
    onBackgroundClick(roleName, startAt)
  }

  const hourStepPx = pixelsPerMinute * GRID_MAJOR_MIN
  const halfHourStepPx = pixelsPerMinute * GRID_MINOR_MIN
  const gridLineStyle: CSSProperties = {
    backgroundImage: [
      `repeating-linear-gradient(to bottom, transparent 0, transparent ${halfHourStepPx - 1}px, rgba(0,0,0,0.045) ${halfHourStepPx - 1}px, rgba(0,0,0,0.045) ${halfHourStepPx}px)`,
      `repeating-linear-gradient(to bottom, transparent 0, transparent ${hourStepPx - 1}px, rgba(0,0,0,0.12) ${hourStepPx - 1}px, rgba(0,0,0,0.12) ${hourStepPx}px)`,
    ].join(','),
  }

  const [nowTs, setNowTs] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 30000)
    return () => window.clearInterval(id)
  }, [])
  const nowMinFromStart = useMemo(() => {
    const startMs = windowStart.getTime()
    const endMs = windowEnd.getTime()
    if (nowTs < startMs || nowTs > endMs) return null
    return (nowTs - startMs) / 60000
  }, [nowTs, windowStart, windowEnd])
  const nowTopPx = nowMinFromStart !== null ? nowMinFromStart * pixelsPerMinute : null

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-sm">
      {/* Horizontal scroll wraps header + body so column widths stay identical (no scrollbar mismatch). */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto overflow-y-hidden">
        <div
          className="flex min-h-0 w-full flex-1 flex-col"
          style={chartMinWidth ? { minWidth: chartMinWidth } : undefined}
        >
          <div
            className="grid shrink-0 border-b border-border bg-surface-raised/40"
            style={{ gridTemplateColumns }}
          >
            <div className="min-w-0 border-r border-border bg-surface-raised/25" aria-hidden />
            {roles.map((r) => (
              <div key={r.name} className="min-w-0 border-l border-border px-1.5 py-2 text-center">
                {onRoleHeaderClick ? (
                  <button
                    type="button"
                    title={`Assign person for ${r.name}`}
                    aria-label={r.subtitle ? `${r.name} — ${r.subtitle}. Click to reassign.` : `${r.name} — assign person`}
                    className="w-full rounded-lg px-1 py-1 text-center transition-colors hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 dark:hover:bg-white/10"
                    onClick={() => onRoleHeaderClick(r.name)}
                  >
                    <div className="text-xs font-semibold leading-tight text-fg">{r.name}</div>
                    <div
                      className={`mt-1 min-h-[2.25rem] text-[11px] leading-snug ${r.subtitle ? 'text-accent hover:underline' : 'italic text-muted/80 hover:underline'}`}
                    >
                      {r.subtitle ?? 'Assign person'}
                    </div>
                  </button>
                ) : (
                  <>
                    <div className="text-xs font-semibold leading-tight text-fg">{r.name}</div>
                    {r.subtitle ? <div className="mt-1 text-[11px] leading-snug text-muted">{r.subtitle}</div> : null}
                  </>
                )}
              </div>
            ))}
          </div>

          <div ref={bodyMeasureRef} className="relative min-h-0 flex-1">
            <div
              className="relative grid min-h-0"
              style={{
                gridTemplateColumns,
                height: bodyHeightPx,
              }}
            >
              <div className="relative z-10 min-w-0 border-r border-border bg-surface-raised/20">
                {ticks.map((t) => (
                  <div
                    key={t.label + String(t.top)}
                    className="absolute right-0.5 translate-y-[-50%] text-[9px] font-medium tabular-nums leading-none text-muted"
                    style={{ top: t.top }}
                  >
                    {t.label}
                  </div>
                ))}
              </div>

              {roles.map((r) => {
                const list = byRole.get(r.name) ?? []
                const layoutItems = list.map((ev) => ({
                  id: ev.id,
                  start: minutesBetween(windowStart, new Date(ev.start_at)),
                  end: minutesBetween(windowStart, new Date(ev.end_at)),
                }))
                const layout = assignLanes(layoutItems)
                const itemsById = new Map(layoutItems.map((x) => [x.id, x]))
                const isHoverDrop = dragUi && dragUi.hoverRole === r.name && dragUi.sourceRole !== dragUi.hoverRole
                const previewMin = dragUi?.previewMin ?? null
                const previewTopPx = previewMin !== null ? previewMin * pixelsPerMinute : 0

                return (
                  <div
                    key={r.name}
                    ref={(el) => setColumnBodyRef(r.name, el)}
                    data-plan24-role-col={r.name}
                    className={`relative z-10 min-w-0 border-l border-border bg-surface transition-[box-shadow] ${
                      dragUi && dragUi.hoverRole === r.name ? 'z-[15] ring-2 ring-accent/50 ring-inset' : ''
                    }`}
                    style={gridLineStyle}
                    role="presentation"
                    onClick={(e) => roleBackgroundClick(r.name, e)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const id = e.dataTransfer.getData(DRAG_DT)
                      if (!id) return
                      const el = e.currentTarget
                      const rect = el.getBoundingClientRect()
                      const y = e.clientY - rect.top
                      const minFromStart = Math.max(0, Math.min(totalMin - 1, y / pixelsPerMinute))
                      const startAt = addMinutes(windowStart, minFromStart)
                      onDropUnassigned(id, r.name, startAt)
                    }}
                  >
                    {isHoverDrop && dragUi ? (
                      <div
                        className="pointer-events-none absolute right-1 left-1 z-[8] rounded-md border-2 border-dashed border-accent bg-accent/10"
                        style={{ top: previewTopPx, height: dragUi.blockHeightPx }}
                        aria-hidden
                      />
                    ) : null}
                    {list.map((ev) => {
                      const start = new Date(ev.start_at)
                      const end = new Date(ev.end_at)
                      const topMin = minutesBetween(windowStart, start)
                      const top = topMin * pixelsPerMinute
                      const lane = layout.get(ev.id)
                      const ln = lane?.lane ?? 0
                      const cur = itemsById.get(ev.id)
                      const curStart = cur?.start ?? topMin
                      const curEnd = cur?.end ?? minutesBetween(windowStart, end)
                      // IMPORTANT: laneCount from assignLanes is global for the whole column.
                      // For visual clarity, only split width when this event actually overlaps others.
                      const overlaps = layoutItems.filter((x) => x.start < curEnd && x.end > curStart)
                      const overlapLaneNums = [...new Set(overlaps.map((x) => layout.get(x.id)?.lane ?? 0))].sort((a, b) => a - b)
                      const lc = Math.max(1, overlapLaneNums.length)
                      const lanePos = Math.max(0, overlapLaneNums.indexOf(ln))
                      const innerLeft = `${(lanePos / lc) * 100}%`
                      const innerW = `${(1 / lc) * 100}%`
                      const isAdHoc = ev.source === 'ad_hoc'
                      const isDds = isPlan24DdsAction(ev)
                      const isNr = ev.status === 'not_required'
                      const isDone = ev.status === 'complete'
                      const inProgress = ev.status === 'in_progress'
                      const isDdsInProgress = isDds && (inProgress || ev.status === 'scheduled')
                      const isDragging = dragUi?.eventId === ev.id
                      const sameColumn = isDragging && dragUi.sourceRole === dragUi.hoverRole
                      const topPx = isDragging && sameColumn && previewMin !== null ? previewMin * pixelsPerMinute : top
                      const fadedCross = isDragging && !sameColumn
                      const statusClass = isDds
                        ? isDone
                          ? 'border-emerald-900/45 bg-emerald-600 text-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-700 dark:text-emerald-50'
                          : isNr
                            ? 'border-zinc-500/45 bg-zinc-400 text-zinc-950 dark:border-zinc-600/60 dark:bg-zinc-600 dark:text-zinc-50'
                            : 'border-orange-700/45 bg-orange-500 text-orange-950 shadow-orange-900/15 dark:border-orange-600/60 dark:bg-orange-500 dark:text-orange-950'
                        : isDone
                          ? isClCilQualityFamily(ev.event_type)
                            ? familyCompletedClass(ev.event_type)
                            : 'border-sky-950/40 bg-sky-950 text-sky-50 dark:border-sky-800/60 dark:bg-sky-950 dark:text-sky-100'
                          : inProgress
                            ? 'border-amber-400/60 bg-amber-500 text-amber-950 shadow-amber-900/20 dark:bg-amber-400 dark:text-amber-950'
                            : familyScheduledClass(ev.event_type)
                      const statusLabel = isDds
                        ? isDone
                          ? 'Complete'
                          : isNr
                            ? 'Not required'
                            : 'In process'
                        : isDone
                          ? 'Complete'
                          : inProgress
                            ? 'In progress'
                            : 'Scheduled'
                      const resizingThis = resizeUi?.eventId === ev.id && resizeUi.roleName === r.name
                      const endMinVisual = resizingThis ? resizeUi.previewEndMin : minutesBetween(windowStart, end)
                      const hMin = Math.max(2, endMinVisual - topMin)
                      const hVisual = hMin * pixelsPerMinute
                      const isCheck = isPlan24EventCheck(ev) || isPlan24DdsAction(ev)
                      const canResizeEnd = isCheck && !!gridRoleKey(ev)
                      const raisedInfo = raisedIssueInfo(ev)
                      const raisedLine = raisedInfo ? `\n${raisedInfo.sourceLabel}` : ''
                      const tip = `${ev.title}\n${formatClock(start)}–${formatClock(end)}\n${statusLabel}${isAdHoc ? ' · Ad hoc' : ''}${raisedLine}`
                      const donePatternStyle: CSSProperties | undefined = isDone
                        ? isClCilQualityFamily(ev.event_type) && !isDds
                          ? familyCompletedStripeStyle()
                          : {
                              backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(255,255,255,0.28) 5px, rgba(255,255,255,0.28) 9px)`,
                            }
                        : undefined
                      return (
                        <div
                          key={ev.id}
                          data-plan24-event
                          className={`group absolute flex flex-col overflow-hidden rounded-md border text-left text-[10px] font-medium leading-tight shadow-sm transition-opacity ${statusClass} ${isAdHoc ? 'border-dashed' : ''} ${isDragging ? 'z-[6]' : ''} ${resizeUi?.eventId === ev.id ? 'z-[7]' : ''}`}
                          style={{
                            top: topPx,
                            height: hVisual,
                            left: innerLeft,
                            width: innerW,
                            touchAction: 'none',
                            opacity: fadedCross ? 0.35 : 1,
                          }}
                        >
                          {isDone ? (
                            <span
                              aria-hidden
                              className={`pointer-events-none absolute inset-0 z-0 rounded-md ${
                                isClCilQualityFamily(ev.event_type) && !isDds ? 'opacity-80 dark:opacity-70' : 'opacity-[0.4]'
                              }`}
                              style={donePatternStyle}
                            />
                          ) : null}
                          <button
                            type="button"
                            aria-label={`${ev.title}, ${formatClock(start)} to ${formatClock(end)}, ${statusLabel}${isAdHoc ? ', ad hoc' : ''}`}
                            title={tip}
                            className={`relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col items-stretch justify-start overflow-hidden border-0 px-1 py-0.5 text-left text-[10px] font-medium leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/70 ${canResizeEnd ? 'rounded-t-md rounded-b-none' : 'rounded-md'} ${isDragging ? 'cursor-grabbing' : 'cursor-grab hover:ring-2 hover:ring-inset hover:ring-accent/40'}`}
                            onPointerDown={(pe) => {
                              pe.stopPropagation()
                              startMove(ev, r.name, pe)
                            }}
                            onClick={(ce) => {
                              ce.stopPropagation()
                              if (lastDragMovedIdRef.current === ev.id || lastResizeMovedIdRef.current === ev.id) return
                              onEventClick(ev)
                            }}
                            onKeyDown={(ke) => {
                              if (ke.key === 'Enter' || ke.key === ' ') {
                                ke.preventDefault()
                                if (lastDragMovedIdRef.current === ev.id || lastResizeMovedIdRef.current === ev.id) return
                                onEventClick(ev)
                              }
                            }}
                          >
                            {!isDone && !isNr && (isDds ? isDdsInProgress : inProgress) ? (
                              <span
                                aria-hidden
                                className={`pointer-events-none absolute right-1 top-1 inline-flex size-1.5 rounded-full ${
                                  isDds ? 'bg-orange-950/85' : 'bg-amber-900/90'
                                }`}
                              />
                            ) : null}
                            {raisedInfo ? (
                              <span
                                aria-hidden
                                className="pointer-events-none absolute left-1 top-1 z-[2] inline-flex size-3 items-center justify-center rounded bg-black/15 dark:bg-white/10"
                              >
                                {raisedInfo.icon}
                              </span>
                            ) : null}
                            <span
                              className={`pointer-events-none relative z-[2] min-h-0 w-full min-w-0 flex-1 truncate text-left ${
                                isDone ? 'line-through decoration-2 decoration-current/55' : ''
                              } ${raisedInfo ? 'pl-3' : ''}`}
                            >
                              {ev.title}
                            </span>
                          </button>
                          {canResizeEnd ? (
                            <div
                              role="separator"
                              aria-orientation="horizontal"
                              aria-label={`Resize end time for ${ev.title}`}
                              title="Drag up or down to change duration"
                              className="pointer-events-auto absolute bottom-0 left-0 right-0 z-[3] flex h-1.5 cursor-ns-resize touch-none items-end justify-center bg-transparent"
                              onPointerDownCapture={(pe) => {
                                pe.preventDefault()
                                pe.stopPropagation()
                                startResizeEnd(ev, r.name, pe)
                              }}
                            >
                              <span
                                aria-hidden
                                className="pointer-events-none mb-px h-px w-4 max-w-[45%] rounded-full bg-white/22 group-hover:bg-white/35"
                              />
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {nowTopPx !== null ? (
              <div
                className="pointer-events-none absolute inset-x-0 top-0 bottom-0 z-[12]"
                aria-hidden
              >
                <div
                  className="absolute right-0 left-0 flex items-center"
                  style={{ top: nowTopPx, transform: 'translateY(-50%)' }}
                >
                  <span
                    className="mr-0.5 inline-block size-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_1.5px_rgba(255,255,255,0.75)] dark:shadow-[0_0_0_1.5px_rgba(0,0,0,0.45)]"
                    aria-hidden
                  />
                  <span className="h-[2px] min-w-0 flex-1 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.45)]" />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {dragUi?.moved ? (
        <div
          className="pointer-events-none fixed z-[100] max-w-[14rem] rounded-lg border border-border-strong bg-surface px-2 py-1.5 text-xs shadow-lg"
          style={{ left: dragUi.ghostX + 12, top: dragUi.ghostY + 12 }}
        >
          <div className="font-semibold text-fg">{dragUi.title}</div>
          <div className="text-[10px] text-muted">
            {dragUi.sourceRole !== dragUi.hoverRole ? `→ ${dragUi.hoverRole} · ` : ''}
            {formatClock(addMinutes(windowStart, dragUi.previewMin))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function buildHourTicks(windowStart: Date, totalMin: number, pixelsPerMinute: number) {
  const ticks: { top: number; label: string }[] = []
  for (let m = 0; m <= totalMin; m += GRID_MAJOR_MIN) {
    const d = addMinutes(windowStart, m)
    ticks.push({ top: m * pixelsPerMinute, label: formatClock(d) })
  }
  return ticks
}

function buildEventsByRole(
  roles: Plan24GridRoleCol[],
  events: Plan24EventRow[],
  gridRoleKey: (ev: Plan24EventRow) => string,
) {
  const m = new Map<string, Plan24EventRow[]>()
  for (const r of roles) m.set(r.name, [])
  const lowerToCanonical = new Map(roles.map((r) => [r.name.trim().toLowerCase(), r.name]))
  for (const ev of events) {
    const rn = gridRoleKey(ev).trim()
    if (!rn) continue
    const canon = lowerToCanonical.get(rn.toLowerCase())
    if (!canon) continue
    m.get(canon)!.push(ev)
  }
  return m
}

export const PLAN24_DRAG_MIME = DRAG_DT
