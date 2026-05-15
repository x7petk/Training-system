import { Loader2 } from 'lucide-react'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import { ShiftDdsKpiSummary } from '../features/dds/ShiftDdsKpiSummary'
import { useShiftDdsShell } from '../features/dds/ShiftDdsShellContext'
import { LineDdsActionsPanel } from '../features/dds/LineDdsActionsPanel'
import { ddsErr, ddsHint, ddsSection } from '../features/dds/ddsAdminCompactClasses'

export function LineDdsPage() {
  const { status: scopeStatus, error: scopeError, cellId } = usePlan24Workspace()
  const { planDate, shiftKind, shellLoading, rosterError } = useShiftDdsShell()

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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,44%)_minmax(0,1fr)] lg:grid-rows-1 lg:items-stretch lg:gap-4">
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
          <section className={`${ddsSection} flex max-h-44 shrink-0 flex-col overflow-hidden sm:max-h-52`}>
            <h2 className="shrink-0 border-b border-border/60 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Top losses
            </h2>
            <p className="mt-2 shrink-0 text-[11px] text-muted">Placeholder — requirements coming later.</p>
            <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-lg border border-border/70">
              <table className="w-full border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-border bg-surface-raised/50">
                    <th className="px-2 py-1.5 font-medium text-muted">Loss</th>
                    <th className="px-2 py-1.5 font-medium text-muted">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={2} className="px-2 py-6 text-center text-muted">
                      —
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section
            className={`${ddsSection} flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden`}
            aria-label="Planned DDS actions"
          >
            <h2 className="shrink-0 border-b border-border/60 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Planned actions (DDS)
            </h2>
            <div className="mt-2 min-h-0 flex-1">
              {shellLoading || !shiftKind ? (
                <p className="text-[11px] text-muted" role="status">
                  {shellLoading ? 'Loading roster…' : 'Select a shift.'}
                </p>
              ) : (
                <LineDdsActionsPanel cellId={cellId} planDate={planDate} shiftKind={shiftKind} />
              )}
            </div>
          </section>

          <section className={`${ddsSection} flex max-h-44 shrink-0 flex-col overflow-hidden sm:max-h-52`}>
            <h2 className="shrink-0 border-b border-border/60 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Reward and recognition
            </h2>
            <p className="mt-2 shrink-0 text-[11px] text-muted">Placeholder — requirements coming later.</p>
            <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-lg border border-border/70">
              <table className="w-full border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-border bg-surface-raised/50">
                    <th className="px-2 py-1.5 font-medium text-muted">Name</th>
                    <th className="px-2 py-1.5 font-medium text-muted">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={2} className="px-2 py-6 text-center text-muted">
                      —
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
