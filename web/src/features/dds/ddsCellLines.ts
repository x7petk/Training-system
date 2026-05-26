export type DdsCellLine = {
  id: string
  master_cell_id: string
  name: string
  sort_order: number
  active: boolean
}

export type DdsKpiLineEntry = {
  id: string
  master_cell_id: string
  line_id: string
  kpi_id: string
  value_numeric: number | null
  comment: string | null
  p2p_breakdown?: unknown
}

export function lineEntryKey(lineId: string, kpiId: string): string {
  return `${lineId}\0${kpiId}`
}

export type DdsKpiCellEntry = {
  id: string
  master_cell_id: string
  kpi_id: string
  value_numeric: number | null
  comment: string | null
  p2p_breakdown?: unknown
}

export function cellEntryKey(cellId: string, kpiId: string): string {
  return `${cellId}\0${kpiId}`
}

/** KPI table column label — drop trailing " cell" from master cell names. */
export function ddsKpiCellColumnLabel(name: string): string {
  const trimmed = name.trim()
  const stripped = trimmed.replace(/\s+cell\s*$/i, '').trim()
  return stripped || trimmed
}
