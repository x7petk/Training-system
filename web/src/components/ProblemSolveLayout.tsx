import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  HelpCircle,
  LayoutDashboard,
  Lightbulb,
  ListTodo,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { AppSectionLayout } from './AppSectionLayout'
import { useAuth } from '../hooks/useAuth'
import { Plan24WorkspaceProvider } from '../features/plan24/Plan24WorkspaceContext'
import { Plan24ScopeBar } from '../features/plan24/Plan24ScopeBar'

export function ProblemSolveLayout() {
  const { isAdmin, profileReady } = useAuth()

  return (
    <Plan24WorkspaceProvider>
      <AppSectionLayout
        storageKey="problem-solve.sidebar-collapsed"
        title="Problem Solve"
        subtitle="Problem solve"
        mainTop={<Plan24ScopeBar />}
        headerIconClass="bg-orange-500/15 text-orange-900 dark:text-orange-300"
        HeaderIcon={Lightbulb}
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
          { to: '/problem-solve/plan-24', label: 'Plan 24', icon: CalendarDays, end: true },
          { to: '/problem-solve/dds-actions', label: 'DDS actions', icon: ListTodo, end: true },
          { to: '/problem-solve/ips', label: 'IPS', icon: Sparkles, end: true },
          { to: '/problem-solve/ups', label: 'UPS', icon: TrendingUp, end: true },
          { to: '/problem-solve/w-w', label: 'W-W', icon: HelpCircle, end: true },
          { to: '/problem-solve/bde', label: 'BDE', icon: BarChart3, end: true },
          { to: '/problem-solve/ida', label: 'IDA', icon: ScanSearch, end: true },
          { to: '/problem-solve/safety', label: 'Safety', icon: ShieldCheck, end: true },
          { to: '/problem-solve/quality', label: 'Quality', icon: BadgeCheck, end: true },
        ]}
        accountFooter={
          profileReady && isAdmin ? (
            <NavLink
              to="/problem-solve/admin"
              end
              className={({ isActive }) =>
                [
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-accent-dim text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg',
                ].join(' ')
              }
            >
              <LayoutDashboard className="size-4 shrink-0 opacity-80" aria-hidden />
              Admin
            </NavLink>
          ) : null
        }
      />
    </Plan24WorkspaceProvider>
  )
}
