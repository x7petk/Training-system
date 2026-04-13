import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLdrWorkspace } from '../features/ldr/LdrWorkspaceContext'
import { ldrMasterCellJoinFromId, ldrMasterCellLabel } from '../features/ldr/types'
import { hcRagBadgeClass, hcRagLabel, type HcRag } from '../features/health-checks/hcScore'
import { useAuth } from '../hooks/useAuth'
import type { ObsKind } from '../features/observations/obsKind'
import { obsBasePath, obsLabel, obsTitle } from '../features/observations/obsKind'

type Row = {
  id: string
  master_cell_id: string
  completed_at: string | null
  score: number | null
  status: HcRag | null
  completed_by_name: string
  typeJoin: { name: string } | { name: string }[] | null
}

function recordsTable(k: ObsKind): 'sos_records' | 'qos_records' | 'ppo_records' {
  switch (k) {
    case 'sos':
      return 'sos_records'
    case 'qos':
      return 'qos_records'
    case 'ppo':
      return 'ppo_records'
  }
}

export function ObsListPage({ kind }: { kind: ObsKind }) {
  const { isAdmin } = useAuth()
  const { masterCellJoinById } = useLdrWorkspace()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    const t = recordsTable(kind)
    const select =
      kind === 'sos'
        ? 'id, master_cell_id, completed_at, score, status, completed_by_name, sos_type_id, sos_types(name)'
        : kind === 'qos'
          ? 'id, master_cell_id, completed_at, score, status, completed_by_name, qos_type_id, qos_types(name)'
          : 'id, master_cell_id, completed_at, score, status, completed_by_name, ppo_type_id, ppo_types(name)'
    const res = await supabase.from(t).select(select).order('created_at', { ascending: false }).limit(200)
    setLoading(false)
    if (res.error) {
      setError(res.error.message)
      setRows([])
      return
    }
    const raw = (res.data ?? []) as Record<string, unknown>[]
    setRows(
      raw.map((r) => ({
        id: r.id as string,
        master_cell_id: r.master_cell_id as string,
        completed_at: r.completed_at as string | null,
        score: r.score as number | null,
        status: r.status as HcRag | null,
        completed_by_name: r.completed_by_name as string,
        typeJoin: (r.sos_types ?? r.qos_types ?? r.ppo_types) as Row['typeJoin'],
      })),
    )
  }, [kind])

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
    const t = r.typeJoin
    if (!t) return '—'
    return Array.isArray(t) ? (t[0]?.name ?? '—') : t.name
  }

  async function deleteRecord(id: string) {
    if (!isAdmin) return
    const n = obsLabel(kind)
    if (!window.confirm(`Delete this ${n} record? This cannot be undone.`)) return
    setDeletingId(id)
    setError(null)
    const del = await supabase.from(recordsTable(kind)).delete().eq('id', id)
    setDeletingId(null)
    if (del.error) {
      setError(del.error.message)
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const base = obsBasePath(kind)
  const title = obsTitle(kind)
  const short = obsLabel(kind)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-800 dark:text-sky-200">
            <ClipboardList className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            <p className="text-sm text-muted">Start a new observation or open a draft or completed record.</p>
          </div>
        </div>
        <Link
          to={`${base}/new`}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600"
        >
          <Plus className="size-4" aria-hidden />
          New {short}
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
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted">
                  No records yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border/80">
                  <td className="px-4 py-3">{r.completed_at ? 'Submitted' : 'Draft'}</td>
                  <td className="px-4 py-3 tabular-nums text-muted">
                    {r.completed_at ? new Date(r.completed_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">{typeName(r)}</td>
                  <td className="px-4 py-3">{locationLabel(r.master_cell_id)}</td>
                  <td className="px-4 py-3">{r.completed_by_name}</td>
                  <td className="px-4 py-3 tabular-nums">{r.score != null ? `${r.score}%` : '—'}</td>
                  <td className="px-4 py-3">
                    {r.status ? (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${hcRagBadgeClass(r.status)}`}>
                        {hcRagLabel(r.status)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Link to={`${base}/${r.id}`} className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300">
                        Open
                      </Link>
                      {isAdmin && r.completed_at ? (
                        <button
                          type="button"
                          disabled={deletingId === r.id}
                          onClick={() => void deleteRecord(r.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                          title="Admin delete"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function SosListPage() {
  return <ObsListPage kind="sos" />
}
export function QosListPage() {
  return <ObsListPage kind="qos" />
}
export function PpoListPage() {
  return <ObsListPage kind="ppo" />
}
