export type SwpAdminTab = 'roles' | 'systems'

export type SwpPageTab = 'admin' | 'process'

type CatalogBase = {
  id: string
  name: string
  active: boolean
}

/** Manufacturing / reliability system (CL, CIL, DH, DDS, …). */
export type SwpSystem = CatalogBase & {
  description?: string
}

export type SwpRoleKey =
  | 'operator'
  | 'team-lead'
  | 'cell-team'
  | 'plant-manager'
  | 'site-manager'
  | 'support'

export type SwpNodeKind = 'start' | 'end' | 'task' | 'decision'

export type SwpNodeStatus = 'draft' | 'active' | 'blocked' | 'done'

/** Optional metadata editable in the properties panel. */
export type SwpFlowNodeMeta = {
  description?: string
  ownerRole?: string
  standardRef?: string
  expectedCompletion?: string
  escalationLevel?: string
  tags?: string[]
  status?: SwpNodeStatus
  /** CSS color override for block border/accent */
  color?: string
}

export type SwpFlowNode = {
  id: string
  kind: SwpNodeKind
  label: string
  roleKey: SwpRoleKey
  position: { x: number; y: number }
  width?: number
  height?: number
  meta?: SwpFlowNodeMeta
  /** Legacy grid coords — migrated to position on load. */
  col?: number
  row?: number
}

export type SwpFlowEdge = {
  id: string
  from: string
  to: string
  label?: string
  color?: string
  lineStyle?: 'straight' | 'stepped' | 'curved'
}

/** Portable diagram JSON (export / import). */
export type SwpDiagramExport = {
  diagramName: string
  systemId: string
  roles: { id: SwpRoleKey; name: string; color: string; order: number }[]
  nodes: {
    id: string
    type: SwpNodeKind
    roleId: SwpRoleKey
    label: string
    x: number
    y: number
    width: number
    height: number
    meta?: SwpFlowNodeMeta
  }[]
  edges: {
    id: string
    source: string
    target: string
    label?: string
    type: 'arrow'
    color?: string
    lineStyle?: SwpFlowEdge['lineStyle']
  }[]
}

export type SwpProcessFlow = {
  systemId: string
  subtitle?: string
  nodes: SwpFlowNode[]
  edges: SwpFlowEdge[]
}

export type SwpWorkspace = {
  version: 1
  systems: SwpSystem[]
  flows: SwpProcessFlow[]
}
