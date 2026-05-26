import type { ReactNode } from 'react'

type Props = {
  table?: ReactNode
  tiles?: ReactNode
}

/** By-line table on the left; KPI tiles on the right when there is room (wraps on narrow widths). */
export function DdsKpiTableTilesLayout({ table, tiles }: Props) {
  if (!table && !tiles) return null
  if (!table) return <>{tiles}</>
  if (!tiles) return <>{table}</>

  return (
    <div className="flex flex-wrap items-start gap-1.5">
      <div className="min-w-0 w-max max-w-full shrink-0">{table}</div>
      <div className="min-w-0 flex-1">{tiles}</div>
    </div>
  )
}
