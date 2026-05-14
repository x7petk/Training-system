import {
  Building2,
  CalendarDays,
  ClipboardCheck,
  Clock,
  Factory,
  FileSpreadsheet,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  ListTree,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { AppSectionLayout } from './AppSectionLayout'
import { useAuth } from '../hooks/useAuth'
import { Plan24WorkspaceProvider } from '../features/plan24/Plan24WorkspaceContext'
import { Plan24ScopeBar } from '../features/plan24/Plan24ScopeBar'

export function DdsProcessLayout() {
  const { isAdmin, profileReady } = useAuth()

  return (
    <Plan24WorkspaceProvider>
      <AppSectionLayout
        storageKey="dds-process.sidebar-collapsed"
        title="DDS Process"
        subtitle="DDS process"
        mainTop={<Plan24ScopeBar />}
        headerIconClass="bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
        HeaderIcon={Layers}
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
          { to: '/dds-process/p2p', label: 'P2P', icon: UsersRound, end: true },
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
          profileReady && isAdmin ? (
            <NavLink
              to="/dds-process/admin"
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
