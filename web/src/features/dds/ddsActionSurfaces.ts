/** Keys aligned with DDS process routes / KPI surfaces (see ddsKpiMetricSurfaces). */
export const DDS_ACTION_UI_SURFACE_KEYS = ['line-dds', 'plant-dds', 'site-dds'] as const

export type DdsActionUiSurfaceKey = (typeof DDS_ACTION_UI_SURFACE_KEYS)[number]

export const DDS_ACTION_UI_SURFACE_LABELS: Record<DdsActionUiSurfaceKey, string> = {
  'line-dds': 'Line',
  'plant-dds': 'Plant',
  'site-dds': 'Site',
}

/** Legacy rows: null or empty = every surface. */
export function ddsActionShowsOnUiSurface(
  ev: { event_type?: string | null; dds_display_surfaces?: string[] | null },
  surface: DdsActionUiSurfaceKey,
): boolean {
  if (String(ev?.event_type ?? '').toLowerCase() !== 'dds_action') return false
  const arr = ev.dds_display_surfaces
  if (arr == null || arr.length === 0) return true
  return arr.includes(surface)
}

/** Checkbox state when opening the editor: legacy null/empty → all three. */
export function ddsActionSurfacesForEditor(raw: string[] | null | undefined): DdsActionUiSurfaceKey[] {
  if (raw == null || raw.length === 0) return [...DDS_ACTION_UI_SURFACE_KEYS]
  return DDS_ACTION_UI_SURFACE_KEYS.filter((k) => raw.includes(k))
}

/** Persisted value: non-empty subset of known keys, stable order. */
export function normalizeDdsActionSurfacesForSave(selected: Iterable<DdsActionUiSurfaceKey>): string[] {
  const set = new Set<string>()
  for (const k of selected) {
    if (DDS_ACTION_UI_SURFACE_KEYS.includes(k as DdsActionUiSurfaceKey)) set.add(k)
  }
  return DDS_ACTION_UI_SURFACE_KEYS.filter((k) => set.has(k))
}

/** Short label for tables (legacy null/empty = all pages). */
export function formatDdsActionSurfacesSummary(ev: {
  event_type?: string | null
  dds_display_surfaces?: string[] | null
}): string {
  if (String(ev?.event_type ?? '').toLowerCase() !== 'dds_action') return '—'
  const raw = ev.dds_display_surfaces
  if (raw == null || raw.length === 0) return 'All'
  const labels = DDS_ACTION_UI_SURFACE_KEYS.filter((k) => raw.includes(k)).map((k) => DDS_ACTION_UI_SURFACE_LABELS[k])
  return labels.length ? labels.join(', ') : '—'
}
