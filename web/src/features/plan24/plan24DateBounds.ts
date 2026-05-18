import { localYMD } from '../../lib/dueDateUtils'

/** Earliest selectable plan date across Plan 24 and DDS actions. */
export const MIN_PLAN_YMD = '2000-01-01'

export const PLAN24_VISIBLE_DAYS_AHEAD = 90

export function plan24MaxVisibleYmd(fromYmd: string = localYMD(new Date())): string {
  const d = new Date(fromYmd + 'T12:00:00')
  d.setDate(d.getDate() + (PLAN24_VISIBLE_DAYS_AHEAD - 1))
  return localYMD(d)
}

export function clampPlanDateYmd(raw: string, maxYmd: string, fallback: string = localYMD(new Date())): string {
  if (!raw) return fallback
  if (raw < MIN_PLAN_YMD) return MIN_PLAN_YMD
  if (raw > maxYmd) return maxYmd
  return raw
}
