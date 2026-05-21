import { localYMD } from '../../lib/dueDateUtils'

/** One KPI value per calendar day (24h); compliance pages do not use roster shifts. */
export const DDS_COMPLIANCE_DAY_SHIFT_KIND = ''

export type ComplianceKpiViewMode = 'day' | 'week' | 'table'

export function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(ymd + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return localYMD(d)
}

/** Seven calendar days ending on `anchorYmd` (inclusive), oldest first. */
export function last7DaysEndingYmd(anchorYmd: string): string[] {
  const out: string[] = []
  for (let i = 6; i >= 0; i--) {
    out.push(addDaysYmd(anchorYmd, -i))
  }
  return out
}

export function formatShortYmd(ymd: string): string {
  const d = new Date(ymd + 'T12:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}
