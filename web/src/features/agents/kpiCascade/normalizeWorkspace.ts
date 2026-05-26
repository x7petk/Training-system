import {
  defaultCascadeScope,
  type CascadeAnalysisPeriod,
  type CascadeBuilderState,
  type CascadeLink,
  type CascadeForumBuilderState,
  type CascadeForumMetric,
  type CascadeForumMetricGroup,
  type CascadeMetric,
  type CascadeMetricGroup,
  type CascadeScope,
} from './cascadeTypes'
import { assignMissingColumnOrders } from './cascadeUtils'
import { emptyCascadeBuilder, emptyForumCascadeBuilder, finalizeCascadeState, finalizeForumCascadeState } from './cascadeMigrate'
import { KPI_CASCADE_SEED } from './seed'
import type {
  KpiCascadeForum,
  KpiCascadeKpi,
  KpiCascadeLevel,
  KpiCascadeRole,
  KpiCascadeWorkspace,
} from './types'

function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
}

function migrateRole(raw: unknown): KpiCascadeRole | null {
  const r = asRecord(raw)
  if (!r || typeof r.id !== 'string' || typeof r.name !== 'string') return null
  return {
    id: r.id,
    name: r.name,
    active: r.active !== false,
    description: typeof r.description === 'string' ? r.description : undefined,
  }
}

function migrateForum(raw: unknown): KpiCascadeForum | null {
  const r = asRecord(raw)
  if (!r || typeof r.id !== 'string' || typeof r.name !== 'string') return null
  return {
    id: r.id,
    name: r.name,
    active: r.active !== false,
    description: typeof r.description === 'string' ? r.description : undefined,
    columnOrder:
      typeof r.columnOrder === 'number' && Number.isFinite(r.columnOrder)
        ? Math.max(1, Math.floor(r.columnOrder))
        : undefined,
    boardRow: typeof r.boardRow === 'number' ? Math.max(1, Math.floor(r.boardRow)) : undefined,
    boardRowsByLevel: migrateBoardRowsByLevel(r.boardRowsByLevel),
  }
}

function levelForLegacyForumColumn(forumColumnId: string, levels: KpiCascadeLevel[]): string | null {
  const linked = levels.find((l) => l.forumIds?.includes(forumColumnId))
  if (linked) return linked.id
  return levels[0]?.id ?? null
}

function migrateLevelForumIds(r: Record<string, unknown>): string[] | undefined {
  if (Array.isArray(r.forumIds)) {
    const ids = r.forumIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    return ids.length ? ids : undefined
  }
  if (typeof r.forumId === 'string' && r.forumId) return [r.forumId]
  return undefined
}

function migrateLevel(raw: unknown): KpiCascadeLevel | null {
  const r = asRecord(raw)
  if (!r || typeof r.id !== 'string' || typeof r.name !== 'string') return null
  return {
    id: r.id,
    name: r.name,
    active: r.active !== false,
    code: typeof r.code === 'string' ? r.code : undefined,
    forumIds: migrateLevelForumIds(r),
    columnOrder:
      typeof r.columnOrder === 'number' && Number.isFinite(r.columnOrder)
        ? Math.max(1, Math.floor(r.columnOrder))
        : undefined,
  }
}

function migrateBoardRowsByLevel(raw: unknown): Record<string, number> | undefined {
  const r = asRecord(raw)
  if (!r) return undefined
  const out: Record<string, number> = {}
  for (const [levelId, row] of Object.entries(r)) {
    if (typeof row === 'number' && Number.isFinite(row)) {
      out[levelId] = Math.max(1, Math.floor(row))
    }
  }
  return Object.keys(out).length ? out : undefined
}

function migrateKpi(raw: unknown): KpiCascadeKpi | null {
  const r = asRecord(raw)
  if (!r || typeof r.id !== 'string' || typeof r.name !== 'string') return null
  return {
    id: r.id,
    name: r.name,
    active: r.active !== false,
    measure:
      typeof r.measure === 'string'
        ? r.measure
        : typeof r.code === 'string'
          ? r.code
          : undefined,
    ddsKpiId: typeof r.ddsKpiId === 'string' ? r.ddsKpiId : undefined,
    boardRow: typeof r.boardRow === 'number' ? Math.max(1, Math.floor(r.boardRow)) : undefined,
    boardRowsByLevel: migrateBoardRowsByLevel(r.boardRowsByLevel),
  }
}

function migrateList<T>(raw: unknown, migrate: (item: unknown) => T | null): T[] {
  if (!Array.isArray(raw)) return []
  return raw.map(migrate).filter((x): x is T => x !== null)
}

function migratePeriod(raw: unknown): CascadeAnalysisPeriod {
  return raw === 'day' || raw === 'month' ? raw : 'week'
}

function migrateScope(raw: unknown): CascadeScope {
  const r = asRecord(raw)
  const base = defaultCascadeScope()
  if (!r) return base
  return {
    product: typeof r.product === 'string' ? r.product : base.product,
    enterprise: typeof r.enterprise === 'string' ? r.enterprise : base.enterprise,
    workshop: typeof r.workshop === 'string' ? r.workshop : base.workshop,
    area: typeof r.area === 'string' ? r.area : base.area,
    unit: typeof r.unit === 'string' ? r.unit : base.unit,
    analysisPeriod: migratePeriod(r.analysisPeriod),
    periodicity: migratePeriod(r.periodicity),
    dateFrom: typeof r.dateFrom === 'string' ? r.dateFrom : base.dateFrom,
    dateTo: typeof r.dateTo === 'string' ? r.dateTo : base.dateTo,
  }
}

function migrateGroup(raw: unknown): CascadeMetricGroup | null {
  const r = asRecord(raw)
  if (!r || typeof r.id !== 'string' || typeof r.levelId !== 'string') return null
  return {
    id: r.id,
    levelId: r.levelId,
    title: typeof r.title === 'string' ? r.title : 'Card',
    collapsed: r.collapsed === true,
    sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : 0,
    boardRow: typeof r.boardRow === 'number' ? Math.max(1, Math.floor(r.boardRow)) : undefined,
  }
}

function migrateMetric(raw: unknown): CascadeMetric | null {
  const r = asRecord(raw)
  if (!r || typeof r.id !== 'string' || typeof r.levelId !== 'string' || typeof r.kpiId !== 'string') {
    return null
  }
  const kind = r.kind === 'secondary' ? 'secondary' : 'primary'
  return {
    id: r.id,
    levelId: r.levelId,
    groupId: typeof r.groupId === 'string' ? r.groupId : '',
    kpiId: r.kpiId,
    kind,
    budget: typeof r.budget === 'number' ? r.budget : 0,
    fact: typeof r.fact === 'number' ? r.fact : 0,
    impactNote: typeof r.impactNote === 'string' ? r.impactNote : undefined,
    sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : 0,
    ddsKpiId: typeof r.ddsKpiId === 'string' ? r.ddsKpiId : undefined,
  }
}

function migrateLink(raw: unknown): CascadeLink | null {
  const r = asRecord(raw)
  if (!r || typeof r.id !== 'string' || typeof r.fromMetricId !== 'string' || typeof r.toMetricId !== 'string') {
    return null
  }
  return { id: r.id, fromMetricId: r.fromMetricId, toMetricId: r.toMetricId }
}

function migrateCascade(raw: unknown): Partial<CascadeBuilderState> | undefined {
  const c = asRecord(raw)
  if (!c) return undefined
  const f = asRecord(c.filters)
  return {
    scope: migrateScope(c.scope),
    groups: migrateList(c.groups, migrateGroup),
    metrics: migrateList(c.metrics, migrateMetric),
    links: migrateList(c.links, migrateLink),
    filters: {
      levelIds: Array.isArray(f?.levelIds) ? f.levelIds.filter((x): x is string => typeof x === 'string') : [],
      kpiIds: Array.isArray(f?.kpiIds) ? f.kpiIds.filter((x): x is string => typeof x === 'string') : [],
      forumIds: Array.isArray(f?.forumIds) ? f.forumIds.filter((x): x is string => typeof x === 'string') : [],
      onlyConnected: f?.onlyConnected === true,
      searchQuery: typeof f?.searchQuery === 'string' ? f.searchQuery : '',
    },
  }
}

function migrateForumGroup(raw: unknown, levels: KpiCascadeLevel[]): CascadeForumMetricGroup | null {
  const r = asRecord(raw)
  if (!r || typeof r.id !== 'string') return null
  const levelId =
    typeof r.levelId === 'string'
      ? r.levelId
      : typeof r.forumId === 'string'
        ? levelForLegacyForumColumn(r.forumId, levels)
        : null
  if (!levelId) return null
  return {
    id: r.id,
    levelId,
    title: typeof r.title === 'string' ? r.title : 'Card',
    collapsed: r.collapsed === true,
    sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : 0,
    boardRow: typeof r.boardRow === 'number' ? Math.max(1, Math.floor(r.boardRow)) : undefined,
  }
}

function migrateForumMetric(raw: unknown, levels: KpiCascadeLevel[]): CascadeForumMetric | null {
  const r = asRecord(raw)
  if (!r || typeof r.id !== 'string') return null

  const kind = r.kind === 'secondary' ? 'secondary' : 'primary'

  if (typeof r.levelId === 'string' && typeof r.forumId === 'string') {
    return {
      id: r.id,
      levelId: r.levelId,
      groupId: typeof r.groupId === 'string' ? r.groupId : '',
      forumId: r.forumId,
      kind,
      budget: typeof r.budget === 'number' ? r.budget : 0,
      fact: typeof r.fact === 'number' ? r.fact : 0,
      impactNote: typeof r.impactNote === 'string' ? r.impactNote : undefined,
      sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : 0,
    }
  }

  if (typeof r.forumId === 'string') {
    const levelId = levelForLegacyForumColumn(r.forumId, levels)
    if (!levelId) return null
    return {
      id: r.id,
      levelId,
      groupId: typeof r.groupId === 'string' ? r.groupId : '',
      forumId: r.forumId,
      kind,
      budget: typeof r.budget === 'number' ? r.budget : 0,
      fact: typeof r.fact === 'number' ? r.fact : 0,
      impactNote: typeof r.impactNote === 'string' ? r.impactNote : undefined,
      sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : 0,
    }
  }

  return null
}

function migrateForumCascade(
  raw: unknown,
  levels: KpiCascadeLevel[],
): Partial<CascadeForumBuilderState> | undefined {
  const c = asRecord(raw)
  if (!c) return undefined
  const f = asRecord(c.filters)
  return {
    scope: migrateScope(c.scope),
    groups: migrateList(c.groups, (item) => migrateForumGroup(item, levels)),
    metrics: migrateList(c.metrics, (item) => migrateForumMetric(item, levels)),
    links: migrateList(c.links, migrateLink),
    filters: {
      levelIds: Array.isArray(f?.levelIds) ? f.levelIds.filter((x): x is string => typeof x === 'string') : [],
      kpiIds: Array.isArray(f?.kpiIds) ? f.kpiIds.filter((x): x is string => typeof x === 'string') : [],
      forumIds: Array.isArray(f?.forumIds) ? f.forumIds.filter((x): x is string => typeof x === 'string') : [],
      onlyConnected: f?.onlyConnected === true,
      searchQuery: typeof f?.searchQuery === 'string' ? f.searchQuery : '',
    },
  }
}

function ensureCascade(partial: Partial<CascadeBuilderState> | undefined, ws: KpiCascadeWorkspace): CascadeBuilderState {
  const hasContent =
    (partial?.metrics?.length ?? 0) > 0 ||
    (partial?.links?.length ?? 0) > 0 ||
    (partial?.groups?.length ?? 0) > 0
  if (!hasContent) return emptyCascadeBuilder()
  return finalizeCascadeState(partial ?? {}, ws)
}

function ensureForumCascade(
  partial: Partial<CascadeForumBuilderState> | undefined,
  ws: KpiCascadeWorkspace,
): CascadeForumBuilderState {
  const hasContent =
    (partial?.metrics?.length ?? 0) > 0 ||
    (partial?.links?.length ?? 0) > 0 ||
    (partial?.groups?.length ?? 0) > 0
  if (!hasContent) return emptyForumCascadeBuilder()
  return finalizeForumCascadeState(partial ?? {}, ws)
}

export function normalizeWorkspace(raw: unknown): KpiCascadeWorkspace | null {
  const w = asRecord(raw)
  if (!w || w.version !== 1) return null

  const roles = migrateList(w.roles, migrateRole)
  const forums = assignMissingColumnOrders(migrateList(w.forums, migrateForum), (a, b) =>
    a.name.localeCompare(b.name),
  )
  const levels = assignMissingColumnOrders(migrateList(w.levels, migrateLevel), (a, b) => {
    const ac = Number(a.code)
    const bc = Number(b.code)
    if (Number.isFinite(ac) && Number.isFinite(bc)) return ac - bc
    return a.name.localeCompare(b.name)
  })
  const kpis = migrateList(w.kpis, migrateKpi)

  if (!roles.length && !forums.length && !levels.length && !kpis.length) return null

  const catalogs: KpiCascadeWorkspace = {
    version: 1,
    roles,
    forums,
    levels,
    kpis,
    cascade: emptyCascadeBuilder(),
    forumCascade: emptyForumCascadeBuilder(),
  }
  return {
    ...catalogs,
    cascade: ensureCascade(migrateCascade(w.cascade), catalogs),
    forumCascade: ensureForumCascade(migrateForumCascade(w.forumCascade, levels), catalogs),
  }
}

export function workspaceOrSeed(raw: unknown): KpiCascadeWorkspace {
  return normalizeWorkspace(raw) ?? structuredClone(KPI_CASCADE_SEED)
}
