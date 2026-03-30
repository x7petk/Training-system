/** Local calendar helpers for report period buckets (aligned with Dashboard due-date logic). */

export type ReportBucket = {
  key: string
  label: string
  start: string
  end: string
}

export function localYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function compareYMD(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

/** Inclusive YYYY-MM-DD range from filter; swaps if reversed. */
export function normalizeRange(start: string, end: string): { start: string; end: string } {
  let a = start
  let b = end
  if (compareYMD(a, b) > 0) [a, b] = [b, a]
  return { start: a, end: b }
}

export function eventLocalDate(iso: string): string {
  return localYMD(new Date(iso))
}

/** Contiguous 7-day buckets from range start through range end (inclusive). */
export function buildWeekBuckets(rangeStart: string, rangeEnd: string): ReportBucket[] {
  const { start, end } = normalizeRange(rangeStart, rangeEnd)
  const buckets: ReportBucket[] = []
  let cur = startOfDay(parseYMD(start))
  const endD = endOfDay(parseYMD(end))
  let i = 0
  while (cur.getTime() <= endD.getTime()) {
    const weekEnd = new Date(cur)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)
    const cap = weekEnd.getTime() > endD.getTime() ? endD : weekEnd
    const s = localYMD(cur)
    const e = localYMD(startOfDay(cap))
    buckets.push({
      key: `w${i}`,
      label: `W${i + 1}`,
      start: s,
      end: e,
    })
    cur = startOfDay(cap)
    cur.setDate(cur.getDate() + 1)
    i += 1
    if (i > 104) break
  }
  return buckets
}

/** Calendar-month buckets overlapping [rangeStart, rangeEnd] (inclusive). */
export function buildMonthBuckets(rangeStart: string, rangeEnd: string): ReportBucket[] {
  const { start, end } = normalizeRange(rangeStart, rangeEnd)
  const rangeA = startOfDay(parseYMD(start))
  const rangeB = startOfDay(parseYMD(end))
  const buckets: ReportBucket[] = []
  let cur = new Date(rangeA.getFullYear(), rangeA.getMonth(), 1)
  let i = 0
  while (cur.getTime() <= rangeB.getTime()) {
    const y = cur.getFullYear()
    const m = cur.getMonth()
    const monthFirst = startOfDay(new Date(y, m, 1))
    const monthLast = startOfDay(new Date(y, m + 1, 0))
    const overlapStart = monthFirst.getTime() < rangeA.getTime() ? rangeA : monthFirst
    const overlapEnd = monthLast.getTime() > rangeB.getTime() ? rangeB : monthLast
    if (compareYMD(localYMD(overlapStart), localYMD(overlapEnd)) <= 0) {
      const label = cur.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
      buckets.push({
        key: `m${i}`,
        label,
        start: localYMD(overlapStart),
        end: localYMD(overlapEnd),
      })
      i += 1
    }
    cur = new Date(y, m + 1, 1)
    if (i > 36) break
  }
  return buckets
}

export function countInBucket(isoDates: string[], bucket: ReportBucket): number {
  return isoDates.filter((iso) => {
    const d = eventLocalDate(iso)
    return compareYMD(d, bucket.start) >= 0 && compareYMD(d, bucket.end) <= 0
  }).length
}
