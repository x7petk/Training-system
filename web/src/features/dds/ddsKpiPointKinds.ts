/** Stored in `dds_kpis.point_kind` (Postgres enum `dds_kpi_point_kind`). */
export const DDS_KPI_POINT_KINDS = [
  { value: 'hard_point', label: 'Hard Point' },
  { value: 'hard_point_optional', label: 'Hard Point - optional' },
  { value: 'soft_point', label: 'Soft Point' },
] as const

export type DdsKpiPointKind = (typeof DDS_KPI_POINT_KINDS)[number]['value']

export function labelForPointKind(kind: string): string {
  const row = DDS_KPI_POINT_KINDS.find((k) => k.value === kind)
  return row?.label ?? kind
}

export function isDdsKpiPointKind(s: string): s is DdsKpiPointKind {
  return DDS_KPI_POINT_KINDS.some((k) => k.value === s)
}
