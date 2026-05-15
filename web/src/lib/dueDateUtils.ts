/** Local calendar date as YYYY-MM-DD (no timezone shift). */
export function localYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Calendar yesterday in local time (YYYY-MM-DD). */
export function localYMDYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return localYMD(d)
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d)
  x.setMonth(x.getMonth() + n)
  return x
}

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function compareYMD(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
