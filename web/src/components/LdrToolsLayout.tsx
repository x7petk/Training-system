import { BookOpenText, CalendarDays, ClipboardList, FileBarChart, LayoutDashboard, ListChecks, Users, UsersRound } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AppSectionLayout } from './AppSectionLayout'
import { useAuth } from '../hooks/useAuth'
import { LdrWorkspaceProvider } from '../features/ldr/LdrWorkspaceContext'
import { LdrScopeFilterBar } from '../features/ldr/LdrScopeFilterBar'
import { LdrHcObsScopeFilterBar } from '../features/ldr/LdrHcObsScopeFilterBar'
import { isHcObsScopedPath } from '../features/ldr/ldrHcObsScope'

function ObservationSystemIcon({ className }: { className?: string }) {
  return (
    <ListChecks
      className={`${className ?? ''} opacity-100 text-blue-900 dark:text-blue-200`}
      strokeWidth={2.6}
      aria-hidden
    />
  )
}

export function LdrToolsLayout() {
  const { isAdmin, profileReady } = useAuth()
  const location = useLocation()
  const path = location.pathname
  const showHcObsScope = isHcObsScopedPath(path)
  const showDefaultScope =
    !path.startsWith('/ldr-tools/user-guide') && !showHcObsScope
  return (
    <LdrWorkspaceProvider>
      <AppSectionLayout
        storageKey="ldr-tools.sidebar-collapsed"
        title="LDR tools"
        headerIconClass="bg-violet-500/15 text-violet-700 dark:text-violet-300"
        HeaderIcon={UsersRound}
        mainTop={
          showHcObsScope ? <LdrHcObsScopeFilterBar /> : showDefaultScope ? <LdrScopeFilterBar /> : null
        }
        outletFallback={
          <div
            className="flex min-h-[14rem] items-center justify-center rounded-2xl border border-border bg-surface-raised/50 text-sm text-muted"
            role="status"
            aria-live="polite"
          >
            Loading…
          </div>
        }
        navItems={[
          { to: '/ldr-tools/calendar', label: 'Calendar', icon: CalendarDays, end: true },
          { to: '/ldr-tools/roster', label: 'Roster', icon: Users, end: true },
          {
            type: 'group',
            label: 'LDR checks',
            items: [
              { to: '/ldr-tools/health-checks', label: 'Health Checks', icon: ClipboardList, end: true },
              { to: '/ldr-tools/sos', label: 'Observation System', icon: ObservationSystemIcon, end: true },
            ],
          },
          {
            type: 'group',
            label: 'Reports',
            items: [
              { to: '/ldr-tools/health-checks/report', label: 'HC Report', icon: FileBarChart, end: true },
              { to: '/ldr-tools/sos/report', label: 'OS Report', icon: FileBarChart, end: true },
            ],
          },
        ]}
        accountFooter={
          <>
            <Link
              to="/ldr-tools/user-guide"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-black/[0.06] hover:text-fg"
            >
              <BookOpenText className="size-4" aria-hidden />
              User Guide
            </Link>
            {profileReady && isAdmin ? (
              <NavLink
                to="/ldr-tools/admin"
                end
                className={({ isActive }) =>
                  [
                    'mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive ? 'bg-accent-dim text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg',
                  ].join(' ')
                }
              >
                <LayoutDashboard className="size-4 shrink-0 opacity-80" aria-hidden />
                Admin
              </NavLink>
            ) : null}
          </>
        }
      />
    </LdrWorkspaceProvider>
  )
}
