export type MatrixAiGroup = {
  title: string
  items: string[]
  systems?: string[]
}

export type RoleForumMatrixCell = {
  roleId: string
  forumId: string
  headline: string
  groups: MatrixAiGroup[]
  systems: string[]
  gap: string | null
}

export type RoleForumMatrixResponse = {
  cells: RoleForumMatrixCell[]
}

export function roleForumCellKey(roleId: string, forumId: string) {
  return `${roleId}::${forumId}`
}
