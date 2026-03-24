import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { classifyCell, type SkillKind } from '../features/matrix/gapLogic'

type PsRow = {
  person_id: string
  skill_id: string
  actual_level: number | null
  is_extra: boolean
  due_date: string | null
  people:
    | { display_name: string; person_roles: { role_id: string }[] | null }
    | { display_name: string; person_roles: { role_id: string }[] | null }[]
    | null
  skills: { name: string; kind: SkillKind } | { name: string; kind: SkillKind }[] | null
}
type RsrRow = { role_id: string; skill_id: string; required_level: number }

function asSingle<T>(v: T | T[] | null): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function personName(r: PsRow): string {
  return asSingle(r.people)?.display_name ?? '—'
}

function skillName(r: PsRow): string {
  return asSingle(r.skills)?.name ?? '—'
}

function skillKind(r: PsRow): SkillKind {
  return asSingle(r.skills)?.kind ?? 'numeric'
}

function personRoleIds(r: PsRow): string[] {
  return (asSingle(r.people)?.person_roles ?? []).map((x) => x.role_id)
}

function localYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function compareYMD(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

type ChartMode = 'weeks' | 'months'

type Bucket = {
  key: string
  label: string
  start: string
  end: string
  count: number
}

const CHART_BAR_AREA_PX = 200

/** Descending tick values from max down to 0 for the chart Y-axis. */
function chartYTicks(maxValue: number): number[] {
  const max = Math.max(0, maxValue)
  if (max === 0) return [0]
  const segments = 4
  const set = new Set<number>()
  for (let i = 0; i <= segments; i++) {
    set.add(Math.round((max * (segments - i)) / segments))
  }
  return [...set].sort((a, b) => b - a)
}

export function DashboardPage() {
  const [rows, setRows] = useState<PsRow[]>([])
  const [rsrRows, setRsrRows] = useState<RsrRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartMode, setChartMode] = useState<ChartMode>('weeks')
  const [selectedBucketIndex, setSelectedBucketIndex] = useState<number | null>(null)

  const today = useMemo(() => startOfDay(new Date()), [])
  const todayStr = localYMD(today)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [psRes, rsrRes] = await Promise.all([
      supabase.from('person_skills').select(`
        person_id,
        skill_id,
        actual_level,
        is_extra,
        due_date,
        people ( display_name, person_roles ( role_id ) ),
        skills ( name, kind )
      `),
      supabase.from('role_skill_requirements').select('role_id, skill_id, required_level'),
    ])
    setLoading(false)
    if (psRes.error || rsrRes.error) {
      setError(psRes.error?.message ?? rsrRes.error?.message ?? 'Load failed')
      setRows([])
      setRsrRows([])
      return
    }
    setRows((psRes.data ?? []) as unknown as PsRow[])
    setRsrRows((rsrRes.data ?? []) as RsrRow[])
  }, [])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void load()
    })
    return () => cancelAnimationFrame(id)
  }, [load])

  const withDue = useMemo(() => rows.filter((r) => r.due_date != null && r.due_date !== ''), [rows])
  const noDue = useMemo(() => rows.filter((r) => r.due_date == null || r.due_date === ''), [rows])
  const rsrMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const row of rsrRows) m.set(`${row.role_id}\0${row.skill_id}`, row.required_level)
    return m
  }, [rsrRows])

  const noTargetGapRows = useMemo(() => {
    function maxRequired(roleIds: string[], skillId: string): number | null {
      let max: number | null = null
      for (const rid of roleIds) {
        const req = rsrMap.get(`${rid}\0${skillId}`)
        if (req != null) max = max == null ? req : Math.max(max, req)
      }
      return max
    }
    return noDue.filter((r) => {
      const gap = classifyCell({
        kind: skillKind(r),
        required: maxRequired(personRoleIds(r), r.skill_id),
        actual: r.actual_level,
        isExtra: r.is_extra,
      })
      return gap === 'critical' || gap === 'minor'
    })
  }, [noDue, rsrMap])

  const overdueRows = useMemo(
    () => withDue.filter((r) => r.due_date && compareYMD(r.due_date, todayStr) < 0),
    [withDue, todayStr],
  )

  const next7Rows = useMemo(() => {
    const end = localYMD(addDays(today, 6))
    return withDue.filter((r) => {
      if (!r.due_date) return false
      return compareYMD(r.due_date, todayStr) >= 0 && compareYMD(r.due_date, end) <= 0
    })
  }, [withDue, today, todayStr])

  const next30Rows = useMemo(() => {
    const end = localYMD(addDays(today, 29))
    return withDue.filter((r) => {
      if (!r.due_date) return false
      return compareYMD(r.due_date, todayStr) >= 0 && compareYMD(r.due_date, end) <= 0
    })
  }, [withDue, today, todayStr])

  const counts = useMemo(
    () => ({
      overdue: overdueRows.length,
      next7: next7Rows.length,
      next30: next30Rows.length,
      noTarget: noTargetGapRows.length,
    }),
    [overdueRows.length, next7Rows.length, next30Rows.length, noTargetGapRows.length],
  )

  const weekBuckets = useMemo((): Bucket[] => {
    const buckets: Bucket[] = []
    for (let w = 0; w < 12; w++) {
      const startD = addDays(today, w * 7)
      const endD = addDays(today, w * 7 + 6)
      const start = localYMD(startD)
      const end = localYMD(endD)
      const count = withDue.filter((r) => {
        if (!r.due_date) return false
        return compareYMD(r.due_date, start) >= 0 && compareYMD(r.due_date, end) <= 0
      }).length
      buckets.push({
        key: `w${w}`,
        label: `W${w + 1}`,
        start,
        end,
        count,
      })
    }
    return buckets
  }, [withDue, today])

  const monthBuckets = useMemo((): Bucket[] => {
    const buckets: Bucket[] = []
    let periodStart = startOfDay(new Date(today))
    for (let i = 0; i < 12; i++) {
      const y = periodStart.getFullYear()
      const m = periodStart.getMonth()
      const lastCalDay = new Date(y, m + 1, 0)
      const startStr = localYMD(periodStart)
      const endStr = localYMD(startOfDay(lastCalDay))
      const count = withDue.filter((r) => {
        if (!r.due_date) return false
        return compareYMD(r.due_date, startStr) >= 0 && compareYMD(r.due_date, endStr) <= 0
      }).length
      const label = periodStart.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
      buckets.push({ key: `m${i}`, label, start: startStr, end: endStr, count })
      periodStart = startOfDay(new Date(y, m + 1, 1))
    }
    return buckets
  }, [withDue, today])

  const activeBuckets = chartMode === 'weeks' ? weekBuckets : monthBuckets
  const maxChart = useMemo(() => Math.max(1, ...activeBuckets.map((b) => b.count)), [activeBuckets])
  const chartYAxisTicks = useMemo(() => chartYTicks(maxChart), [maxChart])

  const defaultComingHorizonEnd = useMemo(() => {
    if (chartMode === 'months' && monthBuckets.length > 0) {
      return monthBuckets[monthBuckets.length - 1].end
    }
    return localYMD(addDays(today, 83))
  }, [chartMode, monthBuckets, today])

  const filteredComingRows = useMemo(() => {
    if (selectedBucketIndex == null || !activeBuckets[selectedBucketIndex]) {
      return withDue.filter((r) => {
        if (!r.due_date) return false
        if (compareYMD(r.due_date, todayStr) < 0) return false
        return compareYMD(r.due_date, defaultComingHorizonEnd) <= 0
      })
    }
    const b = activeBuckets[selectedBucketIndex]
    return withDue.filter((r) => {
      if (!r.due_date) return false
      return compareYMD(r.due_date, b.start) >= 0 && compareYMD(r.due_date, b.end) <= 0
    })
  }, [selectedBucketIndex, activeBuckets, withDue, todayStr, defaultComingHorizonEnd])

  function toggleBucket(i: number) {
    setSelectedBucketIndex((prev) => (prev === i ? null : i))
  }

  function tileClass(n: number) {
    return n > 0
      ? 'border-rose-200 bg-rose-50 text-rose-950 ring-1 ring-rose-200/80'
      : 'border-emerald-200 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200/80'
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
            <BarChart3 className="size-5" aria-hidden />
          </span>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="self-start rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-muted hover:bg-surface-raised sm:self-auto"
        >
          Refresh
        </button>
      </header>

      {error ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          <section aria-label="Summary tiles" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className={`rounded-xl border px-3 py-3 ${tileClass(counts.overdue)}`}>
              <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">Overdue</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums sm:text-3xl">{counts.overdue}</p>
            </div>
            <div className={`rounded-xl border px-3 py-3 ${tileClass(counts.next7)}`}>
              <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">Next 7 days</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums sm:text-3xl">{counts.next7}</p>
            </div>
            <div className={`rounded-xl border px-3 py-3 ${tileClass(counts.next30)}`}>
              <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">Next 30 days</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums sm:text-3xl">{counts.next30}</p>
            </div>
            <div className={`rounded-xl border px-3 py-3 ${tileClass(counts.noTarget)}`}>
              <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">No target date</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums sm:text-3xl">{counts.noTarget}</p>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface-raised/40 backdrop-blur-sm">
            <div className="border-b border-border px-3 py-2.5">
              <h2 className="font-display text-base font-semibold">Overdue</h2>
            </div>
            <DueTable rows={overdueRows} empty="No overdue target dates." />
          </section>

          <section className="rounded-xl border border-border bg-surface-raised/40 p-3 backdrop-blur-sm sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-base font-semibold">Skills due by period</h2>
              <div className="flex rounded-lg border border-border bg-surface p-0.5 text-xs sm:text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setChartMode('weeks')
                    setSelectedBucketIndex(null)
                  }}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors sm:px-3 sm:py-1.5 ${
                    chartMode === 'weeks' ? 'bg-sky-600 text-white shadow-sm' : 'text-muted hover:text-fg'
                  }`}
                >
                  12 weeks
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChartMode('months')
                    setSelectedBucketIndex(null)
                  }}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors sm:px-3 sm:py-1.5 ${
                    chartMode === 'months' ? 'bg-sky-600 text-white shadow-sm' : 'text-muted hover:text-fg'
                  }`}
                >
                  12 months
                </button>
              </div>
            </div>
            <div className="mt-4 flex gap-2 sm:gap-3">
              <div className="flex shrink-0 flex-col justify-end" aria-hidden>
                <div className="h-5 shrink-0 sm:h-6" />
                <div
                  className="flex w-7 flex-col justify-between text-right text-[9px] tabular-nums text-muted sm:w-8 sm:text-[10px]"
                  style={{ height: CHART_BAR_AREA_PX }}
                >
                  {chartYAxisTicks.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              </div>
              <div className="min-w-0 flex-1 overflow-x-auto pb-1">
                <div
                  className="flex items-end gap-1 md:gap-2"
                  role="group"
                  aria-label="Due counts by period"
                >
                  {activeBuckets.map((b, i) => {
                    const barPx = Math.max(4, Math.round((b.count / maxChart) * CHART_BAR_AREA_PX))
                    const selected = selectedBucketIndex === i
                    return (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => toggleBucket(i)}
                        aria-pressed={selected}
                        aria-label={`${b.label}, ${b.count} due, ${b.start} to ${b.end}`}
                        title={`${b.label}: ${b.count} (${b.start} → ${b.end})`}
                        className={`flex min-w-[2.25rem] flex-1 flex-col items-stretch gap-1 rounded-t-lg outline-none focus-visible:ring-2 focus-visible:ring-sky-500 md:min-w-11 ${
                          selected ? 'ring-2 ring-sky-600 ring-offset-2 ring-offset-canvas' : ''
                        }`}
                      >
                        <span className="text-center text-[10px] font-semibold tabular-nums text-fg">{b.count}</span>
                        <div
                          className="flex flex-col justify-end"
                          style={{ height: CHART_BAR_AREA_PX }}
                        >
                          <span
                            className="w-full rounded-t-md bg-sky-500 transition-[filter] hover:brightness-110"
                            style={{ height: `${barPx}px` }}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="mt-1 flex gap-2 border-t border-border/60 pt-1.5 sm:gap-3">
              <div className="w-7 shrink-0 sm:w-8" aria-hidden />
              <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto md:gap-2">
                {activeBuckets.map((b) => (
                  <div
                    key={`lbl-${b.key}`}
                    className="min-w-[2.25rem] flex-1 text-center text-[9px] leading-tight text-muted md:min-w-12 md:text-[10px]"
                  >
                    {b.label}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface-raised/40 backdrop-blur-sm">
            <div className="border-b border-border px-3 py-2.5">
              <h2 className="font-display text-base font-semibold">Coming due</h2>
            </div>
            <DueTable rows={filteredComingRows} empty="No rows in this view." />
          </section>
        </>
      )}
    </div>
  )
}

function DueTable({ rows, empty }: { rows: PsRow[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="px-3 py-8 text-center text-sm text-muted">{empty}</p>
  }
  const sorted = [...rows].sort((a, b) => {
    const da = a.due_date ?? ''
    const db = b.due_date ?? ''
    if (da !== db) return da < db ? -1 : 1
    const pa = personName(a)
    const pb = personName(b)
    return pa.localeCompare(pb)
  })
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="border-b border-border text-[11px] font-medium uppercase tracking-wider text-muted">
          <tr>
            <th className="px-3 py-2">Person</th>
            <th className="px-3 py-2">Skill</th>
            <th className="px-3 py-2">Target date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((r) => (
            <tr key={`${r.person_id}-${r.skill_id}`} className="hover:bg-black/[0.03]">
              <td className="px-3 py-2 font-medium text-fg">{personName(r)}</td>
              <td className="px-3 py-2 text-muted">{skillName(r)}</td>
              <td className="px-3 py-2 font-mono text-xs tabular-nums text-fg">{r.due_date ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
