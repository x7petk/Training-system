import { compareYMD } from '../../lib/dueDateUtils'
import { eplanAddDaysYmd, eplanDaysBetween } from './eplanUtils'

export type EPlanGanttDragMode = 'move' | 'resize-start' | 'resize-end'

export function eplanYmdFromTimelinePct(rangeFrom: string, rangeTo: string, pct: number): string {
  const total = eplanDaysBetween(rangeFrom, rangeTo)
  const idx = Math.max(0, Math.min(total - 1, Math.round(pct * (total - 1))))
  return eplanAddDaysYmd(rangeFrom, idx)
}

export function eplanClampActionDates(startDate: string, endDate: string): { startDate: string; endDate: string } {
  if (compareYMD(endDate, startDate) < 0) return { startDate: endDate, endDate: startDate }
  return { startDate, endDate }
}

export function eplanDatesAfterMove(
  initialStart: string,
  initialEnd: string,
  rangeFrom: string,
  rangeTo: string,
  startPct: number,
  currentPct: number,
): { startDate: string; endDate: string } {
  const total = eplanDaysBetween(rangeFrom, rangeTo)
  const delta = Math.round((currentPct - startPct) * Math.max(1, total - 1))
  const duration = eplanDaysBetween(initialStart, initialEnd) - 1
  let start = eplanAddDaysYmd(initialStart, delta)
  let end = eplanAddDaysYmd(start, duration)
  return eplanClampActionDates(start, end)
}

export function eplanDatesAfterResizeStart(
  initialEnd: string,
  rangeFrom: string,
  rangeTo: string,
  currentPct: number,
): { startDate: string; endDate: string } {
  const start = eplanYmdFromTimelinePct(rangeFrom, rangeTo, currentPct)
  return eplanClampActionDates(start, initialEnd)
}

export function eplanDatesAfterResizeEnd(
  initialStart: string,
  rangeFrom: string,
  rangeTo: string,
  currentPct: number,
): { startDate: string; endDate: string } {
  const end = eplanYmdFromTimelinePct(rangeFrom, rangeTo, currentPct)
  return eplanClampActionDates(initialStart, end)
}
