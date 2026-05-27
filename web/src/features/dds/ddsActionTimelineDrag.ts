import { addMinutes, minutesBetween, shiftWindowBounds, type ShiftRow } from '../plan24/plan24ShiftUtils'

export type DdsActionTimelineDragMode = 'move' | 'resize-start' | 'resize-end'

const MIN_DURATION_MIN = 5

export function ddsActionBarStatusClass(status: string): string {
  if (status === 'complete') return 'border-emerald-800/50 bg-emerald-600 text-emerald-50'
  if (status === 'not_required') return 'border-zinc-500/50 bg-zinc-400 text-zinc-950'
  return 'border-orange-800/50 bg-orange-500 text-orange-950'
}

export function ddsActionMinuteFromTimelinePct(totalMin: number, pct: number): number {
  const clamped = Math.max(0, Math.min(1, pct))
  const raw = clamped * totalMin
  return Math.round(raw / 5) * 5
}

export function ddsActionDateFromTimelinePct(windowStart: Date, totalMin: number, pct: number): Date {
  return addMinutes(windowStart, ddsActionMinuteFromTimelinePct(totalMin, pct))
}

export function ddsActionClampTimes(
  planDate: string,
  shiftKind: string,
  shifts: ShiftRow[],
  start: Date,
  end: Date,
): { start: Date; end: Date } {
  const bounds = shiftWindowBounds(planDate, shiftKind, shifts)
  let s = new Date(start.getTime())
  let e = new Date(end.getTime())
  if (e.getTime() < s.getTime()) {
    const tmp = s
    s = e
    e = tmp
  }
  if (minutesBetween(s, e) < MIN_DURATION_MIN) {
    e = addMinutes(s, MIN_DURATION_MIN)
  }
  if (s.getTime() < bounds.start.getTime()) {
    const dur = Math.max(MIN_DURATION_MIN, minutesBetween(s, e))
    s = bounds.start
    e = addMinutes(s, dur)
  }
  if (e.getTime() > bounds.end.getTime()) {
    const dur = Math.max(MIN_DURATION_MIN, minutesBetween(s, e))
    e = bounds.end
    s = addMinutes(e, -dur)
  }
  if (minutesBetween(s, e) < MIN_DURATION_MIN) {
    e = addMinutes(s, MIN_DURATION_MIN)
    if (e.getTime() > bounds.end.getTime()) {
      e = bounds.end
      s = addMinutes(e, -MIN_DURATION_MIN)
    }
  }
  if (s.getTime() < bounds.start.getTime()) s = bounds.start
  return { start: s, end: e }
}

export function ddsActionTimesAfterMove(
  initialStart: Date,
  initialEnd: Date,
  _windowStart: Date,
  totalMin: number,
  startPct: number,
  currentPct: number,
  planDate: string,
  shiftKind: string,
  shifts: ShiftRow[],
): { start: Date; end: Date } {
  const deltaMin = Math.round((currentPct - startPct) * totalMin)
  const snapped = Math.round(deltaMin / 5) * 5
  const start = addMinutes(initialStart, snapped)
  const end = addMinutes(initialEnd, snapped)
  return ddsActionClampTimes(planDate, shiftKind, shifts, start, end)
}

export function ddsActionTimesAfterResizeStart(
  initialEnd: Date,
  windowStart: Date,
  totalMin: number,
  currentPct: number,
  planDate: string,
  shiftKind: string,
  shifts: ShiftRow[],
): { start: Date; end: Date } {
  const start = ddsActionDateFromTimelinePct(windowStart, totalMin, currentPct)
  return ddsActionClampTimes(planDate, shiftKind, shifts, start, initialEnd)
}

export function ddsActionTimesAfterResizeEnd(
  initialStart: Date,
  windowStart: Date,
  totalMin: number,
  currentPct: number,
  planDate: string,
  shiftKind: string,
  shifts: ShiftRow[],
): { start: Date; end: Date } {
  const end = ddsActionDateFromTimelinePct(windowStart, totalMin, currentPct)
  return ddsActionClampTimes(planDate, shiftKind, shifts, initialStart, end)
}

export function ddsActionBarLayout(
  start: Date,
  end: Date,
  windowStart: Date,
  totalMin: number,
  minWidthPct = 0.65,
): { leftPct: number; widthPct: number } {
  const startMin = Math.max(0, minutesBetween(windowStart, start))
  const durMin = Math.max(2, minutesBetween(start, end))
  const leftPct = (startMin / totalMin) * 100
  const widthPct = (durMin / totalMin) * 100
  return { leftPct, widthPct: Math.max(widthPct, minWidthPct) }
}
