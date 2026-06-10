import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { callBmsBrainAi } from './bmsBrainAiProxy'
import { buildMatrixAiFallbackCell, isMatrixAiCellComplete } from './matrixAiFallback'
import { roleForumCellKey, type RoleForumMatrixCell } from './roleForumMatrixTypes'
import type { BmsCatalogRow, BmsProcessRow, BmsViewFilters } from './types'
import { nodeMatchesFilters } from './validateProcessPublish'

function cellHasSteps(
  processes: BmsProcessRow[],
  roleId: string,
  forumId: string,
  filters: BmsViewFilters,
): boolean {
  for (const process of processes) {
    for (const node of process.flow?.nodes ?? []) {
      if (node.roleId !== roleId || node.forumId !== forumId) continue
      if (!nodeMatchesFilters(node, filters)) continue
      return true
    }
  }
  return false
}

export function useBmsBrainRoleForumMatrix(
  enabled: boolean,
  processes: BmsProcessRow[],
  roles: BmsCatalogRow[],
  forums: BmsCatalogRow[],
  filters: BmsViewFilters,
  systems: BmsCatalogRow[] = [],
) {
  const [cells, setCells] = useState<Map<string, RoleForumMatrixCell>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const requestId = useRef(0)

  const cacheKey = useMemo(
    () =>
      JSON.stringify({
        processIds: processes.map((p) => `${p.id}:${p.updated_at}`).sort(),
        roleIds: filters.roleIds.slice().sort(),
        forumIds: filters.forumIds.slice().sort(),
        systemIds: filters.systemIds.slice().sort(),
      }),
    [processes, filters],
  )

  const stepPresence = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const forum of forums) {
      if (filters.forumIds.length && !filters.forumIds.includes(forum.id)) continue
      for (const role of roles) {
        if (filters.roleIds.length && !filters.roleIds.includes(role.id)) continue
        map.set(
          roleForumCellKey(role.id, forum.id),
          cellHasSteps(processes, role.id, forum.id, filters),
        )
      }
    }
    return map
  }, [forums, roles, processes, filters])

  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const res = await callBmsBrainAi({
        mode: 'matrixAi',
        filters,
      })
      if (id !== requestId.current) return
      const next = new Map<string, RoleForumMatrixCell>()
      for (const cell of res.matrix?.cells ?? []) {
        const key = roleForumCellKey(cell.roleId, cell.forumId)
        if (!(stepPresence.get(key) ?? false)) continue
        next.set(key, cell)
      }

      for (const forum of forums) {
        if (filters.forumIds.length && !filters.forumIds.includes(forum.id)) continue
        for (const role of roles) {
          if (filters.roleIds.length && !filters.roleIds.includes(role.id)) continue
          const key = roleForumCellKey(role.id, forum.id)
          const hasSteps = stepPresence.get(key) ?? false
          if (!hasSteps) continue
          const existing = next.get(key)
          if (!isMatrixAiCellComplete(existing)) {
            next.set(key, buildMatrixAiFallbackCell(role, forum, processes, filters, systems))
          }
        }
      }

      setCells(next)
      setGeneratedAt(new Date().toISOString())
    } catch (e) {
      if (id !== requestId.current) return
      setError(e instanceof Error ? e.message : 'Failed to generate summaries')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [filters, forums, processes, roles, systems, stepPresence])

  useEffect(() => {
    if (!enabled) return
    void load()
  }, [enabled, cacheKey, load])

  return { cells, stepPresence, loading, error, generatedAt, reload: load }
}
