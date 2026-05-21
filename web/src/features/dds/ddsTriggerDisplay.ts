import { localYMD } from '../../lib/dueDateUtils'
import { shiftWindowBounds, type ShiftRow } from '../plan24/plan24ShiftUtils'

/**
 * Which shift's trigger submission to show for a calendar day (Line DDS / compliance day tiles).
 * Prefer the shift whose window contains "now" when it has data; otherwise latest updated submission.
 */
export function pickTriggerDisplayShiftKind(opts: {
  planDateYmd: string
  shifts: ShiftRow[]
  /** shift_kind values that have a submission for this day */
  shiftsWithData: string[]
  /** shift_kind → updated_at ISO */
  updatedAtByShift: Map<string, string>
  now?: Date
}): string {
  const { planDateYmd, shifts, shiftsWithData, updatedAtByShift } = opts
  const now = opts.now ?? new Date()
  const todayYmd = localYMD(now)

  if (shifts.length === 0) return shiftsWithData[0] ?? ''

  if (planDateYmd === todayYmd) {
    for (const sh of shifts) {
      const { start, end } = shiftWindowBounds(planDateYmd, sh.kind, shifts)
      if (now.getTime() >= start.getTime() && now.getTime() < end.getTime()) {
        if (shiftsWithData.includes(sh.kind)) return sh.kind
        return sh.kind
      }
    }
  }

  if (shiftsWithData.length > 0) {
    let best = shiftsWithData[0]!
    let bestTs = updatedAtByShift.get(best) ?? ''
    for (const k of shiftsWithData) {
      const ts = updatedAtByShift.get(k) ?? ''
      if (ts > bestTs) {
        best = k
        bestTs = ts
      }
    }
    return best
  }

  if (planDateYmd === todayYmd) {
    for (const sh of shifts) {
      const { start, end } = shiftWindowBounds(planDateYmd, sh.kind, shifts)
      if (now.getTime() >= start.getTime() && now.getTime() < end.getTime()) return sh.kind
    }
  }

  return shifts[0]?.kind ?? ''
}
