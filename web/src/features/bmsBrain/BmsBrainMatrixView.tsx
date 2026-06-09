import type { BmsCatalogRow, BmsFlowEdge, BmsFlowNode, BmsProcessRow } from './types'
import { nodeMatchesFilters } from './validateProcessPublish'

const CELL_MIN_H = 120
const COL_W = 160

type Props = {
  processes: BmsProcessRow[]
  roles: BmsCatalogRow[]
  forums: BmsCatalogRow[]
  systems: BmsCatalogRow[]
  filters: { processIds: string[]; systemIds: string[]; roleIds: string[]; forumIds: string[] }
  zoom: number
  selectedNodeId: string | null
  onSelectNode: (node: BmsFlowNode, process: BmsProcessRow) => void
}

function systemMap(systems: BmsCatalogRow[]) {
  return new Map(systems.map((s) => [s.id, s]))
}

function blockClass(kind: BmsFlowNode['kind']): string {
  switch (kind) {
    case 'start':
      return 'border-emerald-400 bg-emerald-50 text-emerald-900'
    case 'end':
      return 'border-slate-400 bg-slate-100 text-slate-800'
    case 'decision':
      return 'border-amber-400 bg-amber-50 text-amber-950 rotate-45 scale-[0.85]'
    default:
      return 'border-sky-300 bg-sky-50 text-sky-950'
  }
}

export function BmsBrainMatrixView({
  processes,
  roles,
  forums,
  systems,
  filters,
  zoom,
  selectedNodeId,
  onSelectNode,
}: Props) {
  const sysById = systemMap(systems)
  const visibleRoles = roles.filter((r) => !filters.roleIds.length || filters.roleIds.includes(r.id))
  const visibleForums = forums.filter((f) => !filters.forumIds.length || filters.forumIds.includes(f.id))

  type Placed = { node: BmsFlowNode; process: BmsProcessRow; roleIdx: number; forumIdx: number }
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

  const edges: { edge: BmsFlowEdge; process: BmsProcessRow }[] = []
  for (const process of processes) {
    for (const edge of process.flow?.edges ?? []) {
      edges.push({ edge, process })
    }
  }

  const gridW = visibleRoles.length * COL_W + 140
  const gridH = visibleForums.length * CELL_MIN_H + 80
  const placedByNodeId = new Map(placed.map((p) => [p.node.id, p]))

  function cellCenter(roleIdx: number, forumIdx: number) {
    return {
      x: 140 + roleIdx * COL_W + COL_W / 2,
      y: 48 + forumIdx * CELL_MIN_H + CELL_MIN_H / 2,
    }
  }

  const drawnEdges = edges.flatMap(({ edge }) => {
    const src = placedByNodeId.get(edge.source)
    const tgt = placedByNodeId.get(edge.target)
    if (!src || !tgt) return []
    const from = cellCenter(src.roleIdx, src.forumIdx)
    const to = cellCenter(tgt.roleIdx, tgt.forumIdx)
    return [{ edge, from, to }]
  })

  return (
    <div className="overflow-auto rounded-2xl border border-border bg-white shadow-sm">
      <div
        className="relative"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: gridW, minHeight: gridH }}
      >
        <svg
          className="pointer-events-none absolute inset-0 z-[5]"
          width={gridW}
          height={gridH}
          aria-hidden
        >
          <defs>
            <marker id="bms-matrix-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#94a3b8" />
            </marker>
          </defs>
          {drawnEdges.map(({ edge, from, to }) => {
            const midX = (from.x + to.x) / 2
            const midY = (from.y + to.y) / 2
            const d =
              from.x === to.x || from.y === to.y
                ? `M ${from.x} ${from.y} L ${to.x} ${to.y}`
                : `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`
            return (
              <g key={edge.id}>
                <path
                  d={d}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  markerEnd="url(#bms-matrix-arrow)"
                  opacity={0.85}
                />
                {edge.label ? (
                  <text x={midX} y={midY - 4} textAnchor="middle" fontSize={9} fill="#64748b">
                    {edge.label}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
        <div
          className="relative z-10 grid"
          style={{
            gridTemplateColumns: `140px repeat(${visibleRoles.length}, ${COL_W}px)`,
            gridTemplateRows: `48px repeat(${visibleForums.length}, minmax(${CELL_MIN_H}px, auto))`,
          }}
        >
          <div className="sticky left-0 top-0 z-20 border-b border-r border-border bg-surface-raised/90 p-2 text-xs font-semibold">
            Forum / Role
          </div>
          {visibleRoles.map((r) => (
            <div
              key={r.id}
              className="sticky top-0 z-10 border-b border-r border-border bg-surface-raised/90 p-2 text-center text-xs font-semibold"
              style={{ color: r.color }}
            >
              {r.name}
            </div>
          ))}
          {visibleForums.map((forum, fi) => (
            <div key={forum.id} className="contents">
              <div
                key={`f-${forum.id}`}
                className="sticky left-0 z-10 border-b border-r border-border bg-surface-raised/80 p-2 text-xs font-medium"
                style={{ color: forum.color }}
              >
                <div className="font-semibold">{forum.name}</div>
                <div className="text-[10px] text-muted line-clamp-2">{forum.description}</div>
              </div>
              {visibleRoles.map((role, ri) => {
                const cellNodes = placed.filter((p) => p.roleIdx === ri && p.forumIdx === fi)
                return (
                  <div
                    key={`${forum.id}-${role.id}`}
                    className="relative border-b border-r border-border/70 bg-canvas/20 p-2"
                    style={{ minHeight: CELL_MIN_H }}
                  >
                    <div className="flex flex-col gap-2">
                      {cellNodes.map(({ node, process }) => (
                        <button
                          key={`${process.id}-${node.id}`}
                          type="button"
                          onClick={() => onSelectNode(node, process)}
                          className={[
                            'w-full rounded-lg border px-2 py-1.5 text-left text-[11px] shadow-sm transition hover:ring-2 hover:ring-accent/30',
                            blockClass(node.kind),
                            selectedNodeId === node.id ? 'ring-2 ring-accent' : '',
                          ].join(' ')}
                        >
                          <div className="font-semibold leading-tight">{node.label}</div>
                          <div className="mt-1 flex flex-wrap gap-0.5">
                            {(node.systemIds ?? []).map((sid) => {
                              const s = sysById.get(sid)
                              if (!s) return null
                              return (
                                <span
                                  key={sid}
                                  className="rounded px-1 py-px text-[9px] font-medium"
                                  style={{ backgroundColor: `${s.color}33`, color: s.color }}
                                >
                                  {s.name}
                                </span>
                              )
                            })}
                          </div>
                          <div className="mt-0.5 text-[9px] opacity-70">{process.name}</div>
                        </button>
                      ))}
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
