import { Suspense, useState, type ComponentType, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

type IconComp = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>

const navClass = (isCollapsed: boolean) => ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isCollapsed ? 'justify-center gap-0 px-2' : 'gap-2',
    isActive
      ? 'bg-accent-dim text-accent'
      : 'text-muted hover:bg-black/[0.06] hover:text-fg',
  ].join(' ')

export type SectionNavItem = {
  to: string
  label: string
  icon: IconComp
  end?: boolean
}

export type SectionNavGroup = {
  type: 'group'
  label: string
  items: SectionNavItem[]
}

export type SectionNavEntry = SectionNavItem | SectionNavGroup

function isNavGroup(entry: SectionNavEntry): entry is SectionNavGroup {
  return 'type' in entry && entry.type === 'group'
}

type AppSectionLayoutProps = {
  storageKey: string
  title: string
  /** Shown under the title when expanded; omit to hide. */
  subtitle?: string
  headerIconClass: string
  HeaderIcon: IconComp
  navItems: SectionNavEntry[]
  /** Extra nav nodes below primary items (e.g. footer links) */
  navFooter?: ReactNode
  /** Extra account/action nodes shown under "Sign out" in desktop sidebar. */
  accountFooter?: ReactNode
  /** Rendered above the routed outlet (e.g. global filters). */
  mainTop?: ReactNode
  /** When set, wraps `<Outlet />` in `<Suspense>` for lazy route segments. */
  outletFallback?: ReactNode
}

export function AppSectionLayout({
  storageKey,
  title,
  subtitle,
  headerIconClass,
  HeaderIcon,
  navItems,
  navFooter,
  accountFooter,
  mainTop,
  outletFallback,
}: AppSectionLayoutProps) {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const [desktopCollapsed, setDesktopCollapsed] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(storageKey) === '1',
  )

  function toggleDesktopSidebar() {
    setDesktopCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem(storageKey, next ? '1' : '0')
      queueMicrotask(() => {
        window.dispatchEvent(
          new CustomEvent('app-section-sidebar-toggle', { detail: { storageKey, collapsed: next } }),
        )
      })
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
          className={`flex h-14 items-center border-b border-border md:h-16 ${
            desktopCollapsed ? 'px-2' : 'pl-4 pr-2'
          }`}
        >
          <Link
            to="/"
            className={`flex min-w-0 flex-1 items-center no-underline ${desktopCollapsed ? 'justify-center' : 'gap-2'}`}
            title="All apps"
          >
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${headerIconClass}`}>
              <HeaderIcon className="size-4" aria-hidden />
            </span>
            {!desktopCollapsed ? (
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold tracking-tight text-fg">{title}</p>
                {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
              </div>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={toggleDesktopSidebar}
            className="hidden shrink-0 rounded-lg p-2 text-muted hover:bg-black/[0.06] hover:text-fg md:block"
            aria-label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {desktopCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>

        <nav className="flex gap-1 p-2 md:flex-col" aria-label={`${title} navigation`}>
          {navItems.map((entry, entryIdx) => {
            if (isNavGroup(entry)) {
              return (
                <div
                  key={`nav-group-${entry.label}-${entryIdx}`}
                  className={entryIdx > 0 ? 'mt-2 border-t border-border pt-2' : ''}
                >
                  {!desktopCollapsed ? (
                    <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                      {entry.label}
                    </p>
                  ) : entryIdx > 0 ? (
                    <div className="mx-1 mb-1 h-px shrink-0 bg-border md:mb-1" aria-hidden />
                  ) : null}
                  <div className="flex flex-col gap-1">
                    {entry.items.map((item) => {
                      const Icon = item.icon
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.end}
                          className={navClass(desktopCollapsed)}
                          title={desktopCollapsed ? item.label : undefined}
                        >
                          <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                          {!desktopCollapsed ? item.label : null}
                        </NavLink>
                      )
                    })}
                  </div>
                </div>
              )
            }
            const Icon = entry.icon
            return (
              <NavLink
                key={entry.to}
                to={entry.to}
                end={entry.end}
                className={navClass(desktopCollapsed)}
                title={desktopCollapsed ? entry.label : undefined}
              >
                <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                {!desktopCollapsed ? entry.label : null}
              </NavLink>
            )
          })}
          {navFooter}
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
          {accountFooter ? <div className="mt-1">{accountFooter}</div> : null}
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
        <main className="flex min-h-0 flex-1 flex-col p-4 md:p-8">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col">
            {mainTop ? <div className="mb-6 shrink-0">{mainTop}</div> : null}
            {outletFallback ? (
              <Suspense fallback={outletFallback}>
                <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
                  <Outlet />
                </div>
              </Suspense>
            ) : (
              <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
                <Outlet />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
