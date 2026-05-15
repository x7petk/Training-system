import { LayoutDashboard } from 'lucide-react'
import { Outlet } from 'react-router-dom'

export function DdsProcessAdminLayout() {
  return (
    <div className="space-y-3">
      <header className="flex items-start gap-2">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-dim text-accent">
          <LayoutDashboard className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">DDS Process — Admin</h1>
          <p className="mt-1 max-w-2xl text-xs leading-snug text-muted">
            KPI groups, KPIs, and P2P standard are global. P2P soft points are extra questions per cell and KPI group (use
            the scope bar there). Open sections from the sidebar under Admin.
          </p>
        </div>
      </header>

      <Outlet />
    </div>
  )
}
