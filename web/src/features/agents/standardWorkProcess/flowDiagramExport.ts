import { SWP_NODE_WIDTH } from './flowLayout'
import { nodeSize } from './swpNodeDefaults'
import { SWP_LANE_THEMES, SWP_ROLE_KEY_ORDER } from './roleLaneTheme'
import type { SwpDiagramExport, SwpFlowNodeMeta, SwpNodeKind, SwpProcessFlow, SwpRoleKey } from './types'

const NODE_HEIGHT: Record<SwpNodeKind, number> = {
  start: 40,
  end: 40,
  task: 44,
  decision: 72,
}

const LANE_HEX: Record<SwpRoleKey, string> = {
  operator: '#2563eb',
  'team-lead': '#16a34a',
  'cell-team': '#7c3aed',
  'plant-manager': '#ea580c',
  'site-manager': '#0e7490',
  support: '#334155',
}

function localStorageKey(systemId: string) {
  return `swp-flow-draft:${systemId}`
}

export function flowToDiagramExport(
  flow: SwpProcessFlow,
  diagramName: string,
): SwpDiagramExport {
  return {
    diagramName,
    systemId: flow.systemId,
    roles: SWP_ROLE_KEY_ORDER.map((id, i) => ({
      id,
      name: SWP_LANE_THEMES[id].label,
      color: LANE_HEX[id],
      order: i + 1,
    })),
    nodes: flow.nodes.map((node) => {
      const size = nodeSize(node)
      return {
        id: node.id,
        type: node.kind,
        roleId: node.roleKey,
        label: node.label,
        x: node.position.x,
        y: node.position.y,
        width: size.width,
        height: size.height,
        meta: node.meta,
      }
    }),
    edges: flow.edges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label: edge.label,
      type: 'arrow' as const,
      color: edge.color,
      lineStyle: edge.lineStyle,
    })),
  }
}

export function diagramExportToFlow(exported: SwpDiagramExport): SwpProcessFlow | null {
  if (!exported.systemId || !Array.isArray(exported.nodes) || !exported.nodes.length) return null

  const nodes = exported.nodes
    .filter((n) => SWP_ROLE_KEY_ORDER.includes(n.roleId))
    .map((n) => ({
      id: n.id,
      kind: n.type,
      label: n.label,
      roleKey: n.roleId,
      position: { x: n.x, y: n.y },
      width: n.width,
      height: n.height,
      meta: n.meta,
    }))

  if (!nodes.length) return null

  const edges = (exported.edges ?? []).map((e) => ({
    id: e.id,
    from: e.source,
    to: e.target,
    label: e.label,
    color: e.color,
    lineStyle: e.lineStyle,
  }))

  return {
    systemId: exported.systemId,
    subtitle: exported.diagramName,
    nodes,
    edges,
  }
}

export function downloadFlowJson(flow: SwpProcessFlow, diagramName: string) {
  const payload = flowToDiagramExport(flow, diagramName)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${diagramName.replace(/\s+/g, '-').toLowerCase()}-flow.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function wrapLabel(label: string, maxChars = 18) {
  const words = label.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 3)
}

function nodeHeight(kind: SwpNodeKind) {
  return NODE_HEIGHT[kind]
}

function nodeCenter(node: SwpProcessFlow['nodes'][number]) {
  return {
    x: node.position.x + SWP_NODE_WIDTH[node.kind] / 2,
    y: node.position.y + nodeHeight(node.kind) / 2,
  }
}

function nodeSvg(node: SwpProcessFlow['nodes'][number]) {
  const w = SWP_NODE_WIDTH[node.kind]
  const h = nodeHeight(node.kind)
  const x = node.position.x
  const y = node.position.y
  const accent = node.meta?.color
  const labelLines = wrapLabel(node.label, node.kind === 'decision' ? 15 : 18)
  const text = labelLines
    .map((line, index) => {
      const dy = (index - (labelLines.length - 1) / 2) * 13
      return `<tspan x="${x + w / 2}" y="${y + h / 2 + 4 + dy}">${escapeXml(line)}</tspan>`
    })
    .join('')

  if (node.kind === 'start' || node.kind === 'end') {
    const fill = node.kind === 'start' ? '#dcfce7' : '#bbf7d0'
    return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${accent ?? '#047857'}" stroke-width="2"/><text text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700" fill="#0f172a">${text}</text></g>`
  }

  if (node.kind === 'decision') {
    const points = [
      `${x + w / 2},${y}`,
      `${x + w},${y + h / 2}`,
      `${x + w / 2},${y + h}`,
      `${x},${y + h / 2}`,
    ].join(' ')
    return `<g><polygon points="${points}" fill="#fef3c7" stroke="${accent ?? '#d97706'}" stroke-width="2"/><text text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="10.5" font-weight="700" fill="#0f172a">${text}</text></g>`
  }

  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#e0f2fe" stroke="${accent ?? '#0369a1'}" stroke-width="2"/><text text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700" fill="#0f172a">${text}</text></g>`
}

function edgeSvg(flow: SwpProcessFlow) {
  const byId = new Map(flow.nodes.map((node) => [node.id, node]))
  return flow.edges
    .map((edge) => {
      const from = byId.get(edge.from)
      const to = byId.get(edge.to)
      if (!from || !to) return ''
      const a = nodeCenter(from)
      const b = nodeCenter(to)
      const sameColumn = Math.abs(a.x - b.x) < 12
      const path = sameColumn
        ? `M ${a.x} ${a.y + nodeHeight(from.kind) / 2} L ${b.x} ${b.y - nodeHeight(to.kind) / 2}`
        : `M ${a.x} ${a.y} C ${a.x} ${(a.y + b.y) / 2}, ${b.x} ${(a.y + b.y) / 2}, ${b.x} ${b.y}`
      const label =
        edge.label && edge.label.trim()
          ? `<text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 5}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700" fill="${edge.label === 'No' ? '#dc2626' : '#15803d'}"><tspan paint-order="stroke" stroke="#fff" stroke-width="4">${escapeXml(edge.label)}</tspan></text>`
          : ''
      return `<g><path d="${path}" fill="none" stroke="${edge.color ?? '#1e40af'}" stroke-width="2" marker-end="url(#arrow)"/>${label}</g>`
    })
    .join('')
}

function flowToSvg(flow: SwpProcessFlow, diagramName: string) {
  const maxNodeX = flow.nodes.reduce(
    (max, node) => Math.max(max, node.position.x + SWP_NODE_WIDTH[node.kind]),
    0,
  )
  const maxNodeY = flow.nodes.reduce(
    (max, node) => Math.max(max, node.position.y + nodeHeight(node.kind)),
    0,
  )
  const width = Math.max(1100, Math.ceil(maxNodeX + 48))
  const height = Math.max(520, Math.ceil(maxNodeY + 72))
  const laneWidth = width / SWP_ROLE_KEY_ORDER.length
  const laneHeaders = SWP_ROLE_KEY_ORDER.map((roleKey, index) => {
    const x = index * laneWidth
    return `<g><rect x="${x}" y="42" width="${laneWidth}" height="34" fill="${LANE_HEX[roleKey]}"/><text x="${x + laneWidth / 2}" y="64" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="700" fill="#fff">${escapeXml(SWP_LANE_THEMES[roleKey].label)}</text><rect x="${x}" y="76" width="${laneWidth}" height="${height - 76}" fill="${LANE_HEX[roleKey]}" opacity="0.06"/><line x1="${x + laneWidth}" y1="42" x2="${x + laneWidth}" y2="${height}" stroke="#cbd5e1" stroke-dasharray="4 4"/></g>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#1e40af"/></marker></defs>
<rect width="100%" height="100%" fill="#f8fafc"/>
<text x="${width / 2}" y="26" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="17" font-weight="800" fill="#1e3a5f">${escapeXml(diagramName)}</text>
${laneHeaders}
${edgeSvg(flow)}
${flow.nodes.map(nodeSvg).join('')}
</svg>`
}

export function downloadFlowPng(flow: SwpProcessFlow, diagramName: string) {
  const svg = flowToSvg(flow, diagramName)
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  const image = new Image()

  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      URL.revokeObjectURL(url)
      return
    }
    ctx.drawImage(image, 0, 0)
    URL.revokeObjectURL(url)
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `${diagramName.replace(/\s+/g, '-').toLowerCase()}-flow.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  image.src = url
}

export function parseImportedFlowJson(text: string): SwpProcessFlow | null {
  try {
    const raw = JSON.parse(text) as SwpDiagramExport
    return diagramExportToFlow(raw)
  } catch {
    return null
  }
}

export function saveFlowToLocal(flow: SwpProcessFlow, diagramName: string) {
  const payload = flowToDiagramExport(flow, diagramName)
  localStorage.setItem(localStorageKey(flow.systemId), JSON.stringify(payload))
}

export function loadFlowFromLocal(systemId: string): SwpProcessFlow | null {
  const raw = localStorage.getItem(localStorageKey(systemId))
  if (!raw) return null
  try {
    return diagramExportToFlow(JSON.parse(raw) as SwpDiagramExport)
  } catch {
    return null
  }
}

export function normalizeImportedMeta(raw: unknown): SwpFlowNodeMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const tags = Array.isArray(r.tags) ? r.tags.filter((t) => typeof t === 'string') : undefined
  return {
    description: typeof r.description === 'string' ? r.description : undefined,
    ownerRole: typeof r.ownerRole === 'string' ? r.ownerRole : undefined,
    standardRef: typeof r.standardRef === 'string' ? r.standardRef : undefined,
    expectedCompletion: typeof r.expectedCompletion === 'string' ? r.expectedCompletion : undefined,
    escalationLevel: typeof r.escalationLevel === 'string' ? r.escalationLevel : undefined,
    tags: tags?.length ? tags : undefined,
    status:
      r.status === 'draft' ||
      r.status === 'active' ||
      r.status === 'blocked' ||
      r.status === 'done'
        ? r.status
        : undefined,
    color: typeof r.color === 'string' ? r.color : undefined,
  }
}
