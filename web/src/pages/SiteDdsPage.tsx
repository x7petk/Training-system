import { useMemo, useRef } from 'react'
import { Plus } from 'lucide-react'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import { useAuth } from '../hooks/useAuth'
import { useShiftDdsShell } from '../features/dds/ShiftDdsShellContext'
import { SiteDdsKpiSummary } from '../features/dds/SiteDdsKpiSummary'
import { SiteDdsTriggerGrid } from '../features/dds/SiteDdsTriggerGrid'
import { DdsTopLossesPanel } from '../features/dds/DdsTopLossesPanel'
import { DdsRewardRecognitionPanel } from '../features/dds/DdsRewardRecognitionPanel'
import {
  RollupDdsPlannedActionsPanel,
  type RollupDdsPlannedActionsPanelHandle,
} from '../features/dds/RollupDdsPlannedActionsPanel'
import { ddsErr, ddsHint, ddsSection } from '../features/dds/ddsAdminCompactClasses'

export function SiteDdsPage() {
  const { status: scopeStatus, error: scopeError, siteId, siteCells, cellId } = usePlan24Workspace()
  const { planDate, shiftKind, shifts, shellLoading, rosterError } = useShiftDdsShell()
  const { user } = useAuth()
  const plannedActionsRef = useRef<RollupDdsPlannedActionsPanelHandle>(null)

  const siteCellList = useMemo(() => siteCells.map((c) => ({ id: c.id, name: c.name })), [siteCells])
  const siteCellIds = useMemo(() => siteCellList.map((c) => c.id), [siteCellList])

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
  if (!siteId) {
    return <p className={ddsHint}>Select a site in the scope bar to use Site DDS.</p>
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 border-b border-border/60 pb-2">
        <h1 className="shrink-0 font-display text-lg font-semibold tracking-tight">Site DDS</h1>
      </div>

      {rosterError ? <p className={`${ddsErr} shrink-0`}>{rosterError}</p> : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(12rem,40%)_minmax(0,1fr)] lg:grid-rows-1 lg:items-stretch lg:gap-4">
        <section className={`${ddsSection} flex min-h-0 flex-1 flex-col overflow-hidden lg:min-h-0`}>
          <h2 className="shrink-0 border-b border-border/60 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            KPI summary
          </h2>
          <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto">
            <SiteDdsTriggerGrid
              cells={siteCellList}
              planDate={planDate}
              shiftKind={shiftKind ?? ''}
              shifts={shifts}
            />
            <SiteDdsKpiSummary
              siteId={siteId}
              cells={siteCellList}
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
            <p className="mt-0.5 shrink-0 text-[9px] text-muted">Promoted to site only.</p>
            <div className="min-h-0 flex-1">
              <DdsTopLossesPanel
                cellIds={siteCellIds}
                plantRollup="promoted_only"
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
              <div className="min-w-0">
                <h2 className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Planned actions (DDS)
                </h2>
                <p className="mt-0.5 text-[9px] text-muted">Site-level actions only.</p>
              </div>
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
                  cells={siteCellList}
                  createCellId={cellId}
                  planDate={planDate}
                  shiftKind={shiftKind}
                  uiSurface="site-dds"
                  emptyLabel="No cells in this site."
                />
              )}
            </div>
          </section>

          <section className={`${ddsSection} flex max-h-44 shrink-0 flex-col overflow-hidden sm:max-h-52`}>
            <h2 className="shrink-0 border-b border-border/60 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Reward and recognition
            </h2>
            <p className="mt-0.5 shrink-0 text-[9px] text-muted">Promoted to site only.</p>
            <div className="min-h-0 flex-1">
              <DdsRewardRecognitionPanel
                cellIds={siteCellIds}
                plantRollup="promoted_only"
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
