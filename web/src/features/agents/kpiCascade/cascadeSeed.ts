import { finalizeCascadeState } from './cascadeMigrate'
import {
  DEFAULT_CASCADE_FILTERS,
  defaultCascadeScope,
  type CascadeBuilderState,
  type CascadeLink,
  type CascadeMetric,
  type CascadeMetricGroup,
} from './cascadeTypes'
import type { KpiCascadeWorkspace } from './types'

function mid() {
  return `cm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function gid() {
  return `cg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function lid() {
  return `cl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function group(levelId: string, title: string, sortOrder = 0, boardRow = 1): CascadeMetricGroup {
  return { id: gid(), levelId, title, collapsed: false, sortOrder, boardRow }
}

function metric(
  levelId: string,
  groupId: string,
  kpiId: string,
  kind: CascadeMetric['kind'],
  budget: number,
  fact: number,
  impactNote?: string,
  sortOrder = 0,
): CascadeMetric {
  return { id: mid(), levelId, groupId, kpiId, kind, budget, fact, impactNote, sortOrder }
}

function link(fromMetricId: string, toMetricId: string): CascadeLink {
  return { id: lid(), fromMetricId, toMetricId }
}

/** Demo cascade aligned with admin seed KPIs / levels */
export function buildCascadeDemoSeed(ws: KpiCascadeWorkspace): CascadeBuilderState {
  const level = (code: string) => ws.levels.find((l) => l.code === code && l.active)
  const kpi = (name: string) => ws.kpis.find((k) => k.name === name && k.active)

  const l1 = level('1')
  const l2 = level('2')
  const l3 = level('3')
  const l4 = level('4')
  const l5 = level('5')
  const volume = kpi('Volume')
  const oee = kpi('OEE')
  const rate = kpi('Rate')
  const unds = kpi('UnDS')
  const pdt = kpi('PDT')
  const stops = kpi('Stops')
  const bd = kpi('BD')

  if (!l1 || !l2 || !l3 || !volume || !oee) {
    return finalizeCascadeState(
      { scope: defaultCascadeScope(), groups: [], metrics: [], links: [], filters: { ...DEFAULT_CASCADE_FILTERS } },
      ws,
    )
  }

  const g1 = group(l1.id, 'Output')
  const g2a = group(l2.id, 'Mill performance', 0)
  const g2b = group(l2.id, 'Loss tree context', 1)
  const g3 = group(l3.id, 'Downtime drivers', 0)

  const mVol = metric(l1.id, g1.id, volume.id, 'primary', 1425, 1511, 'Gain +86 units', 0)
  const mOee = metric(l2.id, g2a.id, oee.id, 'primary', 82, 79, 'Loss -3 pts', 0)
  const mRate = rate ? metric(l2.id, g2a.id, rate.id, 'primary', 100, 94, 'Loss -6%', 1) : null
  const mUnds = unds ? metric(l2.id, g2b.id, unds.id, 'secondary', 41.74, 54.76, 'Loss -13 min', 0) : null

  const metrics: CascadeMetric[] = [mVol, mOee]
  const groups: CascadeMetricGroup[] = [g1, g2a, g2b]
  if (mRate) metrics.push(mRate)
  if (mUnds) metrics.push(mUnds)

  const links: CascadeLink[] = []

  if (l3 && pdt && stops) {
    groups.push(g3)
    const mPdt = metric(l3.id, g3.id, pdt.id, 'primary', 120, 145, 'Loss -25 min', 0)
    const mStops = metric(l3.id, g3.id, stops.id, 'primary', 8, 12, 'Loss -4 stops', 1)
    const mBd = bd ? metric(l3.id, g3.id, bd.id, 'secondary', 20, 18, 'Gain +2 min', 2) : null
    metrics.push(mPdt, mStops)
    if (mBd) metrics.push(mBd)
    links.push(link(mOee.id, mPdt.id), link(mOee.id, mStops.id))
    if (mRate) links.push(link(mRate.id, mStops.id))
  }

  if (l4 && unds) {
    const g4 = group(l4.id, 'Line losses', 0)
    groups.push(g4)
    const mUnds4 = metric(l4.id, g4.id, unds.id, 'primary', 30, 38, 'Loss -8 min', 0)
    metrics.push(mUnds4)
    links.push(link(mOee.id, mUnds4.id))
  }

  if (l5 && oee) {
    const g5 = group(l5.id, 'Site context', 0)
    groups.push(g5)
    metrics.push(metric(l5.id, g5.id, oee.id, 'secondary', 75, 72, 'Context only', 0))
  }

  return finalizeCascadeState(
    {
      scope: defaultCascadeScope(),
      groups,
      metrics,
      links,
      filters: { ...DEFAULT_CASCADE_FILTERS },
    },
    ws,
  )
}
