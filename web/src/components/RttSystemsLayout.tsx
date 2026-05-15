import {
  AlertTriangle,
  BookOpenText,
  Bug,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LayoutList,
  ListTodo,
  Network,
  XCircle,
} from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AppSectionLayout } from './AppSectionLayout'
import { useAuth } from '../hooks/useAuth'
import { Plan24WorkspaceProvider } from '../features/plan24/Plan24WorkspaceContext'
import { Plan24ScopeBar } from '../features/plan24/Plan24ScopeBar'

export function RttSystemsLayout() {
  const { isAdmin, profileReady } = useAuth()
  const { pathname } = useLocation()
  const showPlan24Scope =
    pathname.includes('/rtt-systems/plan-24') ||
    pathname.includes('/rtt-systems/dds-actions') ||
    pathname.includes('/rtt-systems/admin') ||
    pathname.includes('/rtt-systems/defect-handling') ||
    pathname.includes('/rtt-systems/deviations') ||
    pathname.includes('/rtt-systems/quality-fails') ||
    pathname.includes('/rtt-systems/list-view')

  return (
    <Plan24WorkspaceProvider>
    <AppSectionLayout
      storageKey="rtt-systems.sidebar-collapsed"
      title="RTT systems"
      mainTop={showPlan24Scope ? <Plan24ScopeBar /> : undefined}
      headerIconClass="bg-sky-500/15 text-sky-800 dark:text-sky-300"
      HeaderIcon={Network}
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
        { to: '/rtt-systems/plan-24', label: 'Plan 24', icon: CalendarDays, end: true },
        { to: '/rtt-systems/dds-actions', label: 'DDS actions', icon: ListTodo, end: true },
        { to: '/rtt-systems/my-plan', label: 'My Plan', icon: ClipboardList, end: true },
        { to: '/rtt-systems/list-view', label: 'List view', icon: LayoutList, end: true },
        { to: '/rtt-systems/deviations', label: 'Deviations', icon: AlertTriangle, end: true },
        { to: '/rtt-systems/defect-handling', label: 'Defect Handling', icon: Bug, end: true },
        { to: '/rtt-systems/quality-fails', label: 'Quality Fails', icon: XCircle, end: true },
      ]}
      accountFooter={
        <>
          <Link
            to="/rtt-systems/user-guide"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-black/[0.06] hover:text-fg"
          >
            <BookOpenText className="size-4" aria-hidden />
            User Guide
          </Link>
          {profileReady && isAdmin ? (
            <NavLink
              to="/rtt-systems/admin"
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
    </Plan24WorkspaceProvider>
  )
}
