import { DdsTriggerScoreTilesRow } from './DdsTriggerScoreTilesRow'
import type { DdsP2pSummaryShiftRow } from './DdsP2pSummaryBody'

type CellLite = { id: string; name: string }

type Props = {
  cells: CellLite[]
  planDate: string
  shiftKind: string
  shifts?: DdsP2pSummaryShiftRow[]
  dayRollup?: boolean
}

export function SiteDdsTriggerGrid({ cells, planDate, shiftKind, shifts, dayRollup }: Props) {
  if (!shiftKind && !dayRollup) return null
  return (
    <div className="mb-2 grid grid-cols-1 gap-1 border-b border-border/40 pb-2 sm:grid-cols-2">
      {cells.map((cell) => (
        <div key={cell.id} className="flex min-w-0 items-center gap-1 rounded border border-border/40 px-1 py-0.5">
          <span className="max-w-[4.5rem] shrink-0 truncate text-[8px] font-semibold uppercase text-muted">
            {cell.name}
          </span>
          <DdsTriggerScoreTilesRow
            cellId={cell.id}
            planDate={planDate}
            shiftKind={dayRollup ? undefined : shiftKind}
            shifts={shifts}
            dayRollup={dayRollup}
            compact
          />
        </div>
      ))}
    </div>
  )
}
