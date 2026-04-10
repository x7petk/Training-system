import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLdrWorkspace } from '../features/ldr/LdrWorkspaceContext'
import { ldrMasterCellJoinFromId, ldrMasterCellLabel } from '../features/ldr/types'
import { hcRagBadgeClass, hcRagLabel, type HcRag } from '../features/health-checks/hcScore'
import { useAuth } from '../hooks/useAuth'

type Row = {
  id: string
  master_cell_id: string
  completed_at: string | null
  score: number | null
  status: HcRag | null
  completed_by_name: string
  hc_types: { name: string } | { name: string }[] | null
}

export function HcListPage() {
  const { isAdmin } = useAuth()
  const { masterCellJoinById } = useLdrWorkspace()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    const res = await supabase
      .from('hc_records')
      .select('id, master_cell_id, completed_at, score, status, completed_by_name, hc_types(name)')
      .order('created_at', { ascending: false })
      .limit(200)
    setLoading(false)
    if (res.error) {
      setError(res.error.message)
      setRows([])
      return
    }
    const raw = (res.data ?? []) as unknown as Row[]
    setRows(raw)
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const locationLabel = useMemo(
    () => (cellId: string) => {
      const j = ldrMasterCellJoinFromId(cellId, masterCellJoinById)
      return j ? ldrMasterCellLabel(j) : `${cellId.slice(0, 8)}…`
    },
    [masterCellJoinById],
  )

  function typeName(r: Row): string {
    const t = r.hc_types
    if (!t) return '—'
    return Array.isArray(t) ? (t[0]?.name ?? '—') : t.name
  }

  async function deleteRecord(id: string) {
    if (!isAdmin) return
    if (!window.confirm('Delete this health check record? This cannot be undone.')) return
    setDeletingId(id)
    setError(null)
    const del = await supabase.from('hc_records').delete().eq('id', id)
    setDeletingId(null)
    if (del.error) {
      setError(del.error.message)
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300">
            <ClipboardList className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Health Checks</h1>
            <p className="text-sm text-muted">Start a new check or open a draft or completed record.</p>
          </div>
        </div>
        <Link
          to="/ldr-tools/health-checks/new"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
        >
          <Plus className="size-4" aria-hidden />
          New HC
        </Link>
      </header>

      {error ? (
        <div className="rounded-2xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-raised/60 text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Completed by</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">RAG</th>
              <th className="px-4 py-3 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted">
                  <span className="inline-block size-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted">
                  No health checks yet. Create one with <strong className="font-medium text-fg">New HC</strong>.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const draft = !r.completed_at
                return (
                  <tr key={r.id} className="border-b border-border/80 hover:bg-surface-raised/40">
                    <td className="px-4 py-3">
                      {draft ? (
                        <span className="rounded-full bg-violet-200 px-2 py-0.5 text-xs font-semibold text-violet-950 ring-1 ring-violet-600/40 dark:bg-violet-400 dark:text-violet-950 dark:ring-violet-300/65">
                          Draft
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-950 ring-1 ring-slate-600/40 dark:bg-slate-400 dark:text-slate-950 dark:ring-slate-300/65">
                          Submitted
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-fg/90">
                      {draft ? '—' : new Date(r.completed_at!).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-fg">{typeName(r)}</td>
                    <td className="max-w-[14rem] truncate px-4 py-3 text-muted" title={locationLabel(r.master_cell_id)}>
                      {locationLabel(r.master_cell_id)}
                    </td>
                    <td className="px-4 py-3 text-fg/90">{r.completed_by_name}</td>
                    <td className="px-4 py-3 tabular-nums">{draft ? '—' : `${r.score}%`}</td>
                    <td className="px-4 py-3">
                      {draft || !r.status ? (
                        '—'
                      ) : (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${hcRagBadgeClass(r.status)}`}
                        >
                          {hcRagLabel(r.status)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-3">
                        <Link
                          to={`/ldr-tools/health-checks/${r.id}`}
                          className="text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
                        >
                          Open
                        </Link>
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => void deleteRecord(r.id)}
                            disabled={deletingId !== null}
                            title="Delete HC"
                            aria-label="Delete HC"
                            aria-busy={deletingId === r.id}
                            className="inline-flex items-center rounded-md p-1.5 text-red-700 hover:bg-red-600/10 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-300"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
