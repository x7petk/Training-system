import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  BarChart3,
  FileBarChart,
  Grid3X3,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  UserCircle,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { ADMIN_NAV_GROUPS, DEFAULT_ADMIN_TAB, parseAdminTab } from '../features/admin/adminNavConfig'

const DESKTOP_SIDEBAR_KEY = 'skill-matrix.sidebar-collapsed'

const navClass = (isCollapsed: boolean) => ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isCollapsed ? 'justify-center gap-0 px-2' : 'gap-2',
    isActive
      ? 'bg-accent-dim text-accent'
      : 'text-muted hover:bg-black/[0.06] hover:text-fg',
  ].join(' ')

function adminSubNavClass(active: boolean, collapsed: boolean) {
  return [
    'flex rounded-md text-xs font-medium transition-colors',
    collapsed ? 'justify-center px-2 py-2' : 'items-center gap-2 px-2 py-1.5 text-left',
    active
      ? 'bg-accent-dim text-accent ring-1 ring-accent/25'
      : 'text-muted hover:bg-black/[0.06] hover:text-fg',
  ].join(' ')
}

export function AppLayout() {
  const { signOut, isAdmin, isOperator, adminLoading, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const onAdminRoute = location.pathname === '/admin'
  const resolvedAdminTab = parseAdminTab(searchParams.get('tab'))
  const adminHref = `/admin?tab=${onAdminRoute ? resolvedAdminTab : DEFAULT_ADMIN_TAB}`
  const [desktopCollapsed, setDesktopCollapsed] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(DESKTOP_SIDEBAR_KEY) === '1',
  )

  function toggleDesktopSidebar() {
    setDesktopCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem(DESKTOP_SIDEBAR_KEY, next ? '1' : '0')
      return next
    })
  }

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside
        className={`border-b border-border bg-surface/80 backdrop-blur-md transition-[width] duration-200 md:border-b-0 md:border-r ${
          desktopCollapsed ? 'md:w-[4.25rem]' : 'md:w-56'
        }`}
      >
        <div
          className={`flex h-14 items-center border-b border-border px-4 md:h-16 ${
            desktopCollapsed ? 'justify-center px-2' : 'gap-2'
          }`}
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent-dim text-accent">
            <Sparkles className="size-4" aria-hidden />
          </span>
          {!desktopCollapsed ? (
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold tracking-tight">Skill Matrix</p>
              <p className="truncate text-xs text-muted">Capability hub</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={toggleDesktopSidebar}
            className={`ml-auto hidden rounded-lg p-2 text-muted hover:bg-black/[0.06] hover:text-fg md:block ${
              desktopCollapsed ? 'ml-0' : ''
            }`}
            aria-label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {desktopCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>
        <nav className="flex gap-1 p-2 md:flex-col" aria-label="Main">
          {!adminLoading && !isOperator ? (
            <>
              <NavLink
                to="/dashboard"
                className={navClass(desktopCollapsed)}
                title={desktopCollapsed ? 'Dashboard' : undefined}
              >
                <BarChart3 className="size-4 shrink-0 opacity-80" aria-hidden />
                {!desktopCollapsed ? 'Dashboard' : null}
              </NavLink>
              <NavLink
                to="/report"
                className={navClass(desktopCollapsed)}
                title={desktopCollapsed ? 'Report' : undefined}
              >
                <FileBarChart className="size-4 shrink-0 opacity-80" aria-hidden />
                {!desktopCollapsed ? 'Report' : null}
              </NavLink>
            </>
          ) : null}
          <NavLink
            to="/my-skills"
            className={navClass(desktopCollapsed)}
            title={desktopCollapsed ? 'My skills' : undefined}
          >
            <UserCircle className="size-4 shrink-0 opacity-80" aria-hidden />
            {!desktopCollapsed ? 'My skills' : null}
          </NavLink>
          {!adminLoading && !isOperator ? (
            <NavLink
              to="/"
              end
              className={navClass(desktopCollapsed)}
              title={desktopCollapsed ? 'Matrix' : undefined}
            >
              <Grid3X3 className="size-4 shrink-0 opacity-80" aria-hidden />
              {!desktopCollapsed ? 'Matrix' : null}
            </NavLink>
          ) : null}
          {isAdmin ? (
            <div
              className={`flex w-full flex-col gap-1 md:w-auto ${onAdminRoute ? 'rounded-lg bg-black/[0.03] p-1 ring-1 ring-border/60 dark:bg-white/[0.04]' : ''}`}
            >
              <NavLink
                to={adminHref}
                className={navClass(desktopCollapsed)}
                title={desktopCollapsed ? 'Admin' : undefined}
              >
                <LayoutDashboard className="size-4 shrink-0 opacity-80" aria-hidden />
                {!desktopCollapsed ? 'Admin' : null}
              </NavLink>
              {onAdminRoute ? (
                <div
                  className={`flex flex-col gap-2 ${desktopCollapsed ? 'items-stretch' : 'border-l-2 border-accent/20 pl-2 md:ml-1'}`}
                  role="navigation"
                  aria-label="Admin settings"
                >
                  {ADMIN_NAV_GROUPS.map((group) => (
                    <div key={group.heading} className="min-w-0">
                      {!desktopCollapsed ? (
                        <p className="mb-1 px-1 text-[9px] font-semibold uppercase tracking-wide text-muted">
                          {group.heading}
                        </p>
                      ) : null}
                      <ul className={`space-y-0.5 ${desktopCollapsed ? 'flex flex-col' : ''}`}>
                        {group.items.map((item) => {
                          const Icon = item.icon
                          const active = resolvedAdminTab === item.id
                          return (
                            <li key={item.id}>
                              <NavLink
                                to={`/admin?tab=${item.id}`}
                                className={() => adminSubNavClass(active, desktopCollapsed)}
                                title={desktopCollapsed ? `${item.label} — ${item.hint}` : item.hint}
                                aria-current={active ? 'page' : undefined}
                              >
                                <Icon
                                  className={`size-4 shrink-0 ${active ? 'text-accent' : 'opacity-75'}`}
                                  aria-hidden
                                />
                                {!desktopCollapsed ? (
                                  <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
                                ) : null}
                              </NavLink>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </nav>
        <div className={`mt-auto hidden border-t border-border p-3 md:block ${desktopCollapsed ? 'px-2' : ''}`}>
          {!desktopCollapsed ? (
            <p className="truncate px-2 text-xs text-muted" title={user?.email ?? undefined}>
              {user?.email}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void signOut().then(() => navigate('/login'))
            }}
            className={`mt-2 flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-black/[0.06] hover:text-fg ${
              desktopCollapsed ? 'justify-center gap-0 px-2' : 'gap-2'
            }`}
            title={desktopCollapsed ? 'Sign out' : undefined}
          >
            <LogOut className="size-4" aria-hidden />
            {!desktopCollapsed ? 'Sign out' : null}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface-raised/50 px-4 md:hidden">
          <p className="truncate text-sm text-muted">{user?.email}</p>
          <button
            type="button"
            onClick={() => {
              void signOut().then(() => navigate('/login'))
            }}
            className="rounded-lg p-2 text-muted hover:bg-black/[0.06] hover:text-fg"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
