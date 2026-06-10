import type { BmsCatalogRow, BmsProcessRow, BmsViewFilters } from './types'

export type PublishIssue = { message: string }

export function validateProcessForPublish(
  process: BmsProcessRow,
  roles: BmsCatalogRow[],
  forums: BmsCatalogRow[],
  systems: BmsCatalogRow[],
): PublishIssue[] {
  const issues: PublishIssue[] = []
  if (!process.name.trim()) issues.push({ message: 'Process name is required.' })
  const nodes = process.flow?.nodes ?? []
  if (nodes.length === 0) issues.push({ message: 'Add at least one step before publishing.' })
  const hasStart = nodes.some((n) => n.kind === 'start')
  const hasEnd = nodes.some((n) => n.kind === 'end')
  if (!hasStart) issues.push({ message: 'Include a Start block.' })
  if (!hasEnd) issues.push({ message: 'Include an End block.' })
  for (const node of nodes) {
    if (!node.label.trim()) issues.push({ message: `Step "${node.id}" needs a name.` })
    if (!node.roleId) issues.push({ message: `"${node.label || node.id}" needs a role.` })
    if (!node.forumId) issues.push({ message: `"${node.label || node.id}" needs a forum.` })
    if (node.roleId && !roles.some((r) => r.id === node.roleId && r.is_active)) {
      issues.push({ message: `"${node.label}" uses an inactive or missing role.` })
    }
    if (node.forumId && !forums.some((f) => f.id === node.forumId && f.is_active)) {
      issues.push({ message: `"${node.label}" uses an inactive or missing forum.` })
    }
    for (const sid of node.systemIds ?? []) {
      if (!systems.some((s) => s.id === sid && s.is_active)) {
        issues.push({ message: `"${node.label}" references an inactive or missing system.` })
      }
    }
  }
  return issues
}

function processMatchesToolTags(process: BmsProcessRow, systemIds: string[]): boolean {
  if (process.catalog_system_id && systemIds.includes(process.catalog_system_id)) return true
  return (process.flow?.nodes ?? []).some((n) => (n.systemIds ?? []).some((id) => systemIds.includes(id)))
}

export function filterProcesses(
  processes: BmsProcessRow[],
  filters: BmsViewFilters,
): BmsProcessRow[] {
  if (filters.systemIds.length === 0) return processes
  return processes.filter((p) => processMatchesToolTags(p, filters.systemIds))
}

export function nodeMatchesFilters(
  node: { roleId: string | null; forumId: string | null; systemIds: string[] },
  filters: BmsViewFilters,
): boolean {
  if (filters.roleIds.length && (!node.roleId || !filters.roleIds.includes(node.roleId))) return false
  if (filters.forumIds.length && (!node.forumId || !filters.forumIds.includes(node.forumId))) return false
  if (filters.systemIds.length) {
    const ids = node.systemIds ?? []
    if (!ids.some((id) => filters.systemIds.includes(id))) return false
  }
  return true
}
