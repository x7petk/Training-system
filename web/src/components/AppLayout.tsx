import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Grid3X3,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  UserCircle,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const DESKTOP_SIDEBAR_KEY = 'skill-matrix.sidebar-collapsed'

const navClass = (isCollapsed: boolean) => ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isCollapsed ? 'justify-center gap-0 px-2' : 'gap-2',
    isActive
      ? 'bg-accent-dim text-accent'
      : 'text-muted hover:bg-black/[0.06] hover:text-fg',
  ].join(' ')

export function AppLayout() {
  const { signOut, isAdmin, isOperator, adminLoading, user } = useAuth()
  const navigate = useNavigate()
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
            <NavLink
              to="/dashboard"
              className={navClass(desktopCollapsed)}
              title={desktopCollapsed ? 'Dashboard' : undefined}
            >
              <BarChart3 className="size-4 shrink-0 opacity-80" aria-hidden />
              {!desktopCollapsed ? 'Dashboard' : null}
            </NavLink>
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
            <NavLink
              to="/admin"
              className={navClass(desktopCollapsed)}
              title={desktopCollapsed ? 'Admin' : undefined}
            >
              <LayoutDashboard className="size-4 shrink-0 opacity-80" aria-hidden />
              {!desktopCollapsed ? 'Admin' : null}
            </NavLink>
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
          {desktopCollapsed ? (
            <button
              type="button"
              onClick={toggleDesktopSidebar}
              className="mb-3 hidden items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-raised md:inline-flex"
            >
              <PanelLeftOpen className="size-4" aria-hidden />
              Show menu
            </button>
          ) : null}
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
