import { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Settings2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import { Plan24EmbeddedPanel } from '../features/plan24/Plan24EmbeddedPanel'
import { DdsP2pSummaryBody, type DdsP2pSummaryBodyHandle } from '../features/dds/DdsP2pSummaryBody'
import {
  DdsRewardRecognitionPanel,
  type DdsRewardRecognitionPanelHandle,
} from '../features/dds/DdsRewardRecognitionPanel'
import { useShiftDdsShell } from '../features/dds/ShiftDdsShellContext'
import { DdsTriggerScoreTilesRow } from '../features/dds/DdsTriggerScoreTilesRow'
import { ddsErr, ddsHint, ddsSection } from '../features/dds/ddsAdminCompactClasses'

type RightMode = 'p2p' | 'plan24'

export function ShiftDdsPage() {
  const { status: scopeStatus, error: scopeError, cellId } = usePlan24Workspace()
  const { user } = useAuth()
  const summaryBodyRef = useRef<DdsP2pSummaryBodyHandle>(null)
  const rewardRecognitionPanelRef = useRef<DdsRewardRecognitionPanelHandle>(null)

  const { planDate, shiftKind, shifts, roles, shellLoading, rosterError } = useShiftDdsShell()

  const [panelError, setPanelError] = useState<string | null>(null)
  const [rightMode, setRightMode] = useState<RightMode>('p2p')

  const error = rosterError ?? panelError

  useEffect(() => {
    setPanelError(null)
  }, [rightMode])

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
    return <p className={ddsHint}>Select a cell in the scope bar to use Shift DDS.</p>
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 border-b border-border/60 pb-2">
        <h1 className="shrink-0 font-display text-lg font-semibold tracking-tight">Shift DDS</h1>
        {shiftKind ? (
          <DdsTriggerScoreTilesRow
            cellId={cellId}
            planDate={planDate}
            shiftKind={shiftKind}
            shifts={shifts}
            compact
          />
        ) : null}
        <div className="min-w-0 flex-1" />
        <div className="inline-flex shrink-0 rounded-lg border border-border bg-surface p-0.5">
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              rightMode === 'p2p' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-fg'
            }`}
            onClick={() => setRightMode('p2p')}
          >
            P2P Summary
          </button>
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              rightMode === 'plan24' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-fg'
            }`}
            onClick={() => setRightMode('plan24')}
          >
            Plan 24
          </button>
        </div>

        {rightMode === 'p2p' ? (
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:bg-black/[0.05] hover:text-fg disabled:opacity-40"
            aria-label="P2P Summary view preferences"
            title="P2P Summary view preferences"
            disabled={!user?.id || shellLoading}
            onClick={() => summaryBodyRef.current?.openPrefs()}
          >
            <Settings2 className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {error ? <p className={`${ddsErr} shrink-0`}>{error}</p> : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] gap-3 lg:grid-cols-1 lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-4">
        <section
          className={`${ddsSection} flex h-full min-h-0 min-w-0 flex-col overflow-hidden`}
          aria-label={rightMode === 'p2p' ? 'P2P summary' : 'Plan 24'}
        >
          {shellLoading ? (
            <p className="flex shrink-0 items-center gap-1 text-xs text-muted" role="status">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading roster…
            </p>
          ) : !shiftKind ? (
            <p className="shrink-0 text-xs text-muted">No shifts on the roster for this cell.</p>
          ) : rightMode === 'p2p' ? (
            <DdsP2pSummaryBody
              ref={summaryBodyRef}
              cellId={cellId}
              userId={user?.id}
              planDate={planDate}
              shiftKind={shiftKind}
              shifts={shifts}
              roles={roles}
              shellLoading={false}
              error={panelError}
              setError={setPanelError}
              prefsHelpStandalone
              className="min-h-0 flex-1"
            />
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <Plan24EmbeddedPanel cellId={cellId} planDate={planDate} shiftKind={shiftKind} />
            </div>
          )}
        </section>

        <section className={`${ddsSection} flex max-h-56 shrink-0 flex-col overflow-hidden sm:max-h-64`}>
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
                surface="shift-dds"
                shellLoading={shellLoading}
              />
            </div>
          </section>
      </div>
    </div>
  )
}
