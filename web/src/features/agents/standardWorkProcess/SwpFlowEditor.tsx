import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  MarkerType,
  ConnectionMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './SwpFlowEditor.css'
import type { KpiCascadeRole } from '../kpiCascade/types'
import { SwpColumnLanes } from './SwpColumnLanes'
import { SwpLaneHeaderRow } from './SwpLaneHeaderRow'
import { SwpFlowEditorProvider } from './SwpFlowEditorContext'
import { SwpFlowContextMenu, type SwpContextMenuState } from './SwpFlowContextMenu'
import { SwpFlowToolbar } from './SwpFlowToolbar'
import {
  downloadFlowJson,
  loadFlowFromLocal,
  parseImportedFlowJson,
  saveFlowToLocal,
} from './flowDiagramExport'
import {
  alignFlowNodes,
  boardHeightFromNodes,
  columnWidthForViewport,
  migrateFlowToColumnLayout,
  nextNodeYInColumn,
  snapNodePosition,
} from './flowLayout'
import {
  connectionToEdge,
  flowToEdges,
  flowToNodes,
  reactFlowToFlow,
  straightEdgeParams,
  type SwpRfNodeData,
} from './flowReactFlow'
import { nodeSize } from './swpNodeDefaults'
import { buildFlowForSystem, createFlowNode } from './processFlowTemplates'
import { swpNodeTypes } from './SwpFlowNodeTypes'
import type { SwpFlowNode, SwpNodeKind, SwpProcessFlow, SwpRoleKey, SwpSystem } from './types'

type Props = {
  systemName: string
  flow: SwpProcessFlow
  roles: KpiCascadeRole[]
  systems?: SwpSystem[]
  selectedSystemId?: string | null
  onSelectSystem?: (systemId: string) => void
  onFlowChange: (flow: SwpProcessFlow) => void
}

function alignRfNodes(
  nds: Node<SwpRfNodeData>[],
  colWidth: number,
): Node<SwpRfNodeData>[] {
  const aligned = alignFlowNodes(
    nds.map((n) => ({
      id: n.id,
      kind: n.data.kind,
      label: n.data.label,
      roleKey: n.data.roleKey,
      position: n.position,
      width: n.width,
      height: n.height,
      meta: n.data.meta,
    })),
    colWidth,
  )
  return nds.map((n, i) => ({
    ...n,
    position: aligned[i].position,
    data: { ...n.data, roleKey: aligned[i].roleKey },
  }))
}

function rfNodeToFlowNode(n: Node<SwpRfNodeData>): SwpFlowNode {
  return {
    id: n.id,
    kind: n.data.kind,
    label: n.data.label,
    roleKey: n.data.roleKey,
    position: n.position,
    width: n.width,
    height: n.height,
    meta: n.data.meta,
  }
}

export function SwpFlowEditor({
  systemName,
  flow,
  roles,
  systems,
  selectedSystemId,
  onSelectSystem,
  onFlowChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<SwpRfNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<SwpContextMenuState | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const columnWidth = viewportWidth > 0 ? columnWidthForViewport(viewportWidth) : 0
  const canvasHeight = useMemo(() => boardHeightFromNodes(nodes), [nodes])

  const diagramName = `${systemName.trim()} process flow`

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth
      if (w > 0) setViewportWidth(w)
    })
    ro.observe(el)
    setViewportWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const applyFlow = useCallback(
    (nextFlow: SwpProcessFlow, immediate = false) => {
      const migrated = migrateFlowToColumnLayout(nextFlow, viewportWidth || undefined)
      setNodes(flowToNodes(migrated))
      setEdges(flowToEdges(migrated))
      if (immediate) {
        onFlowChange(migrated)
      } else {
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => onFlowChange(migrated), 400)
      }
    },
    [onFlowChange, setEdges, setNodes, viewportWidth],
  )

  const emitFlow = useCallback(
    (nextNodes: Node<SwpRfNodeData>[], nextEdges: Edge[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        onFlowChange(reactFlowToFlow(flow.systemId, flow.subtitle, nextNodes, nextEdges))
      }, 400)
    },
    [flow.systemId, flow.subtitle, onFlowChange],
  )

  useEffect(() => {
    const migrated = migrateFlowToColumnLayout(flow, viewportWidth || undefined)
    setNodes(flowToNodes(migrated))
    setEdges(flowToEdges(migrated))
    setSelectedNodeId(null)
  }, [flow.systemId, setNodes, setEdges])

  useLayoutEffect(() => {
    if (columnWidth <= 0) return
    setNodes((nds) => alignRfNodes(nds, columnWidth))
  }, [columnWidth, setNodes])

  const onLabelChange = useCallback(
    (nodeId: string, label: string) => {
      setNodes((nds) => {
        const next = nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, label } } : n,
        )
        emitFlow(next, edges)
        return next
      })
    },
    [edges, emitFlow, setNodes],
  )

  const refreshEdges = useCallback(
    (nds: Node<SwpRfNodeData>[], eds: Edge[]) =>
      flowToEdges(reactFlowToFlow(flow.systemId, flow.subtitle, nds, eds)),
    [flow.subtitle, flow.systemId],
  )

  const onNodeResize = useCallback(
    (nodeId: string, width: number, height: number) => {
      setNodes((nds) => {
        const nextNodes = nds.map((n) => (n.id === nodeId ? { ...n, width, height } : n))
        setEdges((eds) => {
          const nextEdges = refreshEdges(nextNodes, eds)
          emitFlow(nextNodes, nextEdges)
          return nextEdges
        })
        return nextNodes
      })
    },
    [emitFlow, refreshEdges, setEdges, setNodes],
  )

  const connectNodes = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return
      const source = nodes.find((n) => n.id === sourceId)
      const target = nodes.find((n) => n.id === targetId)
      if (!source || !target) return
      const swpEdge = connectionToEdge({
        source: sourceId,
        target: targetId,
        sourceHandle: null,
        targetHandle: null,
      })
      if (!swpEdge) return
      setEdges((eds) => {
        if (eds.some((e) => e.source === sourceId && e.target === targetId)) return eds
        const next = addEdge(straightEdgeParams(source, target, swpEdge.id), eds)
        emitFlow(nodes, next)
        return next
      })
    },
    [emitFlow, nodes, setEdges],
  )

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const swpEdge = connectionToEdge(connection)
      if (!swpEdge) return
      const source = nodes.find((n) => n.id === connection.source)
      const target = nodes.find((n) => n.id === connection.target)
      if (!source || !target) return
      setEdges((eds) => {
        const next = addEdge(straightEdgeParams(source, target, swpEdge.id), eds)
        emitFlow(nodes, next)
        return next
      })
    },
    [emitFlow, nodes, setEdges],
  )

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node<SwpRfNodeData>) => {
      if (columnWidth <= 0) return
      const { width } = nodeSize({
        kind: node.data.kind,
        width: node.width,
        height: node.height,
      })
      const snapped = snapNodePosition(
        node.position.x,
        node.position.y,
        node.data.kind,
        columnWidth,
        width,
      )
      setNodes((nds) => {
        const next = nds.map((n) =>
          n.id === node.id
            ? {
                ...n,
                position: { x: snapped.x, y: node.position.y },
                data: { ...n.data, roleKey: snapped.roleKey },
              }
            : n,
        )
        setEdges((eds) => {
          const nextEdges = refreshEdges(next, eds)
          emitFlow(next, nextEdges)
          return nextEdges
        })
        return next
      })
    },
    [columnWidth, emitFlow, refreshEdges, setEdges, setNodes],
  )

  const onAddNodeAt = useCallback(
    (kind: SwpNodeKind, roleKey: SwpRoleKey, canvasY?: number) => {
      if (columnWidth <= 0) return
      const y =
        canvasY ??
        nextNodeYInColumn(
          nodes.map((n) => rfNodeToFlowNode(n)),
          roleKey,
        )
      const created = createFlowNode(kind, roleKey, y, columnWidth)
      const size = nodeSize(created)
      const rfNode: Node<SwpRfNodeData> = {
        id: created.id,
        type: 'swpNode',
        position: created.position,
        width: size.width,
        height: size.height,
        data: {
          kind: created.kind,
          label: created.label,
          roleKey: created.roleKey,
          meta: created.meta,
        },
        selected: true,
      }
      setSelectedNodeId(created.id)
      setNodes((nds) => {
        const next = [...nds.map((n) => ({ ...n, selected: false })), rfNode]
        emitFlow(next, edges)
        return next
      })
    },
    [columnWidth, edges, emitFlow, nodes, setNodes],
  )

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault()
      const el = containerRef.current
      if (!el || columnWidth <= 0) return
      const rect = el.getBoundingClientRect()
      const x = event.clientX - rect.left + el.scrollLeft
      const y = event.clientY - rect.top + el.scrollTop
      const snapped = snapNodePosition(x, y, 'task', columnWidth)
      setContextMenu({
        clientX: event.clientX,
        clientY: event.clientY,
        canvasY: snapped.y,
        roleKey: snapped.roleKey,
      })
    },
    [columnWidth],
  )

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node<SwpRfNodeData>) => {
      if (event.shiftKey && selectedNodeId && selectedNodeId !== node.id) {
        connectNodes(selectedNodeId, node.id)
      }
      setSelectedNodeId(node.id)
    },
    [connectNodes, selectedNodeId],
  )

  const selectedNodeIds = useRef<Set<string>>(new Set())
  const selectedEdgeIds = useRef<Set<string>>(new Set())

  const onSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
      selectedNodeIds.current = new Set(selNodes.map((n) => n.id))
      selectedEdgeIds.current = new Set(selEdges.map((e) => e.id))
      if (selNodes.length === 1) setSelectedNodeId(selNodes[0].id)
    },
    [],
  )

  const onDeleteSelection = useCallback(() => {
    const nodeIds = selectedNodeIds.current
    const edgeIds = selectedEdgeIds.current
    if (nodeIds.size === 0 && edgeIds.size === 0) return
    setNodes((nds) => {
      const nextNodes = nds.filter((n) => !nodeIds.has(n.id))
      setEdges((eds) => {
        const nextEdges = eds.filter(
          (e) =>
            !edgeIds.has(e.id) && !nodeIds.has(e.source) && !nodeIds.has(e.target),
        )
        emitFlow(nextNodes, nextEdges)
        return nextEdges
      })
      if (selectedNodeId && nodeIds.has(selectedNodeId)) setSelectedNodeId(null)
      return nextNodes
    })
  }, [emitFlow, selectedNodeId, setEdges, setNodes])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      onDeleteSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDeleteSelection])

  const onResetTemplate = useCallback(() => {
    if (
      !confirm(
        `Reset "${systemName}" diagram to the default CL example template? This replaces all blocks and arrows.`,
      )
    ) {
      return
    }
    const fresh = buildFlowForSystem(flow.systemId, systemName)
    applyFlow(fresh, true)
  }, [applyFlow, flow.systemId, systemName])

  const onClearAll = useCallback(() => {
    if (!confirm(`Clear all blocks and arrows from "${systemName}"?`)) return
    applyFlow({ ...flow, nodes: [], edges: [] }, true)
    setSelectedNodeId(null)
  }, [applyFlow, flow, systemName])

  const currentFlow = useCallback(
    () => reactFlowToFlow(flow.systemId, flow.subtitle ?? diagramName, nodes, edges),
    [diagramName, edges, flow.subtitle, flow.systemId, nodes],
  )

  const onSaveLocal = useCallback(() => {
    saveFlowToLocal(currentFlow(), diagramName)
  }, [currentFlow, diagramName])

  const onLoadLocal = useCallback(() => {
    const loaded = loadFlowFromLocal(flow.systemId)
    if (!loaded) {
      alert('No saved diagram found in browser storage for this system.')
      return
    }
    applyFlow({ ...loaded, systemId: flow.systemId }, true)
  }, [applyFlow, flow.systemId])

  const onImportJson = useCallback(() => {
    importInputRef.current?.click()
  }, [])

  const onImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : ''
        const imported = parseImportedFlowJson(text)
        if (!imported) {
          alert('Could not parse diagram JSON. Check the file format.')
          return
        }
        applyFlow({ ...imported, systemId: flow.systemId }, true)
      }
      reader.readAsText(file)
    },
    [applyFlow, flow.systemId],
  )

  const onExportJson = useCallback(() => {
    downloadFlowJson(currentFlow(), diagramName)
  }, [currentFlow, diagramName])

  const providerValue = useMemo(
    () => ({ onLabelChange, onNodeResize }),
    [onLabelChange, onNodeResize],
  )

  return (
    <SwpFlowEditorProvider value={providerValue}>
      <div className="flex w-full flex-col">
        <SwpFlowToolbar
          title="Simple Process Flow Builder"
          systems={systems}
          selectedSystemId={selectedSystemId}
          onSelectSystem={onSelectSystem}
          onResetTemplate={onResetTemplate}
          onSaveLocal={onSaveLocal}
          onLoadLocal={onLoadLocal}
          onImportJson={onImportJson}
          onExportJson={onExportJson}
          onClearAll={onClearAll}
        />

        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onImportFile}
        />

        <div ref={containerRef} className="relative w-full bg-slate-50">
          <div
            className="relative bg-slate-50"
            style={{
              width: viewportWidth > 0 ? viewportWidth : '100%',
              height: canvasHeight,
            }}
          >
            {columnWidth > 0 ? (
              <SwpLaneHeaderRow roles={roles} columnWidth={columnWidth} />
            ) : null}
            <div
              className="relative [&_.react-flow]:z-10 [&_.react-flow__pane]:cursor-default"
              style={{
                width: viewportWidth > 0 ? viewportWidth : '100%',
                height: canvasHeight,
              }}
            >
              {columnWidth > 0 ? (
                <SwpColumnLanes height={canvasHeight} columnWidth={columnWidth} />
              ) : null}
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeDragStop={onNodeDragStop}
                onNodeClick={onNodeClick}
                onPaneContextMenu={onPaneContextMenu}
                onSelectionChange={onSelectionChange}
                nodeTypes={swpNodeTypes}
                connectionMode={ConnectionMode.Loose}
                defaultEdgeOptions={{
                  type: 'straight',
                  style: { stroke: '#1e40af', strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
                }}
                fitView={false}
                minZoom={1}
                maxZoom={1}
                zoomOnScroll={false}
                panOnDrag={[1, 2]}
                panOnScroll={false}
                preventScrolling={false}
                nodesDraggable
                nodesConnectable={false}
                elementsSelectable
                selectNodesOnDrag={false}
                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                translateExtent={[
                  [0, 0],
                  [viewportWidth || 1200, canvasHeight],
                ]}
                proOptions={{ hideAttribution: true }}
                className="swp-flow !bg-slate-50"
                style={{ width: '100%', height: canvasHeight }}
              />
            </div>
          </div>

          {contextMenu ? (
            <SwpFlowContextMenu
              menu={contextMenu}
              onClose={() => setContextMenu(null)}
              onAdd={(kind) => onAddNodeAt(kind, contextMenu.roleKey, contextMenu.canvasY)}
            />
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-slate-200/80 bg-slate-50 px-3 py-2 text-center text-[10px] text-slate-500">
          Right-click to add a block · Double-click to edit · Drag corners to resize · Shift + click
          another block to connect (shortest straight line) · Delete to remove
        </footer>
      </div>
    </SwpFlowEditorProvider>
  )
}
