/**
 * The four DDS process pages where KPI metrics can appear (per-cell visibility in KPI set-up).
 * Broader `dds_kpis.display_sections` can still include p2p, compliance routes, etc.
 */
export const DDS_KPI_DDS_SETUP_SURFACE_KEYS = ['shift-dds', 'line-dds', 'plant-dds', 'site-dds'] as const

export type DdsKpiDdsSetupSurfaceKey = (typeof DDS_KPI_DDS_SETUP_SURFACE_KEYS)[number]

export const DDS_KPI_DDS_SETUP_SURFACE_LABELS: Record<DdsKpiDdsSetupSurfaceKey, string> = {
  'shift-dds': 'Shift DDS',
  'line-dds': 'Line DDS',
  'plant-dds': 'Plant DDS',
  'site-dds': 'Site DDS',
}

const KEY_SET = new Set<string>(DDS_KPI_DDS_SETUP_SURFACE_KEYS)

export function normalizeDdsSetupSurfaces(raw: string[] | null | undefined): DdsKpiDdsSetupSurfaceKey[] {
  const pick = new Set<string>()
  for (const s of raw ?? []) {
    if (KEY_SET.has(s)) pick.add(s)
  }
  return DDS_KPI_DDS_SETUP_SURFACE_KEYS.filter((k) => pick.has(k))
}

/** Hard-point metrics cannot be overridden per cell in KPI set-up (use Admin → KPIs screens). */
export function isDdsKpiHardPointLocked(pointKind: string | null | undefined): boolean {
  const k = String(pointKind ?? '')
  return k === 'hard_point' || k === 'hard_point_optional'
}

/**
 * Effective DDS surfaces for a KPI on a cell (used by DDS summaries and KPI set-up).
 * - `override === null`: inherit global `display_sections` (Admin → KPIs), DDS keys only.
 * - `override` is an array (possibly empty): explicit per-cell list from `dds_kpi_cell_dds_display`.
 * - Empty global DDS selection = not shown on any DDS page (admin ticks are authoritative).
 */
export function effectiveDdsSurfacesForCell(opt: {
  point_kind: string | null | undefined
  globalDisplaySections: string[] | null | undefined
  /** `null` = no row in `dds_kpi_cell_dds_display`; otherwise stored `surfaces` array. */
  override: string[] | null
}): DdsKpiDdsSetupSurfaceKey[] {
  if (opt.override !== null) {
    return normalizeDdsSetupSurfaces(opt.override)
  }
  return normalizeDdsSetupSurfaces(opt.globalDisplaySections)
}

export function kpiShowsOnDdsSurface(
  kpi: {
    point_kind?: string | null
    display_sections?: string[] | null
  },
  surface: DdsKpiDdsSetupSurfaceKey,
  override: string[] | null,
): boolean {
  return effectiveDdsSurfacesForCell({
    point_kind: kpi.point_kind,
    globalDisplaySections: kpi.display_sections,
    override,
  }).includes(surface)
}

export type DdsKpiMetricScope = 'site' | 'plant' | 'cell'

export const DDS_KPI_METRIC_SCOPE_OPTIONS: { value: DdsKpiMetricScope; label: string }[] = [
  { value: 'site', label: 'Site' },
  { value: 'plant', label: 'Plant' },
  { value: 'cell', label: 'Cell' },
]

export function isDdsKpiMetricScope(s: string | null | undefined): s is DdsKpiMetricScope {
  return s === 'site' || s === 'plant' || s === 'cell'
}

export function parseDdsKpiMetricScope(raw: string | null | undefined): DdsKpiMetricScope {
  return isDdsKpiMetricScope(raw) ? raw : 'cell'
}
