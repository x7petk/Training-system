import { SWP_LANE_HEADER_HEIGHT } from './flowLayout'
import { SWP_ROLE_KEY_ORDER } from './roleLaneTheme'

type Props = {
  height: number
  columnWidth: number
}

/** Lane column dividers on a uniform canvas background. */
export function SwpColumnLanes({ height, columnWidth }: Props) {
  const totalWidth = columnWidth * SWP_ROLE_KEY_ORDER.length
  const bodyHeight = height - SWP_LANE_HEADER_HEIGHT

  return (
    <div
      className="pointer-events-none absolute left-0 z-0 bg-slate-50"
      style={{ top: SWP_LANE_HEADER_HEIGHT, width: totalWidth, height: bodyHeight }}
      aria-hidden
    >
      {SWP_ROLE_KEY_ORDER.map((roleKey, index) => {
        const left = index * columnWidth
        return (
          <div
            key={roleKey}
            className="absolute top-0 border-r border-slate-200/90 bg-slate-50 last:border-r-0"
            style={{ left, width: columnWidth, height: bodyHeight }}
          />
        )
      })}
    </div>
  )
}
