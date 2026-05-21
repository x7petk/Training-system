import type { DdsP2pSummaryShiftRow } from './DdsP2pSummaryBody'
import type { ShiftRow } from '../plan24/plan24ShiftUtils'

export function triggerShiftRowsFromShell(shifts: DdsP2pSummaryShiftRow[]): ShiftRow[] {
  return shifts.map((s) => ({
    kind: s.kind,
    start_local: s.start_local ?? '06:00:00',
    end_local: s.end_local ?? '17:00:00',
    display_name: s.display_name,
  }))
}
