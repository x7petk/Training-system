export type Point = { x: number; y: number }

export type BlockRect = {
  x: number
  y: number
  width: number
  height: number
  isDecision?: boolean
}

export type MatrixEdgeSpec = {
  id: string
  srcKey: string
  tgtKey: string
  label?: string
}

export type MatrixEdgeDraw = {
  id: string
  path: string
  labelAt: Point
  label?: string
}

const SIDE_INSET = 0.18
const STUB = 10
const LANE_STEP = 7
const LOOP_EXTRA = 14
const CLOSE_H_GAP = 40
const CLOSE_V_GAP = 52
const COLUMN_CLEARANCE = 8
const COLUMN_LANE_STEP = 5

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function rectsAreClose(a: BlockRect, b: BlockRect): boolean {
  const hGap = b.x - (a.x + a.width)
  const vOverlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  const vGap = vOverlap >= 0 ? 0 : Math.abs(vOverlap)
  if (hGap < CLOSE_H_GAP && vGap < CLOSE_V_GAP) return true
  const dx = b.x - (a.x + a.width)
  const dy = (b.y + b.height / 2) - (a.y + a.height / 2)
  return Math.hypot(dx, dy) < 72
}

function sameColumn(a: BlockRect, b: BlockRect): boolean {
  const overlapW = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const minW = Math.min(a.width, b.width)
  if (minW <= 0) return false
  return overlapW >= minW * 0.45
}

/** Left-side vertical routing for blocks in the same matrix column. */
function columnPath(from: Point, to: Point, lane: number): { path: string; labelAt: Point } {
  const laneOffset = Math.abs(lane) * COLUMN_LANE_STEP
  const leftEdge = Math.min(from.x, to.x)
  const channelX = leftEdge - COLUMN_CLEARANCE - laneOffset

  const path = [
    `M ${from.x} ${from.y}`,
    `L ${channelX} ${from.y}`,
    `L ${channelX} ${to.y}`,
    `L ${to.x} ${to.y}`,
  ].join(' ')

  return { path, labelAt: { x: channelX - 3, y: (from.y + to.y) / 2 } }
}

/** Minimal connector when blocks sit near each other — avoids big loop routes. */
function shortPath(from: Point, to: Point): { path: string; labelAt: Point } {
  const gapX = to.x - from.x
  const gapY = Math.abs(from.y - to.y)

  if (gapX > 3 && gapY < 4) {
    return {
      path: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      labelAt: { x: (from.x + to.x) / 2, y: from.y - 4 },
    }
  }

  if (gapX > 3) {
    const stub = clamp(gapX * 0.22, 2, 5)
    const exitX = from.x + stub
    const enterX = to.x - stub
    if (exitX >= enterX) {
      const midX = (from.x + to.x) / 2
      return {
        path: `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`,
        labelAt: { x: midX, y: (from.y + to.y) / 2 },
      }
    }
    const midX = (exitX + enterX) / 2
    return {
      path: `M ${from.x} ${from.y} L ${exitX} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${enterX} ${to.y} L ${to.x} ${to.y}`,
      labelAt: { x: midX, y: (from.y + to.y) / 2 },
    }
  }

  const bump = clamp(4 + gapY * 0.05, 3, 8)
  const midX = from.x + bump
  return {
    path: `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`,
    labelAt: { x: midX + 2, y: (from.y + to.y) / 2 },
  }
}

function slotFraction(slot: number, total: number) {
  if (total <= 1) return 0.5
  const span = 1 - SIDE_INSET * 2
  return SIDE_INSET + ((slot + 1) / (total + 1)) * span
}

/** Anchor on the left or right edge; spreads multiple connections along the side. */
export function sideAnchor(rect: BlockRect, side: 'left' | 'right', slot: number, total: number): Point {
  const frac = slotFraction(slot, total)
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  const hw = rect.width / 2
  const hh = rect.height / 2
  const y = rect.y + frac * rect.height

  if (rect.isDecision) {
    const dy = Math.abs(y - cy)
    const ratio = hh > 0 ? clamp(dy / hh, 0, 1) : 0
    const dx = hw * (1 - ratio)
    return side === 'right' ? { x: cx + dx, y } : { x: cx - dx, y }
  }

  return side === 'right' ? { x: rect.x + rect.width, y } : { x: rect.x, y }
}

function forwardPath(from: Point, to: Point, lane: number): { path: string; labelAt: Point } {
  const gapX = to.x - from.x
  if (gapX < 32) return shortPath(from, to)

  const laneOffset = lane * LANE_STEP
  const exitX = from.x + STUB
  const enterX = to.x - STUB
  if (exitX >= enterX) return shortPath(from, to)

  const midX = (exitX + enterX) / 2 + laneOffset

  const path = [
    `M ${from.x} ${from.y}`,
    `L ${exitX} ${from.y}`,
    `L ${midX} ${from.y}`,
    `L ${midX} ${to.y}`,
    `L ${enterX} ${to.y}`,
    `L ${to.x} ${to.y}`,
  ].join(' ')

  return { path, labelAt: { x: midX, y: (from.y + to.y) / 2 } }
}

function loopPath(from: Point, to: Point, lane: number, routeBelow: boolean): { path: string; labelAt: Point } {
  const laneOffset = lane * LANE_STEP
  const loopX = from.x + STUB + LOOP_EXTRA + laneOffset
  const enterX = to.x - STUB
  const routeY = routeBelow
    ? Math.max(from.y, to.y) + 18 + lane * 3
    : Math.min(from.y, to.y) - 18 - lane * 3

  const path = [
    `M ${from.x} ${from.y}`,
    `L ${loopX} ${from.y}`,
    `L ${loopX} ${routeY}`,
    `L ${enterX} ${routeY}`,
    `L ${enterX} ${to.y}`,
    `L ${to.x} ${to.y}`,
  ].join(' ')

  return { path, labelAt: { x: (loopX + enterX) / 2, y: routeY } }
}

function routePath(
  from: Point,
  to: Point,
  lane: number,
  srcRect: BlockRect,
  tgtRect: BlockRect,
  sameCol: boolean,
): { path: string; labelAt: Point } {
  if (sameCol) return columnPath(from, to, lane)
  if (rectsAreClose(srcRect, tgtRect)) return shortPath(from, to)
  if (to.x > from.x + 8) return forwardPath(from, to, lane)
  return loopPath(from, to, lane, to.y >= from.y - 4)
}

function corridorKey(from: Point, to: Point, forward: boolean, sameCol: boolean) {
  if (sameCol) {
    return `c:${Math.round(from.x / 24)}:${to.y >= from.y ? 'd' : 'u'}`
  }
  if (forward) {
    return `f:${Math.round(from.x / 24)}:${Math.round(to.x / 24)}`
  }
  return `b:${Math.round(from.x / 24)}:${Math.round(to.x / 24)}:${to.y >= from.y ? 'd' : 'u'}`
}

type EdgeWork = MatrixEdgeSpec & {
  from: Point
  to: Point
  srcRect: BlockRect
  tgtRect: BlockRect
  sameColumn: boolean
  forward: boolean
  lane: number
}

/** Batch-layout matrix edges: right-side exits, left-side entries, staggered lanes. */
export function layoutMatrixEdges(specs: MatrixEdgeSpec[], rects: Map<string, BlockRect>): MatrixEdgeDraw[] {
  type Raw = MatrixEdgeSpec & { srcRect: BlockRect; tgtRect: BlockRect }
  const raws: Raw[] = []

  for (const spec of specs) {
    const srcRect = rects.get(spec.srcKey)
    const tgtRect = rects.get(spec.tgtKey)
    if (!srcRect || !tgtRect) continue
    raws.push({ ...spec, srcRect, tgtRect })
  }

  const outgoing = new Map<string, Raw[]>()
  const incoming = new Map<string, Raw[]>()
  for (const raw of raws) {
    const out = outgoing.get(raw.srcKey) ?? []
    out.push(raw)
    outgoing.set(raw.srcKey, out)
    const inc = incoming.get(raw.tgtKey) ?? []
    inc.push(raw)
    incoming.set(raw.tgtKey, inc)
  }

  for (const group of outgoing.values()) {
    group.sort((a, b) => {
      const ay = a.tgtRect.y + a.tgtRect.height / 2
      const by = b.tgtRect.y + b.tgtRect.height / 2
      return ay - by
    })
  }
  for (const group of incoming.values()) {
    group.sort((a, b) => {
      const ay = a.srcRect.y + a.srcRect.height / 2
      const by = b.srcRect.y + b.srcRect.height / 2
      return ay - by
    })
  }

  const outSlotSameCol = new Map<string, number>()
  const outSlotCross = new Map<string, number>()
  const inSlot = new Map<string, number>()
  for (const [key, group] of outgoing.entries()) {
    const sameColGroup = group.filter((raw) => sameColumn(raw.srcRect, raw.tgtRect))
    const crossGroup = group.filter((raw) => !sameColumn(raw.srcRect, raw.tgtRect))
    sameColGroup.forEach((raw, i) => outSlotSameCol.set(`${raw.srcKey}::${raw.id}`, i))
    crossGroup.forEach((raw, i) => outSlotCross.set(`${raw.srcKey}::${raw.id}`, i))
    void key
  }
  for (const [key, group] of incoming.entries()) {
    group.forEach((raw, i) => inSlot.set(`${raw.tgtKey}::${raw.id}`, i))
    void key
  }

  const works: EdgeWork[] = raws.map((raw) => {
    const sameCol = sameColumn(raw.srcRect, raw.tgtRect)
    const outGroup = outgoing.get(raw.srcKey) ?? []
    const sameColOutTotal = outGroup.filter((r) => sameColumn(r.srcRect, r.tgtRect)).length || 1
    const crossOutTotal = outGroup.filter((r) => !sameColumn(r.srcRect, r.tgtRect)).length || 1
    const inTotal = incoming.get(raw.tgtKey)?.length ?? 1
    const from = sideAnchor(
      raw.srcRect,
      sameCol ? 'left' : 'right',
      sameCol
        ? (outSlotSameCol.get(`${raw.srcKey}::${raw.id}`) ?? 0)
        : (outSlotCross.get(`${raw.srcKey}::${raw.id}`) ?? 0),
      sameCol ? sameColOutTotal : crossOutTotal,
    )
    const to = sideAnchor(raw.tgtRect, 'left', inSlot.get(`${raw.tgtKey}::${raw.id}`) ?? 0, inTotal)
    const forward = !sameCol && to.x > from.x + 8
    return {
      id: raw.id,
      srcKey: raw.srcKey,
      tgtKey: raw.tgtKey,
      label: raw.label,
      from,
      to,
      srcRect: raw.srcRect,
      tgtRect: raw.tgtRect,
      sameColumn: sameCol,
      forward,
      lane: 0,
    }
  })

  const corridors = new Map<string, EdgeWork[]>()
  for (const work of works) {
    const key = corridorKey(work.from, work.to, work.forward, work.sameColumn)
    const group = corridors.get(key) ?? []
    group.push(work)
    corridors.set(key, group)
  }

  for (const group of corridors.values()) {
    group.sort((a, b) => a.from.y + a.to.y - (b.from.y + b.to.y))
    const center = (group.length - 1) / 2
    group.forEach((work, i) => {
      work.lane = i - center
    })
  }

  return works.map(({ id, from, to, lane, label, srcRect, tgtRect, sameColumn: sameCol }) => {
    const { path, labelAt } = routePath(from, to, lane, srcRect, tgtRect, sameCol)
    return { id, path, labelAt, label }
  })
}
