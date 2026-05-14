/** Keys match `/dds-process/<key>` route segments (used in `dds_kpi_groups.display_sections`). */
export const DDS_KPI_DISPLAY_SECTION_OPTIONS = [
  { key: 'plan-24', label: 'Plan 24' },
  { key: 'p2p', label: 'P2P' },
  { key: 'shift-dds', label: 'Shift DDS' },
  { key: 'line-compliance', label: 'Line compliance' },
  { key: 'line-dds', label: 'Line DDS' },
  { key: 'plant-dds', label: 'Plant DDS' },
  { key: 'site-compliance', label: 'Site compliance' },
  { key: 'site-dds', label: 'Site DDS' },
  { key: 'wds', label: 'WDS' },
  { key: 'e-plan', label: 'e-plan' },
  { key: 'pdca', label: 'PDCA' },
] as const

export type DdsKpiDisplaySectionKey = (typeof DDS_KPI_DISPLAY_SECTION_OPTIONS)[number]['key']

export function defaultKpiDisplaySections(): DdsKpiDisplaySectionKey[] {
  return DDS_KPI_DISPLAY_SECTION_OPTIONS.map((o) => o.key)
}
