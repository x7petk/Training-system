import { describe, expect, it } from 'vitest'
import {
  addDays,
  dateInRange,
  formatWeekTitle,
  isoWeekInfo,
  parseYMD,
  startOfWeekMonday,
  toYMD,
  weekDaysMondayFirst,
} from './ldrWeekUtils'

describe('toYMD / parseYMD', () => {
  it('round-trips local calendar dates', () => {
    const d = new Date(2026, 3, 10) // Apr 10 2026
    expect(toYMD(d)).toBe('2026-04-10')
    const back = parseYMD('2026-04-10')
    expect(back.getFullYear()).toBe(2026)
    expect(back.getMonth()).toBe(3)
    expect(back.getDate()).toBe(10)
  })
})

describe('startOfWeekMonday', () => {
  it('returns Monday for a Wednesday', () => {
    // Wed Apr 8 2026
    const wed = new Date(2026, 3, 8)
    const mon = startOfWeekMonday(wed)
    expect(mon.getDay()).toBe(1)
    expect(toYMD(mon)).toBe('2026-04-06')
  })

  it('returns previous Monday when given Sunday', () => {
    // Sun Apr 12 2026 → week starting Mon Apr 6
    const sun = new Date(2026, 3, 12)
    const mon = startOfWeekMonday(sun)
    expect(mon.getDay()).toBe(1)
    expect(toYMD(mon)).toBe('2026-04-06')
  })
})

describe('addDays', () => {
  it('shifts across month boundary', () => {
    const d = new Date(2026, 3, 30)
    expect(toYMD(addDays(d, 5))).toBe('2026-05-05')
  })
})

describe('weekDaysMondayFirst', () => {
  it('returns seven consecutive days from week start', () => {
    const start = parseYMD('2026-04-06')
    const days = weekDaysMondayFirst(start)
    expect(days).toHaveLength(7)
    expect(toYMD(days[0])).toBe('2026-04-06')
    expect(toYMD(days[6])).toBe('2026-04-12')
  })
})

describe('isoWeekInfo', () => {
  it('matches ISO week for early January (week 1)', () => {
    const mon = parseYMD('2026-01-05')
    const { weekYear, week } = isoWeekInfo(mon)
    expect(weekYear).toBe(2026)
    expect(week).toBe(2)
  })
})

describe('formatWeekTitle', () => {
  it('includes week number and a date range', () => {
    const mon = parseYMD('2026-04-06')
    const title = formatWeekTitle(mon)
    expect(title).toMatch(/^Week \d+ ·/)
    expect(title).toMatch(/–/)
  })
})

describe('dateInRange', () => {
  it('is inclusive on both ends', () => {
    expect(dateInRange('2026-04-10', '2026-04-01', '2026-04-30')).toBe(true)
    expect(dateInRange('2026-04-01', '2026-04-01', '2026-04-30')).toBe(true)
    expect(dateInRange('2026-04-30', '2026-04-01', '2026-04-30')).toBe(true)
    expect(dateInRange('2026-03-31', '2026-04-01', '2026-04-30')).toBe(false)
    expect(dateInRange('2026-05-01', '2026-04-01', '2026-04-30')).toBe(false)
  })
})
