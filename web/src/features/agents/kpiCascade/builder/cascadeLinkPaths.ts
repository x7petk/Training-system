import type { CascadeLink } from '../cascadeTypes'

export type Point = { x: number; y: number }

const ANCHOR_FAN_SPACING = 6
const WAVE_AMPLITUDE_SCALE = 1.1
const WAVE_AMPLITUDE_MIN = 2
const WAVE_AMPLITUDE_MAX = 4
const WAVE_SEGMENT_STEP = 12

function fanOffset(index: number, count: number, spacing: number): number {
  if (count <= 1) return 0
  return (index - (count - 1) / 2) * spacing
}

function smoothQuadraticPath(points: Point[]): string {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2
    const yc = (points[i].y + points[i + 1].y) / 2
    d += ` Q ${points[i].x} ${points[i].y} ${xc} ${yc}`
  }
  const n = points.length
  d += ` Q ${points[n - 2].x} ${points[n - 2].y} ${points[n - 1].x} ${points[n - 1].y}`
  return d
}

/** Short path with a subtle sine wave along the chord between anchors. */
export function wavyLinkPath(start: Point, end: Point): string {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.hypot(dx, dy)
  if (len < 12) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`
  }

  const ux = dx / len
  const uy = dy / len
  const nx = -uy
  const ny = ux

  const amplitude =
    Math.min(WAVE_AMPLITUDE_MAX, Math.max(WAVE_AMPLITUDE_MIN, len * 0.03)) *
    WAVE_AMPLITUDE_SCALE
  const waves = len > 200 ? 1.25 : 1
  const segmentCount = Math.max(14, Math.round(len / WAVE_SEGMENT_STEP))

  const samples: Point[] = []
  for (let i = 0; i <= segmentCount; i++) {
    const t = i / segmentCount
    const taper = Math.sin(t * Math.PI)
    const offset = -Math.sin(t * Math.PI * 2 * waves) * amplitude * taper
    samples.push({
      x: start.x + dx * t + nx * offset,
      y: start.y + dy * t + ny * offset,
    })
  }
  samples[0] = start
  samples[samples.length - 1] = end

  return smoothQuadraticPath(samples)
}

export type MetricAnchorSide = 'left' | 'right' | 'top' | 'bottom'

export function getMetricAnchor(
  boardEl: HTMLElement,
  metricEl: HTMLElement,
  side: MetricAnchorSide,
): Point | null {
  const board = boardEl.getBoundingClientRect()
  const tile = metricEl.getBoundingClientRect()
  const cx = tile.left - board.left + tile.width / 2
  const cy = tile.top - board.top + tile.height / 2
  switch (side) {
    case 'right':
      return { x: tile.right - board.left, y: cy }
    case 'left':
      return { x: tile.left - board.left, y: cy }
    case 'top':
      return { x: cx, y: tile.top - board.top }
    case 'bottom':
      return { x: cx, y: tile.bottom - board.top }
  }
}

type LinkSpec = {
  id: string
  fromMetricId: string
  toMetricId: string
  start: Point
  end: Point
}

type LinkLayout = 'columns' | 'rows'

function linkAnchors(layout: LinkLayout): { from: MetricAnchorSide; to: MetricAnchorSide } {
  // Column board: from right column → to left column.
  // Row board: from lower forum row → to upper forum row.
  return layout === 'rows'
    ? { from: 'top', to: 'bottom' }
    : { from: 'left', to: 'right' }
}

export function buildVisibleLinkPaths(
  boardEl: HTMLElement | null,
  tileRefs: Map<string, HTMLDivElement>,
  links: CascadeLink[],
  visibleMetricIds: Set<string>,
  layout: LinkLayout = 'columns',
): { id: string; d: string }[] {
  if (!boardEl) return []

  const { from: fromSide, to: toSide } = linkAnchors(layout)
  const specs: LinkSpec[] = []

  for (const link of links) {
    if (!visibleMetricIds.has(link.fromMetricId) || !visibleMetricIds.has(link.toMetricId)) {
      continue
    }

    const fromEl = tileRefs.get(link.fromMetricId)
    const toEl = tileRefs.get(link.toMetricId)
    if (!fromEl || !toEl) continue

    const start = getMetricAnchor(boardEl, fromEl, fromSide)
    const end = getMetricAnchor(boardEl, toEl, toSide)
    if (!start || !end) continue

    specs.push({
      id: link.id,
      fromMetricId: link.fromMetricId,
      toMetricId: link.toMetricId,
      start: { ...start },
      end: { ...end },
    })
  }

  const byFrom = new Map<string, LinkSpec[]>()
  const byTo = new Map<string, LinkSpec[]>()

  for (const spec of specs) {
    const fromList = byFrom.get(spec.fromMetricId) ?? []
    fromList.push(spec)
    byFrom.set(spec.fromMetricId, fromList)

    const toList = byTo.get(spec.toMetricId) ?? []
    toList.push(spec)
    byTo.set(spec.toMetricId, toList)
  }

  return specs.map((spec) => {
    const fromPeers = byFrom.get(spec.fromMetricId) ?? [spec]
    const fromIndex = fromPeers.findIndex((p) => p.id === spec.id)
    const fromFan = fanOffset(fromIndex, fromPeers.length, ANCHOR_FAN_SPACING)

    const toPeers = byTo.get(spec.toMetricId) ?? [spec]
    const toIndex = toPeers.findIndex((p) => p.id === spec.id)
    const toFan = fanOffset(toIndex, toPeers.length, ANCHOR_FAN_SPACING)

    const start =
      layout === 'rows'
        ? { x: spec.start.x + fromFan, y: spec.start.y }
        : { x: spec.start.x, y: spec.start.y + fromFan }
    const end =
      layout === 'rows'
        ? { x: spec.end.x + toFan, y: spec.end.y }
        : { x: spec.end.x, y: spec.end.y + toFan }

    return { id: spec.id, d: wavyLinkPath(start, end) }
  })
}
