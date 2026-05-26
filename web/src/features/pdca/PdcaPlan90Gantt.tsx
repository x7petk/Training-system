import { useMemo } from 'react'
import { compareYMD, localYMD } from '../../lib/dueDateUtils'
import { EPLAN_STATUS_BAR_CLASS } from '../eplan/eplanConstants'
import type { EPlanAction, EPlanActionStatus } from '../eplan/eplanTypes'
import { eplanBarLayout, eplanDaysBetween } from '../eplan/eplanUtils'

function plan90Range(): { from: string; to: string } {
  const today = localYMD(new Date())
  const end = new Date(today + 'T12:00:00')
  end.setDate(end.getDate() + 90)
  return { from: today, to: localYMD(end) }
}

function statusLabel(status: EPlanActionStatus): string {
  return status.replace(/_/g, ' ')
}

type Props = {
  actions: EPlanAction[]
  expanded?: boolean
}

export function PdcaPlan90Gantt({ actions, expanded = false }: Props) {
  const todayYmd = localYMD(new Date())
  const range = useMemo(() => plan90Range(), [])
  const totalDays = eplanDaysBetween(range.from, range.to)

  const todayPct = useMemo(() => {
    if (compareYMD(todayYmd, range.from) < 0 || compareYMD(todayYmd, range.to) > 0) return null
    const offset = eplanDaysBetween(range.from, todayYmd) - 1
    return (offset / totalDays) * 100
  }, [todayYmd, range.from, range.to, totalDays])

  const ticks = useMemo(() => {
    const n = expanded ? 6 : 3
    const out: { label: string; pct: number }[] = []
    for (let i = 0; i <= n; i++) {
      const pct = (i / n) * 100
      const dayOffset = Math.round((totalDays * i) / n)
      const d = new Date(range.from + 'T12:00:00')
      d.setDate(d.getDate() + dayOffset)
      out.push({
        label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        pct,
      })
    }
    return out
  }, [expanded, range.from, totalDays])

  const rows = useMemo(() => {
    const inWindow = actions.filter((a) => a.endDate >= range.from && a.startDate <= range.to)
    return inWindow.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title))
  }, [actions, range.from, range.to])

  const visible = expanded ? rows : rows.slice(0, 3)
  const rowH = expanded ? 28 : 9

  if (rows.length === 0) {
    return (
      <p className="flex h-full items-center justify-center rounded border border-dashed border-border p-2 text-center text-[10px] text-muted">
        No e-Plan actions in the next 90 days
      </p>
    )
  }

  return (
    <div className={`flex h-full min-h-0 flex-col overflow-hidden ${expanded ? 'gap-1' : 'gap-0.5'}`}>
      <div className="relative shrink-0 border-b border-border/60 pb-0.5">
        {todayPct != null ? (
          <div
            className="pointer-events-none absolute inset-y-0 z-10 w-px border-l border-dashed border-sky-500"
            style={{ left: `${todayPct}%` }}
            aria-hidden
          />
        ) : null}
        <div className={`relative text-muted ${expanded ? 'h-5 text-[10px]' : 'h-3 text-[7px]'}`}>
          {ticks.map((t) => (
            <span
              key={t.pct}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${t.pct}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      <div className={`min-h-0 flex-1 ${expanded ? 'overflow-auto' : 'overflow-hidden'}`}>
        {visible.map((action) => {
          const bar = eplanBarLayout(action, range.from, range.to)
          return (
            <div
              key={action.id}
              className="flex w-full border-b border-border/40 last:border-b-0"
              style={{ height: rowH }}
            >
              {expanded ? (
                <div
                  className="shrink-0 truncate border-r border-border/50 bg-surface-raised/30 px-2 text-[11px] font-medium text-fg"
                  style={{ width: 140 }}
                  title={action.title}
                >
                  {action.title}
                </div>
              ) : null}
              <div className="relative min-w-0 flex-1 px-0.5">
                {todayPct != null ? (
                  <div
                    className="pointer-events-none absolute inset-y-0 z-10 w-px border-l border-dashed border-sky-500/80"
                    style={{ left: `${todayPct}%` }}
                    aria-hidden
                  />
                ) : null}
                {bar ? (
                  <div className="relative h-full w-full">
                    <div
                      className={`absolute top-1/2 max-w-full -translate-y-1/2 overflow-hidden rounded-sm ${EPLAN_STATUS_BAR_CLASS[action.status]}`}
                      style={{
                        left: `${bar.leftPct}%`,
                        width: `${bar.widthPct}%`,
                        height: expanded ? 14 : 6,
                      }}
                      title={`${action.title} (${action.startDate} → ${action.endDate})`}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {!expanded && rows.length > visible.length ? (
        <p className="pointer-events-none shrink-0 truncate text-right text-[7px] text-muted/80" title={`${rows.length - visible.length} more actions`}>
          +{rows.length - visible.length}
        </p>
      ) : null}

      {expanded ? (
        <div className="shrink-0 overflow-auto rounded border border-border/60">
          <table className="w-full border-collapse text-[10px]">
            <thead className="bg-surface-raised/70">
              <tr>
                <th className="border-b border-border px-2 py-1 text-left text-muted">Action</th>
                <th className="border-b border-border px-2 py-1 text-left text-muted">Start</th>
                <th className="border-b border-border px-2 py-1 text-left text-muted">End</th>
                <th className="border-b border-border px-2 py-1 text-left text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-border/50">
                  <td className="max-w-[16rem] truncate px-2 py-1 font-medium">{a.title}</td>
                  <td className="px-2 py-1 tabular-nums text-muted">{a.startDate}</td>
                  <td className="px-2 py-1 tabular-nums text-muted">{a.endDate}</td>
                  <td className="px-2 py-1 text-muted">{statusLabel(a.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
