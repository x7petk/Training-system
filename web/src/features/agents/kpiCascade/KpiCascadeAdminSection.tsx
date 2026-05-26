import { useState } from 'react'
import { BarChart3, Layers, RotateCcw, Users, Workflow } from 'lucide-react'
import type { ComponentType } from 'react'
import {
  ForumsAdminPanel,
  KpisAdminPanel,
  LevelsAdminPanel,
  RolesAdminPanel,
} from './KpiCascadeAdminPanels'
import { reconcileCascadeWithCatalogs } from './cascadeUtils'
import type { KpiCascadeAdminTab, KpiCascadeWorkspace } from './types'

type Props = {
  workspace: KpiCascadeWorkspace
  onUpdate: (workspace: KpiCascadeWorkspace) => void
  onReset: () => void
}

const ADMIN_TABS: {
  id: KpiCascadeAdminTab
  label: string
  icon: ComponentType<{ className?: string }>
  blurb: string
}[] = [
  {
    id: 'roles',
    label: 'Roles',
    icon: Users,
    blurb: 'Accountable roles in the cascade, with optional descriptions.',
  },
  {
    id: 'forums',
    label: 'Forums',
    icon: Workflow,
    blurb: 'Review rhythms and meetings where KPIs are discussed.',
  },
  {
    id: 'levels',
    label: 'Levels',
    icon: Layers,
    blurb: 'Hierarchy depth (1–5) linked to one or more forums where each level is governed.',
  },
  {
    id: 'kpis',
    label: 'KPIs',
    icon: BarChart3,
    blurb: 'Metrics for cascade blocks. Set DDS link for live sync.',
  },
]

export function KpiCascadeAdminSection({ workspace, onUpdate, onReset }: Props) {
  const [adminTab, setAdminTab] = useState<KpiCascadeAdminTab>('roles')
  const activeMeta = ADMIN_TABS.find((t) => t.id === adminTab)!

  const updateWorkspace = (patch: Partial<KpiCascadeWorkspace>) => {
    onUpdate(reconcileCascadeWithCatalogs({ ...workspace, ...patch }))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-canvas to-canvas px-4 py-4 sm:px-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-fg">Admin setup</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Configure catalogs for KPI Cascade. Use the tabs below to manage each list — changes
            save automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                'Reset catalogs and clear the KPI Cascade board? This cannot be undone.',
              )
            )
              onReset()
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm font-medium text-fg hover:bg-black/[0.04]"
        >
          <RotateCcw className="size-4" />
          Reset defaults
        </button>
      </div>

      <nav
        className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface-raised/50 p-1"
        aria-label="Admin catalogs"
      >
        {ADMIN_TABS.map((t) => {
          const Icon = t.icon
          const active = adminTab === t.id
          const count = workspace[t.id].length
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setAdminTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition sm:px-4 ${
                active
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-muted hover:bg-canvas hover:text-fg'
              }`}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {t.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs ${
                  active ? 'bg-white/20' : 'bg-canvas text-muted'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </nav>

      <p className="text-sm text-muted">{activeMeta.blurb}</p>

      {adminTab === 'roles' ? (
        <RolesAdminPanel
          roles={workspace.roles}
          onChange={(roles) => updateWorkspace({ roles })}
        />
      ) : null}

      {adminTab === 'forums' ? (
        <ForumsAdminPanel
          forums={workspace.forums}
          onChange={(forums) => updateWorkspace({ forums })}
        />
      ) : null}

      {adminTab === 'levels' ? (
        <LevelsAdminPanel
          levels={workspace.levels}
          forums={workspace.forums}
          onChange={(levels) => updateWorkspace({ levels })}
        />
      ) : null}

      {adminTab === 'kpis' ? (
        <KpisAdminPanel
          kpis={workspace.kpis}
          onChange={(kpis) => updateWorkspace({ kpis })}
        />
      ) : null}
    </div>
  )
}
