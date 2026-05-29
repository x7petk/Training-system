import {
  DEFAULT_CASCADE_FILTERS,
  defaultCascadeScope,
  type CascadeBuilderState,
  type CascadeForumBuilderState,
  type CascadeForumMetric,
  type CascadeForumMetricGroup,
  type CascadeMetric,
  type CascadeMetricGroup,
} from './cascadeTypes'
import {
  pruneEmptyForumGroups,
  pruneEmptyGroups,
  pruneInvalidForumLinks,
  pruneInvalidLinks,
  syncCascadeGroupBoardRows,
  syncForumCascadeGroupBoardRows,
} from './cascadeUtils'
import type { KpiCascadeWorkspace } from './types'

function gid() {
  return `cg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Ensure every metric belongs to a group; create a solo box only when groupId is missing. */
export function normalizeCascadeGroups(
  metrics: CascadeMetric[],
  groups: CascadeMetricGroup[],
): { metrics: CascadeMetric[]; groups: CascadeMetricGroup[] } {
  const groupList = [...groups]
  const groupById = new Map(groupList.map((g) => [g.id, g]))

  const metricsOut = metrics.map((m) => {
    if (m.groupId && groupById.has(m.groupId)) return m
    const g: CascadeMetricGroup = {
      id: gid(),
      levelId: m.levelId,
      title: '',
      collapsed: false,
      sortOrder: 0,
      boardRow: 1,
    }
    groupList.push(g)
    groupById.set(g.id, g)
    return { ...m, groupId: g.id }
  })

  return { metrics: metricsOut, groups: groupList }
}

export function emptyCascadeBuilder(): CascadeBuilderState {
  return {
    scope: defaultCascadeScope(),
    groups: [],
    metrics: [],
    links: [],
    filters: { ...DEFAULT_CASCADE_FILTERS },
  }
}

export function finalizeCascadeState(
  partial: Partial<CascadeBuilderState>,
  ws: KpiCascadeWorkspace,
): CascadeBuilderState {
  const orderedLevels = ws.levels.filter((l) => l.active)
  const base: CascadeBuilderState = {
    scope: partial.scope ?? defaultCascadeScope(),
    groups: partial.groups ?? [],
    metrics: partial.metrics ?? [],
    links: partial.links ?? [],
    filters: partial.filters ?? { ...DEFAULT_CASCADE_FILTERS },
  }
  const { metrics, groups: normalizedGroups } = normalizeCascadeGroups(base.metrics, base.groups)
  const syncedGroups = syncCascadeGroupBoardRows(normalizedGroups, metrics, ws.kpis)
  const groups = pruneEmptyGroups(syncedGroups, metrics)
  const links = pruneInvalidLinks(metrics, base.links, orderedLevels)
  return { ...base, metrics, groups, links }
}

function normalizeForumCascadeGroups(
  metrics: CascadeForumMetric[],
  groups: CascadeForumMetricGroup[],
): { metrics: CascadeForumMetric[]; groups: CascadeForumMetricGroup[] } {
  const groupList = [...groups]
  const groupById = new Map(groupList.map((g) => [g.id, g]))

  const metricsOut = metrics.map((m) => {
    if (m.groupId && groupById.has(m.groupId)) return m
    const g: CascadeForumMetricGroup = {
      id: gid(),
      levelId: m.levelId,
      title: '',
      collapsed: false,
      sortOrder: 0,
      boardRow: 1,
    }
    groupList.push(g)
    groupById.set(g.id, g)
    return { ...m, groupId: g.id }
  })

  return { metrics: metricsOut, groups: groupList }
}

export function emptyForumCascadeBuilder(): CascadeForumBuilderState {
  return {
    scope: defaultCascadeScope(),
    groups: [],
    metrics: [],
    links: [],
    filters: { ...DEFAULT_CASCADE_FILTERS },
  }
}

export function finalizeForumCascadeState(
  partial: Partial<CascadeForumBuilderState>,
  ws: KpiCascadeWorkspace,
): CascadeForumBuilderState {
  const orderedLevels = ws.levels.filter((l) => l.active)
  const base: CascadeForumBuilderState = {
    scope: partial.scope ?? defaultCascadeScope(),
    groups: partial.groups ?? [],
    metrics: partial.metrics ?? [],
    links: partial.links ?? [],
    filters: partial.filters ?? { ...DEFAULT_CASCADE_FILTERS },
  }
  const { metrics, groups: normalizedGroups } = normalizeForumCascadeGroups(base.metrics, base.groups)
  const syncedGroups = syncForumCascadeGroupBoardRows(normalizedGroups, metrics, ws.forums)
  const groups = pruneEmptyForumGroups(syncedGroups, metrics)
  const links = pruneInvalidForumLinks(metrics, base.links, orderedLevels)
  return { ...base, metrics, groups, links }
}
