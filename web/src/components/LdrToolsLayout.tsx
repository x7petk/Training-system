import { CalendarDays, LayoutDashboard, Users, UsersRound } from 'lucide-react'
import { AppSectionLayout } from './AppSectionLayout'
import { useAuth } from '../hooks/useAuth'
import { LdrWorkspaceProvider } from '../features/ldr/LdrWorkspaceContext'
import { LdrScopeFilterBar } from '../features/ldr/LdrScopeFilterBar'

export function LdrToolsLayout() {
  const { isAdmin, profileReady } = useAuth()
  return (
    <LdrWorkspaceProvider>
      <AppSectionLayout
        storageKey="ldr-tools.sidebar-collapsed"
        title="LDR tools"
        headerIconClass="bg-violet-500/15 text-violet-700 dark:text-violet-300"
        HeaderIcon={UsersRound}
        mainTop={<LdrScopeFilterBar />}
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
        ...(profileReady && isAdmin
          ? [{ to: '/ldr-tools/admin', label: 'Admin', icon: LayoutDashboard, end: true }]
          : []),
      ]}
      />
    </LdrWorkspaceProvider>
  )
}
