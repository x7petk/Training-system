import { SWP_ROLE_KEY_ORDER } from './roleLaneTheme'
import { nodeSize, SWP_NODE_DEFAULT_SIZE } from './swpNodeDefaults'
import type { SwpFlowNode, SwpProcessFlow, SwpNodeKind, SwpRoleKey } from './types'

export const SWP_COLUMN_COUNT = SWP_ROLE_KEY_ORDER.length
/** Fallback when container width is not measured yet. */
export const SWP_COLUMN_WIDTH = 210
export const SWP_LANE_HEADER_HEIGHT = 52
export const SWP_Y_STEP = 80
export const SWP_BRANCH_OFFSET = 40

/** @deprecated Use SWP_NODE_DEFAULT_SIZE */
export const SWP_NODE_WIDTH: Record<SwpNodeKind, number> = {
  start: SWP_NODE_DEFAULT_SIZE.start.width,
  end: SWP_NODE_DEFAULT_SIZE.end.width,
  task: SWP_NODE_DEFAULT_SIZE.task.width,
  decision: SWP_NODE_DEFAULT_SIZE.decision.width,
}

export function columnWidthForViewport(viewportWidth: number): number {
  return viewportWidth / SWP_COLUMN_COUNT
}

export function columnIndex(roleKey: SwpRoleKey): number {
  const i = SWP_ROLE_KEY_ORDER.indexOf(roleKey)
  return i >= 0 ? i : 0
}

export function columnCenterX(
  roleKey: SwpRoleKey,
  colWidth: number,
  nodeWidth: number,
): number {
  const idx = columnIndex(roleKey)
  return idx * colWidth + Math.max(8, (colWidth - nodeWidth) / 2)
}

export function snapY(y: number): number {
  const minY = SWP_LANE_HEADER_HEIGHT + 8
  const rel = Math.max(0, y - minY)
  return minY + Math.round(rel / SWP_Y_STEP) * SWP_Y_STEP
}

/** Snap block to column center + vertical grid. */
export function snapNodePosition(
  x: number,
  y: number,
  kind: SwpNodeKind,
  colWidth: number,
  nodeWidth = SWP_NODE_DEFAULT_SIZE[kind].width,
): { x: number; y: number; roleKey: SwpRoleKey } {
  const centerX = x + nodeWidth / 2
  const idx = Math.max(
    0,
    Math.min(SWP_COLUMN_COUNT - 1, Math.floor(centerX / colWidth)),
  )
  const roleKey = SWP_ROLE_KEY_ORDER[idx]
  return {
    roleKey,
    x: columnCenterX(roleKey, colWidth, nodeWidth),
    y: snapY(y),
  }
}

/** Default position: centered in role column + vertical slot. */
export function slotPosition(
  roleKey: SwpRoleKey,
  ySlot: number,
  colWidth: number,
  kind: SwpNodeKind = 'task',
  branch = 0,
): { x: number; y: number } {
  const { width } = SWP_NODE_DEFAULT_SIZE[kind]
  return {
    x: columnCenterX(roleKey, colWidth, width),
    y: SWP_LANE_HEADER_HEIGHT + 12 + ySlot * SWP_Y_STEP + branch * SWP_BRANCH_OFFSET,
  }
}

export function alignFlowNode(node: SwpFlowNode, colWidth: number): SwpFlowNode {
  const { width } = nodeSize(node)
  return {
    ...node,
    position: {
      x: columnCenterX(node.roleKey, colWidth, width),
      y: node.position.y,
    },
  }
}

export function alignFlowNodes(nodes: SwpFlowNode[], colWidth: number): SwpFlowNode[] {
  return nodes.map((n) => alignFlowNode(n, colWidth))
}

/** Migrate legacy row-lane (col = horizontal) data to column swimlanes. */
export function migrateFlowToColumnLayout(
  flow: SwpProcessFlow,
  colWidth = SWP_COLUMN_WIDTH * SWP_COLUMN_COUNT,
): SwpProcessFlow {
  const cw = colWidth / SWP_COLUMN_COUNT
  const nodes = flow.nodes.map((node) => {
    let withPos = node
    if (!node.position) {
      if (node.col !== undefined) {
        const col = node.col ?? 0
        const row = node.row ?? 0
        withPos = {
          ...node,
          position: {
            x: 0,
            y: SWP_LANE_HEADER_HEIGHT + 12 + col * SWP_Y_STEP + row * SWP_BRANCH_OFFSET,
          },
        }
      } else {
        withPos = { ...node, position: slotPosition(node.roleKey, 0, cw, node.kind) }
      }
    }
    return alignFlowNode(withPos, cw)
  })
  return { ...flow, nodes }
}

export function nextNodeYInColumn(nodes: SwpFlowNode[], roleKey: SwpRoleKey): number {
  const inColumn = nodes.filter((n) => n.roleKey === roleKey)
  if (inColumn.length === 0) return SWP_LANE_HEADER_HEIGHT + 12
  return Math.max(...inColumn.map((n) => n.position.y)) + SWP_Y_STEP
}

export const SWP_CANVAS_BOTTOM_PAD = 120

export function boardHeightFromNodes(
  nodes: { position: { y: number }; height?: number }[],
): number {
  const maxY = nodes.reduce((m, n) => Math.max(m, n.position.y + (n.height ?? 56)), 0)
  return Math.max(640, maxY + SWP_CANVAS_BOTTOM_PAD)
}
