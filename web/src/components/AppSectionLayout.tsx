import { Suspense, useState, type ComponentType, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
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

function flattenNavItems(entries: SectionNavEntry[]): SectionNavItem[] {
  return entries.flatMap((entry) => (isNavGroup(entry) ? entry.items : [entry]))
}

function selectedNavTo(pathname: string, items: SectionNavItem[]): string {
  const exact = items.find((item) => item.to === pathname)
  if (exact) return exact.to
  const nested = items
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]
  return nested?.to ?? items[0]?.to ?? ''
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
  /** When false, routed content grows with the page (document scroll) instead of a fixed viewport pane. */
  outletFillsViewport?: boolean
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
  outletFillsViewport = true,
}: AppSectionLayoutProps) {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const onePageOutlet =
    location.pathname.includes('/dds-process/pdca') ||
    /\/problem-solve\/bde\/?$/.test(location.pathname) ||
    location.pathname.includes('/problem-solve/bde/reports')
  const flatNavItems = flattenNavItems(navItems)
  const mobileNavValue = selectedNavTo(location.pathname, flatNavItems)
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
    <div
      className={`flex flex-col md:flex-row ${
        onePageOutlet ? 'h-svh max-h-svh overflow-hidden' : 'min-h-svh'
      }`}
    >
      <aside
        className={`border-b border-border bg-surface/80 backdrop-blur-md transition-[width] duration-200 md:border-b-0 md:border-r ${
          desktopCollapsed ? 'md:w-[4.25rem]' : 'md:w-56'
        }`}
      >
        <div
          className={`flex h-12 items-center border-b border-border md:h-16 ${
            desktopCollapsed ? 'px-2' : 'pl-3 pr-2 md:pl-4'
          }`}
        >
          <Link
            to="/"
            className={`flex min-w-0 flex-1 items-center no-underline ${desktopCollapsed ? 'justify-center' : 'gap-2'}`}
            title="All apps"
          >
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg md:size-9 ${headerIconClass}`}>
              <HeaderIcon className="size-4" aria-hidden />
            </span>
            {!desktopCollapsed ? (
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold tracking-tight text-fg">{title}</p>
                {subtitle ? <p className="hidden truncate text-xs text-muted md:block">{subtitle}</p> : null}
              </div>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => {
              void signOut().then(() => navigate('/login'))
            }}
            className="rounded-lg p-2 text-muted hover:bg-black/[0.06] hover:text-fg md:hidden"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
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

        {flatNavItems.length > 0 ? (
          <div className="space-y-1 border-b border-border px-2 py-2 md:hidden">
            <label htmlFor={`${storageKey}-mobile-nav`} className="sr-only">
              {title} tool
            </label>
            <select
              id={`${storageKey}-mobile-nav`}
              value={mobileNavValue}
              onChange={(e) => navigate(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-border bg-canvas px-3 text-base font-medium text-fg"
            >
              {flatNavItems.map((item) => (
                <option key={item.to} value={item.to}>
                  {item.label}
                </option>
              ))}
            </select>
            {navFooter}
          </div>
        ) : null}

        <nav className="hidden gap-1 p-2 md:flex md:flex-col" aria-label={`${title} navigation`}>
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
        <main
          className={`flex min-h-0 flex-1 flex-col p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:p-8 ${onePageOutlet ? 'overflow-hidden' : ''}`}
        >
          <div
            className={`mx-auto flex w-full max-w-7xl flex-col ${
              onePageOutlet
                ? 'min-h-0 flex-1 overflow-hidden'
                : outletFillsViewport
                  ? 'h-full min-h-0 flex-1'
                  : 'w-full'
            }`}
          >
            {mainTop ? <div className={`shrink-0 ${onePageOutlet ? 'mb-3' : 'mb-6'}`}>{mainTop}</div> : null}
            {outletFallback ? (
              <Suspense fallback={outletFallback}>
                <div
                  className={
                    onePageOutlet || outletFillsViewport
                      ? 'flex h-full min-h-0 min-w-0 flex-1 flex-col'
                      : 'flex w-full min-w-0 flex-col'
                  }
                >
                  <Outlet />
                </div>
              </Suspense>
            ) : (
              <div
                className={
                  onePageOutlet || outletFillsViewport
                    ? 'flex h-full min-h-0 min-w-0 flex-1 flex-col'
                    : 'flex w-full min-w-0 flex-col'
                }
              >
                <Outlet />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
