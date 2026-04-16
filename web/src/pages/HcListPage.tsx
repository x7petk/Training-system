import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronsUpDown, ClipboardList, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLdrWorkspace } from '../features/ldr/LdrWorkspaceContext'
import { masterCellIdsForHcObsFilter } from '../features/ldr/ldrHcObsScope'
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

function hcRecordTypeName(r: Row): string {
  const t = r.hc_types
  if (!t) return '—'
  return Array.isArray(t) ? (t[0]?.name ?? '—') : t.name
}

function hcRowMatchesListSearch(r: Row, q: string, locationLabel: (cellId: string) => string): boolean {
  const n = q.trim().toLowerCase()
  if (!n) return true
  const draft = !r.completed_at
  const parts: string[] = [
    draft ? 'draft' : 'submitted',
    ...(draft ? [] : [new Date(r.completed_at!).toLocaleString()]),
    r.completed_at ?? '',
    hcRecordTypeName(r),
    locationLabel(r.master_cell_id),
    r.completed_by_name,
    ...(!draft && r.score != null ? [String(r.score), `${r.score}%`] : []),
    ...(draft || !r.status ? [] : [hcRagLabel(r.status), r.status]),
    r.id,
  ]
  return parts.some((p) => p.toLowerCase().includes(n))
}

const IN_CHUNK = 90

type HcSortKey = 'status' | 'date' | 'type' | 'location' | 'completer' | 'score' | 'rag'

function ragRank(s: HcRag | null): number {
  if (!s) return 4
  if (s === 'green') return 0
  if (s === 'amber') return 1
  return 2
}

function SortableTh(props: {
  label: string
  sortKey: HcSortKey
  activeKey: HcSortKey
  dir: 'asc' | 'desc'
  onSort: (k: HcSortKey) => void
}) {
  const active = props.activeKey === props.sortKey
  return (
    <th className="px-4 py-3" scope="col">
      <button
        type="button"
        onClick={() => props.onSort(props.sortKey)}
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted hover:text-fg"
        aria-label={`Sort by ${props.label}`}
      >
        {props.label}
        {active ? (
          props.dir === 'asc' ? (
            <ArrowUp className="size-3.5 shrink-0 text-fg" aria-hidden />
          ) : (
            <ArrowDown className="size-3.5 shrink-0 text-fg" aria-hidden />
          )
        ) : (
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-45" aria-hidden />
        )}
      </button>
    </th>
  )
}

export function HcListPage() {
  const { isAdmin } = useAuth()
  const { masterCellJoinById, hcObsSiteId, hcObsPlantId, hcObsCellId, allPlants, allCells } = useLdrWorkspace()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<HcSortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [listSearch, setListSearch] = useState('')

  const allowedCellIds = useMemo(
    () => masterCellIdsForHcObsFilter(hcObsSiteId, hcObsPlantId, hcObsCellId, allPlants, allCells),
    [hcObsSiteId, hcObsPlantId, hcObsCellId, allPlants, allCells],
  )

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    if (allowedCellIds.length === 0) {
      setLoading(false)
      setRows([])
      return
    }
    const select = 'id, master_cell_id, completed_at, score, status, completed_by_name, hc_types(name)'
    const merged: Row[] = []
    for (let i = 0; i < allowedCellIds.length; i += IN_CHUNK) {
      const slice = allowedCellIds.slice(i, i + IN_CHUNK)
      const res = await supabase
        .from('hc_records')
        .select(select)
        .in('master_cell_id', slice)
        .order('created_at', { ascending: false })
        .limit(200)
      if (res.error) {
        setLoading(false)
        setError(res.error.message)
        setRows([])
        return
      }
      merged.push(...((res.data ?? []) as unknown as Row[]))
    }
    merged.sort((a, b) => {
      const at = new Date(a.completed_at ?? 0).getTime()
      const bt = new Date(b.completed_at ?? 0).getTime()
      return bt - at
    })
    setRows(merged.slice(0, 200))
    setLoading(false)
  }, [allowedCellIds])

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

  function onSort(next: HcSortKey) {
    if (sortKey === next) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(next)
      setSortDir('asc')
    }
  }

  const filteredRows = useMemo(
    () => rows.filter((r) => hcRowMatchesListSearch(r, listSearch, locationLabel)),
    [rows, listSearch, locationLabel],
  )

  const sortedRows = useMemo(() => {
    const mul = sortDir === 'asc' ? 1 : -1
    const copy = [...filteredRows]
    copy.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'status':
          cmp = (a.completed_at ? 1 : 0) - (b.completed_at ? 1 : 0)
          break
        case 'date':
          cmp =
            new Date(a.completed_at ?? 0).getTime() - new Date(b.completed_at ?? 0).getTime()
          break
        case 'type':
          cmp = hcRecordTypeName(a).localeCompare(hcRecordTypeName(b), undefined, { sensitivity: 'base' })
          break
        case 'location':
          cmp = locationLabel(a.master_cell_id).localeCompare(locationLabel(b.master_cell_id), undefined, {
            sensitivity: 'base',
          })
          break
        case 'completer':
          cmp = a.completed_by_name.localeCompare(b.completed_by_name, undefined, { sensitivity: 'base' })
          break
        case 'score': {
          const as = a.score ?? -1
          const bs = b.score ?? -1
          cmp = as - bs
          break
        }
        case 'rag':
          cmp = ragRank(a.status) - ragRank(b.status)
          break
        default:
          cmp = 0
      }
      if (cmp !== 0) return mul * cmp
      return a.id.localeCompare(b.id)
    })
    return copy
  }, [filteredRows, sortKey, sortDir, locationLabel])

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
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:max-w-none sm:flex-initial">
          <label className="flex min-w-[10rem] max-w-md flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-sm sm:max-w-xs sm:flex-initial">
            <Search className="size-4 shrink-0 text-muted" aria-hidden />
            <input
              type="search"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Filter records…"
              aria-label="Filter records in the list"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/55"
            />
          </label>
          <Link
            to="/ldr-tools/health-checks/new"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
          >
            <Plus className="size-4" aria-hidden />
            New HC
          </Link>
        </div>
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
              <SortableTh label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortableTh label="Date" sortKey="date" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortableTh label="Type" sortKey="type" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortableTh label="Location" sortKey="location" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortableTh label="Completed by" sortKey="completer" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortableTh label="Score" sortKey="score" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <SortableTh label="RAG" sortKey="rag" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              <th className="px-4 py-3 text-right" scope="col">
                <span className="sr-only">Actions</span>
              </th>
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
            ) : sortedRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted">
                  No records match your search.
                </td>
              </tr>
            ) : (
              sortedRows.map((r) => {
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
                    <td className="px-4 py-3 font-medium text-fg">{hcRecordTypeName(r)}</td>
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
