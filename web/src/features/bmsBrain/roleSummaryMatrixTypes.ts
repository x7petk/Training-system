export type RoleSummaryCell = {
  roleId: string
  forumId: string
  purpose: string
  mustDo: string[]
  decisions: string[]
  systems: string[]
  handoffs: string[]
  gap: string | null
}

export type RoleSummaryMatrixResponse = {
  cells: RoleSummaryCell[]
}

export function roleSummaryCellKey(roleId: string, forumId: string) {
  return `${roleId}::${forumId}`
}
