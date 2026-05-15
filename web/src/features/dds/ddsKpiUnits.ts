/** Stored on `dds_kpis.unit` — display suffix for entered values. */

export const DDS_KPI_UNIT_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'pct', label: '%' },
  { value: 'mt', label: 'MT' },
  { value: 'kg', label: 'Kg' },
  { value: 'num', label: '#' },
  { value: 'm3', label: 'm³' },
  { value: 'usd', label: '$' },
  { value: 'min', label: 'Min' },
] as const

export type DdsKpiUnit = (typeof DDS_KPI_UNIT_OPTIONS)[number]['value']

const UNIT_SET = new Set<string>(DDS_KPI_UNIT_OPTIONS.map((o) => o.value))

export function parseDdsKpiUnit(raw: unknown): DdsKpiUnit {
  if (typeof raw === 'string' && UNIT_SET.has(raw)) return raw as DdsKpiUnit
  return 'none'
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return ''
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

/** Suffix after a space, or '' for none (caller may omit space). */
export function kpiUnitDisplaySuffix(unit: DdsKpiUnit): string {
  switch (unit) {
    case 'pct':
      return '%'
    case 'mt':
      return ' MT'
    case 'kg':
      return ' Kg'
    case 'num':
      return ' #'
    case 'm3':
      return ' m³'
    case 'usd':
      return ' $'
    case 'min':
      return ' Min'
    default:
      return ''
  }
}

/** Full display for a stored numeric value + unit (no target logic). */
export function formatKpiValueWithUnit(n: number, unit: DdsKpiUnit): string {
  const core = fmt(n)
  if (unit === 'pct') return `${core}%`
  if (unit === 'none') return core
  const suf = kpiUnitDisplaySuffix(unit).trimStart()
  return suf ? `${core} ${suf}` : core
}
