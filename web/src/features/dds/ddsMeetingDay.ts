import { PLAN24_LINE_CONSOLIDATED_SHIFT_KIND } from './ddsPlan24ValueSource'

/** Cell/site KPI and roll-ups for Line, Plant, and Site DDS meetings (full calendar day). */
export const DDS_MEETING_SHIFT_KIND = PLAN24_LINE_CONSOLIDATED_SHIFT_KIND

export function isDdsMeetingDayPath(pathname: string): boolean {
  return (
    pathname.endsWith('/line-dds') ||
    pathname.includes('/dds-process/line-dds') ||
    pathname.endsWith('/plant-dds') ||
    pathname.includes('/dds-process/plant-dds') ||
    pathname.endsWith('/site-dds') ||
    pathname.includes('/dds-process/site-dds')
  )
}
