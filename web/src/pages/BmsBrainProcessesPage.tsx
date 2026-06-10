import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { bmsBrainCanEdit } from '../features/bmsBrain/bmsBrainAccess'
import { saveBmsProcess } from '../features/bmsBrain/useBmsBrainProcesses'
import { useBmsBrainProcesses } from '../features/bmsBrain/useBmsBrainProcesses'
import { useBmsBrainFullCatalog } from '../features/bmsBrain/useBmsBrainCatalog'
import { EMPTY_BMS_FLOW } from '../features/bmsBrain/types'
import type { BmsCatalogRow, BmsProcessRow } from '../features/bmsBrain/types'

function StatusBadge({ status }: { status: BmsProcessRow['status'] }) {
  return (
    <span
      className={[
        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
        status === 'published'
          ? 'bg-emerald-500/15 text-emerald-800'
          : status === 'archived'
            ? 'bg-slate-500/15 text-slate-600'
            : 'bg-amber-500/15 text-amber-900',
      ].join(' ')}
    >
      {status}
    </span>
  )
}

function FlowCard({ process, accent }: { process: BmsProcessRow; accent?: string }) {
  const stepCount = process.flow?.nodes?.length ?? 0
  return (
    <Link
      to={`/bms-brain/processes/${process.id}`}
      className="rounded-2xl border border-border bg-surface-raised/50 p-4 transition hover:border-accent/40 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display font-semibold" style={accent ? { color: accent } : undefined}>
          {process.name}
        </h2>
        <StatusBadge status={process.status} />
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-muted">{process.description || 'No description'}</p>
      <p className="mt-3 text-[10px] text-muted">
        {stepCount} steps · Updated {new Date(process.updated_at).toLocaleString()}
      </p>
    </Link>
  )
}

function MissingFlowCard({ system, canEdit, onCreate }: { system: BmsCatalogRow; canEdit: boolean; onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-canvas/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display font-semibold" style={{ color: system.color }}>
          {system.name}
        </h2>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
          No flow
        </span>
      </div>
      <p className="mt-2 text-xs text-muted">{system.description || 'Process flow not created yet.'}</p>
      {canEdit ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-black/[0.04]"
        >
          Create flow
        </button>
      ) : null}
    </div>
  )
}

export function BmsBrainProcessesPage() {
  const { user, isAdmin, bmsBrainRole } = useAuth()
  const canEdit = bmsBrainCanEdit({ isAdmin, bmsBrainRole })
  const catalog = useBmsBrainFullCatalog()
  const { rows, loading, error, reload } = useBmsBrainProcesses(canEdit)
  const [creating, setCreating] = useState<string | null>(null)

  const bySystemId = useMemo(() => {
    const map = new Map<string, BmsProcessRow>()
    for (const row of rows) {
      if (row.catalog_system_id) map.set(row.catalog_system_id, row)
    }
    return map
  }, [rows])

  const crossSystemFlows = useMemo(
    () => rows.filter((r) => !r.catalog_system_id),
    [rows],
  )

  async function createFlow(catalogSystemId: string | null, name: string) {
    if (!user || !canEdit) return
    setCreating(catalogSystemId ?? 'cross')
    const { row, error: e } = await saveBmsProcess(
      null,
      {
        name,
        description: '',
        status: 'draft',
        flow: EMPTY_BMS_FLOW,
        owner_role_id: null,
        catalog_system_id: catalogSystemId,
      },
      user.id,
    )
    setCreating(null)
    if (e) alert(e)
    else if (row) {
      await reload()
      window.location.href = `/bms-brain/processes/${row.id}`
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Systems &amp; Tools</h1>
          <p className="mt-1 text-sm text-muted">
            Manage process flows for each business system or tool, plus cross-system integration flows.
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            disabled={creating === 'cross'}
            onClick={() => void createFlow(null, 'New cross-system flow')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
          >
            {creating === 'cross' ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            New cross-system flow
          </button>
        ) : null}
      </header>

      {loading ? (
        <div className="flex min-h-[12rem] items-center justify-center text-muted">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">Systems &amp; tools</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.systems.map((system) => {
            const flow = bySystemId.get(system.id)
            if (flow) {
              return <FlowCard key={system.id} process={flow} accent={system.color} />
            }
            return (
              <MissingFlowCard
                key={system.id}
                system={system}
                canEdit={canEdit}
                onCreate={() => void createFlow(system.id, `${system.name} process flow`)}
              />
            )
          })}
        </div>
      </section>

      {crossSystemFlows.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">Cross-system flows</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {crossSystemFlows.map((p) => (
              <FlowCard key={p.id} process={p} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
