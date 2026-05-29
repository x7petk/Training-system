/** Primary metrics drive cascade links; secondary are contextual only. */
export type CascadeMetricKind = 'primary' | 'secondary'

export type CascadeAnalysisPeriod = 'day' | 'week' | 'month'

export type CascadeScope = {
  /** Hierarchy filters (display / future DDS scope) */
  product: string
  enterprise: string
  workshop: string
  area: string
  unit: string
  analysisPeriod: CascadeAnalysisPeriod
  periodicity: CascadeAnalysisPeriod
  dateFrom: string
  dateTo: string
}

export type CascadeMetricGroup = {
  id: string
  levelId: string
  title: string
  collapsed: boolean
  sortOrder: number
  /** 1-based row on the level column grid */
  boardRow?: number
}

export type CascadeMetric = {
  id: string
  levelId: string
  groupId: string
  kpiId: string
  kind: CascadeMetricKind
  budget: number
  fact: number
  /** e.g. "Loss/Gain -86 kT" — manual only */
  impactNote?: string
  sortOrder: number
  /** Resolved DDS KPI when live sync runs */
  ddsKpiId?: string
}

export type CascadeLink = {
  id: string
  fromMetricId: string
  toMetricId: string
}

export type CascadeViewFilters = {
  levelIds: string[]
  kpiIds: string[]
  forumIds: string[]
  /** KPI Cascade metric ids — Forum Cascade shows these + transitively linked metrics. */
  focusMetricIds: string[]
  onlyConnected: boolean
  searchQuery: string
}

/** KPI Cascade metric summary shown under Forum Cascade blocks when filtering by metric. */
export type CascadeKpiOverlayItem = {
  metricId: string
  kpiId: string
  label: string
  measure: string
  budget: number
  fact: number
  isFocus: boolean
}

export type CascadeBuilderState = {
  scope: CascadeScope
  groups: CascadeMetricGroup[]
  metrics: CascadeMetric[]
  links: CascadeLink[]
  filters: CascadeViewFilters
}

export type CascadeForumMetricGroup = {
  id: string
  levelId: string
  title: string
  collapsed: boolean
  sortOrder: number
  /** 1-based row on the level column grid */
  boardRow?: number
}

export type CascadeForumMetric = {
  id: string
  levelId: string
  groupId: string
  forumId: string
  kind: CascadeMetricKind
  budget: number
  fact: number
  impactNote?: string
  sortOrder: number
}

export type CascadeForumBuilderState = {
  scope: CascadeScope
  groups: CascadeForumMetricGroup[]
  metrics: CascadeForumMetric[]
  links: CascadeLink[]
  filters: CascadeViewFilters
}

export type CascadeBoardColumn = {
  id: string
  label: string
}

export function defaultCascadeScope(): CascadeScope {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return {
    product: '',
    enterprise: '',
    workshop: '',
    area: '',
    unit: '',
    analysisPeriod: 'week',
    periodicity: 'day',
    dateFrom: fmt(from),
    dateTo: fmt(to),
  }
}

export const DEFAULT_CASCADE_FILTERS: CascadeViewFilters = {
  levelIds: [],
  kpiIds: [],
  forumIds: [],
  focusMetricIds: [],
  onlyConnected: false,
  searchQuery: '',
}
