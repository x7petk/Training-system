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

type Side = 'left' | 'right' | 'top' | 'bottom'

type RouteCandidate = {
  points: Point[]
  labelAt: Point
}

const SIDE_INSET = 0.18
const STUB = 8
const LANE_STEP = 7
const OBSTACLE_PAD = 5
const DECISION_OBSTACLE_PAD = 24
const HIT_PENALTY = 900
const BEND_PENALTY = 0.001

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function center(rect: BlockRect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

function sameColumn(a: BlockRect, b: BlockRect): boolean {
  const overlapW = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const minW = Math.min(a.width, b.width)
  if (minW <= 0) return false
  return overlapW >= minW * 0.45
}

function slotFraction(slot: number, total: number) {
  if (total <= 1) return 0.5
  const span = 1 - SIDE_INSET * 2
  return SIDE_INSET + ((slot + 1) / (total + 1)) * span
}

/** Anchor on any block side; spreads multiple connections along that side. */
export function sideAnchor(rect: BlockRect, side: Side, slot: number, total: number): Point {
  const frac = slotFraction(slot, total)
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  const hw = rect.width / 2
  const hh = rect.height / 2

  if (side === 'top' || side === 'bottom') {
    const x = rect.x + frac * rect.width
    if (!rect.isDecision) {
      return side === 'top' ? { x, y: rect.y } : { x, y: rect.y + rect.height }
    }
    const dx = Math.abs(x - cx)
    const ratio = hw > 0 ? clamp(dx / hw, 0, 1) : 0
    const dy = hh * (1 - ratio)
    return side === 'top' ? { x, y: cy - dy } : { x, y: cy + dy }
  }

  const y = rect.y + frac * rect.height
  if (!rect.isDecision) {
    return side === 'right' ? { x: rect.x + rect.width, y } : { x: rect.x, y }
  }
  const dy = Math.abs(y - cy)
  const ratio = hh > 0 ? clamp(dy / hh, 0, 1) : 0
  const dx = hw * (1 - ratio)
  return side === 'right' ? { x: cx + dx, y } : { x: cx - dx, y }
}

function inflateRect(rect: BlockRect, pad: number): BlockRect {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    isDecision: rect.isDecision,
  }
}

function segmentIntersectsRect(a: Point, b: Point, rect: BlockRect): boolean {
  const left = rect.x
  const right = rect.x + rect.width
  const top = rect.y
  const bottom = rect.y + rect.height

  if (Math.abs(a.y - b.y) < 0.5) {
    const y = a.y
    if (y < top || y > bottom) return false
    const minX = Math.min(a.x, b.x)
    const maxX = Math.max(a.x, b.x)
    return maxX > left && minX < right
  }

  if (Math.abs(a.x - b.x) < 0.5) {
    const x = a.x
    if (x < left || x > right) return false
    const minY = Math.min(a.y, b.y)
    const maxY = Math.max(a.y, b.y)
    return maxY > top && minY < bottom
  }

  return false
}

function countObstacleHits(points: Point[], obstacles: BlockRect[]): number {
  let hits = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    for (const obstacle of obstacles) {
      if (segmentIntersectsRect(a, b, obstacle)) {
        hits++
        break
      }
    }
  }
  return hits
}

function pathLength(points: Point[]): number {
  let len = 0
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  return len
}

function pointsToPath(points: Point[]): string {
  if (!points.length) return ''
  const [first, ...rest] = points
  return [`M ${first.x} ${first.y}`, ...rest.map((p) => `L ${p.x} ${p.y}`)].join(' ')
}

function labelAtMid(points: Point[]): Point {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 }
  const total = pathLength(points)
  let walked = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const seg = Math.hypot(b.x - a.x, b.y - a.y)
    if (walked + seg >= total / 2) {
      const t = seg > 0 ? (total / 2 - walked) / seg : 0
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    walked += seg
  }
  return points[Math.floor(points.length / 2)]
}

function dedupePoints(points: Point[]): Point[] {
  const out: Point[] = []
  for (const p of points) {
    const prev = out[out.length - 1]
    if (prev && Math.abs(prev.x - p.x) < 0.5 && Math.abs(prev.y - p.y) < 0.5) continue
    out.push(p)
  }
  return out
}

function scoreRoute(points: Point[], obstacles: BlockRect[]): number {
  const deduped = dedupePoints(points)
  return (
    pathLength(deduped) +
    countObstacleHits(deduped, obstacles) * HIT_PENALTY +
    Math.max(0, deduped.length - 2) * BEND_PENALTY
  )
}

function pickBestRoute(candidates: RouteCandidate[], obstacles: BlockRect[]): RouteCandidate {
  let best = candidates[0]
  let bestScore = scoreRoute(best.points, obstacles)
  for (let i = 1; i < candidates.length; i++) {
    const score = scoreRoute(candidates[i].points, obstacles)
    if (score < bestScore) {
      best = candidates[i]
      bestScore = score
    }
  }
  return best
}

function withStub(from: Point, to: Point, exitSide: Side, enterSide: Side): { from: Point; to: Point } {
  const stubFrom = { ...from }
  const stubTo = { ...to }
  if (exitSide === 'right') stubFrom.x += STUB
  else if (exitSide === 'left') stubFrom.x -= STUB
  else if (exitSide === 'bottom') stubFrom.y += STUB
  else stubFrom.y -= STUB

  if (enterSide === 'left') stubTo.x -= STUB
  else if (enterSide === 'right') stubTo.x += STUB
  else if (enterSide === 'top') stubTo.y -= STUB
  else stubTo.y += STUB

  return { from: stubFrom, to: stubTo }
}

function orthogonalCandidates(from: Point, to: Point, lane: number): RouteCandidate[] {
  const laneX = lane * LANE_STEP
  const laneY = lane * LANE_STEP
  const midX = (from.x + to.x) / 2 + laneX
  const midY = (from.y + to.y) / 2 + laneY

  const candidates: RouteCandidate[] = [
    { points: [from, { x: to.x, y: from.y }, to], labelAt: { x: (from.x + to.x) / 2, y: from.y } },
    { points: [from, { x: from.x, y: to.y }, to], labelAt: { x: from.x, y: (from.y + to.y) / 2 } },
    { points: [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to], labelAt: { x: midX, y: midY } },
    { points: [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to], labelAt: { x: midX, y: midY } },
  ]

  if (Math.abs(from.x - to.x) < 2 || Math.abs(from.y - to.y) < 2) {
    candidates.unshift({ points: [from, to], labelAt: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 } })
  }

  return candidates.map((c) => ({
    points: dedupePoints(c.points),
    labelAt: c.labelAt,
  }))
}

function channelCandidates(
  from: Point,
  to: Point,
  lane: number,
  obstacles: BlockRect[],
  srcRect: BlockRect,
  tgtRect: BlockRect,
): RouteCandidate[] {
  const laneOffset = Math.abs(lane) * LANE_STEP + OBSTACLE_PAD
  const relevant = obstacles.length
    ? obstacles
    : [inflateRect(srcRect, OBSTACLE_PAD), inflateRect(tgtRect, OBSTACLE_PAD)]

  const minX = Math.min(from.x, to.x, ...relevant.map((r) => r.x))
  const maxX = Math.max(from.x, to.x, ...relevant.map((r) => r.x + r.width))
  const minY = Math.min(from.y, to.y, ...relevant.map((r) => r.y))
  const maxY = Math.max(from.y, to.y, ...relevant.map((r) => r.y + r.height))

  const aboveY = minY - laneOffset
  const belowY = maxY + laneOffset
  const leftX = minX - laneOffset
  const rightX = maxX + laneOffset

  return [
  { points: [from, { x: from.x, y: aboveY }, { x: to.x, y: aboveY }, to], labelAt: { x: (from.x + to.x) / 2, y: aboveY } },
  { points: [from, { x: from.x, y: belowY }, { x: to.x, y: belowY }, to], labelAt: { x: (from.x + to.x) / 2, y: belowY } },
  { points: [from, { x: leftX, y: from.y }, { x: leftX, y: to.y }, to], labelAt: { x: leftX, y: (from.y + to.y) / 2 } },
  { points: [from, { x: rightX, y: from.y }, { x: rightX, y: to.y }, to], labelAt: { x: rightX, y: (from.y + to.y) / 2 } },
  ].map((c) => ({
    points: dedupePoints(c.points),
    labelAt: c.labelAt,
  }))
}

function preferredSides(srcRect: BlockRect, tgtRect: BlockRect, sameCol: boolean): { exit: Side; enter: Side } {
  const sc = center(srcRect)
  const tc = center(tgtRect)
  const dx = tc.x - sc.x
  const dy = tc.y - sc.y

  if (sameCol) {
    if (Math.abs(dy) >= Math.abs(dx) * 0.6) {
      return dy >= 0 ? { exit: 'bottom', enter: 'top' } : { exit: 'top', enter: 'bottom' }
    }
    return dx >= 0 ? { exit: 'right', enter: 'left' } : { exit: 'left', enter: 'right' }
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { exit: 'right', enter: 'left' } : { exit: 'left', enter: 'right' }
  }
  return dy >= 0 ? { exit: 'bottom', enter: 'top' } : { exit: 'top', enter: 'bottom' }
}

function sideAlternates(side: Side): Side[] {
  switch (side) {
    case 'right':
      return ['right', 'bottom', 'top', 'left']
    case 'left':
      return ['left', 'bottom', 'top', 'right']
    case 'bottom':
      return ['bottom', 'right', 'left', 'top']
    case 'top':
      return ['top', 'right', 'left', 'bottom']
  }
}

function routeBetween(
  from: Point,
  to: Point,
  exitSide: Side,
  enterSide: Side,
  lane: number,
  obstacles: BlockRect[],
  srcRect: BlockRect,
  tgtRect: BlockRect,
): RouteCandidate {
  const stubbed = withStub(from, to, exitSide, enterSide)
  const candidates = [
    ...orthogonalCandidates(stubbed.from, stubbed.to, lane),
    ...channelCandidates(stubbed.from, stubbed.to, lane, obstacles, srcRect, tgtRect),
  ]

  const best = pickBestRoute(candidates, obstacles)
  return {
    points: dedupePoints([from, ...best.points, to]),
    labelAt: best.labelAt,
  }
}

function buildObstacles(rects: Map<string, BlockRect>, srcKey: string, tgtKey: string): BlockRect[] {
  const obstacles: BlockRect[] = []
  for (const [key, rect] of rects.entries()) {
    if (key === srcKey || key === tgtKey) continue
    obstacles.push(inflateRect(rect, rect.isDecision ? DECISION_OBSTACLE_PAD : OBSTACLE_PAD))
  }
  return obstacles
}

type EdgeWork = MatrixEdgeSpec & {
  from: Point
  to: Point
  exitSide: Side
  enterSide: Side
  srcRect: BlockRect
  tgtRect: BlockRect
  sameColumn: boolean
  lane: number
}

/** Batch-layout matrix edges: shortest orthogonal paths that avoid other blocks when possible. */
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
    group.sort((a, b) => a.tgtRect.y + a.tgtRect.height / 2 - (b.tgtRect.y + b.tgtRect.height / 2))
  }
  for (const group of incoming.values()) {
    group.sort((a, b) => a.srcRect.y + a.srcRect.height / 2 - (b.srcRect.y + b.srcRect.height / 2))
  }

  const outSlot = new Map<string, number>()
  const inSlot = new Map<string, number>()
  for (const [key, group] of outgoing.entries()) {
    group.forEach((raw, i) => outSlot.set(`${raw.srcKey}::${raw.id}`, i))
    void key
  }
  for (const [key, group] of incoming.entries()) {
    group.forEach((raw, i) => inSlot.set(`${raw.tgtKey}::${raw.id}`, i))
    void key
  }

  const works: EdgeWork[] = raws.map((raw) => {
    const sameCol = sameColumn(raw.srcRect, raw.tgtRect)
    const preferred = preferredSides(raw.srcRect, raw.tgtRect, sameCol)
    const outTotal = outgoing.get(raw.srcKey)?.length ?? 1
    const inTotal = incoming.get(raw.tgtKey)?.length ?? 1
    const outIdx = outSlot.get(`${raw.srcKey}::${raw.id}`) ?? 0
    const inIdx = inSlot.get(`${raw.tgtKey}::${raw.id}`) ?? 0

    let bestFrom = sideAnchor(raw.srcRect, preferred.exit, outIdx, outTotal)
    let bestTo = sideAnchor(raw.tgtRect, preferred.enter, inIdx, inTotal)
    let bestExit = preferred.exit
    let bestEnter = preferred.enter
    let bestScore = Number.POSITIVE_INFINITY

    const obstacles = buildObstacles(rects, raw.srcKey, raw.tgtKey)

    for (const exitSide of sideAlternates(preferred.exit).slice(0, 3)) {
      for (const enterSide of sideAlternates(preferred.enter).slice(0, 3)) {
        const from = sideAnchor(raw.srcRect, exitSide, outIdx, outTotal)
        const to = sideAnchor(raw.tgtRect, enterSide, inIdx, inTotal)
        const route = routeBetween(from, to, exitSide, enterSide, 0, obstacles, raw.srcRect, raw.tgtRect)
        const score = scoreRoute(route.points, obstacles)
        if (score < bestScore) {
          bestScore = score
          bestFrom = from
          bestTo = to
          bestExit = exitSide
          bestEnter = enterSide
        }
      }
    }

    return {
      id: raw.id,
      srcKey: raw.srcKey,
      tgtKey: raw.tgtKey,
      label: raw.label,
      from: bestFrom,
      to: bestTo,
      exitSide: bestExit,
      enterSide: bestEnter,
      srcRect: raw.srcRect,
      tgtRect: raw.tgtRect,
      sameColumn: sameCol,
      lane: 0,
    }
  })

  const corridorKey = (work: EdgeWork) =>
    `${work.exitSide}:${work.enterSide}:${Math.round(work.from.x / 20)}:${Math.round(work.to.x / 20)}:${work.to.y >= work.from.y ? 'd' : 'u'}`

  const corridors = new Map<string, EdgeWork[]>()
  for (const work of works) {
    const key = corridorKey(work)
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

  return works.map(({ id, from, to, exitSide, enterSide, lane, label, srcRect, tgtRect, srcKey, tgtKey }) => {
    const obstacles = buildObstacles(rects, srcKey, tgtKey)
    const route = routeBetween(from, to, exitSide, enterSide, lane, obstacles, srcRect, tgtRect)
    return {
      id,
      path: pointsToPath(route.points),
      labelAt: labelAtMid(route.points),
      label,
    }
  })
}
