import { DdsTriggerScoreTilesRow } from './DdsTriggerScoreTilesRow'
import type { DdsP2pSummaryShiftRow } from './DdsP2pSummaryBody'

type CellLite = { id: string; name: string }

type Props = {
  cells: CellLite[]
  planDate: string
  shifts?: DdsP2pSummaryShiftRow[]
}

export function PlantDdsTriggerStrip({ cells, planDate, shifts }: Props) {
  if (cells.length === 0) return null
  const multiCell = cells.length > 1
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {cells.map((cell) => (
        <div key={cell.id} className="flex flex-wrap items-center gap-1.5">
          {multiCell ? (
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-muted">{cell.name}</span>
          ) : null}
          <DdsTriggerScoreTilesRow cellId={cell.id} planDate={planDate} shifts={shifts} dayRollup compact />
        </div>
      ))}
    </div>
  )
}
