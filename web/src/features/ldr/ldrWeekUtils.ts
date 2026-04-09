/** Monday-based week helpers (local timezone). */

export function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay() // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function weekDaysMondayFirst(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

/** ISO week number and ISO week-year for a Monday week start. */
export function isoWeekInfo(weekStartMonday: Date): { weekYear: number; week: number } {
  const thursday = addDays(weekStartMonday, 3)
  const y = thursday.getFullYear()
  const firstThursday = new Date(y, 0, 4)
  const ftMon = startOfWeekMonday(firstThursday)
  const diffMs = thursday.getTime() - ftMon.getTime()
  const week = 1 + Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
  return { weekYear: y, week }
}

export function formatWeekTitle(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  const { week } = isoWeekInfo(weekStart)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const a = weekStart.toLocaleDateString(undefined, opts)
  const b = end.toLocaleDateString(undefined, opts)
  return `Week ${week} · ${a} – ${b}`
}

export function dateInRange(day: string, start: string, end: string): boolean {
  return day >= start && day <= end
}
