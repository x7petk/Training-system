import { useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import { useShiftDdsShell } from '../features/dds/ShiftDdsShellContext'
import { SiteComplianceKpiPanel } from '../features/dds/SiteComplianceKpiPanel'
import { SiteDdsTriggerGrid } from '../features/dds/SiteDdsTriggerGrid'
import { ComplianceViewModeToggle } from '../features/dds/ComplianceViewModeToggle'
import { LineDdsActionsPanel, type LineDdsActionsPanelHandle } from '../features/dds/LineDdsActionsPanel'
import type { ComplianceKpiViewMode } from '../features/dds/ddsComplianceConstants'
import { ddsErr, ddsHint, ddsSection } from '../features/dds/ddsAdminCompactClasses'
import { useAuth } from '../hooks/useAuth'

export function SiteCompliancePage() {
  const { status: scopeStatus, error: scopeError, siteId, siteCells, cellId } = usePlan24Workspace()
  const { planDate, shifts } = useShiftDdsShell()
  const { user } = useAuth()
  const [viewMode, setViewMode] = useState<ComplianceKpiViewMode>('day')
  const actionsRef = useRef<LineDdsActionsPanelHandle>(null)

  const siteCellList = useMemo(() => siteCells.map((c) => ({ id: c.id, name: c.name })), [siteCells])

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
    return <p className={ddsHint}>Select a site in the scope bar to use Site compliance.</p>
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 border-b border-border/60 pb-2">
        <h1 className="shrink-0 font-display text-lg font-semibold tracking-tight">Site compliance</h1>
        <ComplianceViewModeToggle value={viewMode} onChange={setViewMode} />
        <div className="min-w-0 flex-1" />
      </div>

      <section className={`${ddsSection} flex min-h-0 flex-1 flex-col overflow-hidden`}>
        <h2 className="shrink-0 border-b border-border/60 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          KPIs
          {viewMode === 'week' || viewMode === 'table' ? (
            <span className="ml-1 font-normal normal-case text-fg/55">· last 7 days ending selected date</span>
          ) : null}
        </h2>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
          <SiteDdsTriggerGrid cells={siteCellList} planDate={planDate} shiftKind="" shifts={shifts} dayRollup />
          <SiteComplianceKpiPanel
            siteId={siteId}
            cells={siteCellList}
            planDate={planDate}
            viewMode={viewMode}
          />
        </div>
      </section>

      <section className={`${ddsSection} flex max-h-56 shrink-0 flex-col overflow-hidden sm:max-h-64`} aria-label="DDS actions">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 pb-1.5">
          <h2 className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-muted">
            Planned actions (DDS)
          </h2>
          {cellId ? (
            <button
              type="button"
              disabled={!user}
              title={user ? 'Create a DDS action' : 'Sign in to create actions'}
              onClick={() => actionsRef.current?.openCreate()}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/80 bg-surface px-2 py-0.5 text-[10px] font-semibold text-fg shadow-sm hover:bg-surface-raised/80 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus className="size-3" aria-hidden />
              New
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!cellId ? (
            <p className="text-[11px] text-muted">Select a cell in the scope bar to view and create DDS actions.</p>
          ) : (
            <LineDdsActionsPanel
              ref={actionsRef}
              cellId={cellId}
              planDate={planDate}
              shiftKind=""
              uiSurface="site-dds"
              allShiftsForPlanDate
            />
          )}
        </div>
      </section>
    </div>
  )
}
