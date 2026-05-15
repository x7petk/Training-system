/** Parse Postgres `time` / ISO time fragment to hours and minutes. */
export function parseLocalTimeParts(s: string): { h: number; m: number } {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?/.exec(s.trim())
  if (!m) return { h: 0, m: 0 }
  return { h: Number(m[1]), m: Number(m[2]) }
}

export type ShiftRow = { kind: string; start_local: string; end_local: string; display_name?: string | null }

/**
 * Shift window in browser-local time. Night (e.g. 17:00–05:00) spans to the next calendar day (D1, D14).
 */
export function shiftWindowBounds(planDateYmd: string, shiftKind: string, shifts: ShiftRow[]): { start: Date; end: Date } {
  const row = shifts.find((s) => s.kind === shiftKind)
  if (!row) {
    const d = parseYmdLocal(planDateYmd)
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 5, 0, 0, 0)
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 17, 0, 0, 0)
    return { start, end }
  }
  const d = parseYmdLocal(planDateYmd)
  const sh = parseLocalTimeParts(row.start_local)
  const eh = parseLocalTimeParts(row.end_local)
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh.h, sh.m, 0, 0)
  let end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh.h, eh.m, 0, 0)
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000)
  }
  return { start, end }
}

export function parseYmdLocal(ymd: string): Date {
  const [y, mo, da] = ymd.split('-').map(Number)
  return new Date(y, mo - 1, da, 0, 0, 0, 0)
}

export function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 60000
}

export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60000)
}

export function formatPlan24Clock(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/** 1-based pattern day index from roster anchor date (UTC date arithmetic). */
export function patternDayIndex(planDateYmd: string, startYmd: string | null, length: number): number {
  const L = Math.max(1, length)
  if (!startYmd) return 1
  const [y, mo, d] = planDateYmd.split('-').map(Number)
  const [y1, mo1, d1] = startYmd.split('-').map(Number)
  const t0 = Date.UTC(y, mo - 1, d)
  const t1 = Date.UTC(y1, mo1 - 1, d1)
  const diff = Math.floor((t0 - t1) / 86400000)
  const mod = ((diff % L) + L) % L
  return mod + 1
}
