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
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { bmsFlowNodeTypes, type BmsFlowNodeData } from './BmsBrainFlowNodes'
import { BmsBrainSmartEdge } from './BmsBrainSmartEdge'
import { normalizeBmsFlowLayout } from './bmsFlowAutoLayout'
import type { BmsCatalogRow, BmsFlowEdge, BmsFlowNode, BmsNodeKind, BmsProcessFlow } from './types'

function catalogById(rows: BmsCatalogRow[]) {
  return new Map(rows.map((r) => [r.id, r]))
}

function toRf(
  flow: BmsProcessFlow,
  systems: BmsCatalogRow[],
  roles: BmsCatalogRow[],
  forums: BmsCatalogRow[],
): { nodes: Node<BmsFlowNodeData>[]; edges: ReturnType<typeof flowToRfEdges> } {
  const roleById = catalogById(roles)
  const forumById = catalogById(forums)
  return {
    nodes: (flow.nodes ?? []).map((n) => ({
      id: n.id,
      type: 'bmsFlow',
      position: n.position ?? { x: 0, y: 0 },
      data: {
        label: n.label,
        kind: n.kind,
        systemIds: n.systemIds ?? [],
        systems,
        roleId: n.roleId,
        forumId: n.forumId,
        role: n.roleId ? roleById.get(n.roleId) ?? null : null,
        forum: n.forumId ? forumById.get(n.forumId) ?? null : null,
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
    type: 'bmsSmart',
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { strokeWidth: 2 },
  }))
}

const bmsFlowEdgeTypes = {
  bmsSmart: BmsBrainSmartEdge,
}

function fromRf(nodes: Node<BmsFlowNodeData>[], edges: Edge[], prev: BmsProcessFlow): BmsProcessFlow {
  const prevById = new Map((prev.nodes ?? []).map((n) => [n.id, n]))
  return {
    nodes: nodes.map((n) => {
      const old = prevById.get(n.id)
      return {
        id: n.id,
        kind: n.data.kind,
        label: n.data.label,
        description: old?.description,
        roleId: old?.roleId ?? n.data.roleId ?? null,
        forumId: old?.forumId ?? n.data.forumId ?? null,
        systemIds: old?.systemIds ?? [],
        owner: old?.owner,
        inputs: old?.inputs,
        outputs: old?.outputs,
        links: old?.links,
        position: n.position,
      } satisfies BmsFlowNode
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === 'string' ? e.label : undefined,
    })),
  }
}

type Props = {
  flow: BmsProcessFlow
  systems: BmsCatalogRow[]
  roles: BmsCatalogRow[]
  forums: BmsCatalogRow[]
  readOnly?: boolean
  selectedNodeId?: string | null
  onNodeSelect?: (nodeId: string | null) => void
  onFlowChange: (flow: BmsProcessFlow) => void
}

function EditorInner({ flow, systems, roles, forums, readOnly, selectedNodeId, onNodeSelect, onFlowChange }: Props) {
  const initial = useMemo(() => toRf(flow, systems, roles, forums), [flow, systems, roles, forums])
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)

  useEffect(() => {
    const next = toRf(flow, systems, roles, forums)
    setNodes(next.nodes)
    setEdges(next.edges)
  }, [flow, systems, roles, forums, setNodes, setEdges])

  const applyFlow = useCallback(
    (nextFlow: BmsProcessFlow) => {
      const next = toRf(nextFlow, systems, roles, forums)
      setNodes(next.nodes)
      setEdges(next.edges)
      onFlowChange(nextFlow)
    },
    [forums, onFlowChange, roles, setEdges, setNodes, systems],
  )

  const emit = useCallback(
    (nds: Node<BmsFlowNodeData>[], eds: typeof edges, lockedNodeId?: string | null) => {
      const nextFlow = normalizeBmsFlowLayout(fromRf(nds, eds, flow), { lockedNodeId })
      applyFlow(nextFlow)
    },
    [applyFlow, flow],
  )

  const onConnect = useCallback(
    (c: Connection) => {
      setEdges((eds) => {
        const next = addEdge({ ...c, type: 'bmsSmart', markerEnd: { type: MarkerType.ArrowClosed } }, eds)
        emit(nodes, next, c.source)
        return next
      })
    },
    [emit, nodes, setEdges],
  )

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node<BmsFlowNodeData>) => {
      emit(nodes, edges, node.id)
    },
    [emit, nodes, edges],
  )

  return (
    <div className="h-[min(70vh,720px)] rounded-2xl border border-border bg-white">
      <ReactFlow
        nodeTypes={bmsFlowNodeTypes}
        edgeTypes={bmsFlowEdgeTypes}
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
        fitViewOptions={{ padding: 0.22, minZoom: 0.35, maxZoom: 1.25 }}
        minZoom={0.25}
        maxZoom={1.5}
      >
        <Background gap={20} />
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
