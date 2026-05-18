import { useMemo, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { compareYMD, localYMD } from '../../lib/dueDateUtils'
import { EPLAN_ROW_H } from './eplanConstants'
import { EPlanGanttBar } from './EPlanGanttBar'
import type { EPlanAction, EPlanAdminStore, EPlanDisplayRow, EPlanTimelineMode } from './eplanTypes'
import {
  eplanActionProgress,
  eplanDaysBetween,
  eplanIsOverdue,
  eplanLookupName,
  eplanOwnerName,
  eplanTimelineRange,
} from './eplanUtils'

/** Fixed width for the action table (Gantt takes the rest). Action title column uses remaining space. */
const TABLE_W = 480
const TABLE_GRID = 'grid-cols-[1.75rem_minmax(12rem,1fr)_4.25rem_4.25rem]'

type Props = {
  rows: EPlanDisplayRow[]
  allCellActions: EPlanAction[]
  admin: EPlanAdminStore
  timelineMode: EPlanTimelineMode
  onToggleExpand: (id: string) => void
  onOpen: (action: EPlanAction) => void
  onDatesChange: (actionId: string, startDate: string, endDate: string) => void
}

function GanttArea({
  children,
  todayPct,
}: {
  children: ReactNode
  todayPct: number | null
}) {
  return (
    <div className="relative min-w-0 flex-1 basis-0 px-2 sm:min-w-[24rem]">
      {todayPct != null ? (
        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-px border-l border-dashed border-sky-500"
          style={{ left: `${todayPct}%` }}
          aria-hidden
        />
      ) : null}
      {children}
    </div>
  )
}

export function EPlanBoard({ rows, allCellActions, admin, timelineMode, onToggleExpand, onOpen, onDatesChange }: Props) {
  const todayYmd = localYMD(new Date())
  const range = useMemo(() => eplanTimelineRange(timelineMode), [timelineMode])
  const totalDays = eplanDaysBetween(range.from, range.to)
  const todayPct = useMemo(() => {
    if (compareYMD(todayYmd, range.from) < 0 || compareYMD(todayYmd, range.to) > 0) return null
    const offset = eplanDaysBetween(range.from, todayYmd) - 1
    return (offset / totalDays) * 100
  }, [todayYmd, range.from, range.to, totalDays])

  const ticks = useMemo(() => {
    const n = timelineMode === 'weeks' ? 14 : timelineMode === 'months' ? 6 : 12
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
  }, [range.from, totalDays, timelineMode])

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
        No e-Plan actions match the current filters. Create one or adjust filters.
      </div>
    )
  }

  return (
    <div className="flex min-h-[20rem] min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="sticky top-0 z-20 flex w-full border-b border-border bg-surface-raised/95 backdrop-blur-sm">
          <div className="sticky left-0 z-30 shrink-0 border-r border-border bg-surface-raised/95" style={{ width: TABLE_W }}>
            <div className={`grid ${TABLE_GRID} gap-1 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted`}>
              <span />
              <span>Action</span>
              <span>Owner</span>
              <span>Category</span>
            </div>
          </div>
          <GanttArea todayPct={todayPct}>
            <div className="relative h-5 py-1.5 text-[10px] text-muted">
              {ticks.map((t) => (
                <span key={t.pct} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${t.pct}%` }}>
                  {t.label}
                </span>
              ))}
            </div>
          </GanttArea>
        </div>

        {rows.map(({ action, depth, hasChildren, expanded }) => {
          const overdue = eplanIsOverdue(action, todayYmd)
          const archived = action.status === 'NOT_REQUIRED'
          const progress = eplanActionProgress(action, allCellActions)
          const owner = eplanOwnerName(action.actionOwnerId, admin)
          const category = eplanLookupName(action.ogsmPillarId, admin.ogsmPillars)

          return (
            <div
              key={action.id}
              className={[
                'flex w-full border-b border-border/60 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]',
                overdue ? 'border-l-2 border-l-red-500' : '',
                archived ? 'opacity-60' : '',
              ].join(' ')}
              style={{ height: EPLAN_ROW_H }}
            >
              <div className="sticky left-0 z-10 shrink-0 border-r border-border bg-surface" style={{ width: TABLE_W }}>
                <button
                  type="button"
                  className={`grid h-full w-full ${TABLE_GRID} items-center gap-1 px-2 text-left text-xs`}
                  onClick={() => onOpen(action)}
                >
                  <span className="flex justify-center">
                    {hasChildren ? (
                      <span
                        role="button"
                        tabIndex={0}
                        className="rounded p-0.5 text-muted hover:bg-black/[0.06]"
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleExpand(action.id)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.stopPropagation()
                            onToggleExpand(action.id)
                          }
                        }}
                        aria-label={expanded ? 'Collapse' : 'Expand'}
                      >
                        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      </span>
                    ) : depth > 0 ? (
                      <span className="inline-block w-3 border-l border-border" />
                    ) : null}
                  </span>
                  <span className="truncate font-medium text-fg" style={{ paddingLeft: depth * 12 }} title={action.title}>
                    {action.title}
                  </span>
                  <span className="truncate text-muted" title={owner}>
                    {owner}
                  </span>
                  <span className="truncate text-muted" title={category}>
                    {category}
                  </span>
                </button>
              </div>
              <GanttArea todayPct={todayPct}>
                <EPlanGanttBar
                  action={action}
                  rangeFrom={range.from}
                  rangeTo={range.to}
                  progressLabel={progress != null && progress > 0 ? `${progress}%` : null}
                  onDatesChange={onDatesChange}
                  onOpen={onOpen}
                />
              </GanttArea>
            </div>
          )
        })}
      </div>
    </div>
  )
}
