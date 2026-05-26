import { buildCascadeDemoSeed } from './cascadeSeed'
import { emptyCascadeBuilder, emptyForumCascadeBuilder } from './cascadeMigrate'
import type {
  KpiCascadeForum,
  KpiCascadeKpi,
  KpiCascadeLevel,
  KpiCascadeRole,
  KpiCascadeWorkspace,
} from './types'

function id(prefix: string, name: string) {
  return `seed-${prefix}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function role(name: string, description = ''): KpiCascadeRole {
  return { id: id('role', name), name, description, active: true }
}

function forum(name: string, columnOrder: number, description = ''): KpiCascadeForum {
  return { id: id('forum', name), name, description, active: true, columnOrder }
}

function level(name: string, code: string, forumIds: string[]): KpiCascadeLevel {
  const codeNum = Number(code)
  return {
    id: id('level', name),
    name,
    code,
    forumIds,
    active: true,
    columnOrder: Number.isFinite(codeNum) ? codeNum : undefined,
  }
}

function kpi(name: string, measure = ''): KpiCascadeKpi {
  return { id: id('kpi', name), name, measure, active: true }
}

const forums = [
  forum('SWP', 1, 'Standard work process review'),
  forum('P2P', 2, 'Peer-to-peer problem solving'),
  forum('Shift DDS', 3, 'Shift daily direction setting'),
  forum('Line DDS', 4, 'Line daily direction setting'),
  forum('Plant DDS', 5, 'Plant daily direction setting'),
  forum('Site DDS', 6, 'Site daily direction setting'),
  forum('WDS', 7, 'Weekly direction setting'),
  forum('MDS', 8, 'Monthly direction setting'),
  forum('Site WDS', 9, 'Site weekly direction setting'),
  forum('Site MDS', 10, 'Site monthly direction setting'),
]

const forumIds = Object.fromEntries(forums.map((f) => [f.name, f.id])) as Record<string, string>

const KPI_CASCADE_CATALOGS = {
  roles: [
    role('Operator', 'Front-line execution and escalation'),
    role('Team Lead', 'Shift or team coordination'),
    role('Cell team', 'Cell-level ownership'),
    role('Plant Manager', 'Plant-wide performance'),
    role('Site manager', 'Site strategy and outcomes'),
    role('Support', 'Enabling functions (quality, maintenance, etc.)'),
  ],
  forums,
  levels: [
    level('Level 1', '1', [forumIds['Shift DDS']]),
    level('Level 2', '2', [forumIds['Line DDS']]),
    level('Level 3', '3', [forumIds['Plant DDS']]),
    level('Level 4', '4', [forumIds['Site DDS']]),
    level('Level 5', '5', [forumIds['Site MDS']]),
  ],
  kpis: [
    kpi('OEE', '%'),
    kpi('UnDS', 'min'),
    kpi('PDT', 'min'),
    kpi('Rate', 'units/hr'),
    kpi('Stops', 'count'),
    kpi('BD', 'min'),
    kpi('Volume', 'units'),
  ],
}

function buildKpiCascadeSeed(): KpiCascadeWorkspace {
  const base: KpiCascadeWorkspace = {
    version: 1,
    ...KPI_CASCADE_CATALOGS,
    cascade: emptyCascadeBuilder(),
    forumCascade: emptyForumCascadeBuilder(),
  }
  return {
    ...base,
    cascade: buildCascadeDemoSeed(base),
  }
}

/** Fill an empty KPI Cascade board with the demo tree (catalogs must already exist). */
export function hydrateKpiCascadeDemoIfEmpty(ws: KpiCascadeWorkspace): {
  workspace: KpiCascadeWorkspace
  changed: boolean
} {
  if ((ws.cascade.metrics?.length ?? 0) > 0) {
    return { workspace: ws, changed: false }
  }
  return { workspace: { ...ws, cascade: buildCascadeDemoSeed(ws) }, changed: true }
}

export const KPI_CASCADE_SEED: KpiCascadeWorkspace = buildKpiCascadeSeed()
