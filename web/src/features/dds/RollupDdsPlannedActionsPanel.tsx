import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { LineDdsActionsPanel, type LineDdsActionsPanelHandle } from './LineDdsActionsPanel'
import type { DdsActionUiSurfaceKey } from './ddsActionSurfaces'

type CellLite = { id: string; name: string }

type Props = {
  cells: CellLite[]
  planDate: string
  shiftKind: string
  uiSurface: DdsActionUiSurfaceKey
  emptyLabel: string
  /** Scoped cell from the scope bar — used for New (create) and shown with full Line DDS actions UI. */
  createCellId: string | null
  /** Line / Plant / Site DDS: list all actions for the plan date (day meeting). */
  allShiftsForPlanDate?: boolean
  showOtherCellsEmptyHint?: boolean
}

export type RollupDdsPlannedActionsPanelHandle = {
  openCreate: () => void
}

/** Plant / Site DDS planned actions — scoped cell editable; other cells read-only timelines. */
export const RollupDdsPlannedActionsPanel = forwardRef<RollupDdsPlannedActionsPanelHandle, Props>(
  function RollupDdsPlannedActionsPanel(
    { cells, planDate, shiftKind, uiSurface, emptyLabel, createCellId, allShiftsForPlanDate, showOtherCellsEmptyHint = true },
    ref,
  ) {
    const createPanelRef = useRef<LineDdsActionsPanelHandle>(null)
    const [rollupEpoch, setRollupEpoch] = useState(0)

    const createCell = useMemo(
      () => (createCellId ? cells.find((c) => c.id === createCellId) : undefined),
      [cells, createCellId],
    )

    const otherCells = useMemo(
      () => (createCellId ? cells.filter((c) => c.id !== createCellId) : cells),
      [cells, createCellId],
    )

    const onCreated = useCallback(() => {
      setRollupEpoch((n) => n + 1)
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        openCreate: () => {
          if (!createCellId) return
          createPanelRef.current?.openCreate()
        },
      }),
      [createCellId],
    )

    const [visibleByCell, setVisibleByCell] = useState<Record<string, boolean>>({})

    const onCellVisible = useCallback((cellId: string, visible: boolean) => {
      setVisibleByCell((prev) => (prev[cellId] === visible ? prev : { ...prev, [cellId]: visible }))
    }, [])

    const trackedCells = createCellId ? otherCells : cells
    const allLoadedEmpty = useMemo(() => {
      if (trackedCells.length === 0 && !createCell) return !createCellId
      if (trackedCells.length === 0) return false
      return trackedCells.every((c) => visibleByCell[c.id] === false)
    }, [trackedCells, visibleByCell, createCell, createCellId])

    if (cells.length === 0) {
      return <p className="text-[11px] text-muted">{emptyLabel}</p>
    }

    if (!createCellId) {
      return (
        <p className="text-[11px] text-muted">Select a cell in the scope bar to create DDS actions for this level.</p>
      )
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {createCell ? (
          <section className="shrink-0">
            <h3 className="mb-0.5 truncate border-b border-border/50 pb-px text-[9px] font-semibold uppercase tracking-wide text-muted">
              {createCell.name}
            </h3>
            <LineDdsActionsPanel
              ref={createPanelRef}
              cellId={createCellId}
              planDate={planDate}
              shiftKind={shiftKind}
              uiSurface={uiSurface}
              allShiftsForPlanDate={allShiftsForPlanDate}
              onCreated={onCreated}
            />
          </section>
        ) : null}

        {otherCells.map((cell) => (
          <RollupCellActionsSection
            key={`${cell.id}-${rollupEpoch}`}
            cell={cell}
            planDate={planDate}
            shiftKind={shiftKind}
            uiSurface={uiSurface}
            allShiftsForPlanDate={allShiftsForPlanDate}
            onVisibleChange={(visible) => onCellVisible(cell.id, visible)}
          />
        ))}

        {showOtherCellsEmptyHint && otherCells.length > 0 && allLoadedEmpty ? (
          <p className="py-0.5 text-[10px] text-muted">No DDS actions on other cells for this shift.</p>
        ) : null}
      </div>
    )
  },
)

function RollupCellActionsSection({
  cell,
  planDate,
  shiftKind,
  uiSurface,
  allShiftsForPlanDate,
  onVisibleChange,
}: {
  cell: CellLite
  planDate: string
  shiftKind: string
  uiSurface: DdsActionUiSurfaceKey
  allShiftsForPlanDate?: boolean
  onVisibleChange: (visible: boolean) => void
}) {
  const [hasActions, setHasActions] = useState<boolean | null>(null)

  if (hasActions === false) return null

  return (
    <section className="shrink-0">
      <h3 className="mb-0.5 truncate border-b border-border/50 pb-px text-[9px] font-semibold uppercase tracking-wide text-muted">
        {cell.name}
      </h3>
      <LineDdsActionsPanel
        cellId={cell.id}
        planDate={planDate}
        shiftKind={shiftKind}
        uiSurface={uiSurface}
        allShiftsForPlanDate={allShiftsForPlanDate}
        readOnly
        hideWhenEmpty
        onVisibleChange={(visible) => {
          setHasActions(visible)
          onVisibleChange(visible)
        }}
      />
    </section>
  )
}
