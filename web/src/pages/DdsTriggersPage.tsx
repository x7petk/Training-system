import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import { useShiftDdsShell } from '../features/dds/ShiftDdsShellContext'
import { DdsTriggerScoreTile } from '../features/dds/DdsTriggerScoreTile'
import { DdsTriggerControlsPanel } from '../features/dds/DdsTriggerControlsPanel'
import { ddsErr, ddsHint, ddsSection } from '../features/dds/ddsAdminCompactClasses'
import { triggerShiftRowsFromShell } from '../features/dds/ddsTriggerShiftRows'

export function DdsTriggersPage() {
  const { status: scopeStatus, error: scopeError, cellId } = usePlan24Workspace()
  const { planDate, shiftKind, shifts, shellLoading, rosterError } = useShiftDdsShell()
  const shiftRows = triggerShiftRowsFromShell(shifts)

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
    return <p className={ddsHint}>Select a cell in the scope bar to use Triggers.</p>
  }

  const err = rosterError
  const sk = shiftKind

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 border-b border-border/60 pb-2">
        <h1 className="shrink-0 font-display text-lg font-semibold tracking-tight">Triggers</h1>
        <div className="flex flex-wrap gap-1.5">
          <DdsTriggerScoreTile cellId={cellId} planDate={planDate} shiftKind={sk} domain="safety" shifts={shiftRows} />
          <DdsTriggerScoreTile cellId={cellId} planDate={planDate} shiftKind={sk} domain="quality" shifts={shiftRows} />
        </div>
      </div>

      {err ? <p className={`${ddsErr} shrink-0`}>{err}</p> : null}

      {shellLoading || !sk ? (
        <p className="text-[11px] text-muted">{shellLoading ? 'Loading roster…' : 'Select a shift in the scope bar.'}</p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
          <section className={`${ddsSection} flex min-h-0 flex-col overflow-hidden`}>
            <h2 className="shrink-0 border-b border-border/60 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Safety
            </h2>
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
              <DdsTriggerControlsPanel cellId={cellId} planDate={planDate} shiftKind={sk} domain="safety" />
            </div>
          </section>
          <section className={`${ddsSection} flex min-h-0 flex-col overflow-hidden`}>
            <h2 className="shrink-0 border-b border-border/60 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Quality
            </h2>
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
              <DdsTriggerControlsPanel cellId={cellId} planDate={planDate} shiftKind={sk} domain="quality" />
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
