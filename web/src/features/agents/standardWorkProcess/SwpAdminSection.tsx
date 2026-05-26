import { useState, type ComponentType } from 'react'
import { Cpu, RotateCcw, Users } from 'lucide-react'
import { RolesAdminPanel } from '../kpiCascade/KpiCascadeAdminPanels'
import { SystemsAdminPanel } from './SwpAdminPanels'
import type { SwpAdminTab } from './types'
import type { KpiCascadeRole } from '../kpiCascade/types'
import type { SwpSystem } from './types'

type Props = {
  roles: KpiCascadeRole[]
  onRolesChange: (roles: KpiCascadeRole[]) => void
  systems: SwpSystem[]
  onSystemsChange: (systems: SwpSystem[]) => void
  onResetSystems: () => void
}

const ADMIN_TABS: {
  id: SwpAdminTab
  label: string
  icon: ComponentType<{ className?: string }>
  blurb: string
}[] = [
  {
    id: 'roles',
    label: 'Roles',
    icon: Users,
    blurb: 'Same role list as KPI Cascade — edits here apply everywhere roles are used.',
  },
  {
    id: 'systems',
    label: 'Systems',
    icon: Cpu,
    blurb: 'Standard work systems such as CL, CIL, DH, and DDS.',
  },
]

export function SwpAdminSection({
  roles,
  onRolesChange,
  systems,
  onSystemsChange,
  onResetSystems,
}: Props) {
  const [adminTab, setAdminTab] = useState<SwpAdminTab>('roles')
  const activeMeta = ADMIN_TABS.find((t) => t.id === adminTab)!

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-canvas to-canvas px-4 py-4 sm:px-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-fg">Admin setup</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Configure roles (shared with KPI Cascade) and systems for Standard Work Process.
            Changes save automatically.
          </p>
        </div>
        {adminTab === 'systems' ? (
          <button
            type="button"
            onClick={() => {
              if (confirm('Reset systems to CL, CIL, DH, DDS? This cannot be undone.')) onResetSystems()
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm font-medium text-fg hover:bg-black/[0.04]"
          >
            <RotateCcw className="size-4" />
            Reset systems
          </button>
        ) : null}
      </div>

      <nav
        className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-surface-raised/50 p-1"
        aria-label="SWP admin sections"
      >
        {ADMIN_TABS.map((t) => {
          const Icon = t.icon
          const active = adminTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setAdminTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-muted hover:bg-canvas hover:text-fg'
              }`}
            >
              <Icon className="size-4" aria-hidden />
              {t.label}
            </button>
          )
        })}
      </nav>

      <p className="text-sm text-muted">{activeMeta.blurb}</p>

      {adminTab === 'roles' ? (
        <RolesAdminPanel roles={roles} onChange={onRolesChange} />
      ) : (
        <SystemsAdminPanel systems={systems} onChange={onSystemsChange} />
      )}
    </div>
  )
}
