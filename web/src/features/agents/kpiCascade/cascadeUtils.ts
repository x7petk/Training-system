import { emptyCascadeBuilder, finalizeCascadeState } from './cascadeMigrate'
import type {
  CascadeBuilderState,
  CascadeBoardColumn,
  CascadeForumMetric,
  CascadeForumMetricGroup,
  CascadeKpiOverlayItem,
  CascadeLink,
  CascadeMetric,
  CascadeMetricGroup,
  CascadeViewFilters,
} from './cascadeTypes'
import type { KpiCascadeForum, KpiCascadeKpi, KpiCascadeLevel, KpiCascadeWorkspace } from './types'

export function levelSortKey(level: KpiCascadeLevel): number {
  if (typeof level.columnOrder === 'number' && Number.isFinite(level.columnOrder)) {
    return level.columnOrder
  }
  const n = Number(level.code)
  return Number.isFinite(n) ? n : 9999
}

export function forumSortKey(forum: KpiCascadeForum): number {
  if (typeof forum.columnOrder === 'number' && Number.isFinite(forum.columnOrder)) {
    return forum.columnOrder
  }
  return 9999
}

export function sortedActiveLevels(levels: KpiCascadeLevel[]): KpiCascadeLevel[] {
  return levels
    .filter((l) => l.active)
    .sort((a, b) => levelSortKey(a) - levelSortKey(b) || a.name.localeCompare(b.name))
}

export function sortedActiveForums(forums: KpiCascadeForum[]): KpiCascadeForum[] {
  return forums
    .filter((f) => f.active)
    .sort((a, b) => forumSortKey(a) - forumSortKey(b) || a.name.localeCompare(b.name))
}

export function nextColumnOrder(items: { columnOrder?: number }[]): number {
  let max = 0
  for (const item of items) {
    if (typeof item.columnOrder === 'number' && Number.isFinite(item.columnOrder)) {
      max = Math.max(max, item.columnOrder)
    }
  }
  return max + 1
}

/** Swap a catalog item one step left (−1) or right (+1) in column order. */
export function nudgeColumnOrder<T extends { id: string; columnOrder?: number }>(
  items: T[],
  id: string,
  delta: -1 | 1,
  sortKey: (item: T) => number,
): T[] {
  const sorted = [...items].sort((a, b) => sortKey(a) - sortKey(b) || a.id.localeCompare(b.id))
  const idx = sorted.findIndex((i) => i.id === id)
  const targetIdx = idx + delta
  if (idx < 0 || targetIdx < 0 || targetIdx >= sorted.length) return items
  const reordered = [...sorted]
  const [item] = reordered.splice(idx, 1)
  reordered.splice(targetIdx, 0, item)
  return items.map((entry) => {
    const pos = reordered.findIndex((r) => r.id === entry.id)
    return pos >= 0 ? { ...entry, columnOrder: pos + 1 } : entry
  })
}

export function assignMissingColumnOrders<T extends { id: string; columnOrder?: number }>(
  items: T[],
  fallbackSort: (a: T, b: T) => number,
): T[] {
  if (items.every((i) => typeof i.columnOrder === 'number' && Number.isFinite(i.columnOrder))) {
    return items
  }
  const sorted = [...items].sort(fallbackSort)
  return items.map((item) => {
    if (typeof item.columnOrder === 'number' && Number.isFinite(item.columnOrder)) return item
    const pos = sorted.findIndex((s) => s.id === item.id)
    return { ...item, columnOrder: pos >= 0 ? pos + 1 : sorted.length + 1 }
  })
}

export function forumsToColumns(forums: KpiCascadeForum[]): CascadeBoardColumn[] {
  return forums.map((f) => ({ id: f.id, label: f.name }))
}

export function levelsToColumns(levels: KpiCascadeLevel[]): CascadeBoardColumn[] {
  return levels.map((l) => ({
    id: l.id,
    label: l.name || `Level ${l.code ?? '—'}`,
  }))
}

/** Visible forum columns: all active forums when filter empty, else selected ids. */
export function visibleForumColumns(
  forums: KpiCascadeForum[],
  filterForumIds: string[],
): CascadeBoardColumn[] {
  const active = sortedActiveForums(forums)
  if (filterForumIds.length === 0) return forumsToColumns(active)
  const idSet = new Set(filterForumIds)
  return forumsToColumns(active.filter((f) => idSet.has(f.id)))
}

export function kpiLabel(kpiId: string, kpis: KpiCascadeKpi[]): string {
  return kpis.find((k) => k.id === kpiId)?.name ?? 'Unknown KPI'
}

export function kpiMeasure(kpiId: string, kpis: KpiCascadeKpi[]): string {
  return kpis.find((k) => k.id === kpiId)?.measure ?? ''
}

export function variancePct(budget: number, fact: number): number | null {
  if (!budget) return null
  return ((fact - budget) / budget) * 100
}

/** Thousands-separated numbers like the reference UI (1 511 / 1 425). */
export function formatCascadeNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const maxFrac = abs >= 100 ? 0 : abs >= 10 ? 1 : 2
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: maxFrac,
    minimumFractionDigits: 0,
  })
    .format(value)
    .replace(/,/g, ' ')
}

export function formatBudgetFactLine(budget: number, fact: number): string {
  return `${formatCascadeNumber(fact)} / ${formatCascadeNumber(budget)}`
}

export function formatImpactLine(
  metric: CascadeMetric,
  kpis: KpiCascadeKpi[],
): string {
  if (metric.impactNote?.trim()) return metric.impactNote.trim()
  const pct = variancePct(metric.budget, metric.fact)
  if (pct === null) return ''
  const measure = kpiMeasure(metric.kpiId, kpis)
  const suffix = measure ? ` ${measure}` : ''
  const label = pct >= 0 ? 'Gain' : 'Loss'
  return `${label}${suffix} ${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`
}

export function isMetricGain(budget: number, fact: number): boolean | null {
  if (!Number.isFinite(budget) || !Number.isFinite(fact)) return null
  if (budget === fact) return null
  return fact > budget
}

export function levelIndex(levelId: string, orderedLevels: KpiCascadeLevel[]): number {
  return orderedLevels.findIndex((l) => l.id === levelId)
}

export function pruneInvalidLinks(
  metrics: CascadeMetric[],
  links: CascadeLink[],
  orderedLevels: KpiCascadeLevel[],
): CascadeLink[] {
  return links.filter((l) => {
    const from = metrics.find((m) => m.id === l.fromMetricId)
    const to = metrics.find((m) => m.id === l.toMetricId)
    if (!from || !to) return false
    return canLinkMetrics(from, to, orderedLevels)
  })
}

export function canLinkMetrics(
  from: CascadeMetric,
  to: CascadeMetric,
  orderedLevels: KpiCascadeLevel[],
): boolean {
  if (from.id === to.id) return false
  if (from.kind !== 'primary') return false
  const fromIdx = levelIndex(from.levelId, orderedLevels)
  const toIdx = levelIndex(to.levelId, orderedLevels)
  // Flow direction for the builder: right column -> left column.
  return fromIdx >= 0 && toIdx >= 0 && toIdx < fromIdx
}

export function forumLabel(forumId: string, forums: KpiCascadeForum[]): string {
  return forums.find((f) => f.id === forumId)?.name ?? 'Unknown forum'
}

export function pruneInvalidForumLinks(
  metrics: CascadeForumMetric[],
  links: CascadeLink[],
  orderedLevels: KpiCascadeLevel[],
): CascadeLink[] {
  return links.filter((l) => {
    const from = metrics.find((m) => m.id === l.fromMetricId)
    const to = metrics.find((m) => m.id === l.toMetricId)
    if (!from || !to) return false
    return canLinkForumMetrics(from, to, orderedLevels)
  })
}

export function canLinkForumMetrics(
  from: CascadeForumMetric,
  to: CascadeForumMetric,
  orderedLevels: KpiCascadeLevel[],
): boolean {
  if (from.id === to.id) return false
  if (from.kind !== 'primary') return false
  const fromIdx = levelIndex(from.levelId, orderedLevels)
  const toIdx = levelIndex(to.levelId, orderedLevels)
  return fromIdx >= 0 && toIdx >= 0 && toIdx < fromIdx
}

export function kpiCatalogForumIds(kpi: KpiCascadeKpi): string[] {
  return kpi.forumIds?.filter(Boolean) ?? []
}

export function kpiMatchesForumFilter(
  kpiId: string,
  forumSet: Set<string>,
  kpis: KpiCascadeKpi[],
): boolean {
  if (forumSet.size === 0) return true
  const kpi = kpis.find((k) => k.id === kpiId)
  if (!kpi) return false
  const ids = kpiCatalogForumIds(kpi)
  if (ids.length === 0) return false
  return ids.some((fid) => forumSet.has(fid))
}

/** KPI Cascade metric ids for Forum Cascade filters (catalog KPI + optional link expansion). */
export function forumCascadeOverlayMetricIds(
  cascadeMetrics: CascadeMetric[],
  selectedKpiIds: string[],
  activeLevelIds: Set<string>,
  onlyConnected: boolean,
  links: CascadeLink[],
): { closure: Set<string>; focus: Set<string> } {
  if (selectedKpiIds.length === 0) {
    return { closure: new Set(), focus: new Set() }
  }
  const kpiSet = new Set(selectedKpiIds)
  const seedIds = cascadeMetrics
    .filter((m) => activeLevelIds.has(m.levelId) && kpiSet.has(m.kpiId))
    .map((m) => m.id)
  const focus = new Set(seedIds)
  const closure = onlyConnected
    ? collectTransitiveLinkedMetricIds(seedIds, links)
    : focus
  return { closure, focus }
}

/** Undirected transitive closure of KPI cascade metric links. */
export function collectTransitiveLinkedMetricIds(
  seedIds: string[],
  links: CascadeLink[],
): Set<string> {
  const result = new Set<string>()
  const queue = [...seedIds]
  while (queue.length > 0) {
    const id = queue.pop()!
    if (result.has(id)) continue
    result.add(id)
    for (const l of links) {
      if (l.fromMetricId === id && !result.has(l.toMetricId)) queue.push(l.toMetricId)
      if (l.toMetricId === id && !result.has(l.fromMetricId)) queue.push(l.fromMetricId)
    }
  }
  return result
}

export function cascadeMetricMatchesForum(
  metric: CascadeMetric,
  forumId: string,
  workspace: KpiCascadeWorkspace,
): boolean {
  const kpi = workspace.kpis.find((k) => k.id === metric.kpiId)
  if (!kpi) return false
  const linked = kpiCatalogForumIds(kpi)
  if (linked.length > 0) return linked.includes(forumId)
  const level = workspace.levels.find((l) => l.id === metric.levelId)
  return level?.forumIds?.includes(forumId) ?? false
}

export function buildKpiOverlaysForForumBox(
  forumId: string,
  levelId: string,
  closureMetricIds: Set<string>,
  focusMetricIds: Set<string>,
  cascadeMetrics: CascadeMetric[],
  workspace: KpiCascadeWorkspace,
): CascadeKpiOverlayItem[] {
  const levelLabel =
    workspace.levels.find((l) => l.id === levelId)?.name ?? 'Level'
  const items: CascadeKpiOverlayItem[] = []
  for (const m of cascadeMetrics) {
    if (!closureMetricIds.has(m.id)) continue
    if (!cascadeMetricMatchesForum(m, forumId, workspace)) continue
    const kpi = workspace.kpis.find((k) => k.id === m.kpiId)
    items.push({
      metricId: m.id,
      kpiId: m.kpiId,
      label: `${levelLabel} · ${kpi?.name ?? 'KPI'}`,
      measure: kpi?.measure ?? '',
      budget: m.budget,
      fact: m.fact,
      isFocus: focusMetricIds.has(m.id),
    })
  }
  items.sort((a, b) => {
    if (a.isFocus !== b.isFocus) return a.isFocus ? -1 : 1
    return a.label.localeCompare(b.label)
  })
  return items
}

function metricMatchesCascadeFilters(
  m: CascadeMetric,
  levelSet: Set<string>,
  kpiSet: Set<string> | null,
  forumSet: Set<string>,
  searchQuery: string,
  kpis: KpiCascadeKpi[],
): boolean {
  if (!levelSet.has(m.levelId)) return false
  if (kpiSet && !kpiSet.has(m.kpiId)) return false
  if (!kpiMatchesForumFilter(m.kpiId, forumSet, kpis)) return false
  const q = searchQuery.trim().toLowerCase()
  if (q) {
    const name = kpiLabel(m.kpiId, kpis).toLowerCase()
    if (!name.includes(q)) return false
  }
  return true
}

export function filterMetrics(
  metrics: CascadeMetric[],
  filters: CascadeViewFilters,
  workspace: KpiCascadeWorkspace,
  links: CascadeLink[],
): CascadeMetric[] {
  const ordered = sortedActiveLevels(workspace.levels)
  const levelSet =
    filters.levelIds.length > 0
      ? new Set(filters.levelIds)
      : new Set(ordered.map((l) => l.id))

  const forumSet = new Set(filters.forumIds)
  const kpiSet = filters.kpiIds.length > 0 ? new Set(filters.kpiIds) : null

  const inScope = (m: CascadeMetric) => levelSet.has(m.levelId)

  const selected = metrics.filter((m) =>
    metricMatchesCascadeFilters(m, levelSet, kpiSet, forumSet, filters.searchQuery, workspace.kpis),
  )

  if (!filters.onlyConnected || links.length === 0) {
    return selected
  }

  const seedIds = selected.map((m) => m.id)
  if (seedIds.length === 0) {
    const linkedIds = new Set<string>()
    for (const l of links) {
      linkedIds.add(l.fromMetricId)
      linkedIds.add(l.toMetricId)
    }
    return metrics.filter((m) => inScope(m) && linkedIds.has(m.id))
  }

  const closure = collectTransitiveLinkedMetricIds(seedIds, links)
  return metrics.filter((m) => inScope(m) && closure.has(m.id))
}

export function filterLinksToMetrics(links: CascadeLink[], visibleIds: Set<string>): CascadeLink[] {
  return links.filter((l) => visibleIds.has(l.fromMetricId) && visibleIds.has(l.toMetricId))
}

export function metricsForLevel(metrics: CascadeMetric[], levelId: string): CascadeMetric[] {
  return metrics
    .filter((m) => m.levelId === levelId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function normalizeBoardRow(row: unknown): number {
  if (typeof row !== 'number' || !Number.isFinite(row)) return 1
  return Math.max(1, Math.floor(row))
}

export function kpiBoardRow(kpi: KpiCascadeKpi, levelId: string): number {
  const override = kpi.boardRowsByLevel?.[levelId]
  if (typeof override === 'number') return normalizeBoardRow(override)
  return normalizeBoardRow(kpi.boardRow)
}

export function boardRowForGroup(
  group: CascadeMetricGroup,
  metrics: CascadeMetric[],
  kpis: KpiCascadeKpi[],
): number {
  if (typeof group.boardRow === 'number') return normalizeBoardRow(group.boardRow)
  const metric = metrics
    .filter((m) => m.groupId === group.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0]
  if (!metric) return 1
  const kpi = kpis.find((k) => k.id === metric.kpiId)
  if (!kpi) return 1
  return kpiBoardRow(kpi, group.levelId)
}

/** Minimum row slots shown in every level column (aligned across the board). */
export const CASCADE_BOARD_MIN_SLOTS = 12

/** Fixed height for each board row slot (empty placeholders and drop targets). */
export const CASCADE_BOARD_SLOT_HEIGHT = '4.5rem'

/** Min width for each horizontal KPI slot on forum row boards. */
export const CASCADE_BOARD_SLOT_WIDTH = '9rem'

export function cascadeBoardSlotCount(
  groups: CascadeMetricGroup[],
  metrics: CascadeMetric[],
  kpis: KpiCascadeKpi[],
): number {
  let max = CASCADE_BOARD_MIN_SLOTS
  for (const g of groups) {
    max = Math.max(max, boardRowForGroup(g, metrics, kpis))
  }
  return max
}

/** Fill missing boardRow from KPI catalog; keeps manually placed rows. */
export function syncCascadeGroupBoardRows(
  groups: CascadeMetricGroup[],
  metrics: CascadeMetric[],
  kpis: KpiCascadeKpi[],
): CascadeMetricGroup[] {
  return groups.map((g) => {
    if (typeof g.boardRow === 'number') return g
    const row = boardRowForGroup({ ...g, boardRow: undefined }, metrics, kpis)
    return { ...g, boardRow: row }
  })
}

/** Push catalog line settings onto all board groups (Admin save). */
export function applyCatalogBoardRowsToGroups(
  groups: CascadeMetricGroup[],
  metrics: CascadeMetric[],
  kpis: KpiCascadeKpi[],
): CascadeMetricGroup[] {
  return groups.map((g) => {
    const row = boardRowForGroup({ ...g, boardRow: undefined }, metrics, kpis)
    return g.boardRow === row ? g : { ...g, boardRow: row }
  })
}

export function groupsForLevel(groups: CascadeMetricGroup[], levelId: string): CascadeMetricGroup[] {
  return groups
    .filter((g) => g.levelId === levelId)
    .sort((a, b) => (a.boardRow ?? 1) - (b.boardRow ?? 1) || a.sortOrder - b.sortOrder)
}

export function metricsInGroup<T extends { groupId: string; sortOrder: number }>(
  metrics: T[],
  groupId: string,
): T[] {
  return metrics.filter((m) => m.groupId === groupId).sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Drop groups with no metrics (internal combine containers only). */
export function pruneEmptyGroups(
  groups: CascadeMetricGroup[],
  metrics: CascadeMetric[],
): CascadeMetricGroup[] {
  const used = new Set(metrics.map((m) => m.groupId))
  return groups.filter((g) => used.has(g.id))
}

export function groupsWithMetrics(
  groups: CascadeMetricGroup[],
  metrics: CascadeMetric[],
  levelId: string,
): CascadeMetricGroup[] {
  return groupsForLevel(groups, levelId).filter((g) => metricsInGroup(metrics, g.id).length > 0)
}

export function forumBoardRow(forum: KpiCascadeForum, levelId: string): number {
  const override = forum.boardRowsByLevel?.[levelId]
  if (typeof override === 'number') return normalizeBoardRow(override)
  return normalizeBoardRow(forum.boardRow)
}

export function boardRowForForumGroup(
  group: CascadeForumMetricGroup,
  metrics: CascadeForumMetric[],
  forums: KpiCascadeForum[],
): number {
  if (typeof group.boardRow === 'number') return normalizeBoardRow(group.boardRow)
  const metric = metrics
    .filter((m) => m.groupId === group.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0]
  if (!metric) return 1
  const forum = forums.find((f) => f.id === metric.forumId)
  if (!forum) return 1
  return forumBoardRow(forum, group.levelId)
}

export function forumCascadeBoardSlotCount(
  groups: CascadeForumMetricGroup[],
  metrics: CascadeForumMetric[],
  forums: KpiCascadeForum[],
): number {
  let max = CASCADE_BOARD_MIN_SLOTS
  for (const g of groups) {
    max = Math.max(max, boardRowForForumGroup(g, metrics, forums))
  }
  return max
}

export function syncForumCascadeGroupBoardRows(
  groups: CascadeForumMetricGroup[],
  metrics: CascadeForumMetric[],
  forums: KpiCascadeForum[],
): CascadeForumMetricGroup[] {
  return groups.map((g) => {
    if (typeof g.boardRow === 'number') return g
    const row = boardRowForForumGroup({ ...g, boardRow: undefined }, metrics, forums)
    return { ...g, boardRow: row }
  })
}

export function forumGroupsWithMetrics(
  groups: CascadeForumMetricGroup[],
  metrics: CascadeForumMetric[],
  levelId: string,
): CascadeForumMetricGroup[] {
  return groups
    .filter((g) => g.levelId === levelId)
    .sort((a, b) => (a.boardRow ?? 1) - (b.boardRow ?? 1) || a.sortOrder - b.sortOrder)
    .filter((g) => metricsInGroup(metrics, g.id).length > 0)
}

export function pruneEmptyForumGroups(
  groups: CascadeForumMetricGroup[],
  metrics: CascadeForumMetric[],
): CascadeForumMetricGroup[] {
  const used = new Set(metrics.map((m) => m.groupId))
  return groups.filter((g) => used.has(g.id))
}

export function connectedMetricIds(links: CascadeLink[]): Set<string> {
  const ids = new Set<string>()
  for (const l of links) {
    ids.add(l.fromMetricId)
    ids.add(l.toMetricId)
  }
  return ids
}

export function ensureCascade(
  state: CascadeBuilderState | undefined,
  ws: KpiCascadeWorkspace,
): CascadeBuilderState {
  const hasContent =
    (state?.metrics?.length ?? 0) > 0 ||
    (state?.links?.length ?? 0) > 0 ||
    (state?.groups?.length ?? 0) > 0
  if (!hasContent) return emptyCascadeBuilder()
  return finalizeCascadeState(state ?? {}, ws)
}

/** Drop board metrics/links that reference removed or inactive catalog entries. */
export function reconcileCascadeWithCatalogs(ws: KpiCascadeWorkspace): KpiCascadeWorkspace {
  const activeLevelIds = new Set(ws.levels.filter((l) => l.active).map((l) => l.id))
  const activeForumIds = new Set(ws.forums.filter((f) => f.active).map((f) => f.id))
  const activeKpiIds = new Set(ws.kpis.filter((k) => k.active).map((k) => k.id))
  const metrics = ws.cascade.metrics.filter(
    (m) => activeLevelIds.has(m.levelId) && activeKpiIds.has(m.kpiId),
  )
  const orderedLevels = sortedActiveLevels(ws.levels)
  const links = pruneInvalidLinks(metrics, ws.cascade.links, orderedLevels)
  const groups = pruneEmptyGroups(ws.cascade.groups, metrics)

  const forumMetrics = ws.forumCascade.metrics.filter(
    (m) => activeLevelIds.has(m.levelId) && activeForumIds.has(m.forumId),
  )
  const forumLinks = pruneInvalidForumLinks(forumMetrics, ws.forumCascade.links, orderedLevels)
  const forumGroups = pruneEmptyForumGroups(ws.forumCascade.groups, forumMetrics)

  return {
    ...ws,
    cascade: { ...ws.cascade, metrics, links, groups },
    forumCascade: { ...ws.forumCascade, metrics: forumMetrics, links: forumLinks, groups: forumGroups },
  }
}
