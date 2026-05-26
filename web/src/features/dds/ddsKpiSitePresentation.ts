import type { DdsKpiScoring } from './ddsKpiScoring'

export const DDS_KPI_SITE_PRESENTATION_MODES = ['sum', 'avg', 'max', 'min', 'by_line'] as const

export type DdsKpiSitePresentationMode = (typeof DDS_KPI_SITE_PRESENTATION_MODES)[number]

export type DdsKpiSiteRollupMode = Exclude<DdsKpiSitePresentationMode, 'by_line'>

export const DDS_KPI_SITE_PRESENTATION_OPTIONS: {
  value: DdsKpiSitePresentationMode | ''
  label: string
}[] = [
  { value: '', label: 'Per cell (default)' },
  { value: 'sum', label: 'Site — consolidated sum' },
  { value: 'avg', label: 'Site — consolidated average' },
  { value: 'max', label: 'Site — consolidated max' },
  { value: 'min', label: 'Site — consolidated min' },
  { value: 'by_line', label: 'Site — by line (table)' },
]

export function parseDdsKpiSitePresentation(raw: string | null | undefined): DdsKpiSitePresentationMode | null {
  if (raw === 'sum' || raw === 'avg' || raw === 'max' || raw === 'min' || raw === 'by_line') return raw
  return null
}

export function isDdsKpiSiteByLine(presentation: string | null | undefined): boolean {
  return parseDdsKpiSitePresentation(presentation) === 'by_line'
}

export function isDdsKpiSiteConsolidated(presentation: string | null | undefined): boolean {
  const mode = parseDdsKpiSitePresentation(presentation)
  return mode === 'sum' || mode === 'avg' || mode === 'max' || mode === 'min'
}

export function parseDdsKpiSiteRollupMode(raw: string | null | undefined): DdsKpiSiteRollupMode | null {
  const mode = parseDdsKpiSitePresentation(raw)
  if (mode === 'by_line' || mode == null) return null
  return mode
}

/** Roll up numeric cell values; pass/fail uses worst (any fail → 0). Ignores empty cells. */
export function rollupSiteKpiFromCells(
  mode: DdsKpiSiteRollupMode,
  scoring: DdsKpiScoring,
  cellValues: number[],
): number | null {
  if (cellValues.length === 0) return null
  if (scoring.kind === 'pass_fail') {
    return cellValues.some((v) => v === 0) ? 0 : 1
  }
  switch (mode) {
    case 'sum':
      return cellValues.reduce((a, b) => a + b, 0)
    case 'avg':
      return cellValues.reduce((a, b) => a + b, 0) / cellValues.length
    case 'max':
      return Math.max(...cellValues)
    case 'min':
      return Math.min(...cellValues)
    default:
      return null
  }
}

export function resolveSiteDdsKpiValue(opts: {
  presentation: DdsKpiSiteRollupMode
  scoring: DdsKpiScoring
  siteValue: number | null | undefined
  cellValues: number[]
}): { value: number | null; fromSiteEntry: boolean; fromRollup: boolean } {
  if (opts.siteValue != null && Number.isFinite(opts.siteValue)) {
    return { value: opts.siteValue, fromSiteEntry: true, fromRollup: false }
  }
  const rolled = rollupSiteKpiFromCells(opts.presentation, opts.scoring, opts.cellValues)
  if (rolled != null && Number.isFinite(rolled)) {
    return { value: rolled, fromSiteEntry: false, fromRollup: true }
  }
  return { value: null, fromSiteEntry: false, fromRollup: false }
}

export function sitePresentationLabel(mode: DdsKpiSitePresentationMode): string {
  switch (mode) {
    case 'sum':
      return 'Site sum'
    case 'avg':
      return 'Site avg'
    case 'max':
      return 'Site max'
    case 'min':
      return 'Site min'
    case 'by_line':
      return 'By line'
  }
}
