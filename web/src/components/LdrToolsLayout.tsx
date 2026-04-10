import { BookOpenText, CalendarDays, ClipboardList, FileBarChart, LayoutDashboard, Users, UsersRound } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { AppSectionLayout } from './AppSectionLayout'
import { useAuth } from '../hooks/useAuth'
import { LdrWorkspaceProvider } from '../features/ldr/LdrWorkspaceContext'
import { LdrScopeFilterBar } from '../features/ldr/LdrScopeFilterBar'

export function LdrToolsLayout() {
  const { isAdmin, profileReady } = useAuth()
  const location = useLocation()
  const showScopeFilter =
    !location.pathname.startsWith('/ldr-tools/user-guide') &&
    location.pathname !== '/ldr-tools/health-checks/report'
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
          { to: '/ldr-tools/health-checks', label: 'Health Checks', icon: ClipboardList, end: true },
          { to: '/ldr-tools/health-checks/report', label: 'HC Report', icon: FileBarChart, end: true },
          ...(profileReady && isAdmin
            ? [{ to: '/ldr-tools/admin', label: 'Admin', icon: LayoutDashboard, end: true }]
            : []),
        ]}
        accountFooter={
          <Link
            to="/ldr-tools/user-guide"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-black/[0.06] hover:text-fg"
          >
            <BookOpenText className="size-4" aria-hidden />
            User Guide
          </Link>
        }
      />
    </LdrWorkspaceProvider>
  )
}
