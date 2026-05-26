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
