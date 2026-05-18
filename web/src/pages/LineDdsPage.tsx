import { useRef } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import { ShiftDdsKpiSummary } from '../features/dds/ShiftDdsKpiSummary'
import { useShiftDdsShell } from '../features/dds/ShiftDdsShellContext'
import {
  DdsRewardRecognitionPanel,
  type DdsRewardRecognitionPanelHandle,
} from '../features/dds/DdsRewardRecognitionPanel'
import { DdsTopLossesPanel, type DdsTopLossesPanelHandle } from '../features/dds/DdsTopLossesPanel'
import { LineDdsActionsPanel, type LineDdsActionsPanelHandle } from '../features/dds/LineDdsActionsPanel'
import { ddsErr, ddsHint, ddsSection } from '../features/dds/ddsAdminCompactClasses'
import { useAuth } from '../hooks/useAuth'

export function LineDdsPage() {
  const { status: scopeStatus, error: scopeError, cellId } = usePlan24Workspace()
  const { planDate, shiftKind, shellLoading, rosterError } = useShiftDdsShell()
  const { user } = useAuth()
  const plannedActionsPanelRef = useRef<LineDdsActionsPanelHandle>(null)
  const rewardRecognitionPanelRef = useRef<DdsRewardRecognitionPanelHandle>(null)
  const topLossesPanelRef = useRef<DdsTopLossesPanelHandle>(null)

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
  if (!cellId) {
    return <p className={ddsHint}>Select a cell in the scope bar to use Line DDS.</p>
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 border-b border-border/60 pb-2">
        <h1 className="shrink-0 font-display text-lg font-semibold tracking-tight">Line DDS</h1>
        <div className="min-w-0 flex-1" />
      </div>

      {error ? <p className={`${ddsErr} shrink-0`}>{error}</p> : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(12rem,40%)_minmax(0,1fr)] lg:grid-rows-1 lg:items-stretch lg:gap-4">
        <section className={`${ddsSection} flex min-h-0 flex-1 flex-col overflow-hidden lg:min-h-0`}>
          <h2 className="shrink-0 border-b border-border/60 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            KPI summary
          </h2>
          {shellLoading ? (
            <p className="mt-2 flex shrink-0 items-center gap-1 text-[11px] text-muted" role="status">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading…
            </p>
          ) : !shiftKind ? (
            <p className="mt-2 shrink-0 text-[11px] text-muted">Select a shift to load KPIs.</p>
          ) : (
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
              <ShiftDdsKpiSummary cellId={cellId} planDate={planDate} shiftKind={shiftKind} kpiSurface="line-dds" />
            </div>
          )}
        </section>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:min-h-0">
          <section className={`${ddsSection} flex max-h-48 shrink-0 flex-col overflow-hidden sm:max-h-56`}>
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 pb-1.5">
              <h2 className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-muted">
                Top losses
              </h2>
              {!shellLoading && shiftKind ? (
                <button
                  type="button"
                  disabled={!user}
                  title={user ? 'Add top loss entry' : 'Sign in to add entries'}
                  onClick={() => topLossesPanelRef.current?.openCreate()}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/80 bg-surface px-2 py-0.5 text-[10px] font-semibold text-fg shadow-sm hover:bg-surface-raised/80 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Plus className="size-3" aria-hidden />
                  Add
                </button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1">
              <DdsTopLossesPanel
                ref={topLossesPanelRef}
                cellId={cellId}
                planDate={planDate}
                shiftKind={shiftKind ?? ''}
                surface="line-dds"
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
              {!shellLoading && shiftKind ? (
                <button
                  type="button"
                  disabled={!user}
                  title={user ? 'Create a DDS action' : 'Sign in to create actions'}
                  onClick={() => plannedActionsPanelRef.current?.openCreate()}
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
                <LineDdsActionsPanel
                  ref={plannedActionsPanelRef}
                  cellId={cellId}
                  planDate={planDate}
                  shiftKind={shiftKind}
                />
              )}
            </div>
          </section>

          <section className={`${ddsSection} flex max-h-44 shrink-0 flex-col overflow-hidden sm:max-h-52`}>
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 pb-1.5">
              <h2 className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-muted">
                Reward and recognition
              </h2>
              {!shellLoading && shiftKind ? (
                <button
                  type="button"
                  disabled={!user}
                  title={user ? 'Add reward & recognition entry' : 'Sign in to add entries'}
                  onClick={() => rewardRecognitionPanelRef.current?.openCreate()}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/80 bg-surface px-2 py-0.5 text-[10px] font-semibold text-fg shadow-sm hover:bg-surface-raised/80 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Plus className="size-3" aria-hidden />
                  Add
                </button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1">
              <DdsRewardRecognitionPanel
                ref={rewardRecognitionPanelRef}
                cellId={cellId}
                planDate={planDate}
                shiftKind={shiftKind ?? ''}
                surface="line-dds"
                shellLoading={shellLoading}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
