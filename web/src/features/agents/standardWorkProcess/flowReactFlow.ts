import type { Connection, Edge, Node } from '@xyflow/react'
import { MarkerType } from '@xyflow/react'
import { nodeSize } from './swpNodeDefaults'
import { shortestConnectionHandles } from './swpEdgeHandles'
import type { SwpFlowEdge, SwpFlowNode, SwpFlowNodeMeta, SwpNodeKind, SwpProcessFlow } from './types'

export type SwpRfNodeData = {
  kind: SwpNodeKind
  label: string
  roleKey: SwpFlowNode['roleKey']
  meta?: SwpFlowNodeMeta
}

function edgeLabelStyle(label?: string) {
  if (label === 'Yes') return { fill: '#15803d', fontWeight: 600, fontSize: 11 }
  if (label === 'No') return { fill: '#dc2626', fontWeight: 600, fontSize: 11 }
  if (label === 'Escalate') return { fill: '#c2410c', fontWeight: 600, fontSize: 11 }
  if (label === 'Complete') return { fill: '#15803d', fontWeight: 600, fontSize: 11 }
  return { fill: '#1e3a5f', fontWeight: 600, fontSize: 11 }
}

function edgeType(lineStyle?: SwpFlowEdge['lineStyle']) {
  if (lineStyle === 'stepped') return 'step'
  if (lineStyle === 'curved') return 'default'
  return 'straight'
}

function nodeBox(node: SwpFlowNode) {
  const size = nodeSize(node)
  return {
    x: node.position.x,
    y: node.position.y,
    width: size.width,
    height: size.height,
  }
}

function newEdgeId() {
  return `swp-e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function flowToNodes(flow: SwpProcessFlow): Node<SwpRfNodeData>[] {
  return flow.nodes.map((node) => {
    const size = nodeSize(node)
    return {
      id: node.id,
      type: 'swpNode',
      position: node.position,
      width: size.width,
      height: size.height,
      data: { kind: node.kind, label: node.label, roleKey: node.roleKey, meta: node.meta },
      draggable: true,
      selectable: true,
    }
  })
}

export function flowToEdges(flow: SwpProcessFlow): Edge[] {
  const nodeById = new Map(flow.nodes.map((node) => [node.id, node]))

  return flow.edges.map((edge) => {
    const from = nodeById.get(edge.from)
    const to = nodeById.get(edge.to)
    const handles =
      from && to ? shortestConnectionHandles(nodeBox(from), nodeBox(to)) : undefined

    return {
      id: edge.id,
      source: edge.from,
      target: edge.to,
      sourceHandle: handles?.sourceHandle,
      targetHandle: handles?.targetHandle,
      label: edge.label,
      type: edgeType(edge.lineStyle),
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      labelStyle: edgeLabelStyle(edge.label),
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92 },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 4,
      style: {
        stroke: edge.color ?? '#1e40af',
        strokeWidth: 2,
        strokeLinecap: 'round',
      },
      animated: false,
      interactionWidth: 18,
      selectable: true,
    }
  })
}

export function reactFlowToFlow(
  systemId: string,
  subtitle: string | undefined,
  nodes: Node<SwpRfNodeData>[],
  edges: Edge[],
): SwpProcessFlow {
  return {
    systemId,
    subtitle,
    nodes: nodes.map((n) => ({
      id: n.id,
      kind: n.data.kind,
      label: n.data.label,
      roleKey: n.data.roleKey,
      position: n.position,
      width: n.width,
      height: n.height,
      meta: n.data.meta,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      from: e.source,
      to: e.target,
      label: typeof e.label === 'string' ? e.label : undefined,
      color: typeof e.style?.stroke === 'string' ? e.style.stroke : undefined,
      lineStyle:
        e.type === 'step' || e.type === 'smoothstep'
          ? 'stepped'
          : e.type === 'default'
            ? 'curved'
            : 'straight',
    })),
  }
}

export function connectionToEdge(connection: Connection): SwpFlowEdge | null {
  if (!connection.source || !connection.target) return null
  return {
    id: newEdgeId(),
    from: connection.source,
    to: connection.target,
    lineStyle: 'straight',
  }
}

export function newFlowNodeId() {
  return `swp-n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function rfNodeBox(node: Node<SwpRfNodeData>) {
  const size = nodeSize({
    kind: node.data.kind,
    width: node.width,
    height: node.height,
  })
  return {
    x: node.position.x,
    y: node.position.y,
    width: size.width,
    height: size.height,
  }
}

export function straightEdgeParams(
  source: Node<SwpRfNodeData>,
  target: Node<SwpRfNodeData>,
  edgeId: string,
): Edge {
  const handles = shortestConnectionHandles(rfNodeBox(source), rfNodeBox(target))
  return {
    id: edgeId,
    source: source.id,
    target: target.id,
    sourceHandle: handles.sourceHandle,
    targetHandle: handles.targetHandle,
    type: 'straight',
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: { stroke: '#1e40af', strokeWidth: 2 },
  }
}
