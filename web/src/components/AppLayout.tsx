import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Grid3X3, LayoutDashboard, LogOut, Sparkles, UserCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent-dim text-accent'
      : 'text-muted hover:bg-black/[0.06] hover:text-fg',
  ].join(' ')

export function AppLayout() {
  const { signOut, isAdmin, isOperator, adminLoading, user } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside className="border-b border-border bg-surface/80 backdrop-blur-md md:w-56 md:border-b-0 md:border-r">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4 md:h-16">
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent-dim text-accent">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold tracking-tight">Skill Matrix</p>
            <p className="truncate text-xs text-muted">Capability hub</p>
          </div>
        </div>
        <nav className="flex gap-1 p-2 md:flex-col" aria-label="Main">
          {!adminLoading && !isOperator ? (
            <NavLink to="/" end className={navClass}>
              <Grid3X3 className="size-4 shrink-0 opacity-80" aria-hidden />
              Matrix
            </NavLink>
          ) : null}
          <NavLink to="/my-skills" className={navClass}>
            <UserCircle className="size-4 shrink-0 opacity-80" aria-hidden />
            My skills
          </NavLink>
          {isAdmin ? (
            <NavLink to="/admin" className={navClass}>
              <LayoutDashboard className="size-4 shrink-0 opacity-80" aria-hidden />
              Admin
            </NavLink>
          ) : null}
        </nav>
        <div className="mt-auto hidden border-t border-border p-3 md:block">
          <p className="truncate px-2 text-xs text-muted" title={user?.email ?? undefined}>
            {user?.email}
          </p>
          <button
            type="button"
            onClick={() => {
              void signOut().then(() => navigate('/login'))
            }}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-black/[0.06] hover:text-fg"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
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
