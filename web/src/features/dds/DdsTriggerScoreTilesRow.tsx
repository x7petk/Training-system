import { DdsTriggerScoreTile } from './DdsTriggerScoreTile'
import { triggerShiftRowsFromShell } from './ddsTriggerShiftRows'
import type { DdsP2pSummaryShiftRow } from './DdsP2pSummaryBody'

type Props = {
  cellId: string
  planDate: string
  shiftKind?: string
  shifts?: DdsP2pSummaryShiftRow[]
  dayRollup?: boolean
  compact?: boolean
}

/** Safety + Quality score tiles for DDS surfaces. */
export function DdsTriggerScoreTilesRow({
  cellId,
  planDate,
  shiftKind,
  shifts = [],
  dayRollup,
  compact,
}: Props) {
  const shiftRows = triggerShiftRowsFromShell(shifts)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <DdsTriggerScoreTile
        cellId={cellId}
        planDate={planDate}
        shiftKind={shiftKind}
        domain="safety"
        shifts={shiftRows}
        dayRollup={dayRollup}
        compact={compact}
      />
      <DdsTriggerScoreTile
        cellId={cellId}
        planDate={planDate}
        shiftKind={shiftKind}
        domain="quality"
        shifts={shiftRows}
        dayRollup={dayRollup}
        compact={compact}
      />
    </div>
  )
}
