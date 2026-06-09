import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { bmsBrainCanEdit } from '../features/bmsBrain/bmsBrainAccess'
import { saveBmsProcess } from '../features/bmsBrain/useBmsBrainProcesses'
import { useBmsBrainProcesses } from '../features/bmsBrain/useBmsBrainProcesses'
import { EMPTY_BMS_FLOW } from '../features/bmsBrain/types'

export function BmsBrainProcessesPage() {
  const { user, isAdmin, bmsBrainRole } = useAuth()
  const canEdit = bmsBrainCanEdit({ isAdmin, bmsBrainRole })
  const { rows, loading, error, reload } = useBmsBrainProcesses(canEdit)
  const [creating, setCreating] = useState(false)

  async function createProcess() {
    if (!user || !canEdit) return
    setCreating(true)
    const { row, error: e } = await saveBmsProcess(
      null,
      {
        name: 'New process',
        description: '',
        status: 'draft',
        flow: EMPTY_BMS_FLOW,
        owner_role_id: null,
      },
      user.id,
    )
    setCreating(false)
    if (e) alert(e)
    else if (row) {
      await reload()
      window.location.href = `/bms-brain/processes/${row.id}`
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Processes</h1>
          <p className="mt-1 text-sm text-muted">Create and manage business system process flows.</p>
        </div>
        {canEdit ? (
          <button
            type="button"
            disabled={creating}
            onClick={() => void createProcess()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            New process
          </button>
        ) : null}
      </header>

      {loading ? (
        <div className="flex min-h-[12rem] items-center justify-center text-muted">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((p) => (
          <Link
            key={p.id}
            to={`/bms-brain/processes/${p.id}`}
            className="rounded-2xl border border-border bg-surface-raised/50 p-4 transition hover:border-accent/40 hover:shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display font-semibold">{p.name}</h2>
              <span
                className={[
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                  p.status === 'published'
                    ? 'bg-emerald-500/15 text-emerald-800'
                    : p.status === 'archived'
                      ? 'bg-slate-500/15 text-slate-600'
                      : 'bg-amber-500/15 text-amber-900',
                ].join(' ')}
              >
                {p.status}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-muted">{p.description || 'No description'}</p>
            <p className="mt-3 text-[10px] text-muted">Updated {new Date(p.updated_at).toLocaleString()}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
