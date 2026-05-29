export type KpiCascadeCatalogKey = 'roles' | 'forums' | 'levels' | 'kpis'

export type KpiCascadeAdminTab = KpiCascadeCatalogKey

type CatalogBase = {
  id: string
  name: string
  active: boolean
}

export type KpiCascadeRole = CatalogBase & {
  description?: string
}

export type KpiCascadeForum = CatalogBase & {
  description?: string
  /** Left-to-right column position on the forum cascade board (1 = leftmost) */
  columnOrder?: number
  /** Default 1-based board line when no per-level override */
  boardRow?: number
  /** Per-level board line overrides (level id → row) */
  boardRowsByLevel?: Record<string, number>
}

export type KpiCascadeLevel = CatalogBase & {
  /** Numeric or shorthand label (e.g. 1–5) */
  code?: string
  /** Forums this level belongs to */
  forumIds?: string[]
  /** Left-to-right column position on the level cascade board (overrides code when set) */
  columnOrder?: number
}

export type KpiCascadeKpi = CatalogBase & {
  measure?: string
  /** Forums where this KPI is discussed (Admin → KPIs). */
  forumIds?: string[]
  /** Optional explicit link to `dds_kpis.id` for live sync */
  ddsKpiId?: string
  /** Default 1-based board line when no per-level override */
  boardRow?: number
  /** Per-level board line overrides (level id → row) */
  boardRowsByLevel?: Record<string, number>
}

import type { CascadeBuilderState, CascadeForumBuilderState } from './cascadeTypes'

export type KpiCascadeWorkspace = {
  version: 1
  roles: KpiCascadeRole[]
  forums: KpiCascadeForum[]
  levels: KpiCascadeLevel[]
  kpis: KpiCascadeKpi[]
  cascade: CascadeBuilderState
  forumCascade: CascadeForumBuilderState
}

export type KpiCascadePageTab = 'admin' | 'cascade' | 'forum-cascade'
