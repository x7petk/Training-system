import { useState } from 'react'
import { GitBranch, LayoutGrid, Settings2 } from 'lucide-react'
import { KpiCascadeAdminSection } from '../features/agents/kpiCascade/KpiCascadeAdminSection'
import { ForumCascadeBuilder } from '../features/agents/kpiCascade/builder/ForumCascadeBuilder'
import { KpiCascadeBuilder } from '../features/agents/kpiCascade/builder/KpiCascadeBuilder'
import { useKpiCascadeStore } from '../features/agents/kpiCascade/useKpiCascadeStore'
import type { KpiCascadePageTab } from '../features/agents/kpiCascade/types'

const TABS: { id: KpiCascadePageTab; label: string; icon: typeof Settings2 }[] = [
  { id: 'admin', label: 'Admin', icon: Settings2 },
  { id: 'cascade', label: 'KPI Cascade', icon: GitBranch },
  { id: 'forum-cascade', label: 'Forum Cascade', icon: LayoutGrid },
]

export function KpiCascadePage() {
  const { workspace, ready, loading, saving, error, replaceWorkspace, resetToSeed } = useKpiCascadeStore()
  const [tab, setTab] = useState<KpiCascadePageTab>('cascade')

  if (!ready) {
    return (
      <div className="flex min-h-[14rem] items-center justify-center text-sm text-muted" role="status">
        Loading KPI Cascade…
      </div>
    )
  }

  const isBoardTab = tab === 'cascade' || tab === 'forum-cascade'

  return (
    <div className={isBoardTab ? 'flex min-h-[calc(100vh-4.5rem)] flex-col gap-2' : 'space-y-6'}>
      <header className={`shrink-0 ${isBoardTab ? 'sr-only' : ''}`}>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">KPI Cascade</h1>
        {!isBoardTab ? (
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Build and govern KPI decomposition trees for manufacturing analytics — start with admin
            catalogs, then map cascades on the builder tab.
          </p>
        ) : null}
      </header>

      {error ? (
        <p className="rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-muted" role="status">
          Syncing from Supabase…
        </p>
      ) : null}

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <nav
          className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-surface-raised/50 p-1"
          aria-label="KPI Cascade sections"
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
        <KpiCascadeAdminSection
          workspace={workspace}
          onUpdate={replaceWorkspace}
          onReset={resetToSeed}
        />
      ) : null}

      {tab === 'cascade' ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <KpiCascadeBuilder
            workspace={workspace}
            onUpdate={replaceWorkspace}
            loadError={error}
          />
        </div>
      ) : null}

      {tab === 'forum-cascade' ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ForumCascadeBuilder
            workspace={workspace}
            onUpdate={replaceWorkspace}
            loadError={error}
          />
        </div>
      ) : null}
    </div>
  )
}
