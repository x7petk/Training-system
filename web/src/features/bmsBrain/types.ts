export type BmsBrainRoleLevel = 'viewer' | 'editor' | 'admin'

export type BmsCatalogKind = 'roles' | 'forums' | 'systems'

export type BmsCatalogRow = {
  id: string
  slug: string
  name: string
  description: string
  color: string
  icon: string
  sort_order: number
  is_active: boolean
  integrations?: string
}

export type BmsProcessStatus = 'draft' | 'published' | 'archived'

export type BmsNodeKind =
  | 'start'
  | 'process'
  | 'decision'
  | 'review'
  | 'document'
  | 'subprocess'
  | 'end'

export type BmsFlowNode = {
  id: string
  kind: BmsNodeKind
  label: string
  description?: string
  roleId: string | null
  forumId: string | null
  systemIds: string[]
  owner?: string
  inputs?: string
  outputs?: string
  links?: { label: string; url: string }[]
  subprocessProcessId?: string | null
  position: { x: number; y: number }
}

export type BmsFlowEdge = {
  id: string
  source: string
  target: string
  label?: string
}

export type BmsProcessFlow = {
  nodes: BmsFlowNode[]
  edges: BmsFlowEdge[]
}

export type BmsProcessRow = {
  id: string
  name: string
  description: string
  status: BmsProcessStatus
  flow: BmsProcessFlow
  owner_role_id: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type BmsProcessVersionRow = {
  id: string
  process_id: string
  version_no: number
  snapshot: BmsProcessRow
  published_by: string | null
  published_at: string
  note: string
}

export type BmsViewFilters = {
  processIds: string[]
  systemIds: string[]
  roleIds: string[]
  forumIds: string[]
}

export type BmsViewViewport = {
  zoom: number
  panX: number
  panY: number
  viewMode: 'matrix' | 'flow'
}

export const EMPTY_BMS_FLOW: BmsProcessFlow = { nodes: [], edges: [] }

export const DEFAULT_BMS_FILTERS: BmsViewFilters = {
  processIds: [],
  systemIds: [],
  roleIds: [],
  forumIds: [],
}

export const DEFAULT_BMS_VIEWPORT: BmsViewViewport = {
  zoom: 1,
  panX: 0,
  panY: 0,
  viewMode: 'matrix',
}
