import { useCallback, useRef, useState } from 'react'
import { formatPlan24Clock } from '../plan24/plan24ShiftUtils'
import type { ShiftRow } from '../plan24/plan24ShiftUtils'
import {
  ddsActionBarLayout,
  ddsActionBarStatusClass,
  ddsActionTimesAfterMove,
  ddsActionTimesAfterResizeEnd,
  ddsActionTimesAfterResizeStart,
  type DdsActionTimelineDragMode,
} from './ddsActionTimelineDrag'

const DRAG_THRESHOLD_PX = 4

type Props = {
  eventId: string
  title: string
  status: string
  planDate: string
  shiftKind: string
  startAt: string
  endAt: string
  windowStart: Date
  totalMin: number
  shifts: ShiftRow[]
  readOnly?: boolean
  minWidthPct?: number
  barClassName?: string
  onOpen: () => void
  onTimesChange: (eventId: string, startAt: Date, endAt: Date) => void
}

export function DdsActionTimelineBar({
  eventId,
  title,
  status,
  planDate,
  shiftKind,
  startAt,
  endAt,
  windowStart,
  totalMin,
  shifts,
  readOnly = false,
  minWidthPct,
  barClassName = '',
  onOpen,
  onTimesChange,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<{ start: Date; end: Date } | null>(null)
  const suppressClickRef = useRef(false)
  const [preview, setPreview] = useState<{ start: Date; end: Date } | null>(null)
  const dragRef = useRef<{
    mode: DdsActionTimelineDragMode
    startX: number
    startPct: number
    initialStart: Date
    initialEnd: Date
    moved: boolean
  } | null>(null)

  const baseStart = new Date(startAt)
  const baseEnd = new Date(endAt)
  const displayStart = preview?.start ?? baseStart
  const displayEnd = preview?.end ?? baseEnd
  const bar = ddsActionBarLayout(displayStart, displayEnd, windowStart, totalMin, minWidthPct)

  const pctFromEvent = useCallback((clientX: number) => {
    const el = trackRef.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    if (r.width <= 0) return 0
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width))
  }, [])

  const applyPreview = useCallback(
    (pct: number) => {
      const d = dragRef.current
      if (!d) return
      let times: { start: Date; end: Date }
      if (d.mode === 'move') {
        times = ddsActionTimesAfterMove(
          d.initialStart,
          d.initialEnd,
          windowStart,
          totalMin,
          d.startPct,
          pct,
          planDate,
          shiftKind,
          shifts,
        )
      } else if (d.mode === 'resize-start') {
        times = ddsActionTimesAfterResizeStart(
          d.initialEnd,
          windowStart,
          totalMin,
          pct,
          planDate,
          shiftKind,
          shifts,
        )
      } else {
        times = ddsActionTimesAfterResizeEnd(
          d.initialStart,
          windowStart,
          totalMin,
          pct,
          planDate,
          shiftKind,
          shifts,
        )
      }
      previewRef.current = times
      setPreview(times)
    },
    [planDate, shiftKind, shifts, totalMin, windowStart],
  )

  const endDrag = useCallback(() => {
    const d = dragRef.current
    const p = previewRef.current
    const moved = d?.moved ?? false
    dragRef.current = null
    previewRef.current = null
    setPreview(null)
    if (moved) suppressClickRef.current = true
    if (
      moved &&
      p &&
      (p.start.getTime() !== baseStart.getTime() || p.end.getTime() !== baseEnd.getTime())
    ) {
      onTimesChange(eventId, p.start, p.end)
    }
  }, [baseEnd, baseStart, eventId, onTimesChange])

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      if (Math.abs(e.clientX - d.startX) > DRAG_THRESHOLD_PX) d.moved = true
      applyPreview(pctFromEvent(e.clientX))
    },
    [applyPreview, pctFromEvent],
  )

  const startDrag = useCallback(
    (e: React.PointerEvent, mode: DdsActionTimelineDragMode) => {
      if (readOnly) return
      e.preventDefault()
      e.stopPropagation()
      const startPct = pctFromEvent(e.clientX)
      dragRef.current = {
        mode,
        startX: e.clientX,
        startPct,
        initialStart: baseStart,
        initialEnd: baseEnd,
        moved: false,
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onUp)
        endDrag()
      }
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onUp)
    },
    [baseEnd, baseStart, endDrag, onPointerMove, pctFromEvent, readOnly],
  )

  const clockLabel = `${formatPlan24Clock(displayStart)}–${formatPlan24Clock(displayEnd)}`

  const barNode = readOnly ? (
    <button
      type="button"
      title={`${title} · ${clockLabel}`}
      className={`absolute min-w-[5px] rounded-sm border text-left font-medium leading-none shadow-sm transition hover:brightness-105 ${ddsActionBarStatusClass(status)} ${barClassName || 'inset-y-px'}`}
      style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}
      onClick={onOpen}
    >
      <span className="sr-only">
        {title}, {clockLabel}
      </span>
    </button>
  ) : (
    <div
      role="button"
      tabIndex={0}
      title={`${title} · ${clockLabel} — drag to move, edges to resize`}
      className={[
        'absolute min-w-[5px] touch-none rounded-sm border text-left font-medium leading-none shadow-sm',
        barClassName || 'inset-y-px',
        ddsActionBarStatusClass(status),
        preview ? 'ring-2 ring-accent/60' : '',
        'cursor-grab active:cursor-grabbing',
      ].join(' ')}
      style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}
      onPointerDown={(e) => startDrag(e, 'move')}
      onClick={(e) => {
        e.stopPropagation()
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          return
        }
        onOpen()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen()
      }}
      aria-label={`${title}, ${clockLabel}`}
    >
      <span
        className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize rounded-l-sm hover:bg-white/25"
        onPointerDown={(e) => startDrag(e, 'resize-start')}
        aria-hidden
      />
      <span className="sr-only">
        {title}, {clockLabel}
      </span>
      <span
        className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize rounded-r-sm hover:bg-white/25"
        onPointerDown={(e) => startDrag(e, 'resize-end')}
        aria-hidden
      />
    </div>
  )

  return (
    <div ref={trackRef} className="absolute inset-0">
      {barNode}
    </div>
  )
}
