import { LayoutDashboard } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

export function BmsBrainAdminLayout() {
  return (
    <div className="space-y-4">
      <header className="flex items-start gap-2">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-dim text-accent">
          <LayoutDashboard className="size-4" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">BMS Brain — Admin</h1>
          <p className="mt-1 text-xs text-muted">
            Manage roles and forums. System/tool flows are edited under Systems &amp; Tools.
          </p>
        </div>
      </header>
      <nav className="flex flex-wrap gap-2">
        {[
          { to: '/bms-brain/admin/roles', label: 'Roles' },
          { to: '/bms-brain/admin/forums', label: 'Forums' },
        ].map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              [
                'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                isActive ? 'bg-accent text-white' : 'border border-border text-muted hover:text-fg',
              ].join(' ')
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
