import { useEffect, useState } from 'react'
import { LayoutDashboard } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Plan24AdminRosterTab } from '../features/plan24/Plan24AdminRosterTab'
import { Plan24AdminChecksTab } from '../features/plan24/Plan24AdminChecksTab'
import { DhDefectTypesAdminTab } from '../features/dh/DhDefectTypesAdminTab'
import { DeviationTypesAdminTab } from '../features/deviations/DeviationTypesAdminTab'
import { QualityFailTypesAdminTab } from '../features/qualityFails/QualityFailTypesAdminTab'

type Tab = 'roster' | 'checks' | 'dh_types' | 'deviation_types' | 'quality_fail_types'

export function RttSystemsAdminPage() {
  const { isSuperAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>('roster')

  useEffect(() => {
    if ((tab === 'dh_types' || tab === 'deviation_types' || tab === 'quality_fail_types') && !isSuperAdmin) setTab('roster')
  }, [tab, isSuperAdmin])

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-accent">
          <LayoutDashboard className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">RTT systems — Admin</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            <strong className="font-medium text-fg">Roster</strong> — shifts and roles for the cell.{' '}
            <strong className="font-medium text-fg">Checks</strong> — check definitions and when they run; open the Checks tab and use{' '}
            <em>Check templates</em> vs <em>Schedules</em> there to focus on one workflow at a time.
          </p>
        </div>
      </header>

      <div className="inline-flex rounded-xl border border-border bg-surface p-1" role="tablist" aria-label="Admin sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'roster'}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            tab === 'roster' ? 'bg-accent-dim text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg'
          }`}
          onClick={() => setTab('roster')}
        >
          Plan 24 roster
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'checks'}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            tab === 'checks' ? 'bg-accent-dim text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg'
          }`}
          onClick={() => setTab('checks')}
        >
          Checks
        </button>
        {isSuperAdmin ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'dh_types'}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'dh_types' ? 'bg-accent-dim text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg'
            }`}
            onClick={() => setTab('dh_types')}
          >
            DH defect types
          </button>
        ) : null}
        {isSuperAdmin ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'deviation_types'}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'deviation_types' ? 'bg-accent-dim text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg'
            }`}
            onClick={() => setTab('deviation_types')}
          >
            Deviation types
          </button>
        ) : null}
        {isSuperAdmin ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'quality_fail_types'}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'quality_fail_types' ? 'bg-accent-dim text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg'
            }`}
            onClick={() => setTab('quality_fail_types')}
          >
            Quality fail types
          </button>
        ) : null}
      </div>

      {tab === 'roster' ? <Plan24AdminRosterTab /> : null}

      {tab === 'checks' ? <Plan24AdminChecksTab /> : null}

      {tab === 'dh_types' && isSuperAdmin ? <DhDefectTypesAdminTab /> : null}
      {tab === 'deviation_types' && isSuperAdmin ? <DeviationTypesAdminTab /> : null}
      {tab === 'quality_fail_types' && isSuperAdmin ? <QualityFailTypesAdminTab /> : null}
    </div>
  )
}
