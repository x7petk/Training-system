/**
 * Surfaces where a KPI metric can appear (admin tick-boxes per KPI).
 * Keys align with `/dds-process/<segment>` routes where applicable.
 */
export const DDS_KPI_METRIC_SURFACE_OPTIONS = [
  { key: 'p2p', label: 'P2P' },
  { key: 'shift-dds', label: 'Shift DDS' },
  { key: 'line-compliance', label: 'Line compliance' },
  { key: 'line-dds', label: 'Line DDS' },
  { key: 'plant-dds', label: 'Plant DDS' },
  { key: 'site-compliance', label: 'Site compliance' },
  { key: 'site-dds', label: 'Site DDS' },
] as const

export type DdsKpiMetricSurfaceKey = (typeof DDS_KPI_METRIC_SURFACE_OPTIONS)[number]['key']

export const DDS_KPI_METRIC_SURFACE_KEY_SET = new Set<string>(DDS_KPI_METRIC_SURFACE_OPTIONS.map((o) => o.key))

export function metricSurfacesFromRow(raw: string[] | null | undefined): DdsKpiMetricSurfaceKey[] {
  return (raw ?? []).filter((s): s is DdsKpiMetricSurfaceKey => DDS_KPI_METRIC_SURFACE_KEY_SET.has(s))
}

/** Admin → KPIs “Show on screens” — compliance pages use these keys only (not DDS set-up overrides). */
export function kpiShowsOnMetricSurface(
  kpi: { display_sections?: string[] | null },
  surface: DdsKpiMetricSurfaceKey,
): boolean {
  return (kpi.display_sections ?? []).includes(surface)
}
