import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { BmsCatalogRow, BmsFlowEdge, BmsFlowNode, BmsProcessRow } from './types'
import {
  bmsBlockAccentClass,
  bmsBlockClass,
  bmsBlockInteractiveClass,
  bmsBlockKindLabel,
  bmsBlockRadiusClass,
  bmsBlockShape,
  bmsBlockSoftBadgeClass,
} from './bmsBlockStyles'
import { layoutMatrixEdges, type BlockRect } from './matrixEdgeGeometry'
import { computeMatrixLayout, matrixBlockLabelClass, matrixBlockMaxWidth, matrixBlockTextPlan, type MatrixDensity } from './matrixLayout'
import { matrixBlockHighlightClass, resolveMatrixBlockHighlight, type MatrixBlockHighlight } from './matrixBlockHighlight'
import { nodeMatchesFilters } from './validateProcessPublish'

type Props = {
  processes: BmsProcessRow[]
  roles: BmsCatalogRow[]
  forums: BmsCatalogRow[]
  systems: BmsCatalogRow[]
  filters: { systemIds: string[]; roleIds: string[]; forumIds: string[] }
  viewportWidth: number
  zoom: number
  highlightProcessId: string | null
  focusedNodeKey: string | null
  onSelectNode: (node: BmsFlowNode, process: BmsProcessRow) => void
  /** Extra padding and gap between blocks inside matrix cells (e.g. process editor). */
  relaxedBlockSpacing?: boolean
}

function systemMap(systems: BmsCatalogRow[]) {
  return new Map(systems.map((s) => [s.id, s]))
}

function blockKey(processId: string, nodeId: string) {
  return `${processId}::${nodeId}`
}

type Placed = { node: BmsFlowNode; process: BmsProcessRow; roleIdx: number; forumIdx: number }

type BlockTextPlan = ReturnType<typeof matrixBlockTextPlan>

function blockSizeStyle(maxWidth: number, fontSize: number) {
  return { width: maxWidth, maxWidth, fontSize, minWidth: 0 }
}

function MatrixTerminalBlock({
  node,
  process,
  density,
  maxWidth,
  text,
  highlight,
  blockRef,
  onSelect,
}: {
  node: BmsFlowNode
  process: BmsProcessRow
  density: MatrixDensity
  maxWidth: number
  text: BlockTextPlan
  highlight: MatrixBlockHighlight
  blockRef: (el: HTMLButtonElement | null) => void
  onSelect: () => void
}) {
  const tight = density === 'tight'
  return (
    <button
      ref={blockRef}
      type="button"
      title={node.label}
      onClick={onSelect}
      style={blockSizeStyle(maxWidth, text.typography.label)}
      className={[
        'group relative inline-flex shrink-0 flex-col items-center justify-center overflow-hidden border text-center leading-tight transition',
        bmsBlockClass[node.kind],
        bmsBlockRadiusClass(node.kind),
        bmsBlockInteractiveClass,
        tight ? 'min-h-[1.2rem] px-1 py-0.5' : 'min-h-[1.5rem] px-1 py-0.5',
        matrixBlockHighlightClass(highlight),
        highlight === 'none' ? 'hover:ring-1 hover:ring-accent/30' : '',
      ].join(' ')}
    >
      <span className={['absolute inset-x-4 top-0 h-0.5 opacity-70', bmsBlockAccentClass[node.kind]].join(' ')} aria-hidden />
      <div className={matrixBlockLabelClass(text.labelLines) + ' font-semibold tracking-[-0.01em]'}>{node.label}</div>
      {text.showMeta ? (
        <div className={matrixBlockLabelClass(1) + ' opacity-70'} style={{ fontSize: text.typography.meta }}>
          {process.name}
        </div>
      ) : null}
    </button>
  )
}

function MatrixDecisionBlock({
  node,
  density,
  maxWidth,
  text,
  highlight,
  blockRef,
  onSelect,
}: {
  node: BmsFlowNode
  density: MatrixDensity
  maxWidth: number
  text: BlockTextPlan
  highlight: MatrixBlockHighlight
  blockRef: (el: HTMLButtonElement | null) => void
  onSelect: () => void
}) {
  const dim = Math.min(maxWidth, density === 'tight' ? 44 : density === 'compact' ? 54 : 64)
  const labelSize = Math.min(text.typography.label, Math.max(5, Math.floor(dim / 7)))
  return (
    <button
      ref={blockRef}
      type="button"
      title={node.label}
      onClick={onSelect}
      style={{ width: dim, height: dim, minWidth: 0, fontSize: labelSize }}
      className={[
        'group relative inline-flex shrink-0 items-center justify-center overflow-hidden transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        matrixBlockHighlightClass(highlight),
        highlight === 'none' ? 'hover:ring-1 hover:ring-accent/30' : '',
      ].join(' ')}
      aria-label={node.label}
    >
      <span
        className={[
          'absolute inset-1 rotate-45 rounded-sm border shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_18px_rgba(245,158,11,0.12)] transition group-hover:-translate-y-px group-hover:shadow-[0_8px_20px_rgba(245,158,11,0.18)]',
          bmsBlockClass[node.kind],
        ].join(' ')}
      />
      <span className={matrixBlockLabelClass(3) + ' relative z-10 max-w-[82%] text-center font-semibold leading-tight tracking-[-0.01em]'}>
        {node.label}
      </span>
    </button>
  )
}

function MatrixStandardBlock({
  node,
  process,
  systems,
  density,
  maxWidth,
  text,
  highlight,
  blockRef,
  onSelect,
}: {
  node: BmsFlowNode
  process: BmsProcessRow
  systems: Map<string, BmsCatalogRow>
  density: MatrixDensity
  maxWidth: number
  text: BlockTextPlan
  highlight: MatrixBlockHighlight
  blockRef: (el: HTMLButtonElement | null) => void
  onSelect: () => void
}) {
  const compact = density !== 'comfortable'
  const systemIds = node.systemIds ?? []
  const showSystems = text.showTags && systemIds.length > 0
  const maxTags = compact ? 1 : 2

  return (
    <button
      ref={blockRef}
      type="button"
      title={node.label}
      onClick={onSelect}
      style={blockSizeStyle(maxWidth, text.typography.label)}
      className={[
        'group relative inline-flex shrink-0 flex-col overflow-hidden border text-left leading-tight transition',
        bmsBlockClass[node.kind],
        bmsBlockRadiusClass(node.kind),
        bmsBlockInteractiveClass,
        compact ? 'gap-0 px-1 py-0.5 pl-1.5' : 'gap-0.5 px-1.5 py-1 pl-2',
        matrixBlockHighlightClass(highlight),
        highlight === 'none' ? 'hover:ring-1 hover:ring-accent/30' : '',
      ].join(' ')}
    >
      <span className={['absolute inset-y-0 left-0 w-1 opacity-75', bmsBlockAccentClass[node.kind]].join(' ')} aria-hidden />
      <div className="flex min-w-0 w-full items-start justify-between gap-1">
        <div className={matrixBlockLabelClass(text.labelLines) + ' min-w-0 font-semibold tracking-[-0.01em]'}>
          {node.label}
        </div>
        {!compact ? (
          <span
            className={['shrink-0 rounded-full px-1 py-px font-semibold uppercase leading-none', bmsBlockSoftBadgeClass[node.kind]].join(' ')}
            style={{ fontSize: text.typography.tag }}
          >
            {bmsBlockKindLabel[node.kind]}
          </span>
        ) : null}
      </div>
      {showSystems ? (
        <div className="flex min-w-0 w-full flex-wrap gap-0.5 overflow-hidden">
          {systemIds.slice(0, maxTags).map((sid) => {
            const s = systems.get(sid)
            if (!s) return null
            return (
              <span
                key={sid}
                className="max-w-full truncate rounded-full border px-1 py-px font-semibold leading-none shadow-sm"
                style={{ fontSize: text.typography.tag, backgroundColor: `${s.color}1f`, borderColor: `${s.color}33`, color: s.color }}
                title={s.name}
              >
                {s.name}
              </span>
            )
          })}
        </div>
      ) : null}
      {text.showMeta ? (
        <div className={matrixBlockLabelClass(1) + ' opacity-65'} style={{ fontSize: text.typography.meta }} title={process.name}>
          {process.name}
        </div>
      ) : null}
    </button>
  )
}

export function BmsBrainMatrixView({
  processes,
  roles,
  forums,
  systems,
  filters,
  viewportWidth,
  zoom,
  highlightProcessId,
  focusedNodeKey,
  onSelectNode,
  relaxedBlockSpacing = false,
}: Props) {
  const sysById = systemMap(systems)
  const containerRef = useRef<HTMLDivElement>(null)
  const blockRefs = useRef(new Map<string, HTMLButtonElement>())
  const [rects, setRects] = useState<Map<string, BlockRect>>(new Map())
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 400 })

  const visibleRoles = roles.filter((r) => !filters.roleIds.length || filters.roleIds.includes(r.id))
  const visibleForums = forums.filter((f) => !filters.forumIds.length || filters.forumIds.includes(f.id))

  const layout = useMemo(
    () => computeMatrixLayout(viewportWidth, visibleRoles.length, zoom),
    [viewportWidth, visibleRoles.length, zoom],
  )

  const placed: Placed[] = []
  for (const process of processes) {
    for (const node of process.flow?.nodes ?? []) {
      if (!nodeMatchesFilters(node, filters)) continue
      const roleIdx = visibleRoles.findIndex((r) => r.id === node.roleId)
      const forumIdx = visibleForums.findIndex((f) => f.id === node.forumId)
      if (roleIdx < 0 || forumIdx < 0) continue
      placed.push({ node, process, roleIdx, forumIdx })
    }
  }

  const edges: { edge: BmsFlowEdge; process: BmsProcessRow }[] = useMemo(() => {
    const next: { edge: BmsFlowEdge; process: BmsProcessRow }[] = []
    for (const process of processes) {
      for (const edge of process.flow?.edges ?? []) {
        next.push({ edge, process })
      }
    }
    return next
  }, [processes])

  const { labelW, colW, cellMinH, headerH, density, blockScale, gridW } = layout
  const stdMaxW = matrixBlockMaxWidth(colW, blockScale, 'standard')
  const termMaxW = matrixBlockMaxWidth(colW, blockScale, 'terminal')
  const decMaxW = matrixBlockMaxWidth(colW, blockScale, 'decision')
  const stdText = matrixBlockTextPlan(blockScale, stdMaxW, density)
  const termText = matrixBlockTextPlan(blockScale, termMaxW, density)
  const decText = matrixBlockTextPlan(blockScale, decMaxW, density)

  const measureBlocks = useCallback(() => {
    const root = containerRef.current
    if (!root) return
    const rootRect = root.getBoundingClientRect()
    const next = new Map<string, BlockRect>()
    for (const [key, el] of blockRefs.current.entries()) {
      if (!el) continue
      const r = el.getBoundingClientRect()
      next.set(key, {
        x: r.left - rootRect.left,
        y: r.top - rootRect.top,
        width: r.width,
        height: r.height,
        isDecision: el.dataset.decision === 'true',
      })
    }
    setRects(next)
    setCanvasSize({ w: root.offsetWidth, h: root.offsetHeight })
  }, [])

  useLayoutEffect(() => {
    measureBlocks()
    const root = containerRef.current
    if (!root) return
    const ro = new ResizeObserver(() => measureBlocks())
    ro.observe(root)
    return () => ro.disconnect()
  }, [measureBlocks, placed.length, processes, zoom, layout, visibleRoles.length, visibleForums.length])

  const setBlockRef = useCallback(
    (key: string) => (el: HTMLButtonElement | null) => {
      if (el) blockRefs.current.set(key, el)
      else blockRefs.current.delete(key)
    },
    [],
  )

  const placedKeys = useMemo(() => new Set(placed.map(({ node, process }) => blockKey(process.id, node.id))), [placed])

  const drawnEdges = useMemo(() => {
    const specs = edges
      .map(({ edge, process }) => ({
        id: `${process.id}-${edge.id}`,
        srcKey: blockKey(process.id, edge.source),
        tgtKey: blockKey(process.id, edge.target),
        label: edge.label,
        processId: process.id,
      }))
      .filter((spec) => placedKeys.has(spec.srcKey) && placedKeys.has(spec.tgtKey))
    const laidOut = layoutMatrixEdges(
      specs.map(({ id, srcKey, tgtKey, label }) => ({ id, srcKey, tgtKey, label })),
      rects,
    )
    const byId = new Map(laidOut.map((e) => [e.id, e]))
    return specs
      .map((spec) => {
        const draw = byId.get(spec.id)
        if (!draw) return null
        return { ...draw, processId: spec.processId }
      })
      .filter((e): e is NonNullable<typeof e> => e != null)
  }, [edges, placedKeys, rects])

  const cellPad = relaxedBlockSpacing
    ? density === 'tight'
      ? 'p-2.5'
      : 'p-3'
    : density === 'tight'
      ? 'p-1.5'
      : 'p-2'
  const cellGap = relaxedBlockSpacing
    ? density === 'tight'
      ? 'gap-2'
      : 'gap-2.5'
    : density === 'tight'
      ? 'gap-1'
      : 'gap-1.5'

  return (
    <div className="overflow-auto rounded-2xl border border-border bg-white shadow-sm" style={{ maxHeight: 'min(75vh, 900px)' }}>
      <div ref={containerRef} className="relative w-full" style={{ width: gridW, minWidth: '100%' }}>
        <svg
          className="pointer-events-none absolute inset-0 z-[15]"
          width={canvasSize.w}
          height={canvasSize.h}
          aria-hidden
        >
          <defs>
            <marker id="bms-matrix-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
            </marker>
          </defs>
          {drawnEdges.map(({ id, processId, path, labelAt, label }) => {
            const active = !highlightProcessId || processId === highlightProcessId
            const stroke = active && highlightProcessId ? '#64748b' : '#94a3b8'
            return (
              <g key={id} opacity={active ? (highlightProcessId ? 0.95 : 0.8) : 0.18} color={stroke}>
                <path
                  d={path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={active && highlightProcessId ? 1.25 : 1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd="url(#bms-matrix-arrow)"
                />
                {label ? (
                  <text x={labelAt.x} y={labelAt.y - 4} textAnchor="middle" fontSize={7} fill={stroke}>
                    {label}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
        <div
          className="relative z-10 grid w-full"
          style={{
            gridTemplateColumns: `${labelW}px repeat(${visibleRoles.length}, minmax(0, 1fr))`,
            gridTemplateRows: `${headerH}px repeat(${visibleForums.length}, minmax(${cellMinH}px, auto))`,
          }}
        >
          <div
            className={[
              'sticky left-0 top-0 z-20 border-b border-r border-border bg-surface-raised/90 font-semibold',
              density === 'tight' ? 'p-1 text-[9px]' : 'p-1.5 text-[10px]',
            ].join(' ')}
          >
            Forum / Role
          </div>
          {visibleRoles.map((r) => (
            <div
              key={r.id}
              className={[
                'sticky top-0 z-10 border-b border-r border-border bg-surface-raised/90 text-center font-semibold',
                density === 'tight' ? 'p-1 text-[9px]' : 'p-1.5 text-[10px]',
              ].join(' ')}
              style={{ color: r.color }}
            >
              {r.name}
            </div>
          ))}
          {visibleForums.map((forum, fi) => (
            <div key={forum.id} className="contents">
              <div
                className={[
                  'sticky left-0 z-10 border-b border-r border-border bg-surface-raised/80 font-medium',
                  density === 'tight' ? 'p-1 text-[9px]' : 'p-1.5 text-[10px]',
                ].join(' ')}
                style={{ color: forum.color }}
              >
                <div className="font-semibold">{forum.name}</div>
                {density !== 'tight' ? (
                  <div className="text-[9px] text-muted line-clamp-2">{forum.description}</div>
                ) : null}
              </div>
              {visibleRoles.map((role, ri) => {
                const cellNodes = placed.filter((p) => p.roleIdx === ri && p.forumIdx === fi)
                return (
                  <div
                    key={`${forum.id}-${role.id}`}
                    className={[
                      'relative border-b border-r border-border/70 bg-canvas/20 transition-colors hover:bg-surface-raised/40',
                      cellPad,
                    ].join(' ')}
                    style={{ minHeight: cellMinH }}
                  >
                    <div className={['flex flex-row flex-wrap items-start content-start', cellGap].join(' ')}>
                      {cellNodes.map(({ node, process }) => {
                        const key = blockKey(process.id, node.id)
                        const highlight = resolveMatrixBlockHighlight(
                          process.id,
                          key,
                          highlightProcessId,
                          focusedNodeKey,
                        )
                        if (bmsBlockShape(node.kind) === 'diamond') {
                          return (
                            <MatrixDecisionBlock
                              key={key}
                              node={node}
                              density={density}
                              maxWidth={decMaxW}
                              text={decText}
                              highlight={highlight}
                              blockRef={(el) => {
                                if (el) el.dataset.decision = 'true'
                                setBlockRef(key)(el)
                              }}
                              onSelect={() => onSelectNode(node, process)}
                            />
                          )
                        }
                        if (node.kind === 'start' || node.kind === 'end') {
                          return (
                            <MatrixTerminalBlock
                              key={key}
                              node={node}
                              process={process}
                              density={density}
                              maxWidth={termMaxW}
                              text={termText}
                              highlight={highlight}
                              blockRef={setBlockRef(key)}
                              onSelect={() => onSelectNode(node, process)}
                            />
                          )
                        }
                        return (
                          <MatrixStandardBlock
                            key={key}
                            node={node}
                            process={process}
                            systems={sysById}
                            density={density}
                            maxWidth={stdMaxW}
                            text={stdText}
                            highlight={highlight}
                            blockRef={setBlockRef(key)}
                            onSelect={() => onSelectNode(node, process)}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
