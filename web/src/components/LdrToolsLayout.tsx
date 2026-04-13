import {
  BookOpenText,
  CalendarDays,
  ClipboardList,
  Factory,
  FileBarChart,
  LayoutDashboard,
  ListChecks,
  Users,
  UsersRound,
} from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AppSectionLayout } from './AppSectionLayout'
import { useAuth } from '../hooks/useAuth'
import { LdrWorkspaceProvider } from '../features/ldr/LdrWorkspaceContext'
import { LdrScopeFilterBar } from '../features/ldr/LdrScopeFilterBar'

export function LdrToolsLayout() {
  const { isAdmin, profileReady } = useAuth()
  const location = useLocation()
  const showScopeFilter =
    !location.pathname.startsWith('/ldr-tools/user-guide') &&
    !(location.pathname.startsWith('/ldr-tools/') && location.pathname.includes('/report'))
  return (
    <LdrWorkspaceProvider>
      <AppSectionLayout
        storageKey="ldr-tools.sidebar-collapsed"
        title="LDR tools"
        headerIconClass="bg-violet-500/15 text-violet-700 dark:text-violet-300"
        HeaderIcon={UsersRound}
        mainTop={showScopeFilter ? <LdrScopeFilterBar /> : null}
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
              { to: '/ldr-tools/sos', label: 'SOS', icon: ListChecks, end: true },
              { to: '/ldr-tools/qos', label: 'QOS', icon: ClipboardList, end: true },
              { to: '/ldr-tools/ppo', label: 'PPO', icon: Factory, end: true },
            ],
          },
          {
            type: 'group',
            label: 'Reports',
            items: [
              { to: '/ldr-tools/health-checks/report', label: 'HC Report', icon: FileBarChart, end: true },
              { to: '/ldr-tools/sos/report', label: 'SOS Report', icon: FileBarChart, end: true },
              { to: '/ldr-tools/qos/report', label: 'QOS Report', icon: FileBarChart, end: true },
              { to: '/ldr-tools/ppo/report', label: 'PPO Report', icon: FileBarChart, end: true },
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
