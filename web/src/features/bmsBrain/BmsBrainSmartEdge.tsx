import { BaseEdge, EdgeLabelRenderer, useNodes, type EdgeProps, type Node } from '@xyflow/react'
import { bmsBlockShape } from './bmsBlockStyles'
import { layoutMatrixEdges, type BlockRect } from './matrixEdgeGeometry'
import type { BmsFlowNodeData } from './BmsBrainFlowNodes'

const FALLBACK_WIDTH = 180
const FALLBACK_HEIGHT = 88

function nodeRect(node: Node<BmsFlowNodeData>): BlockRect {
  const measured = node.measured
  return {
    x: node.position.x,
    y: node.position.y,
    width: measured?.width ?? node.width ?? FALLBACK_WIDTH,
    height: measured?.height ?? node.height ?? FALLBACK_HEIGHT,
    isDecision: bmsBlockShape(node.data.kind) === 'diamond',
  }
}

function fallbackOrthogonalPath(sourceX: number, sourceY: number, targetX: number, targetY: number) {
  const midY = (sourceY + targetY) / 2
  return `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`
}

export function BmsBrainSmartEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  label,
}: EdgeProps) {
  const nodes = useNodes<Node<BmsFlowNodeData>>()
  const rects = new Map<string, BlockRect>()
  for (const node of nodes) {
    rects.set(node.id, nodeRect(node))
  }

  const [draw] = layoutMatrixEdges([{ id, srcKey: source, tgtKey: target, label: typeof label === 'string' ? label : undefined }], rects)
  const path = draw?.path ?? fallbackOrthogonalPath(sourceX, sourceY, targetX, targetY)
  const labelAt = draw?.labelAt ?? { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 }

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan rounded-full border border-border bg-white px-1.5 py-0.5 text-[9px] font-semibold text-muted shadow-sm"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelAt.x}px, ${labelAt.y}px)`,
              pointerEvents: 'all',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
