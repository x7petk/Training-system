import type { KpiCascadeRole } from '../kpiCascade/types'
import { SWP_LANE_HEADER_HEIGHT } from './flowLayout'
import { SWP_LANE_THEMES, SWP_ROLE_KEY_ORDER, matchRoleKey } from './roleLaneTheme'

type Props = {
  roles: KpiCascadeRole[]
  columnWidth: number
}

/** Fixed top swimlane role headers (Operator → Support). */
export function SwpLaneHeaderRow({ roles, columnWidth }: Props) {
  const roleLabelByKey = new Map<string, string>()
  for (const role of roles) {
    const key = matchRoleKey(role.name)
    if (key) roleLabelByKey.set(key, role.name)
  }

  return (
    <div
      className="flex border-b border-slate-300/80 shadow-sm"
      style={{ height: SWP_LANE_HEADER_HEIGHT }}
    >
      {SWP_ROLE_KEY_ORDER.map((roleKey) => {
        const theme = SWP_LANE_THEMES[roleKey]
        const Icon = theme.icon
        return (
          <div
            key={roleKey}
            className={`flex shrink-0 items-center justify-center gap-1.5 border-r border-slate-300/60 px-1 last:border-r-0 ${theme.headerClass}`}
            style={{ width: columnWidth, height: SWP_LANE_HEADER_HEIGHT }}
          >
            <Icon className="size-3.5 shrink-0 opacity-95" />
            <span className="text-center text-[11px] font-bold leading-tight">
              {roleLabelByKey.get(roleKey) ?? theme.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
