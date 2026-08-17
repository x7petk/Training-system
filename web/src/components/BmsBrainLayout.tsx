import {
  Brain,
  GitBranch,
  LayoutDashboard,
  LayoutGrid,
  Sparkles,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { AppSectionLayout } from './AppSectionLayout'
import { useAuth } from '../hooks/useAuth'
import { UserGuideFooterLink, UserGuideMobileNavLink } from './userGuide/UserGuideKit'

export function BmsBrainLayout() {
  const { isAdmin, profileReady } = useAuth()

  return (
    <AppSectionLayout
      storageKey="bms-brain.sidebar-collapsed"
      title="BMS Brain"
      subtitle="Business systems & process matrix"
      headerIconClass="bg-indigo-500/15 text-indigo-800 dark:text-indigo-300"
      HeaderIcon={Brain}
      navFooter={<UserGuideMobileNavLink to="/bms-brain/user-guide" />}
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
        { to: '/bms-brain/matrix', label: 'Process Matrix', icon: LayoutGrid, end: true },
        { to: '/bms-brain/processes', label: 'Systems & Tools', icon: GitBranch, end: true },
        { to: '/bms-brain/ai', label: 'AI Insights', icon: Sparkles, end: true },
      ]}
      accountFooter={
        <div className="flex flex-col gap-0.5">
          <UserGuideFooterLink to="/bms-brain/user-guide" />
          {profileReady && isAdmin ? (
            <NavLink
              to="/bms-brain/admin/roles"
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
          ) : null}
        </div>
      }
    />
  )
}
