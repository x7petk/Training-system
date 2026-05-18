import { Loader2 } from 'lucide-react'
import { ShiftDdsKpiSummary } from './ShiftDdsKpiSummary'

type CellLite = { id: string; name: string }

type Props = {
  cells: CellLite[]
  planDate: string
  shiftKind: string
  shellLoading?: boolean
}

export function PlantDdsKpiSummary({ cells, planDate, shiftKind, shellLoading }: Props) {
  if (shellLoading) {
    return (
      <p className="flex items-center gap-1 text-[11px] text-muted" role="status">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading…
      </p>
    )
  }

  if (!shiftKind) {
    return <p className="text-[11px] text-muted">Select a shift.</p>
  }

  if (cells.length === 0) {
    return <p className="text-[11px] text-muted">No cells in this plant.</p>
  }

  return (
    <div className="space-y-3">
      {cells.map((cell) => (
        <div key={cell.id} className="rounded-lg border border-border/60 bg-canvas/20 p-2">
          <h3 className="mb-1.5 truncate border-b border-border/50 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
            {cell.name}
          </h3>
          <ShiftDdsKpiSummary
            cellId={cell.id}
            planDate={planDate}
            shiftKind={shiftKind}
            kpiSurface="plant-dds"
            compact
          />
        </div>
      ))}
    </div>
  )
}
