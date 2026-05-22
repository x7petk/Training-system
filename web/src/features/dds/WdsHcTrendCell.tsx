import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListFilter } from 'lucide-react'
import { buildWdsHcTopFails, type WdsHcFailAnswerLite } from './wdsHcFails'
import { WDS_HC_GLIDE_TARGET, type WdsHcRecordLite } from './wdsHcTrend'
import { WdsTrendChart, type WdsTrendSeries } from './WdsTrendChart'
import type { WdsWeekSlot } from './ddsWds'
import { hcRagBadgeClass, hcRagLabel } from '../health-checks/hcScore'
import { eventLocalDate } from '../report/reportBucketUtils'

type Props = {
  series: WdsTrendSeries | null
  typeName: string | null
  weeks: WdsWeekSlot[]
  records: WdsHcRecordLite[]
  failAnswers: WdsHcFailAnswerLite[]
  columnHeader: string
  onOpenPicker: () => void
}

export function WdsHcTrendCell({
  series,
  typeName,
  weeks,
  records,
  failAnswers,
  columnHeader,
  onOpenPicker,
}: Props) {
  const [zoomOpen, setZoomOpen] = useState(false)
  const [weekDetail, setWeekDetail] = useState<number | null>(null)

  const totalChecks = series ? series.commentCountByWeek.reduce((a, b) => a + b, 0) : 0
  const hcChartLabelProps = { showBarLabels: false, showYAxisLabels: false } as const

  const recordsForWeek = useMemo(() => {
    if (weekDetail == null) return []
    const w = weeks[weekDetail]
    if (!w) return []
    return records.filter((r) => {
      const d = eventLocalDate(r.completed_at)
      return d >= w.startYmd && d <= w.endYmd
    })
  }, [weekDetail, weeks, records])

  const topFails = useMemo(() => {
    if (weekDetail == null) return []
    const w = weeks[weekDetail]
    if (!w) return []
    return buildWdsHcTopFails(failAnswers, w)
  }, [weekDetail, weeks, failAnswers])

  function openZoomWithLatestWeek() {
    const wi = series
      ? [...series.commentCountByWeek].map((c, i) => ({ c, i })).filter((x) => x.c > 0).at(-1)?.i
      : undefined
    setWeekDetail(wi ?? null)
    setZoomOpen(true)
  }

  if (!series) {
    return (
      <div className="relative flex min-h-[6.5rem] items-center justify-center rounded border border-dashed border-border/70 bg-surface-raised/10">
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center rounded border border-border/80 bg-surface text-muted hover:text-fg"
          aria-label="Select health check type"
          onClick={onOpenPicker}
        >
          <ListFilter className="size-3.5" aria-hidden />
        </button>
      </div>
    )
  }

  const hasData = totalChecks > 0

  if (!hasData) {
    return (
      <div className="relative flex min-h-[6.5rem] flex-col items-center justify-center gap-1 rounded border border-dashed border-border/70 bg-surface-raised/10 px-2 text-center">
        <p className="text-[9px] text-muted">
          No submitted checks for {typeName ?? 'this type'} in this window.
        </p>
        <Link to="/ldr-tools/health-checks" className="text-[9px] font-semibold text-accent hover:underline">
          LDR Health checks
        </Link>
        <button
          type="button"
          className="absolute right-2 top-2 inline-flex size-5 items-center justify-center rounded border border-border/80 bg-surface/90 text-muted hover:text-fg"
          aria-label="Select health check type"
          onClick={onOpenPicker}
        >
          <ListFilter className="size-3" aria-hidden />
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="mt-0.5 space-y-0.5">
        <div className="rounded border border-border/70 bg-surface-raised/20 px-1.5 py-0.5 pr-7">
          <p className="truncate text-[9px] font-semibold text-fg">{typeName ?? 'Health check'}</p>
        </div>
        <button
          type="button"
          className="absolute right-2 top-2 inline-flex size-5 items-center justify-center rounded border border-border/80 bg-surface/90 text-muted hover:text-fg"
          aria-label="Select health check type"
          onClick={(e) => {
            e.stopPropagation()
            onOpenPicker()
          }}
        >
          <ListFilter className="size-3" aria-hidden />
        </button>
        <button
          type="button"
          className="block w-full text-left"
          onClick={openZoomWithLatestWeek}
          aria-label="Zoom health check trend"
        >
          <WdsTrendChart series={series} weeks={weeks} {...hcChartLabelProps} />
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
                  {typeName ?? 'Health check'} — weekly average score (%) · target {WDS_HC_GLIDE_TARGET}% · orange dots = weeks with checks
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
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[1fr_minmax(14rem,18rem)]">
              <div className="min-h-0">
                <WdsTrendChart
                  compact={false}
                  series={series}
                  weeks={weeks}
                  showBarLabels={false}
                  onBarClick={(wi) => setWeekDetail(wi)}
                />
              </div>
              <aside className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded border border-border/60 bg-canvas/20 p-2">
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    {weekDetail != null ? weeks[weekDetail]?.shortLabel ?? 'Week' : 'Select a week'}
                  </p>
                  {weekDetail == null ? (
                    <p className="text-[10px] text-muted">Click a week on the chart.</p>
                  ) : (
                    <>
                      <p className="mb-1 text-[10px] font-semibold text-fg">Top 5 fails</p>
                      {topFails.length === 0 ? (
                        <p className="text-[10px] text-muted">No fails this week.</p>
                      ) : (
                        <ol className="space-y-2">
                          {topFails.map((f, i) => (
                            <li key={`${f.questionText}-${i}`} className="rounded border border-border/50 px-2 py-1">
                              <div className="flex items-start justify-between gap-1">
                                <span className="text-[10px] font-semibold text-fg">
                                  {i + 1}. {f.questionText}
                                </span>
                                <span className="shrink-0 rounded bg-danger/10 px-1 py-px text-[8px] font-semibold tabular-nums text-danger">
                                  ×{f.count}
                                </span>
                              </div>
                              {f.comments.length > 0 ? (
                                <ul className="mt-1 space-y-0.5 border-t border-border/40 pt-1">
                                  {f.comments.map((c, ci) => (
                                    <li key={ci} className="text-[9px] leading-snug text-muted">
                                      <span className="text-danger/80">— </span>
                                      <span className="whitespace-pre-wrap break-words">{c}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-0.5 text-[9px] italic text-muted">No comments recorded.</p>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                    </>
                  )}
                </div>
                {weekDetail != null && recordsForWeek.length > 0 ? (
                  <div className="border-t border-border/50 pt-2">
                    <p className="mb-1 text-[10px] font-semibold text-fg">Checks this week</p>
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
                  </div>
                ) : null}
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
