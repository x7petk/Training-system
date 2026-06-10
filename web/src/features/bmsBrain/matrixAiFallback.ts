import { MATRIX_CELL_NO_DATA } from './matrixCellNoData'
import type { RoleForumMatrixCell } from './roleForumMatrixTypes'
import type { BmsCatalogRow, BmsProcessRow, BmsViewFilters } from './types'
import { nodeMatchesFilters } from './validateProcessPublish'

function stepsForCell(
  processes: BmsProcessRow[],
  roleId: string,
  forumId: string,
  filters: BmsViewFilters,
  systems: BmsCatalogRow[],
) {
  const sysName = new Map(systems.map((s) => [s.id, s.name]))
  const steps: { label: string; processName: string; systems: string[] }[] = []
  for (const process of processes) {
    for (const node of process.flow?.nodes ?? []) {
      if (node.roleId !== roleId || node.forumId !== forumId) continue
      if (!nodeMatchesFilters(node, filters)) continue
      steps.push({
        label: node.label,
        processName: process.name,
        systems: (node.systemIds ?? []).map((id) => sysName.get(id) ?? id).filter(Boolean),
      })
    }
  }
  return steps
}

export function buildMatrixAiFallbackCell(
  role: BmsCatalogRow,
  forum: BmsCatalogRow,
  processes: BmsProcessRow[],
  filters: BmsViewFilters,
  systems: BmsCatalogRow[],
): RoleForumMatrixCell {
  const steps = stepsForCell(processes, role.id, forum.id, filters, systems)
  if (!steps.length) {
    return {
      roleId: role.id,
      forumId: forum.id,
      headline: '',
      groups: [],
      systems: [],
      gap: MATRIX_CELL_NO_DATA,
    }
  }

  const byProcess = new Map<string, typeof steps>()
  for (const step of steps) {
    const list = byProcess.get(step.processName) ?? []
    list.push(step)
    byProcess.set(step.processName, list)
  }

  const groups = [...byProcess.entries()].slice(0, 4).map(([title, items]) => ({
    title: title.length > 28 ? `${title.slice(0, 28)}…` : title,
    items: items.slice(0, 3).map((s) => s.label).filter(Boolean),
    systems: [...new Set(items.flatMap((s) => s.systems))].slice(0, 3),
  }))

  return {
    roleId: role.id,
    forumId: forum.id,
    headline: `${role.name} in ${forum.name} — ${steps[0]?.label ?? 'process steps'}`,
    groups,
    systems: [...new Set(steps.flatMap((s) => s.systems))].slice(0, 4),
    gap: null,
  }
}

export function isMatrixAiCellComplete(cell: RoleForumMatrixCell | undefined): boolean {
  if (!cell) return false
  if (cell.gap === MATRIX_CELL_NO_DATA) return true
  return Boolean(cell.headline.trim() || cell.groups.length)
}
