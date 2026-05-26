import { normalizeImportedMeta } from './flowDiagramExport'
import { migrateFlowToColumnLayout } from './flowLayout'
import { ensureWorkspaceFlows } from './processFlowTemplates'
import { SWP_SEED } from './seed'
import type { SwpFlowEdge, SwpFlowNode, SwpProcessFlow, SwpSystem, SwpWorkspace } from './types'
import { SWP_ROLE_KEY_ORDER } from './roleLaneTheme'
import type { SwpNodeKind, SwpRoleKey } from './types'

function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
}

function migrateSystem(raw: unknown): SwpSystem | null {
  const r = asRecord(raw)
  if (!r || typeof r.id !== 'string' || typeof r.name !== 'string') return null
  return {
    id: r.id,
    name: r.name,
    active: r.active !== false,
    description: typeof r.description === 'string' ? r.description : undefined,
  }
}

function migrateList<T>(raw: unknown, migrate: (item: unknown) => T | null): T[] {
  if (!Array.isArray(raw)) return []
  return raw.map(migrate).filter((x): x is T => x !== null)
}

function migrateNode(raw: unknown): SwpFlowNode | null {
  const r = asRecord(raw)
  if (!r || typeof r.id !== 'string' || typeof r.label !== 'string') return null
  const roleKey = typeof r.roleKey === 'string' ? r.roleKey : ''
  if (!SWP_ROLE_KEY_ORDER.includes(roleKey as SwpRoleKey)) return null
  const kind = r.kind as SwpNodeKind
  if (kind !== 'start' && kind !== 'end' && kind !== 'task' && kind !== 'decision') return null
  const col = typeof r.col === 'number' ? r.col : undefined
  const pos = asRecord(r.position)
  const position =
    pos && typeof pos.x === 'number' && typeof pos.y === 'number'
      ? { x: pos.x, y: pos.y }
      : { x: 0, y: 0 }
  return {
    id: r.id,
    kind,
    label: r.label,
    roleKey: roleKey as SwpRoleKey,
    position,
    width: typeof r.width === 'number' ? r.width : undefined,
    height: typeof r.height === 'number' ? r.height : undefined,
    meta: normalizeImportedMeta(r.meta),
    col,
    row: typeof r.row === 'number' ? r.row : undefined,
  }
}

function migrateEdge(raw: unknown): SwpFlowEdge | null {
  const r = asRecord(raw)
  if (!r || typeof r.id !== 'string' || typeof r.from !== 'string' || typeof r.to !== 'string') return null
  return {
    id: r.id,
    from: r.from,
    to: r.to,
    label: typeof r.label === 'string' ? r.label : undefined,
    color: typeof r.color === 'string' ? r.color : undefined,
    lineStyle:
      r.lineStyle === 'straight' || r.lineStyle === 'stepped' || r.lineStyle === 'curved'
        ? r.lineStyle
        : undefined,
  }
}

function migrateFlow(raw: unknown): SwpProcessFlow | null {
  const r = asRecord(raw)
  if (!r || typeof r.systemId !== 'string') return null
  const nodes = migrateList(r.nodes, migrateNode)
  const edges = migrateList(r.edges, migrateEdge)
  if (!nodes.length) return null
  return migrateFlowToColumnLayout({
    systemId: r.systemId,
    subtitle: typeof r.subtitle === 'string' ? r.subtitle : undefined,
    nodes,
    edges,
  })
}

export function normalizeWorkspace(raw: unknown): SwpWorkspace | null {
  const w = asRecord(raw)
  if (!w || w.version !== 1) return null
  const systems = migrateList(w.systems, migrateSystem)
  if (!systems.length) return null
  const flows = migrateList(w.flows, migrateFlow)
  return {
    version: 1,
    systems,
    flows: ensureWorkspaceFlows(systems, flows),
  }
}

export function workspaceOrSeed(raw: unknown): SwpWorkspace {
  return normalizeWorkspace(raw) ?? structuredClone(SWP_SEED)
}
