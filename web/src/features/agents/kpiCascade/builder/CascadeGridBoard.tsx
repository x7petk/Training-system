import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type {
  CascadeBoardColumn,
  CascadeForumMetric,
  CascadeForumMetricGroup,
  CascadeKpiOverlayItem,
  CascadeLink,
  CascadeMetric,
  CascadeMetricGroup,
} from '../cascadeTypes'
import { CASCADE_BOARD_SLOT_HEIGHT, metricsInGroup } from '../cascadeUtils'
import type { KpiCascadeForum, KpiCascadeKpi } from '../types'
import { buildVisibleLinkPaths } from './cascadeLinkPaths'
import { CascadeLinkedKpiChips } from './CascadeLinkedKpiChips'
import { CascadeMetricTile } from './CascadeMetricTile'

const DRAG_MIME = 'application/x-kpi-cascade-metric'

export type BoardMetric = CascadeMetric | CascadeForumMetric
export type BoardGroup = CascadeMetricGroup | CascadeForumMetricGroup

type Props = {
  columns: CascadeBoardColumn[]
  metrics: BoardMetric[]
  links: CascadeLink[]
  groups: BoardGroup[]
  kpis: KpiCascadeKpi[]
  forums: KpiCascadeForum[]
  slotCount: number
  /** Forum Cascade: linked KPI cascade metrics shown under each block. */
  kpiOverlaysByBoxId?: Map<string, CascadeKpiOverlayItem[]>
  boardRowForGroup: (group: BoardGroup) => number
  groupsWithMetricsForColumn: (
    groups: BoardGroup[],
    metrics: BoardMetric[],
    columnId: string,
  ) => BoardGroup[]
  linkSourceId: string | null
  onStartLink: (metricId: string) => void
  onCompleteLink: (targetMetricId: string) => void
  onCancelLinking: () => void
  onDeleteLink: (linkId: string) => void
  onDeleteMetric: (metricId: string) => void
  onMoveMetricToColumn: (metricId: string, columnId: string) => void
  onMoveMetricToRow: (metricId: string, columnId: string, toRow: number) => void
  onMoveMetricToBox: (metricId: string, columnId: string, boxId: string) => void
}

export function CascadeGridBoard({
  columns,
  metrics,
  links,
  groups,
  kpis,
  forums,
  slotCount,
  kpiOverlaysByBoxId,
  boardRowForGroup,
  groupsWithMetricsForColumn,
  linkSourceId,
  onStartLink,
  onCompleteLink,
  onCancelLinking,
  onDeleteLink,
  onDeleteMetric,
  onMoveMetricToColumn,
  onMoveMetricToRow,
  onMoveMetricToBox,
}: Props) {
  const boardRef = useRef<HTMLDivElement>(null)
  const tileRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [linkPaths, setLinkPaths] = useState<{ id: string; d: string }[]>([])
  const [dropColumnId, setDropColumnId] = useState<string | null>(null)
  const [dropBoxId, setDropBoxId] = useState<string | null>(null)
  const [dropRow, setDropRow] = useState<{ columnId: string; row: number } | null>(null)

  const visibleMetricIds = useMemo(() => new Set(metrics.map((m) => m.id)), [metrics])
  const refreshPaths = useCallback(() => {
    setLinkPaths(
      buildVisibleLinkPaths(
        boardRef.current,
        tileRefs.current,
        links,
        visibleMetricIds,
      ),
    )
  }, [links, visibleMetricIds])

  const registerRef = useCallback(
    (metricId: string, el: HTMLDivElement | null) => {
      if (el) tileRefs.current.set(metricId, el)
      else tileRefs.current.delete(metricId)
      requestAnimationFrame(() => refreshPaths())
    },
    [refreshPaths],
  )

  useLayoutEffect(() => {
    refreshPaths()
    const board = boardRef.current
    if (!board) return
    const ro = new ResizeObserver(() => refreshPaths())
    ro.observe(board)
    const cols = board.querySelectorAll('[data-cascade-column-scroll]')
    cols.forEach((el) => el.addEventListener('scroll', refreshPaths, { passive: true }))
    window.addEventListener('resize', refreshPaths)
    return () => {
      ro.disconnect()
      cols.forEach((el) => el.removeEventListener('scroll', refreshPaths))
      window.removeEventListener('resize', refreshPaths)
    }
  }, [refreshPaths, metrics, groups, columns])

  const colCount = Math.max(columns.length, 1)
  const isLinking = linkSourceId != null

  return (
    <div
      ref={boardRef}
      className="relative min-h-0 flex-1 overflow-x-auto overflow-y-visible rounded-lg border border-[#c5cad3] bg-[#e4e8ed]"
      onMouseDown={(e) => {
        if (!linkSourceId) return
        const t = e.target as HTMLElement
        if (t === e.currentTarget || t.dataset.cascadeBoardBg === '1') {
          onCancelLinking()
        }
      }}
    >
      <div
        data-cascade-board-bg="1"
        className="relative z-0 grid min-h-full items-start gap-3 bg-[#dde3ea] p-3"
        style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
      >
        {columns.map((column) => (
          <CascadeGridColumn
            key={column.id}
            column={column}
            slotCount={slotCount}
            boxes={groupsWithMetricsForColumn(groups, metrics, column.id)}
            metrics={metrics.filter((m) => m.levelId === column.id)}
            kpis={kpis}
            forums={forums}
            boardRowForGroup={boardRowForGroup}
            kpiOverlaysByBoxId={kpiOverlaysByBoxId}
            linkSourceId={linkSourceId}
            isDropTarget={dropColumnId === column.id}
            dropBoxId={dropBoxId}
            dropRow={dropRow?.columnId === column.id ? dropRow.row : null}
            onStartLink={onStartLink}
            onCompleteLink={onCompleteLink}
            onDeleteMetric={onDeleteMetric}
            registerRef={registerRef}
            onDragEnterColumn={() => setDropColumnId(column.id)}
            onDragLeaveColumn={(left) => {
              if (!left) setDropColumnId(null)
            }}
            onDropOnColumn={(metricId) => {
              setDropColumnId(null)
              setDropBoxId(null)
              setDropRow(null)
              onMoveMetricToColumn(metricId, column.id)
            }}
            onDragEnterRow={(row) => setDropRow({ columnId: column.id, row })}
            onDragLeaveRow={(left) => {
              if (left) setDropRow(null)
            }}
            onDropOnRow={(metricId, row) => {
              setDropColumnId(null)
              setDropBoxId(null)
              setDropRow(null)
              onMoveMetricToRow(metricId, column.id, row)
            }}
            onDragEnterBox={(boxId) => setDropBoxId(boxId)}
            onDragLeaveBox={(left) => {
              if (left) setDropBoxId(null)
            }}
            onDropOnBox={(metricId, boxId) => {
              setDropBoxId(null)
              setDropColumnId(null)
              setDropRow(null)
              onMoveMetricToBox(metricId, column.id, boxId)
            }}
          />
        ))}
      </div>

      <svg
        className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
        aria-hidden={isLinking}
      >
        <defs>
          {linkPaths.map((p) => (
            <marker
              key={`arrow-${p.id}`}
              id={`cascade-arrow-${p.id}`}
              markerUnits="userSpaceOnUse"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#525252" />
            </marker>
          ))}
        </defs>
        <g className={isLinking ? 'pointer-events-none' : 'pointer-events-auto'}>
          {linkPaths.map((p) => (
            <g key={p.id}>
              <path
                d={p.d}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteLink(p.id)
                }}
              />
              <path
                d={p.d}
                fill="none"
                stroke="#525252"
                strokeWidth={1}
                strokeLinejoin="round"
                strokeLinecap="round"
                markerEnd={`url(#cascade-arrow-${p.id})`}
                className="pointer-events-none"
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}

function CascadeGridColumn({
  column,
  slotCount,
  boxes,
  metrics,
  kpis,
  forums,
  boardRowForGroup,
  kpiOverlaysByBoxId,
  linkSourceId,
  isDropTarget,
  dropBoxId,
  dropRow,
  onStartLink,
  onCompleteLink,
  onDeleteMetric,
  registerRef,
  onDragEnterColumn,
  onDragLeaveColumn,
  onDropOnColumn,
  onDragEnterRow,
  onDragLeaveRow,
  onDropOnRow,
  onDragEnterBox,
  onDragLeaveBox,
  onDropOnBox,
}: {
  column: CascadeBoardColumn
  slotCount: number
  boxes: BoardGroup[]
  metrics: BoardMetric[]
  kpis: KpiCascadeKpi[]
  forums: KpiCascadeForum[]
  boardRowForGroup: (group: BoardGroup) => number
  kpiOverlaysByBoxId?: Map<string, CascadeKpiOverlayItem[]>
  linkSourceId: string | null
  isDropTarget: boolean
  dropBoxId: string | null
  dropRow: number | null
  onStartLink: (id: string) => void
  onCompleteLink: (targetMetricId: string) => void
  onDeleteMetric: (id: string) => void
  registerRef: (metricId: string, el: HTMLDivElement | null) => void
  onDragEnterColumn: () => void
  onDragLeaveColumn: (left: boolean) => void
  onDropOnColumn: (metricId: string) => void
  onDragEnterRow: (row: number) => void
  onDragLeaveRow: (left: boolean) => void
  onDropOnRow: (metricId: string, row: number) => void
  onDragEnterBox: (boxId: string) => void
  onDragLeaveBox: (left: boolean) => void
  onDropOnBox: (metricId: string, boxId: string) => void
}) {
  const boxesByRow = useMemo(() => {
    const map = new Map<number, BoardGroup[]>()
    for (const box of boxes) {
      const row = boardRowForGroup(box)
      const list = map.get(row) ?? []
      list.push(box)
      map.set(row, list)
    }
    return map
  }, [boxes, boardRowForGroup])

  return (
    <div className="flex min-h-0 min-w-0 flex-col self-stretch rounded-xl border border-[#c5cad3] bg-white shadow-sm">
      <header className="shrink-0 border-b border-[#c5cad3] bg-[#f0f2f5] px-2 py-2 text-center">
        <h3 className="text-[11px] font-semibold text-[#1a1a1a]">{column.label}</h3>
      </header>
      <div
        data-cascade-column-scroll
        data-column-id={column.id}
        className={`flex flex-col gap-1 overflow-visible bg-[#eef1f5] p-2 transition-colors ${
          isDropTarget && !dropBoxId && dropRow == null ? 'bg-[#dbeafe]/40' : ''
        }`}
        style={{ '--cascade-slot-min-h': CASCADE_BOARD_SLOT_HEIGHT } as CSSProperties}
        onDragEnter={(e) => {
          if (e.dataTransfer.types.includes(DRAG_MIME)) {
            e.preventDefault()
            onDragEnterColumn()
          }
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DRAG_MIME)) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
          }
        }}
        onDragLeave={(e) => {
          const related = e.relatedTarget as Node | null
          onDragLeaveColumn(!e.currentTarget.contains(related))
        }}
        onDrop={(e) => {
          e.preventDefault()
          const metricId = e.dataTransfer.getData(DRAG_MIME)
          if (!metricId) return
          if ((e.target as HTMLElement).closest('[data-cascade-row-slot]')) return
          if ((e.target as HTMLElement).closest('[data-cascade-group]')) return
          onDropOnColumn(metricId)
        }}
      >
        {Array.from({ length: slotCount }, (_, idx) => {
          const row = idx + 1
          const rowBoxes = boxesByRow.get(row) ?? []
          const isRowDrop = dropRow === row

          return (
            <CascadeRowSlot
              key={`slot-${row}`}
              row={row}
              hasBlocks={rowBoxes.length > 0}
              isDropTarget={isRowDrop}
              onDragEnter={() => onDragEnterRow(row)}
              onDragLeave={(left) => onDragLeaveRow(left)}
              onDrop={(metricId) => onDropOnRow(metricId, row)}
            >
              {rowBoxes.map((box) => (
                <KpiCombineBox
                  key={box.id}
                  boxId={box.id}
                  metrics={metricsInGroup(metrics, box.id)}
                  kpis={kpis}
                  forums={forums}
                  kpiOverlays={kpiOverlaysByBoxId?.get(box.id)}
                  linkSourceId={linkSourceId}
                  isDropTarget={dropBoxId === box.id}
                  onStartLink={onStartLink}
                  onCompleteLink={onCompleteLink}
                  onDeleteMetric={onDeleteMetric}
                  registerRef={registerRef}
                  onDragEnter={() => onDragEnterBox(box.id)}
                  onDragLeave={(left) => onDragLeaveBox(left)}
                  onDrop={(metricId) => onDropOnBox(metricId, box.id)}
                />
              ))}
            </CascadeRowSlot>
          )
        })}
      </div>
    </div>
  )
}

function CascadeRowSlot({
  row,
  isDropTarget,
  hasBlocks,
  children,
  onDragEnter,
  onDragLeave,
  onDrop,
}: {
  row: number
  isDropTarget: boolean
  hasBlocks: boolean
  children: ReactNode
  onDragEnter: () => void
  onDragLeave: (left: boolean) => void
  onDrop: (metricId: string) => void
}) {
  return (
    <div
      data-cascade-row-slot={row}
      className={`relative flex shrink-0 flex-col gap-1 overflow-visible transition-colors ${
        hasBlocks ? 'min-h-0' : 'min-h-[var(--cascade-slot-min-h)]'
      } ${
        isDropTarget
          ? 'min-h-[var(--cascade-slot-min-h)] rounded-md border border-[#2b6cb0]/60 bg-[#dbeafe]/40 ring-1 ring-[#2b6cb0]/30'
          : ''
      }`}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes(DRAG_MIME)) {
          e.preventDefault()
          e.stopPropagation()
          onDragEnter()
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DRAG_MIME)) {
          e.preventDefault()
          e.stopPropagation()
          e.dataTransfer.dropEffect = 'move'
        }
      }}
      onDragLeave={(e) => {
        const related = e.relatedTarget as Node | null
        onDragLeave(!e.currentTarget.contains(related))
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const metricId = e.dataTransfer.getData(DRAG_MIME)
        if (metricId) onDrop(metricId)
      }}
    >
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function KpiCombineBox({
  boxId,
  metrics,
  kpis,
  forums,
  kpiOverlays,
  linkSourceId,
  isDropTarget,
  onStartLink,
  onCompleteLink,
  onDeleteMetric,
  registerRef,
  onDragEnter,
  onDragLeave,
  onDrop,
}: {
  boxId: string
  metrics: BoardMetric[]
  kpis: KpiCascadeKpi[]
  forums: KpiCascadeForum[]
  kpiOverlays?: CascadeKpiOverlayItem[]
  linkSourceId: string | null
  isDropTarget: boolean
  onStartLink: (id: string) => void
  onCompleteLink: (targetMetricId: string) => void
  onDeleteMetric: (id: string) => void
  registerRef: (metricId: string, el: HTMLDivElement | null) => void
  onDragEnter: () => void
  onDragLeave: (left: boolean) => void
  onDrop: (metricId: string) => void
}) {
  const combined = metrics.length > 1

  const dragHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes(DRAG_MIME)) {
        e.preventDefault()
        e.stopPropagation()
        onDragEnter()
      }
    },
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes(DRAG_MIME)) {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
      }
    },
    onDragLeave: (e: React.DragEvent) => {
      const related = e.relatedTarget as Node | null
      onDragLeave(!e.currentTarget.contains(related))
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const metricId = e.dataTransfer.getData(DRAG_MIME)
      if (metricId) onDrop(metricId)
    },
  }

  const tileProps = (metric: BoardMetric) => ({
    metric,
    kpis,
    forums,
    isLinkSource: linkSourceId === metric.id,
    isLinking: linkSourceId != null,
    draggable: linkSourceId == null,
    onStartLink: () => onStartLink(metric.id),
    onCompleteLink:
      linkSourceId && linkSourceId !== metric.id && metric.kind === 'primary'
        ? () => onCompleteLink(metric.id)
        : undefined,
    onDelete: () => onDeleteMetric(metric.id),
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(DRAG_MIME, metric.id)
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_MIME)) return
      e.preventDefault()
      e.stopPropagation()
      onDragEnter()
    },
    onDrop: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_MIME)) return
      e.preventDefault()
      e.stopPropagation()
      const draggedId = e.dataTransfer.getData(DRAG_MIME)
      if (draggedId && draggedId !== metric.id) onDrop(draggedId)
    },
    registerRef: (el: HTMLDivElement | null) => registerRef(metric.id, el),
  })

  const overlayNode = kpiOverlays?.length ? <CascadeLinkedKpiChips items={kpiOverlays} /> : null

  if (!combined && metrics.length === 1) {
    return (
      <div
        data-cascade-group={boxId}
        className={`group/box relative shrink-0 transition-colors ${isDropTarget ? 'rounded-md ring-2 ring-[#2b6cb0]/50' : ''}`}
        {...dragHandlers}
      >
        <div className="rounded-md border border-[#c5cad3] bg-[#fafbfc] p-1 shadow-sm">
          <CascadeMetricTile {...tileProps(metrics[0])} />
          {overlayNode}
        </div>
      </div>
    )
  }

  return (
    <div
      data-cascade-group={boxId}
      className={`group/box relative shrink-0 transition-colors ${
        isDropTarget ? 'rounded-md ring-2 ring-[#2b6cb0]/50' : ''
      }`}
      {...dragHandlers}
    >
      <div
        className={`flex w-full flex-col gap-1 rounded-md border border-[#c5cad3] bg-[#fafbfc] p-1 shadow-sm ${
          isDropTarget ? 'border-[#2b6cb0] bg-[#e8f0fa]' : ''
        }`}
      >
        {metrics.map((metric) => (
          <CascadeMetricTile key={metric.id} {...tileProps(metric)} />
        ))}
        {overlayNode}
      </div>
    </div>
  )
}
