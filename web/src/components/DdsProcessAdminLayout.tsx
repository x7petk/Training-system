import { LayoutDashboard } from 'lucide-react'
import { Outlet } from 'react-router-dom'

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
            KPI groups and their KPIs are shared across every site, plant, and cell. Use the sidebar under Admin for KPI groups and KPIs.
          </p>
        </div>
      </header>

      <Outlet />
    </div>
  )
}
