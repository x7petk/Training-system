import { useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import { useAuth } from '../hooks/useAuth'
import { useShiftDdsShell } from '../features/dds/ShiftDdsShellContext'
import { PlantDdsKpiSummary } from '../features/dds/PlantDdsKpiSummary'
import { PlantDdsTriggerStrip } from '../features/dds/PlantDdsTriggerStrip'
import { DdsTopLossesPanel } from '../features/dds/DdsTopLossesPanel'
import { DdsRewardRecognitionPanel } from '../features/dds/DdsRewardRecognitionPanel'
import {
  RollupDdsPlannedActionsPanel,
  type RollupDdsPlannedActionsPanelHandle,
} from '../features/dds/RollupDdsPlannedActionsPanel'
import { type DdsPlantRollupMode } from '../features/dds/ddsPlantRollup'
import { ddsErr, ddsHint, ddsSection } from '../features/dds/ddsAdminCompactClasses'

export function PlantDdsPage() {
  const { status: scopeStatus, error: scopeError, plantId, cellId, cells } = usePlan24Workspace()
  const { planDate, shiftKind, shifts, shellLoading, rosterError } = useShiftDdsShell()
  const { user } = useAuth()
  const [rollupMode, setRollupMode] = useState<DdsPlantRollupMode>('all')
  const plannedActionsRef = useRef<RollupDdsPlannedActionsPanelHandle>(null)

  const plantCells = useMemo(() => cells.map((c) => ({ id: c.id, name: c.name })), [cells])
  const plantCellIds = useMemo(() => plantCells.map((c) => c.id), [plantCells])

  const error = rosterError

  if (scopeStatus === 'loading') {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-xs text-muted" role="status">
        Loading…
      </div>
    )
  }
  if (scopeStatus === 'error') {
    return <p className={ddsErr}>{scopeError ?? 'Could not load scope.'}</p>
  }
  if (!plantId) {
    return <p className={ddsHint}>Select a plant in the scope bar to use Plant DDS.</p>
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 border-b border-border/60 pb-2">
        <h1 className="shrink-0 font-display text-lg font-semibold tracking-tight">Plant DDS</h1>
        <div className="min-w-0 flex-1" />
        <div
          className="inline-flex shrink-0 rounded-lg border border-border/80 bg-surface p-0.5 text-[10px] shadow-sm"
          role="group"
          aria-label="Top losses and reward roll-up filter"
        >
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 font-semibold transition ${
              rollupMode === 'all'
                ? 'bg-accent text-accent-fg shadow-sm'
                : 'text-muted hover:bg-surface-raised/80 hover:text-fg'
            }`}
            aria-pressed={rollupMode === 'all'}
            onClick={() => setRollupMode('all')}
          >
            Show all
          </button>
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 font-semibold transition ${
              rollupMode === 'promoted_only'
                ? 'bg-accent text-accent-fg shadow-sm'
                : 'text-muted hover:bg-surface-raised/80 hover:text-fg'
            }`}
            aria-pressed={rollupMode === 'promoted_only'}
            onClick={() => setRollupMode('promoted_only')}
          >
            Promoted to site
          </button>
        </div>
      </div>

      {error ? <p className={`${ddsErr} shrink-0`}>{error}</p> : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(12rem,40%)_minmax(0,1fr)] lg:grid-rows-1 lg:items-stretch lg:gap-4">
        <section className={`${ddsSection} flex min-h-0 flex-1 flex-col overflow-hidden lg:min-h-0`}>
          <h2 className="shrink-0 border-b border-border/60 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            KPI summary
          </h2>
          <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
            <PlantDdsTriggerStrip
              cells={plantCells}
              planDate={planDate}
              shiftKind={shiftKind ?? ''}
              shifts={shifts}
            />
            <PlantDdsKpiSummary
              cells={plantCells}
              planDate={planDate}
              shiftKind={shiftKind ?? ''}
              shellLoading={shellLoading}
            />
          </div>
        </section>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:min-h-0">
          <section className={`${ddsSection} flex max-h-48 shrink-0 flex-col overflow-hidden sm:max-h-56`}>
            <h2 className="shrink-0 border-b border-border/60 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Top losses
            </h2>
            <div className="min-h-0 flex-1">
              <DdsTopLossesPanel
                cellIds={plantCellIds}
                plantRollup={rollupMode}
                planDate={planDate}
                shiftKind={shiftKind ?? ''}
                shellLoading={shellLoading}
              />
            </div>
          </section>

          <section
            className={`${ddsSection} flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden`}
            aria-label="Planned DDS actions"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 pb-1.5">
              <h2 className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-muted">
                Planned actions (DDS)
              </h2>
              {!shellLoading && shiftKind && cellId ? (
                <button
                  type="button"
                  disabled={!user}
                  title={user ? 'Create a DDS action' : 'Sign in to create actions'}
                  onClick={() => plannedActionsRef.current?.openCreate()}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/80 bg-surface px-2 py-0.5 text-[10px] font-semibold text-fg shadow-sm hover:bg-surface-raised/80 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Plus className="size-3" aria-hidden />
                  New
                </button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1">
              {shellLoading || !shiftKind ? (
                <p className="text-[11px] text-muted" role="status">
                  {shellLoading ? 'Loading roster…' : 'Select a shift.'}
                </p>
              ) : (
                <RollupDdsPlannedActionsPanel
                  ref={plannedActionsRef}
                  cells={plantCells}
                  createCellId={cellId}
                  planDate={planDate}
                  shiftKind={shiftKind}
                  uiSurface="plant-dds"
                  emptyLabel="No cells in this plant."
                />
              )}
            </div>
          </section>

          <section className={`${ddsSection} flex max-h-44 shrink-0 flex-col overflow-hidden sm:max-h-52`}>
            <h2 className="shrink-0 border-b border-border/60 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Reward and recognition
            </h2>
            <div className="min-h-0 flex-1">
              <DdsRewardRecognitionPanel
                cellIds={plantCellIds}
                plantRollup={rollupMode}
                planDate={planDate}
                shiftKind={shiftKind ?? ''}
                shellLoading={shellLoading}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
