import { DdsTriggerScoreTilesRow } from './DdsTriggerScoreTilesRow'
import type { DdsP2pSummaryShiftRow } from './DdsP2pSummaryBody'

type CellLite = { id: string; name: string }

type Props = {
  cells: CellLite[]
  planDate: string
  shiftKind: string
  shifts?: DdsP2pSummaryShiftRow[]
}

export function PlantDdsTriggerStrip({ cells, planDate, shiftKind, shifts }: Props) {
  if (!shiftKind) return null
  return (
    <div className="space-y-2 border-b border-border/40 pb-2">
      {cells.map((cell) => (
        <div key={cell.id} className="flex flex-wrap items-center gap-2">
          <span className="min-w-[5rem] shrink-0 truncate text-[10px] font-semibold uppercase text-muted">
            {cell.name}
          </span>
          <DdsTriggerScoreTilesRow
            cellId={cell.id}
            planDate={planDate}
            shiftKind={shiftKind}
            shifts={shifts}
            compact
          />
        </div>
      ))}
    </div>
  )
}
