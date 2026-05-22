import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ExternalLink, Users } from 'lucide-react'
import { LdrWorkspaceProvider } from '../ldr/LdrWorkspaceContext'
import { LdrCalendarPage } from '../../pages/LdrCalendarPage'
import { LeadershipRosterPage } from '../../pages/LeadershipRosterPage'
import { ComplianceLdrScopeSync } from './ComplianceLdrScopeSync'
import { ddsSection } from './ddsAdminCompactClasses'
import type { LdrScopeLevel } from '../ldr/LdrWorkspaceContext'

export type ComplianceLdrView = 'calendar' | 'roster'

type Props = {
  scopeLevel: LdrScopeLevel
  siteId: string
  plantId: string
  cellId: string
  planDate: string
  scopeLabel: string
}

export function ComplianceLdrPanel({ scopeLevel, siteId, plantId, cellId, planDate, scopeLabel }: Props) {
  const [view, setView] = useState<ComplianceLdrView>('roster')

  const fullLdrHref = view === 'calendar' ? '/ldr-tools/calendar' : '/ldr-tools/roster'

  return (
    <LdrWorkspaceProvider>
      <ComplianceLdrScopeSync scopeLevel={scopeLevel} siteId={siteId} plantId={plantId} cellId={cellId} />
      <section
        className={`${ddsSection} flex min-h-0 flex-1 flex-col overflow-hidden`}
        aria-label="LDR calendar and roster"
      >
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border/60 pb-1.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted">LDR</h2>
            <p className="truncate text-[10px] text-fg/70">{scopeLabel}</p>
          </div>
          <div className="inline-flex rounded-lg border border-border/80 bg-surface-raised/40 p-0.5">
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                view === 'calendar'
                  ? 'bg-violet-500/15 text-violet-900 shadow-sm dark:text-violet-100'
                  : 'text-muted hover:text-fg'
              }`}
              onClick={() => setView('calendar')}
            >
              <CalendarDays className="size-3" aria-hidden />
              Calendar
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                view === 'roster'
                  ? 'bg-violet-500/15 text-violet-900 shadow-sm dark:text-violet-100'
                  : 'text-muted hover:text-fg'
              }`}
              onClick={() => setView('roster')}
            >
              <Users className="size-3" aria-hidden />
              Roster
            </button>
          </div>
          <Link
            to={fullLdrHref}
            className="inline-flex items-center gap-1 rounded-md border border-border/80 px-2 py-1 text-[10px] font-semibold text-muted hover:bg-surface-raised hover:text-fg"
            title="Open full LDR tools view"
          >
            Full view
            <ExternalLink className="size-3" aria-hidden />
          </Link>
        </div>

        <div className="mt-1 min-h-0 flex-1 overflow-hidden">
          {view === 'calendar' ? (
            <LdrCalendarPage embed anchorPlanDate={planDate} />
          ) : (
            <LeadershipRosterPage embed />
          )}
        </div>
      </section>
    </LdrWorkspaceProvider>
  )
}
