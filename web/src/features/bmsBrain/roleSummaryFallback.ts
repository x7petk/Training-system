import { MATRIX_CELL_NO_DATA } from './matrixCellNoData'
import type { RoleSummaryCell } from './roleSummaryMatrixTypes'
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
  return processes.flatMap((process) =>
    (process.flow?.nodes ?? [])
      .filter((node) => node.roleId === roleId && node.forumId === forumId && nodeMatchesFilters(node, filters))
      .map((node) => ({
        label: node.label,
        kind: node.kind,
        processName: process.name,
        systems: (node.systemIds ?? []).map((id) => sysName.get(id) ?? id).filter(Boolean),
      })),
  )
}

export function buildRoleSummaryFallbackCell(
  role: BmsCatalogRow,
  forum: BmsCatalogRow,
  processes: BmsProcessRow[],
  filters: BmsViewFilters,
  systems: BmsCatalogRow[],
): RoleSummaryCell {
  const steps = stepsForCell(processes, role.id, forum.id, filters, systems)

  if (!steps.length) {
    return {
      roleId: role.id,
      forumId: forum.id,
      purpose: '',
      mustDo: [],
      decisions: [],
      systems: [],
      handoffs: [],
      gap: MATRIX_CELL_NO_DATA,
    }
  }

  const mustDo = steps.filter((s) => s.kind !== 'decision').map((s) => s.label).filter(Boolean)
  const decisions = steps.filter((s) => s.kind === 'decision').map((s) => s.label).filter(Boolean)
  const allSystems = [...new Set(steps.flatMap((s) => s.systems))].slice(0, 6)

  return {
    roleId: role.id,
    forumId: forum.id,
    purpose: `${role.name} accountable for ${forum.name} — ${mustDo[0] ?? decisions[0] ?? 'process steps'}`,
    mustDo: mustDo.slice(0, 12),
    decisions: decisions.slice(0, 6),
    systems: allSystems,
    handoffs: [],
    gap: null,
  }
}

export function isRoleSummaryCellComplete(cell: RoleSummaryCell | undefined): boolean {
  if (!cell) return false
  if (cell.gap === MATRIX_CELL_NO_DATA) return true
  return Boolean(cell.purpose.trim() || cell.mustDo.length || cell.decisions.length)
}
