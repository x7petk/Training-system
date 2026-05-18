export type EPlanActionStatus =
  | 'ON_TRACK'
  | 'NEED_HELP'
  | 'OFF_TRACK'
  | 'COMPLETED'
  | 'NOT_STARTED'
  | 'NOT_REQUIRED'

export type EPlanAdminItem = {
  id: string
  name: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type EPlanOwner = {
  id: string
  name: string
  email?: string
  role?: string
  siteId?: string
  plantId?: string
  cellId?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type EPlanAction = {
  id: string
  title: string
  description?: string
  siteId: string
  plantId: string
  cellId: string
  startDate: string
  endDate: string
  ogsmPillarId: string
  forumId: string
  status: EPlanActionStatus
  actionOwnerId: string
  labelId?: string
  lossTypeId?: string
  raisedById: string
  createdAt: string
  updatedAt: string
  parentActionId?: string
  progress?: number
}

export type EPlanAdminStore = {
  ogsmPillars: EPlanAdminItem[]
  forums: EPlanAdminItem[]
  labels: EPlanAdminItem[]
  lossTypes: EPlanAdminItem[]
  owners: EPlanOwner[]
}

export type EPlanTimelineMode = 'weeks' | 'months' | 'next12'

export type EPlanPageFilters = {
  status: EPlanActionStatus | 'all'
  ogsmPillarId: string
  forumId: string
  actionOwnerId: string
  labelId: string
  lossTypeId: string
  raisedById: string
  dateFrom: string
  dateTo: string
  showNotRequired: boolean
}

export type EPlanDisplayRow = {
  action: EPlanAction
  depth: number
  hasChildren: boolean
  expanded: boolean
}
