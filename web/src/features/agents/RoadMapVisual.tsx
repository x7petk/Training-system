import { forwardRef, useMemo } from 'react'
import type {
  RoadMapItem,
  RoadMapPhase,
  RoadMapResult,
  RoadMapWorkstream,
  RoadMapWorkstreamColor,
} from './roadMapBuilderTypes'

type Palette = { fill: string; stroke: string; text: string; soft: string }

const COLORS: Record<RoadMapWorkstreamColor, Palette> = {
  amber: { fill: '#fef3c7', stroke: '#d97706', text: '#78350f', soft: '#fffbeb' },
  emerald: { fill: '#d1fae5', stroke: '#059669', text: '#064e3b', soft: '#ecfdf5' },
  sky: { fill: '#e0f2fe', stroke: '#0284c7', text: '#0c4a6e', soft: '#f0f9ff' },
  violet: { fill: '#ede9fe', stroke: '#7c3aed', text: '#4c1d95', soft: '#f5f3ff' },
  rose: { fill: '#ffe4e6', stroke: '#e11d48', text: '#881337', soft: '#fff1f2' },
  indigo: { fill: '#e0e7ff', stroke: '#4f46e5', text: '#312e81', soft: '#eef2ff' },
  teal: { fill: '#ccfbf1', stroke: '#0d9488', text: '#134e4a', soft: '#f0fdfa' },
  fuchsia: { fill: '#fae8ff', stroke: '#c026d3', text: '#701a75', soft: '#fdf4ff' },
}

function paletteFor(ws?: RoadMapWorkstream): Palette {
  if (!ws) return COLORS.sky
  return COLORS[ws.color] ?? COLORS.sky
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  if (!text) return []
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (next.length > maxChars && line) {
      lines.push(line)
      line = w
      if (lines.length >= maxLines) break
    } else {
      line = next
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  if (lines.length === maxLines && words.length > 0) {
    // Trim final line with ellipsis if there is leftover content.
    const last = lines[maxLines - 1]
    const remaining = words.join(' ')
    const joined = lines.join(' ')
    if (joined.length < remaining.length) {
      lines[maxLines - 1] = last.length > 3 ? last.replace(/[\s\S]{1,3}$/, '…') : last
    }
  }
  return lines
}

type ViewMode = 'quarterly' | 'now_next_later' | 'gantt'

type Props = {
  result: RoadMapResult
  view: ViewMode
  width?: number
}

const FONT_STACK =
  "'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif"

/**
 * Self-contained SVG. All styles are inline so XMLSerializer + canvas export work.
 * The component forwards a ref to the underlying `<svg>` for PNG/PDF export.
 */
export const RoadMapVisual = forwardRef<SVGSVGElement, Props>(function RoadMapVisual(
  { result, view, width = 1280 },
  ref,
) {
  if (view === 'quarterly') return <QuarterlyView ref={ref} result={result} width={width} />
  if (view === 'now_next_later') return <NowNextLaterView ref={ref} result={result} width={width} />
  return <GanttView ref={ref} result={result} width={width} />
})

/* -------------------------------------------------------------------------- */
/* Quarterly swim-lanes                                                       */
/* -------------------------------------------------------------------------- */

type QuarterlyProps = { result: RoadMapResult; width: number }

const QuarterlyView = forwardRef<SVGSVGElement, QuarterlyProps>(function QuarterlyView(
  { result, width },
  ref,
) {
  const layout = useMemo(() => layoutQuarterly(result, width), [result, width])
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      style={{ background: '#ffffff', fontFamily: FONT_STACK, display: 'block' }}
    >
      <Header
        title={result.title}
        subtitle={result.polishedVision}
        viewLabel="Quarterly swim-lanes"
        width={layout.width}
      />

      {/* Phase header row */}
      {layout.phases.map((p) => (
        <g key={p.id}>
          <rect
            x={p.x}
            y={layout.gridTop}
            width={p.width}
            height={28}
            fill="#0f172a"
            rx={4}
          />
          <text
            x={p.x + p.width / 2}
            y={layout.gridTop + 19}
            textAnchor="middle"
            fontSize={12}
            fontWeight={600}
            fill="#ffffff"
          >
            {p.label}
          </text>
          <text
            x={p.x + p.width / 2}
            y={layout.gridTop + 44}
            textAnchor="middle"
            fontSize={10}
            fill="#64748b"
          >
            M{p.phase.startMonth}–M{p.phase.endMonth}
          </text>
        </g>
      ))}

      {/* Vertical grid lines */}
      {layout.phases.slice(1).map((p) => (
        <line
          key={`vgrid-${p.id}`}
          x1={p.x}
          x2={p.x}
          y1={layout.gridTop + 56}
          y2={layout.gridBottom}
          stroke="#e2e8f0"
          strokeDasharray="3 3"
        />
      ))}

      {/* Lanes */}
      {layout.lanes.map((lane) => {
        const palette = paletteFor(lane.workstream)
        return (
          <g key={lane.workstream.id}>
            <rect
              x={layout.laneLabelX}
              y={lane.y}
              width={layout.width - layout.laneLabelX - layout.margin}
              height={lane.height}
              fill={palette.soft}
              rx={8}
            />
            <rect
              x={layout.laneLabelX}
              y={lane.y}
              width={6}
              height={lane.height}
              fill={palette.stroke}
              rx={3}
            />
            {/* Lane label */}
            <text
              x={layout.margin}
              y={lane.y + 22}
              fontSize={13}
              fontWeight={700}
              fill={palette.text}
            >
              {lane.workstream.name}
            </text>
            {lane.workstream.description ? (
              <text
                x={layout.margin}
                y={lane.y + 40}
                fontSize={10}
                fill="#64748b"
              >
                {(lane.workstream.description || '').slice(0, 64)}
              </text>
            ) : null}
            {/* Items */}
            {lane.items.map((it) => {
              const itemPalette = paletteFor(lane.workstream)
              const lines = wrapText(it.item.title, 28, 2)
              return (
                <g key={it.item.id}>
                  <rect
                    x={it.x}
                    y={it.y}
                    width={it.width}
                    height={it.height}
                    rx={6}
                    fill="#ffffff"
                    stroke={itemPalette.stroke}
                    strokeWidth={1.2}
                  />
                  <rect
                    x={it.x}
                    y={it.y}
                    width={4}
                    height={it.height}
                    fill={
                      it.item.priority === 'high'
                        ? '#ef4444'
                        : it.item.priority === 'medium'
                          ? '#f59e0b'
                          : '#22c55e'
                    }
                  />
                  {lines.map((line, idx) => (
                    <text
                      key={`${it.item.id}-line-${idx}`}
                      x={it.x + 12}
                      y={it.y + 18 + idx * 14}
                      fontSize={11}
                      fontWeight={600}
                      fill={itemPalette.text}
                    >
                      {line}
                    </text>
                  ))}
                  {it.item.milestone ? (
                    <text
                      x={it.x + it.width - 8}
                      y={it.y + 14}
                      fontSize={9}
                      textAnchor="end"
                      fontWeight={700}
                      fill={itemPalette.stroke}
                    >
                      ★
                    </text>
                  ) : null}
                </g>
              )
            })}
          </g>
        )
      })}

      <Footer width={layout.width} y={layout.gridBottom + 18} />
    </svg>
  )
})

function layoutQuarterly(result: RoadMapResult, width: number) {
  const margin = 28
  const headerHeight = 110
  const gridTop = headerHeight + 12
  const phaseHeaderHeight = 56
  const laneLabelX = 180
  const phases = result.phases.length > 0 ? result.phases : fallbackPhases(result)
  const trackWidth = width - laneLabelX - margin
  const totalSpan = phases.reduce((s, p) => s + Math.max(1, p.endMonth - p.startMonth + 1), 0)
  let cursor = laneLabelX
  const phaseBoxes = phases.map((p) => {
    const span = Math.max(1, p.endMonth - p.startMonth + 1)
    const w = (trackWidth * span) / totalSpan
    const x = cursor
    cursor += w
    return { id: p.id, label: p.label, phase: p, x, width: w }
  })

  const monthToX = (m: number) => {
    const px = phaseBoxes.find((p) => m >= p.phase.startMonth && m <= p.phase.endMonth)
    if (px) {
      const localOffset = (m - px.phase.startMonth + 0) / Math.max(1, px.phase.endMonth - px.phase.startMonth + 1)
      return px.x + px.width * localOffset
    }
    if (m < phaseBoxes[0].phase.startMonth) return phaseBoxes[0].x
    const last = phaseBoxes[phaseBoxes.length - 1]
    return last.x + last.width
  }

  const laneTop = gridTop + phaseHeaderHeight + 8

  const lanes = result.workstreams.map((ws) => {
    const items = result.items.filter((it) => it.workstreamId === ws.id)
    const stacks = packItemRows(items)
    return { workstream: ws, items, stacks }
  })

  // height per lane based on number of stacked rows
  const rowHeight = 44
  const laneVerticalPad = 16
  let y = laneTop
  const finalLanes = lanes.map((l) => {
    const stackCount = Math.max(1, l.stacks.maxRow + 1)
    const height = stackCount * rowHeight + laneVerticalPad
    const positionedItems = l.stacks.itemPositions.map(({ item, row }) => {
      const x1 = monthToX(item.startMonth)
      const x2 = monthToX(item.endMonth + 1)
      const itemX = Math.max(laneLabelX + 12, x1 + 4)
      const itemW = Math.max(60, x2 - x1 - 8)
      return {
        item,
        x: itemX,
        y: y + 10 + row * rowHeight,
        width: itemW,
        height: rowHeight - 6,
      }
    })
    const laneY = y
    y += height + 6
    return { workstream: l.workstream, y: laneY, height, items: positionedItems }
  })

  const gridBottom = y + 4

  return {
    width,
    height: gridBottom + 48,
    margin,
    gridTop,
    gridBottom,
    laneLabelX,
    phases: phaseBoxes,
    lanes: finalLanes,
  }
}

function packItemRows(items: RoadMapItem[]): {
  maxRow: number
  itemPositions: { item: RoadMapItem; row: number }[]
} {
  const sorted = [...items].sort((a, b) => a.startMonth - b.startMonth || a.endMonth - b.endMonth)
  const rowEnds: number[] = []
  const result: { item: RoadMapItem; row: number }[] = []
  for (const it of sorted) {
    let placed = -1
    for (let r = 0; r < rowEnds.length; r += 1) {
      if (rowEnds[r] < it.startMonth) {
        placed = r
        rowEnds[r] = it.endMonth
        break
      }
    }
    if (placed === -1) {
      rowEnds.push(it.endMonth)
      placed = rowEnds.length - 1
    }
    result.push({ item: it, row: placed })
  }
  return { maxRow: Math.max(0, rowEnds.length - 1), itemPositions: result }
}

function fallbackPhases(result: RoadMapResult): RoadMapPhase[] {
  const horizon = result.horizonMonths || 12
  if (result.bucket === 'months') {
    return Array.from({ length: horizon }, (_, idx) => ({
      id: `m${idx + 1}`,
      label: `M${idx + 1}`,
      startMonth: idx + 1,
      endMonth: idx + 1,
    }))
  }
  const quarters = Math.max(1, Math.ceil(horizon / 3))
  return Array.from({ length: quarters }, (_, idx) => ({
    id: `q${idx + 1}`,
    label: `Q${idx + 1}`,
    startMonth: idx * 3 + 1,
    endMonth: Math.min(horizon, idx * 3 + 3),
  }))
}

/* -------------------------------------------------------------------------- */
/* Now / Next / Later                                                          */
/* -------------------------------------------------------------------------- */

type NnlProps = { result: RoadMapResult; width: number }

const NowNextLaterView = forwardRef<SVGSVGElement, NnlProps>(function NowNextLaterView(
  { result, width },
  ref,
) {
  const layout = useMemo(() => layoutNowNextLater(result, width), [result, width])
  const columnTitles: Record<'now' | 'next' | 'later', { title: string; subtitle: string; tint: string }> = {
    now: { title: 'Now', subtitle: 'Next 1–3 months', tint: '#0ea5e9' },
    next: { title: 'Next', subtitle: 'Months 4–6', tint: '#8b5cf6' },
    later: { title: 'Later', subtitle: 'Month 7+', tint: '#64748b' },
  }
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      style={{ background: '#ffffff', fontFamily: FONT_STACK, display: 'block' }}
    >
      <Header
        title={result.title}
        subtitle={result.polishedVision}
        viewLabel="Now / Next / Later"
        width={layout.width}
      />

      {layout.columns.map((col) => {
        const titles = columnTitles[col.key]
        return (
          <g key={col.key}>
            <rect
              x={col.x}
              y={layout.gridTop}
              width={col.width}
              height={28}
              fill={titles.tint}
              rx={4}
            />
            <text
              x={col.x + col.width / 2}
              y={layout.gridTop + 19}
              textAnchor="middle"
              fontSize={13}
              fontWeight={700}
              fill="#ffffff"
            >
              {titles.title}
            </text>
            <text
              x={col.x + col.width / 2}
              y={layout.gridTop + 46}
              textAnchor="middle"
              fontSize={10}
              fill="#64748b"
            >
              {titles.subtitle}
            </text>

            {col.items.map((it) => {
              const ws = result.workstreams.find((w) => w.id === it.item.workstreamId)
              const palette = paletteFor(ws)
              const titleLines = wrapText(it.item.title, 32, 2)
              const descLines = wrapText(it.item.description || '', 40, 3)
              return (
                <g key={it.item.id}>
                  <rect
                    x={it.x}
                    y={it.y}
                    width={it.width}
                    height={it.height}
                    rx={8}
                    fill="#ffffff"
                    stroke={palette.stroke}
                    strokeWidth={1.2}
                  />
                  <rect x={it.x} y={it.y} width={it.width} height={4} fill={palette.stroke} rx={2} />
                  {ws ? (
                    <text
                      x={it.x + 12}
                      y={it.y + 22}
                      fontSize={10}
                      fontWeight={600}
                      fill={palette.text}
                    >
                      {ws.name}
                    </text>
                  ) : null}
                  {titleLines.map((line, idx) => (
                    <text
                      key={`${it.item.id}-t-${idx}`}
                      x={it.x + 12}
                      y={it.y + 42 + idx * 14}
                      fontSize={12}
                      fontWeight={700}
                      fill="#0f172a"
                    >
                      {line}
                    </text>
                  ))}
                  {descLines.map((line, idx) => (
                    <text
                      key={`${it.item.id}-d-${idx}`}
                      x={it.x + 12}
                      y={it.y + 42 + titleLines.length * 14 + 8 + idx * 12}
                      fontSize={10}
                      fill="#475569"
                    >
                      {line}
                    </text>
                  ))}
                  <circle
                    cx={it.x + it.width - 14}
                    cy={it.y + 24}
                    r={4}
                    fill={
                      it.item.priority === 'high'
                        ? '#ef4444'
                        : it.item.priority === 'medium'
                          ? '#f59e0b'
                          : '#22c55e'
                    }
                  />
                </g>
              )
            })}
          </g>
        )
      })}

      <Footer width={layout.width} y={layout.gridBottom + 16} />
    </svg>
  )
})

function layoutNowNextLater(result: RoadMapResult, width: number) {
  const margin = 28
  const headerHeight = 110
  const gridTop = headerHeight + 12
  const colGap = 16
  const cols: ('now' | 'next' | 'later')[] = ['now', 'next', 'later']
  const colWidth = (width - margin * 2 - colGap * 2) / 3

  const buckets: Record<'now' | 'next' | 'later', RoadMapItem[]> = { now: [], next: [], later: [] }
  for (const it of result.items) {
    const startsAt = Math.max(1, it.startMonth)
    if (startsAt <= 3) buckets.now.push(it)
    else if (startsAt <= 6) buckets.next.push(it)
    else buckets.later.push(it)
  }

  const columns = cols.map((key, idx) => {
    const x = margin + idx * (colWidth + colGap)
    const items = buckets[key].map((it, i) => {
      const cardHeight = 110
      const yTop = gridTop + 60 + i * (cardHeight + 12)
      return { item: it, x: x + 6, y: yTop, width: colWidth - 12, height: cardHeight }
    })
    return { key, x, width: colWidth, items }
  })

  const tallest = Math.max(
    ...columns.map((c) => (c.items.length > 0 ? c.items[c.items.length - 1].y + c.items[c.items.length - 1].height : gridTop + 60)),
  )

  return { width, height: tallest + 70, gridTop, gridBottom: tallest + 8, columns }
}

/* -------------------------------------------------------------------------- */
/* Gantt                                                                       */
/* -------------------------------------------------------------------------- */

type GanttProps = { result: RoadMapResult; width: number }

const GanttView = forwardRef<SVGSVGElement, GanttProps>(function GanttView(
  { result, width },
  ref,
) {
  const layout = useMemo(() => layoutGantt(result, width), [result, width])
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      style={{ background: '#ffffff', fontFamily: FONT_STACK, display: 'block' }}
    >
      <Header
        title={result.title}
        subtitle={result.polishedVision}
        viewLabel="Gantt timeline"
        width={layout.width}
      />

      {/* Month axis */}
      {layout.months.map((m) => (
        <g key={`month-${m.month}`}>
          <line
            x1={m.x}
            x2={m.x}
            y1={layout.gridTop + 18}
            y2={layout.gridBottom}
            stroke="#e2e8f0"
            strokeDasharray="2 3"
          />
          <text
            x={m.x + m.width / 2}
            y={layout.gridTop + 14}
            textAnchor="middle"
            fontSize={10}
            fontWeight={600}
            fill="#475569"
          >
            M{m.month}
          </text>
        </g>
      ))}

      {/* Workstream label column background */}
      <rect
        x={0}
        y={layout.gridTop + 18}
        width={layout.labelWidth}
        height={layout.gridBottom - layout.gridTop - 18}
        fill="#f8fafc"
      />

      {/* Rows */}
      {layout.rows.map((row) => {
        const ws = result.workstreams.find((w) => w.id === row.item.workstreamId)
        const palette = paletteFor(ws)
        return (
          <g key={row.item.id}>
            <rect
              x={0}
              y={row.y - 2}
              width={layout.width}
              height={row.height + 4}
              fill={row.idx % 2 === 0 ? '#ffffff' : '#f8fafc'}
            />
            <text
              x={12}
              y={row.y + row.height / 2 + 4}
              fontSize={11}
              fontWeight={600}
              fill={palette.text}
            >
              {ws ? ws.name : '—'}
            </text>
            <text
              x={12}
              y={row.y + row.height / 2 + 18}
              fontSize={10}
              fill="#475569"
            >
              {row.item.title.length > 26 ? `${row.item.title.slice(0, 24)}…` : row.item.title}
            </text>
            <rect
              x={row.x}
              y={row.y + 6}
              width={row.width}
              height={row.height - 14}
              rx={4}
              fill={palette.fill}
              stroke={palette.stroke}
              strokeWidth={1.2}
            />
            <rect
              x={row.x}
              y={row.y + 6}
              width={Math.max(3, Math.min(6, row.width / 6))}
              height={row.height - 14}
              fill={palette.stroke}
              rx={2}
            />
            <text
              x={row.x + 12}
              y={row.y + row.height / 2 + 2}
              fontSize={10}
              fontWeight={700}
              fill={palette.text}
            >
              {row.item.title.length > 24 ? `${row.item.title.slice(0, 22)}…` : row.item.title}
            </text>
            {row.item.milestone ? (
              <polygon
                points={`${row.x + row.width - 4},${row.y + row.height / 2 - 6} ${row.x + row.width + 6},${row.y + row.height / 2} ${row.x + row.width - 4},${row.y + row.height / 2 + 6} ${row.x + row.width - 14},${row.y + row.height / 2}`}
                fill={palette.stroke}
              />
            ) : null}
          </g>
        )
      })}

      {/* Key milestones markers */}
      {result.keyMilestones.map((ms) => {
        const x = monthToXGantt(ms.month, layout)
        return (
          <g key={ms.id}>
            <line x1={x} x2={x} y1={layout.gridTop + 18} y2={layout.gridBottom} stroke="#ef4444" strokeDasharray="4 4" />
            <polygon
              points={`${x - 5},${layout.gridTop + 28} ${x + 5},${layout.gridTop + 28} ${x},${layout.gridTop + 38}`}
              fill="#ef4444"
            />
            <text x={x + 8} y={layout.gridTop + 34} fontSize={10} fill="#7f1d1d" fontWeight={700}>
              {ms.title.length > 28 ? `${ms.title.slice(0, 26)}…` : ms.title}
            </text>
          </g>
        )
      })}

      <Footer width={layout.width} y={layout.gridBottom + 18} />
    </svg>
  )
})

function layoutGantt(result: RoadMapResult, width: number) {
  const margin = 16
  const headerHeight = 110
  const gridTop = headerHeight + 12
  const labelWidth = 200
  const horizon = result.horizonMonths || 12
  const trackWidth = width - labelWidth - margin
  const monthWidth = trackWidth / horizon
  const rowHeight = 44

  const months = Array.from({ length: horizon }, (_, idx) => ({
    month: idx + 1,
    x: labelWidth + idx * monthWidth,
    width: monthWidth,
  }))

  const items = [...result.items].sort((a, b) => a.startMonth - b.startMonth || a.endMonth - b.endMonth)

  const rows = items.map((item, idx) => {
    const x = labelWidth + (item.startMonth - 1) * monthWidth
    const end = Math.max(item.startMonth, item.endMonth)
    const w = Math.max(40, (end - item.startMonth + 1) * monthWidth - 6)
    return {
      idx,
      item,
      x,
      y: gridTop + 28 + idx * rowHeight,
      width: w,
      height: rowHeight - 6,
    }
  })

  const gridBottom = rows.length > 0 ? rows[rows.length - 1].y + rows[rows.length - 1].height + 8 : gridTop + 80
  return {
    width,
    height: gridBottom + 50,
    margin,
    gridTop,
    gridBottom,
    labelWidth,
    monthWidth,
    horizon,
    months,
    rows,
  }
}

function monthToXGantt(month: number, layout: { labelWidth: number; monthWidth: number; horizon: number }) {
  const m = Math.max(1, Math.min(layout.horizon, month))
  return layout.labelWidth + (m - 0.5) * layout.monthWidth
}

/* -------------------------------------------------------------------------- */
/* Shared header / footer                                                      */
/* -------------------------------------------------------------------------- */

function Header({
  title,
  subtitle,
  viewLabel,
  width,
}: {
  title: string
  subtitle: string
  viewLabel: string
  width: number
}) {
  const titleLines = wrapText(title || 'Untitled roadmap', 70, 1)
  const subLines = wrapText(subtitle || '', 110, 2)
  return (
    <g>
      <rect x={0} y={0} width={width} height={92} fill="#0f172a" />
      <text x={24} y={36} fontSize={20} fontWeight={700} fill="#ffffff">
        {titleLines[0] || 'Untitled roadmap'}
      </text>
      <text x={24} y={60} fontSize={12} fill="#cbd5e1">
        {subLines[0] || ''}
      </text>
      <text x={24} y={76} fontSize={12} fill="#cbd5e1">
        {subLines[1] || ''}
      </text>
      <rect x={width - 220} y={20} width={196} height={26} rx={13} fill="#1e293b" stroke="#334155" />
      <text x={width - 122} y={37} fontSize={11} fontWeight={600} textAnchor="middle" fill="#e2e8f0">
        {viewLabel}
      </text>
    </g>
  )
}

function Footer({ width, y }: { width: number; y: number }) {
  return (
    <g>
      <text x={24} y={y} fontSize={10} fill="#94a3b8">
        Priority:
      </text>
      <circle cx={66} cy={y - 3} r={4} fill="#ef4444" />
      <text x={74} y={y} fontSize={10} fill="#475569">
        High
      </text>
      <circle cx={108} cy={y - 3} r={4} fill="#f59e0b" />
      <text x={116} y={y} fontSize={10} fill="#475569">
        Medium
      </text>
      <circle cx={158} cy={y - 3} r={4} fill="#22c55e" />
      <text x={166} y={y} fontSize={10} fill="#475569">
        Low
      </text>
      <text x={width - 24} y={y} fontSize={10} textAnchor="end" fill="#94a3b8">
        Generated with Road Map Builder
      </text>
    </g>
  )
}
