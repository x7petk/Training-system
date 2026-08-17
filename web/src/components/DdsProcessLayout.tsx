import {
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Clock,
  Factory,
  FileSpreadsheet,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  ListTodo,
  ListTree,
  RefreshCw,
  ShieldCheck,
  Table2,
  Zap,
  UsersRound,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { AppSectionLayout } from './AppSectionLayout'
import { useAuth } from '../hooks/useAuth'
import { Plan24WorkspaceProvider } from '../features/plan24/Plan24WorkspaceContext'
import { ShiftDdsShellProvider } from '../features/dds/ShiftDdsShellContext'
import { Plan24ScopeBar } from '../features/plan24/Plan24ScopeBar'
import { UserGuideMobileNavLink } from './userGuide/UserGuideKit'

const adminBasePath = '/dds-process/admin'
const userGuidePath = '/dds-process/user-guide'

export function DdsProcessLayout() {
  const { isAdmin, profileReady } = useAuth()
  const location = useLocation()
  const inAdminSection = location.pathname.startsWith(adminBasePath)
  const inUserGuide = location.pathname.startsWith(userGuidePath)
  const adminNeedsScope =
    location.pathname.includes('/admin/p2p-soft-points') ||
    location.pathname.includes('/admin/p2p-setup') ||
    location.pathname.includes('/admin/kpi-setup') ||
    location.pathname.includes('/admin/triggers')
  const showPlan24Scope = (!inAdminSection && !inUserGuide) || adminNeedsScope

  return (
    <Plan24WorkspaceProvider>
      <ShiftDdsShellProvider>
        <AppSectionLayout
        storageKey="dds-process.sidebar-collapsed"
        title="DDS Process"
        subtitle="DDS process"
        mainTop={showPlan24Scope ? <Plan24ScopeBar /> : null}
        headerIconClass="bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
        HeaderIcon={Layers}
        navFooter={<UserGuideMobileNavLink to={userGuidePath} />}
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
          { to: '/dds-process/plan-24', label: 'Plan 24', icon: CalendarDays, end: true },
          { to: '/dds-process/dds-actions', label: 'DDS actions', icon: ListTodo, end: true },
          { to: '/dds-process/p2p', label: 'P2P', icon: UsersRound, end: true },
          { to: '/dds-process/p2p-summary', label: 'P2P Summary', icon: Table2, end: true },
          { to: '/dds-process/triggers', label: 'Triggers', icon: Zap, end: true },
          { to: '/dds-process/shift-dds', label: 'Shift DDS', icon: Clock, end: true },
          { to: '/dds-process/line-compliance', label: 'Line compliance', icon: ClipboardCheck, end: true },
          { to: '/dds-process/line-dds', label: 'Line DDS', icon: ListTree, end: true },
          { to: '/dds-process/plant-dds', label: 'Plant DDS', icon: Factory, end: true },
          { to: '/dds-process/site-compliance', label: 'Site compliance', icon: ShieldCheck, end: true },
          { to: '/dds-process/site-dds', label: 'Site DDS', icon: Building2, end: true },
          { to: '/dds-process/wds', label: 'WDS', icon: LayoutGrid, end: true },
          { to: '/dds-process/e-plan', label: 'e-plan', icon: FileSpreadsheet, end: true },
          { to: '/dds-process/pdca', label: 'PDCA', icon: RefreshCw, end: true },
        ]}
        accountFooter={
          profileReady ? (
            <div className="flex flex-col gap-0.5">
              {isAdmin ? (
                <>
                  <NavLink
                    to={adminBasePath}
                    end={false}
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
                  {inAdminSection ? (
                    <>
                      <NavLink
                    to="/dds-process/admin/kpi-groups"
                    end
                    className={({ isActive }) =>
                      [
                        'flex w-full items-center gap-2 rounded-lg py-1.5 pl-9 pr-3 text-xs font-medium transition-colors',
                        isActive ? 'text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg',
                      ].join(' ')
                    }
                  >
                    KPI groups
                  </NavLink>
                  <NavLink
                    to="/dds-process/admin/kpis"
                    end
                    className={({ isActive }) =>
                      [
                        'flex w-full items-center gap-2 rounded-lg py-1.5 pl-9 pr-3 text-xs font-medium transition-colors',
                        isActive ? 'text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg',
                      ].join(' ')
                    }
                  >
                    KPIs
                  </NavLink>
                  <NavLink
                    to="/dds-process/admin/kpi-setup"
                    end
                    className={({ isActive }) =>
                      [
                        'flex w-full items-center gap-2 rounded-lg py-1.5 pl-9 pr-3 text-xs font-medium transition-colors',
                        isActive ? 'text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg',
                      ].join(' ')
                    }
                  >
                    KPI set-up
                  </NavLink>
                  <NavLink
                    to="/dds-process/admin/cell-lines"
                    end
                    className={({ isActive }) =>
                      [
                        'flex w-full items-center gap-2 rounded-lg py-1.5 pl-9 pr-3 text-xs font-medium transition-colors',
                        isActive ? 'text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg',
                      ].join(' ')
                    }
                  >
                    Cell lines
                  </NavLink>
                  <NavLink
                    to="/dds-process/admin/p2p-standard"
                    end
                    className={({ isActive }) =>
                      [
                        'flex w-full items-center gap-2 rounded-lg py-1.5 pl-9 pr-3 text-xs font-medium transition-colors',
                        isActive ? 'text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg',
                      ].join(' ')
                    }
                  >
                    P2P standard
                  </NavLink>
                  <NavLink
                    to="/dds-process/admin/p2p-soft-points"
                    end
                    className={({ isActive }) =>
                      [
                        'flex w-full items-center gap-2 rounded-lg py-1.5 pl-9 pr-3 text-xs font-medium transition-colors',
                        isActive ? 'text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg',
                      ].join(' ')
                    }
                  >
                    P2P soft points
                  </NavLink>
                  <NavLink
                    to="/dds-process/admin/p2p-setup"
                    end
                    className={({ isActive }) =>
                      [
                        'flex w-full items-center gap-2 rounded-lg py-1.5 pl-9 pr-3 text-xs font-medium transition-colors',
                        isActive ? 'text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg',
                      ].join(' ')
                    }
                  >
                    P2P set-up
                  </NavLink>
                  <NavLink
                    to="/dds-process/admin/triggers"
                    end
                    className={({ isActive }) =>
                      [
                        'flex w-full items-center gap-2 rounded-lg py-1.5 pl-9 pr-3 text-xs font-medium transition-colors',
                        isActive ? 'text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg',
                      ].join(' ')
                    }
                  >
                    Triggers
                  </NavLink>
                  <NavLink
                    to="/dds-process/admin/reward-recognition"
                    end
                    className={({ isActive }) =>
                      [
                        'flex w-full items-center gap-2 rounded-lg py-1.5 pl-9 pr-3 text-xs font-medium transition-colors',
                        isActive ? 'text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg',
                      ].join(' ')
                    }
                  >
                    Reward & recognition
                  </NavLink>
                  <NavLink
                    to="/dds-process/admin/top-losses"
                    end
                    className={({ isActive }) =>
                      [
                        'flex w-full items-center gap-2 rounded-lg py-1.5 pl-9 pr-3 text-xs font-medium transition-colors',
                        isActive ? 'text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg',
                      ].join(' ')
                    }
                  >
                    Top losses
                  </NavLink>
                  <NavLink
                    to="/dds-process/admin/e-plan-setup"
                    end
                    className={({ isActive }) =>
                      [
                        'flex w-full items-center gap-2 rounded-lg py-1.5 pl-9 pr-3 text-xs font-medium transition-colors',
                        isActive ? 'text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg',
                      ].join(' ')
                    }
                  >
                    e-Plan setup
                  </NavLink>
                  <NavLink
                    to="/dds-process/admin/wds-kpis"
                    end
                    className={({ isActive }) =>
                      [
                        'flex w-full items-center gap-2 rounded-lg py-1.5 pl-9 pr-3 text-xs font-medium transition-colors',
                        isActive ? 'text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg',
                      ].join(' ')
                    }
                  >
                    WDS KPIs
                  </NavLink>
                    </>
                  ) : null}
                </>
              ) : null}
              <NavLink
                to={userGuidePath}
                end
                className={({ isActive }) =>
                  [
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive ? 'bg-accent-dim text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg',
                  ].join(' ')
                }
              >
                <BookOpen className="size-4 shrink-0 opacity-80" aria-hidden />
                User Guide
              </NavLink>
            </div>
          ) : null
        }
      />
      </ShiftDdsShellProvider>
    </Plan24WorkspaceProvider>
  )
}
