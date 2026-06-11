import { layoutMatrixEdges, type BlockRect, type Point } from './matrixEdgeGeometry'
import { bmsBlockShape } from './bmsBlockStyles'
import type { BmsFlowEdge, BmsFlowNode, BmsProcessFlow } from './types'

type LayoutOptions = {
  lockedNodeId?: string | null
  minBlockGap?: number
  decisionClearance?: number
  arrowCorridorGap?: number
  gridSize?: number
  maxPasses?: number
}

type LayoutRect = BlockRect & { id: string }

const DEFAULT_BLOCK_GAP = 56
const DEFAULT_DECISION_CLEARANCE = 104
const DEFAULT_ARROW_CORRIDOR_GAP = 96
const DECISION_BRANCH_CORRIDOR_GAP = 120
const DEFAULT_GRID_SIZE = 20
const DEFAULT_MAX_PASSES = 8
const FALLBACK_STANDARD = { width: 190, height: 86 }
const FALLBACK_TERMINAL = { width: 170, height: 70 }
const FALLBACK_DECISION = { width: 132, height: 132 }

function isDiamondNode(node: BmsFlowNode) {
  return bmsBlockShape(node.kind) === 'diamond'
}

function estimateNodeSize(node: BmsFlowNode): { width: number; height: number } {
  if (isDiamondNode(node)) return FALLBACK_DECISION
  if (node.kind === 'start' || node.kind === 'end') return FALLBACK_TERMINAL
  const labelRows = Math.ceil(Math.max(node.label.length, 18) / 26)
  return { width: FALLBACK_STANDARD.width, height: Math.max(FALLBACK_STANDARD.height, 58 + labelRows * 12) }
}

function toRect(node: BmsFlowNode): LayoutRect {
  const size = estimateNodeSize(node)
  return {
    id: node.id,
    x: node.position?.x ?? 0,
    y: node.position?.y ?? 0,
    width: size.width,
    height: size.height,
    isDecision: isDiamondNode(node),
  }
}

function rectClearance(rect: LayoutRect, normalGap: number, decisionClearance: number) {
  return rect.isDecision ? decisionClearance : normalGap
}

function pairGap(a: LayoutRect, b: LayoutRect, normalGap: number, decisionClearance: number) {
  return Math.max(rectClearance(a, normalGap, decisionClearance), rectClearance(b, normalGap, decisionClearance))
}

function expanded(rect: LayoutRect, gap: number): LayoutRect {
  return {
    ...rect,
    x: rect.x - gap / 2,
    y: rect.y - gap / 2,
    width: rect.width + gap,
    height: rect.height + gap,
  }
}

function overlaps(a: BlockRect, b: BlockRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function moveRect(rect: LayoutRect, dx: number, dy: number) {
  rect.x = Math.max(0, rect.x + dx)
  rect.y = Math.max(0, rect.y + dy)
}

function snap(value: number, gridSize: number) {
  return Math.max(0, Math.round(value / gridSize) * gridSize)
}

function center(rect: BlockRect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

function resolveBlockCollision(
  a: LayoutRect,
  b: LayoutRect,
  lockedNodeId: string | null | undefined,
  normalGap: number,
  decisionClearance: number,
): boolean {
  const gap = pairGap(a, b, normalGap, decisionClearance)
  const ea = expanded(a, gap)
  const eb = expanded(b, gap)
  if (!overlaps(ea, eb)) return false

  const aLocked = a.id === lockedNodeId
  const bLocked = b.id === lockedNodeId
  const movable = aLocked && !bLocked ? b : bLocked && !aLocked ? a : b
  const fixed = movable === a ? b : a
  const mc = center(movable)
  const fc = center(fixed)
  const pushRight = mc.x >= fc.x
  const pushDown = mc.y >= fc.y

  const horizontal = pushRight
    ? fixed.x + fixed.width + gap - movable.x
    : fixed.x - gap - (movable.x + movable.width)
  const vertical = pushDown
    ? fixed.y + fixed.height + gap - movable.y
    : fixed.y - gap - (movable.y + movable.height)

  const horizontalMove = Math.abs(horizontal)
  const verticalMove = Math.abs(vertical)
  if (horizontalMove <= verticalMove || Math.abs(mc.x - fc.x) > Math.abs(mc.y - fc.y)) {
    moveRect(movable, horizontal, 0)
  } else {
    moveRect(movable, 0, vertical)
  }
  return true
}

function pathPoints(path: string): Point[] {
  const matches = path.match(/[ML]\s+-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?/g) ?? []
  return matches.map((part) => {
    const [, x, y] = part.match(/[ML]\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/) ?? []
    return { x: Number(x), y: Number(y) }
  })
}

function segmentIntersectsRect(a: Point, b: Point, rect: BlockRect): boolean {
  if (Math.abs(a.y - b.y) < 0.5) {
    const minX = Math.min(a.x, b.x)
    const maxX = Math.max(a.x, b.x)
    return a.y >= rect.y && a.y <= rect.y + rect.height && maxX > rect.x && minX < rect.x + rect.width
  }
  if (Math.abs(a.x - b.x) < 0.5) {
    const minY = Math.min(a.y, b.y)
    const maxY = Math.max(a.y, b.y)
    return a.x >= rect.x && a.x <= rect.x + rect.width && maxY > rect.y && minY < rect.y + rect.height
  }
  return false
}

function resolveArrowCorridorConflicts(
  rects: LayoutRect[],
  edges: BmsFlowEdge[],
  lockedNodeId: string | null | undefined,
  normalGap: number,
  decisionClearance: number,
  arrowCorridorGap: number,
): boolean {
  const rectMap = new Map(rects.map((rect) => [rect.id, rect]))
  const specs = edges.map((edge) => ({ id: edge.id, srcKey: edge.source, tgtKey: edge.target, label: edge.label }))
  const routes = layoutMatrixEdges(specs, rectMap)
  const byId = new Map(rects.map((rect) => [rect.id, rect]))
  let changed = false

  for (const route of routes) {
    const edge = edges.find((candidate) => candidate.id === route.id)
    if (!edge) continue
    const sourceRect = byId.get(edge.source)
    const targetRect = byId.get(edge.target)
    const sourceDecision = Boolean(sourceRect?.isDecision)
    const targetDecision = Boolean(targetRect?.isDecision)
    const corridorGap = sourceDecision || targetDecision ? Math.max(arrowCorridorGap, DECISION_BRANCH_CORRIDOR_GAP) : arrowCorridorGap
    const points = pathPoints(route.path)
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]
      const b = points[i]
      for (const rect of rects) {
        if (rect.id === edge.source || rect.id === edge.target || rect.id === lockedNodeId) continue
        const clearance = Math.max(corridorGap, rectClearance(rect, normalGap, decisionClearance))
        if (!segmentIntersectsRect(a, b, expanded(rect, clearance))) continue
        const horizontal = Math.abs(a.y - b.y) < 0.5
        if (horizontal) moveRect(rect, 0, rect.y + rect.height / 2 >= a.y ? clearance : -clearance)
        else moveRect(rect, rect.x + rect.width / 2 >= a.x ? clearance : -clearance, 0)
        changed = true
      }
    }
  }

  return changed
}

export function normalizeBmsFlowLayout(flow: BmsProcessFlow, options: LayoutOptions = {}): BmsProcessFlow {
  const minBlockGap = options.minBlockGap ?? DEFAULT_BLOCK_GAP
  const decisionClearance = options.decisionClearance ?? DEFAULT_DECISION_CLEARANCE
  const arrowCorridorGap = options.arrowCorridorGap ?? DEFAULT_ARROW_CORRIDOR_GAP
  const gridSize = options.gridSize ?? DEFAULT_GRID_SIZE
  const maxPasses = options.maxPasses ?? DEFAULT_MAX_PASSES
  const rects = flow.nodes.map(toRect)

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        changed = resolveBlockCollision(rects[i], rects[j], options.lockedNodeId, minBlockGap, decisionClearance) || changed
      }
    }
    changed =
      resolveArrowCorridorConflicts(
        rects,
        flow.edges ?? [],
        options.lockedNodeId,
        minBlockGap,
        decisionClearance,
        arrowCorridorGap,
      ) || changed
    if (!changed) break
  }

  const byId = new Map(rects.map((rect) => [rect.id, rect]))
  return {
    ...flow,
    nodes: flow.nodes.map((node) => {
      const rect = byId.get(node.id)
      if (!rect) return node
      return { ...node, position: { x: snap(rect.x, gridSize), y: snap(rect.y, gridSize) } }
    }),
  }
}
