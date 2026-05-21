import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { WDS_HC_GLIDE_TARGET, type WdsHcRecordLite } from './wdsHcTrend'
import { WdsTrendChart, wdsToneTextClass, type WdsTrendSeries } from './WdsTrendChart'
import type { WdsWeekSlot } from './ddsWds'
import { hcRagBadgeClass, hcRagLabel } from '../health-checks/hcScore'
import { eventLocalDate } from '../report/reportBucketUtils'

const compactFmt = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

type Props = {
  series: WdsTrendSeries
  weeks: WdsWeekSlot[]
  records: WdsHcRecordLite[]
  columnHeader: string
}

export function WdsHcTrendCell({ series, weeks, records, columnHeader }: Props) {
  const [zoomOpen, setZoomOpen] = useState(false)
  const [weekDetail, setWeekDetail] = useState<number | null>(null)

  const latestIx = series.valueByWeek.map((v, i) => ({ v, i })).filter((x) => x.v != null).at(-1)?.i ?? -1
  const latestValue = latestIx >= 0 ? series.valueByWeek[latestIx] : null
  const latestTarget = latestIx >= 0 ? series.targetByWeek[latestIx] : null
  const latestTone = latestIx >= 0 ? series.toneByWeek[latestIx] : 'neutral'
  const totalChecks = series.commentCountByWeek.reduce((a, b) => a + b, 0)

  const recordsForWeek = useMemo(() => {
    if (weekDetail == null) return []
    const w = weeks[weekDetail]
    if (!w) return []
    return records.filter((r) => {
      const d = eventLocalDate(r.completed_at)
      return d >= w.startYmd && d <= w.endYmd
    })
  }, [weekDetail, weeks, records])

  const hasData = totalChecks > 0

  if (!hasData) {
    return (
      <div className="flex min-h-[6.5rem] flex-col items-center justify-center gap-1 rounded border border-dashed border-border/70 bg-surface-raised/10 px-2 text-center">
        <p className="text-[9px] text-muted">No submitted health checks in this window.</p>
        <Link to="/ldr-tools/health-checks" className="text-[9px] font-semibold text-accent hover:underline">
          LDR Health checks
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="mt-0.5 space-y-0.5">
        <div className="flex items-start justify-between gap-1 rounded border border-border/70 bg-surface-raised/20 px-1.5 py-0.5">
          <div className="min-w-0">
            <p className="truncate text-[9px] font-semibold text-fg">Health check %</p>
            <p className="text-[8px] text-muted">LDR · cell avg / week</p>
          </div>
          <div className="text-right">
            <p className={`text-[9px] font-semibold tabular-nums ${wdsToneTextClass(latestTone)}`}>
              {latestValue == null ? '—' : `${compactFmt.format(latestValue)}%`}
            </p>
            <p className="text-[8px] tabular-nums text-blue-700 dark:text-blue-300">
              T {latestTarget == null ? '—' : `${compactFmt.format(latestTarget)}%`}
            </p>
          </div>
        </div>
        {totalChecks > 0 ? (
          <button
            type="button"
            className="absolute right-8 top-2 inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded border border-amber-500/50 bg-amber-500/15 px-1 text-amber-900 hover:bg-amber-500/25 dark:text-amber-200"
            aria-label="Open week detail"
            title={`${totalChecks} check${totalChecks === 1 ? '' : 's'} in window`}
            onClick={(e) => {
              e.stopPropagation()
              const wi = [...series.commentCountByWeek].map((c, i) => ({ c, i })).filter((x) => x.c > 0).at(-1)?.i
              if (wi != null) {
                setWeekDetail(wi)
                setZoomOpen(true)
              }
            }}
          >
            <MessageSquare className="size-2.5" aria-hidden />
            <span className="text-[8px] leading-none">{totalChecks}</span>
          </button>
        ) : null}
        <button
          type="button"
          className="block w-full text-left"
          onClick={() => setZoomOpen(true)}
          aria-label="Zoom health check trend"
        >
          <WdsTrendChart series={series} weeks={weeks} />
        </button>
      </div>

      {zoomOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setZoomOpen(false)
            setWeekDetail(null)
          }}
        >
          <div
            className="flex h-[60dvh] w-[60vw] min-w-[48rem] flex-col rounded-lg border border-border bg-surface p-2 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex shrink-0 items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-fg">
                  {columnHeader} · Health check
                </p>
                <p className="text-[10px] text-muted">
                  Weekly average score (%) · dashed target {WDS_HC_GLIDE_TARGET}% (green band) · orange dots = weeks with checks
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  to="/ldr-tools/health-checks/report"
                  className="h-7 rounded-md border border-border px-2 text-[10px] font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                >
                  HC Report
                </Link>
                <button
                  type="button"
                  className="h-7 rounded-md border border-border px-2 text-[10px] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  onClick={() => {
                    setZoomOpen(false)
                    setWeekDetail(null)
                  }}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[1fr_minmax(12rem,16rem)]">
              <div className="min-h-0">
                <WdsTrendChart
                  compact={false}
                  series={series}
                  weeks={weeks}
                  onBarClick={(wi) => setWeekDetail(wi)}
                />
              </div>
              <aside className="min-h-0 overflow-y-auto rounded border border-border/60 bg-canvas/20 p-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {weekDetail != null ? weeks[weekDetail]?.shortLabel ?? 'Week' : 'Select a week'}
                </p>
                {weekDetail == null ? (
                  <p className="text-[10px] text-muted">Click a week on the chart.</p>
                ) : recordsForWeek.length === 0 ? (
                  <p className="text-[10px] text-muted">No checks this week.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {recordsForWeek.map((r) => (
                      <li key={r.id} className="rounded border border-border/50 px-2 py-1">
                        <Link
                          to={`/ldr-tools/health-checks/${r.id}`}
                          className="text-[10px] font-semibold text-accent hover:underline"
                        >
                          {r.type_name}
                        </Link>
                        <div className="mt-0.5 flex items-center justify-between gap-1">
                          <span className="text-[9px] tabular-nums text-fg">{r.score}%</span>
                          <span
                            className={`inline-flex rounded-full px-1.5 py-px text-[8px] font-semibold ring-1 ${hcRagBadgeClass(r.status)}`}
                          >
                            {hcRagLabel(r.status)}
                          </span>
                        </div>
                        <p className="text-[8px] text-muted">{eventLocalDate(r.completed_at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
