import { useCallback, useRef, useState } from 'react'
import { EPLAN_STATUS_BAR_CLASS } from './eplanConstants'
import type { EPlanAction } from './eplanTypes'
import {
  eplanDatesAfterMove,
  eplanDatesAfterResizeEnd,
  eplanDatesAfterResizeStart,
  type EPlanGanttDragMode,
} from './eplanGanttDrag'
import { eplanBarLayout } from './eplanUtils'

const DRAG_THRESHOLD_PX = 4

type Props = {
  action: EPlanAction
  rangeFrom: string
  rangeTo: string
  progressLabel: string | null
  onDatesChange: (actionId: string, startDate: string, endDate: string) => void
  onOpen: (action: EPlanAction) => void
}

export function EPlanGanttBar({ action, rangeFrom, rangeTo, progressLabel, onDatesChange, onOpen }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<{ startDate: string; endDate: string } | null>(null)
  const suppressClickRef = useRef(false)
  const [preview, setPreview] = useState<{ startDate: string; endDate: string } | null>(null)
  const dragRef = useRef<{
    mode: EPlanGanttDragMode
    startX: number
    startPct: number
    initialStart: string
    initialEnd: string
    moved: boolean
  } | null>(null)

  const displayStart = preview?.startDate ?? action.startDate
  const displayEnd = preview?.endDate ?? action.endDate
  const displayAction = preview ? { ...action, startDate: displayStart, endDate: displayEnd } : action
  const bar = eplanBarLayout(displayAction, rangeFrom, rangeTo)

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
      let dates: { startDate: string; endDate: string }
      if (d.mode === 'move') {
        dates = eplanDatesAfterMove(d.initialStart, d.initialEnd, rangeFrom, rangeTo, d.startPct, pct)
      } else if (d.mode === 'resize-start') {
        dates = eplanDatesAfterResizeStart(d.initialEnd, rangeFrom, rangeTo, pct)
      } else {
        dates = eplanDatesAfterResizeEnd(d.initialStart, rangeFrom, rangeTo, pct)
      }
      previewRef.current = dates
      setPreview(dates)
    },
    [rangeFrom, rangeTo],
  )

  const endDrag = useCallback(() => {
    const d = dragRef.current
    const p = previewRef.current
    const moved = d?.moved ?? false
    dragRef.current = null
    previewRef.current = null
    setPreview(null)
    if (moved) suppressClickRef.current = true
    if (moved && p && (p.startDate !== action.startDate || p.endDate !== action.endDate)) {
      onDatesChange(action.id, p.startDate, p.endDate)
    }
  }, [action.endDate, action.id, action.startDate, onDatesChange])

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
    (e: React.PointerEvent, mode: EPlanGanttDragMode) => {
      e.preventDefault()
      e.stopPropagation()
      const startPct = pctFromEvent(e.clientX)
      dragRef.current = {
        mode,
        startX: e.clientX,
        startPct,
        initialStart: action.startDate,
        initialEnd: action.endDate,
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
    [action.endDate, action.startDate, endDrag, onPointerMove, pctFromEvent],
  )

  if (!bar) return <div ref={trackRef} className="relative h-full w-full" />

  return (
    <div ref={trackRef} className="relative h-full w-full touch-none">
      <div
        role="button"
        tabIndex={0}
        className={[
          'absolute top-1/2 flex h-5 -translate-y-1/2 cursor-grab items-center overflow-hidden rounded-md text-[9px] font-semibold text-white shadow-sm active:cursor-grabbing',
          EPLAN_STATUS_BAR_CLASS[action.status],
          preview ? 'ring-2 ring-accent/60' : '',
        ].join(' ')}
        style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}
        onPointerDown={(e) => startDrag(e, 'move')}
        onClick={(e) => {
          e.stopPropagation()
          if (suppressClickRef.current) {
            suppressClickRef.current = false
            return
          }
          onOpen(action)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onOpen(action)
        }}
        aria-label={`${action.title}, drag to move dates`}
      >
        <span
          className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize rounded-l-md hover:bg-white/25"
          onPointerDown={(e) => startDrag(e, 'resize-start')}
          aria-hidden
        />
        <span className="pointer-events-none flex-1 truncate px-1.5">{progressLabel}</span>
        <span
          className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize rounded-r-md hover:bg-white/25"
          onPointerDown={(e) => startDrag(e, 'resize-end')}
          aria-hidden
        />
      </div>
    </div>
  )
}
