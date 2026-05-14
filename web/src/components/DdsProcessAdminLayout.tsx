import { LayoutDashboard } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
    isActive ? 'bg-accent-dim text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg',
  ].join(' ')

export function DdsProcessAdminLayout() {
  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-accent">
          <LayoutDashboard className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">DDS Process — Admin</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Configure DDS for the cell selected in the scope bar. KPI groups control which areas can surface each group later.
          </p>
        </div>
      </header>

      <nav
        className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1"
        role="tablist"
        aria-label="DDS admin sections"
      >
        <NavLink to="/dds-process/admin/kpi-groups" role="tab" className={tabClass}>
          KPI groups
        </NavLink>
      </nav>

      <Outlet />
    </div>
  )
}
