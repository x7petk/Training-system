import { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useEdgesState,
  useNodesState,
  type Connection,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { BmsCatalogRow, BmsFlowEdge, BmsFlowNode, BmsNodeKind, BmsProcessFlow } from './types'

type NodeData = {
  label: string
  kind: BmsNodeKind
  systemIds: string[]
  systems: BmsCatalogRow[]
}

const kindStyle: Record<BmsNodeKind, string> = {
  start: '#10b981',
  end: '#64748b',
  decision: '#f59e0b',
  process: '#0ea5e9',
  review: '#8b5cf6',
  document: '#6366f1',
  subprocess: '#ec4899',
}

function toRf(flow: BmsProcessFlow, systems: BmsCatalogRow[]): { nodes: Node<NodeData>[]; edges: ReturnType<typeof flowToRfEdges> } {
  return {
    nodes: (flow.nodes ?? []).map((n) => ({
      id: n.id,
      type: 'default',
      position: n.position ?? { x: 0, y: 0 },
      data: { label: n.label, kind: n.kind, systemIds: n.systemIds ?? [], systems },
      style: {
        borderColor: kindStyle[n.kind],
        borderWidth: 2,
        borderRadius: n.kind === 'decision' ? 4 : 8,
        padding: 8,
        fontSize: 12,
        width: 160,
      },
    })),
    edges: flowToRfEdges(flow.edges ?? []),
  }
}

function flowToRfEdges(edges: BmsFlowEdge[]) {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { strokeWidth: 2 },
  }))
}

function fromRf(nodes: Node<NodeData>[], edges: { id: string; source: string; target: string; label?: string }[], prev: BmsProcessFlow): BmsProcessFlow {
  const prevById = new Map((prev.nodes ?? []).map((n) => [n.id, n]))
  return {
    nodes: nodes.map((n) => {
      const old = prevById.get(n.id)
      return {
        id: n.id,
        kind: n.data.kind,
        label: n.data.label,
        description: old?.description,
        roleId: old?.roleId ?? null,
        forumId: old?.forumId ?? null,
        systemIds: old?.systemIds ?? [],
        owner: old?.owner,
        inputs: old?.inputs,
        outputs: old?.outputs,
        links: old?.links,
        position: n.position,
      } satisfies BmsFlowNode
    }),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label })),
  }
}

type Props = {
  flow: BmsProcessFlow
  systems: BmsCatalogRow[]
  readOnly?: boolean
  selectedNodeId?: string | null
  onNodeSelect?: (nodeId: string | null) => void
  onFlowChange: (flow: BmsProcessFlow) => void
}

function EditorInner({ flow, systems, readOnly, selectedNodeId, onNodeSelect, onFlowChange }: Props) {
  const initial = useMemo(() => toRf(flow, systems), [flow, systems])
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)

  useEffect(() => {
    const next = toRf(flow, systems)
    setNodes(next.nodes)
    setEdges(next.edges)
  }, [flow, systems, setNodes, setEdges])

  const emit = useCallback(
    (nds: Node<NodeData>[], eds: typeof edges) => {
      onFlowChange(fromRf(nds, eds, flow))
    },
    [flow, onFlowChange],
  )

  const onConnect = useCallback(
    (c: Connection) => {
      setEdges((eds) => {
        const next = addEdge({ ...c, markerEnd: { type: MarkerType.ArrowClosed } }, eds)
        emit(nodes, next)
        return next
      })
    },
    [emit, nodes, setEdges],
  )

  const onNodeDragStop = useCallback(() => {
    emit(nodes, edges)
  }, [emit, nodes, edges])

  return (
    <div className="h-[min(70vh,720px)] rounded-2xl border border-border bg-white">
      <ReactFlow
        nodes={nodes.map((n) => ({
          ...n,
          selected: selectedNodeId ? n.id === selectedNodeId : n.selected,
        }))}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_, node) => onNodeSelect?.(node.id)}
        onPaneClick={() => onNodeSelect?.(null)}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        fitView
      >
        <Background gap={16} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}

export function BmsBrainFlowView(props: Props) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  )
}

export function createBmsNode(kind: BmsNodeKind, label: string, x: number, y: number): BmsFlowNode {
  return {
    id: crypto.randomUUID(),
    kind,
    label,
    roleId: null,
    forumId: null,
    systemIds: [],
    position: { x, y },
  }
}
