/** Plan 24 metric keys stored on `dds_kpis.plan24_value_source`. */

export const PLAN24_LINE_CONSOLIDATED_SHIFT_KIND = 'day_night'

export const DDS_PLAN24_VALUE_SOURCES = [
  { value: '', label: 'Manual only' },
  { value: 'cl_completion_pct', label: 'Plan 24 — CL completion %' },
  { value: 'cil_completion_pct', label: 'Plan 24 — CIL completion %' },
  { value: 'quality_completion_pct', label: 'Plan 24 — Quality completion %' },
  { value: 'check_completion_pct', label: 'Plan 24 — Checks completion %' },
  { value: 'deviations_count', label: 'Plan 24 — Deviations raised' },
  { value: 'defects_new_count', label: 'Plan 24 — Defects new (day)' },
  { value: 'defects_fixed_count', label: 'Plan 24 — Defects fixed (day)' },
  { value: 'defects_open_count', label: 'Plan 24 — Defects open (total)' },
  { value: 'quality_fails_count', label: 'Plan 24 — Quality fails raised' },
] as const

export type DdsPlan24ValueSource = Exclude<(typeof DDS_PLAN24_VALUE_SOURCES)[number]['value'], ''>

const SOURCE_SET = new Set<string>(DDS_PLAN24_VALUE_SOURCES.map((o) => o.value).filter(Boolean))

export function isDdsPlan24ValueSource(v: string | null | undefined): v is DdsPlan24ValueSource {
  return typeof v === 'string' && v.length > 0 && SOURCE_SET.has(v)
}

export function parseDdsPlan24ValueSource(v: string | null | undefined): DdsPlan24ValueSource | null {
  return isDdsPlan24ValueSource(v) ? v : null
}

/** Cell entry `shift_kind` for Plan 24 auto KPIs: consolidated on Line DDS, per shift elsewhere. */
export function plan24EntryShiftKind(
  plan24Source: string | null | undefined,
  kpiSurface: string,
  shiftKind: string,
): string {
  if (!isDdsPlan24ValueSource(plan24Source)) return shiftKind
  if (
    kpiSurface === 'line-dds' ||
    kpiSurface === 'plant-dds' ||
    kpiSurface === 'site-dds'
  ) {
    return PLAN24_LINE_CONSOLIDATED_SHIFT_KIND
  }
  return shiftKind
}
