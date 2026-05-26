import { useState } from 'react'
import { ClipboardList, Settings2 } from 'lucide-react'
import { SwpAdminSection } from '../features/agents/standardWorkProcess/SwpAdminSection'
import { SwpProcessTab } from '../features/agents/standardWorkProcess/SwpProcessTab'
import { useSwpStore } from '../features/agents/standardWorkProcess/useSwpStore'
import type { SwpPageTab } from '../features/agents/standardWorkProcess/types'
import { useKpiCascadeStore } from '../features/agents/kpiCascade/useKpiCascadeStore'

const TABS: { id: SwpPageTab; label: string; icon: typeof Settings2 }[] = [
  { id: 'admin', label: 'Admin', icon: Settings2 },
  { id: 'process', label: 'Standard Work', icon: ClipboardList },
]

export function StandardWorkProcessPage() {
  const kpi = useKpiCascadeStore()
  const swp = useSwpStore()
  const [tab, setTab] = useState<SwpPageTab>('process')

  const ready = kpi.ready && swp.ready
  const saving = kpi.saving || swp.saving
  const error = kpi.error ?? swp.error

  if (!ready) {
    return (
      <div className="flex min-h-[14rem] items-center justify-center text-sm text-muted" role="status">
        Loading Standard Work Process…
      </div>
    )
  }

  return (
    <div className={tab === 'process' ? 'space-y-3' : 'space-y-6'}>
      {tab !== 'process' ? (
        <header className="shrink-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Standard Work Process
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Configure roles and systems in Admin.
          </p>
        </header>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {kpi.loading || swp.loading ? (
        <p className="text-sm text-muted" role="status">
          Syncing from Supabase…
        </p>
      ) : null}

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <nav
          className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-surface-raised/50 p-1"
          aria-label="Standard Work Process sections"
        >
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
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
        {saving ? (
          <p className="shrink-0 text-sm text-muted" role="status">
            Saving…
          </p>
        ) : null}
      </div>

      {tab === 'admin' ? (
        <SwpAdminSection
          roles={kpi.workspace.roles}
          onRolesChange={(roles) => kpi.updateCatalog('roles', roles)}
          systems={swp.workspace.systems}
          onSystemsChange={swp.updateSystems}
          onResetSystems={swp.resetToSeed}
        />
      ) : (
        <SwpProcessTab
          systems={swp.workspace.systems}
          flows={swp.workspace.flows}
          roles={kpi.workspace.roles}
          onFlowChange={swp.updateFlow}
        />
      )}
    </div>
  )
}
