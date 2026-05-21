export type RoadMapViewMode = 'auto' | 'quarterly' | 'now_next_later' | 'gantt'

export type RoadMapWorkstreamColor =
  | 'amber'
  | 'emerald'
  | 'sky'
  | 'violet'
  | 'rose'
  | 'indigo'
  | 'teal'
  | 'fuchsia'

export type RoadMapInputs = {
  title: string
  vision: string
  objective: string
  horizonMonths: number
  bucket: 'months' | 'quarters'
  audience: string
  currentState: string
  constraints: string
  successMetrics: string
  workstreams: string
  contextNotes: string
  preferredView: RoadMapViewMode
}

export type RoadMapPhase = {
  id: string
  label: string
  startMonth: number
  endMonth: number
}

export type RoadMapWorkstream = {
  id: string
  name: string
  color: RoadMapWorkstreamColor
  description?: string
}

export type RoadMapItem = {
  id: string
  title: string
  workstreamId: string
  phaseIds: string[]
  startMonth: number
  endMonth: number
  priority: 'high' | 'medium' | 'low'
  milestone: boolean
  description: string
  outcome?: string
  owner?: string
}

export type RoadMapMilestone = {
  id: string
  title: string
  month: number
  description: string
}

export type RoadMapSuccessMetric = {
  name: string
  baseline?: string
  target: string
  timeframe?: string
  owner?: string
}

export type RoadMapRisk = {
  description: string
  severity: 'high' | 'medium' | 'low'
  mitigation: string
}

export type RoadMapResult = {
  title: string
  polishedVision: string
  chosenView: 'quarterly' | 'now_next_later' | 'gantt'
  viewRationale: string
  horizonMonths: number
  bucket: 'months' | 'quarters'
  phases: RoadMapPhase[]
  workstreams: RoadMapWorkstream[]
  items: RoadMapItem[]
  keyMilestones: RoadMapMilestone[]
  successMetrics: RoadMapSuccessMetric[]
  risks: RoadMapRisk[]
  quickWins: string[]
  executiveSummary: string
}

export type RoadMapApiResponse = {
  model: string
  result: RoadMapResult
}

export type RoadMapRow = {
  id: string
  user_id: string
  title: string
  inputs: RoadMapInputs
  result: RoadMapResult | null
  view_mode: RoadMapViewMode
  created_at: string
  updated_at: string
}

export const EMPTY_INPUTS: RoadMapInputs = {
  title: '',
  vision: '',
  objective: '',
  horizonMonths: 12,
  bucket: 'quarters',
  audience: '',
  currentState: '',
  constraints: '',
  successMetrics: '',
  workstreams: '',
  contextNotes: '',
  preferredView: 'auto',
}
