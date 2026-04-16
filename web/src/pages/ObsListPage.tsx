import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronsUpDown, ClipboardList, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLdrWorkspace } from '../features/ldr/LdrWorkspaceContext'
import { ldrMasterCellJoinFromId, ldrMasterCellLabel } from '../features/ldr/types'
import { hcRagBadgeClass, hcRagLabel, type HcRag } from '../features/health-checks/hcScore'
import { useAuth } from '../hooks/useAuth'
import type { ObsKind } from '../features/observations/obsKind'
import { obsBasePath, obsLabel, obsTitle } from '../features/observations/obsKind'
import { masterCellIdsForHcObsFilter } from '../features/ldr/ldrHcObsScope'

const OBS_IN_CHUNK = 90

type ObsSortKey = 'status' | 'added' | 'date' | 'type' | 'location' | 'completer' | 'score' | 'rag'

function ragRankObs(s: HcRag | null): number {
  if (!s) return 4
  if (s === 'green') return 0
  if (s === 'amber') return 1
  return 2
}

function kindRank(k: ObsKind): number {
  if (k === 'sos') return 0
  if (k === 'qos') return 1
  return 2
}

function SortableTh(props: {
  label: string
  sortKey: ObsSortKey
  activeKey: ObsSortKey
  dir: 'asc' | 'desc'
  onSort: (k: ObsSortKey) => void
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

type Row = {
  id: string
  kind: ObsKind
  master_cell_id: string
  created_at: string
  completed_at: string | null
  score: number | null
  status: HcRag | null
  completed_by_name: string
  typeJoin: { name: string } | { name: string }[] | null
}

function observationTypeName(r: Row): string {
  const t = r.typeJoin
  if (!t) return '—'
  return Array.isArray(t) ? (t[0]?.name ?? '—') : t.name
}

function obsRowMatchesListSearch(
  r: Row,
  q: string,
  locationLabel: (cellId: string) => string,
  mergedMode: boolean,
): boolean {
  const n = q.trim().toLowerCase()
  if (!n) return true
  const parts: string[] = [
    r.completed_at ? 'submitted' : 'draft',
    ...(r.completed_at ? [new Date(r.completed_at).toLocaleString()] : []),
    r.completed_at ?? '',
    r.created_at,
    observationTypeName(r),
    locationLabel(r.master_cell_id),
    r.completed_by_name,
    ...(r.score != null ? [String(r.score), `${r.score}%`] : []),
    ...(r.status ? [hcRagLabel(r.status), r.status] : []),
    r.id,
  ]
  if (mergedMode) {
    parts.push(obsLabel(r.kind), r.kind)
  }
  return parts.some((p) => p.toLowerCase().includes(n))
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

async function loadKindRows(kind: ObsKind, allowedCellIds: string[]): Promise<Row[]> {
  if (allowedCellIds.length === 0) return []
  const t = recordsTable(kind)
  const select =
    kind === 'sos'
      ? 'id, master_cell_id, created_at, completed_at, score, status, completed_by_name, sos_type_id, sos_types(name)'
      : kind === 'qos'
        ? 'id, master_cell_id, created_at, completed_at, score, status, completed_by_name, qos_type_id, qos_types(name)'
        : 'id, master_cell_id, created_at, completed_at, score, status, completed_by_name, ppo_type_id, ppo_types(name)'
  const merged: Row[] = []
  for (let i = 0; i < allowedCellIds.length; i += OBS_IN_CHUNK) {
    const slice = allowedCellIds.slice(i, i + OBS_IN_CHUNK)
    const res = await supabase.from(t).select(select).in('master_cell_id', slice).order('created_at', { ascending: false }).limit(200)
    if (res.error) throw new Error(res.error.message)
    const raw = (res.data ?? []) as Record<string, unknown>[]
    merged.push(
      ...raw.map((r) => ({
        id: r.id as string,
        kind,
        master_cell_id: r.master_cell_id as string,
        created_at: (r.created_at as string) ?? '',
        completed_at: r.completed_at as string | null,
        score: r.score as number | null,
        status: r.status as HcRag | null,
        completed_by_name: r.completed_by_name as string,
        typeJoin: (r.sos_types ?? r.qos_types ?? r.ppo_types) as Row['typeJoin'],
      })),
    )
  }
  merged.sort((a, b) => {
    const at = new Date(a.created_at).getTime()
    const bt = new Date(b.created_at).getTime()
    return bt - at
  })
  return merged.slice(0, 200)
}

export function ObsListPage({ kind }: { kind?: ObsKind }) {
  const { isAdmin } = useAuth()
  const { masterCellJoinById, hcObsSiteId, hcObsPlantId, hcObsCellId, allPlants, allCells } = useLdrWorkspace()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | ObsKind>('all')
  const mergedMode = !kind
  const [searchParams] = useSearchParams()
  const [sortKey, setSortKey] = useState<ObsSortKey>('added')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [listSearch, setListSearch] = useState('')

  useEffect(() => {
    if (!mergedMode) return
    const tab = searchParams.get('tab')
    if (tab === 'sos' || tab === 'qos' || tab === 'ppo') setActiveTab(tab)
    if (tab === 'all') setActiveTab('all')
  }, [mergedMode, searchParams])

  const allowedCellIds = useMemo(
    () => masterCellIdsForHcObsFilter(hcObsSiteId, hcObsPlantId, hcObsCellId, allPlants, allCells),
    [hcObsSiteId, hcObsPlantId, hcObsCellId, allPlants, allCells],
  )

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const mergedRows = mergedMode
        ? (await Promise.all([
            loadKindRows('sos', allowedCellIds),
            loadKindRows('qos', allowedCellIds),
            loadKindRows('ppo', allowedCellIds),
          ])).flat()
        : await loadKindRows(kind!, allowedCellIds)
      mergedRows.sort((a, b) => {
        const at = new Date(a.created_at).getTime()
        const bt = new Date(b.created_at).getTime()
        return bt - at
      })
      setRows(mergedRows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load observation records.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [kind, mergedMode, allowedCellIds])

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

  async function deleteRecord(id: string) {
    if (!isAdmin) return
    const row = rows.find((r) => r.id === id)
    const targetKind = row?.kind ?? kind ?? 'sos'
    const n = obsLabel(targetKind)
    if (!window.confirm(`Delete this ${n} record? This cannot be undone.`)) return
    setDeletingId(id)
    setError(null)
    const del = await supabase.from(recordsTable(targetKind)).delete().eq('id', id)
    setDeletingId(null)
    if (del.error) {
      setError(del.error.message)
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const base = obsBasePath(kind ?? 'sos')
  const title = mergedMode ? 'Observation System' : obsTitle(kind)
  const short = mergedMode ? 'OS' : obsLabel(kind)
  const visibleRows = useMemo(
    () => (mergedMode && activeTab !== 'all' ? rows.filter((r) => r.kind === activeTab) : rows),
    [rows, mergedMode, activeTab],
  )

  const searchFilteredRows = useMemo(
    () => visibleRows.filter((r) => obsRowMatchesListSearch(r, listSearch, locationLabel, mergedMode)),
    [visibleRows, listSearch, locationLabel, mergedMode],
  )

  function onSort(next: ObsSortKey) {
    if (sortKey === next) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(next)
      // Newest-first for "when added" and submission date; A→Z for text columns.
      setSortDir(next === 'added' || next === 'date' ? 'desc' : 'asc')
    }
  }

  const sortedVisibleRows = useMemo(() => {
    const mul = sortDir === 'asc' ? 1 : -1
    const copy = [...searchFilteredRows]
    copy.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'status':
          cmp = (a.completed_at ? 1 : 0) - (b.completed_at ? 1 : 0)
          break
        case 'added':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'date':
          cmp =
            new Date(a.completed_at ?? 0).getTime() - new Date(b.completed_at ?? 0).getTime()
          break
        case 'type':
          cmp = observationTypeName(a).localeCompare(observationTypeName(b), undefined, { sensitivity: 'base' })
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
          cmp = ragRankObs(a.status) - ragRankObs(b.status)
          break
        default:
          cmp = 0
      }
      if (cmp !== 0) return mul * cmp
      if (mergedMode) cmp = kindRank(a.kind) - kindRank(b.kind)
      if (cmp !== 0) return cmp
      return a.id.localeCompare(b.id)
    })
    return copy
  }, [searchFilteredRows, sortKey, sortDir, locationLabel, mergedMode])

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
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:max-w-none sm:flex-initial">
          {mergedMode ? (
            <div
              className="inline-flex shrink-0 flex-wrap items-center gap-1 rounded-xl border border-border bg-surface p-1 shadow-sm"
              role="group"
              aria-label="Observation kind"
            >
              {(
                [
                  ['all', 'All'],
                  ['sos', 'S'],
                  ['qos', 'Q'],
                  ['ppo', 'PP'],
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                    activeTab === tab
                      ? 'bg-sky-600 text-white'
                      : 'border border-transparent text-muted hover:bg-surface-raised hover:text-fg'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
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
            to={`${base}/new`}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600"
          >
            <Plus className="size-4" aria-hidden />
            New {short}
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
              <SortableTh label="Added" sortKey="added" activeKey={sortKey} dir={sortDir} onSort={onSort} />
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
                <td colSpan={9} className="px-4 py-10 text-center text-muted">
                  Loading…
                </td>
              </tr>
            ) : sortedVisibleRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted">
                  {rows.length === 0
                    ? 'No records yet.'
                    : listSearch.trim()
                      ? 'No records match your search.'
                      : 'No records in this view.'}
                </td>
              </tr>
            ) : (
              sortedVisibleRows.map((r) => (
                <tr key={r.id} className="border-b border-border/80">
                  <td className="px-4 py-3">{r.completed_at ? 'Submitted' : 'Draft'}</td>
                  <td className="px-4 py-3 tabular-nums text-muted">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted">
                    {r.completed_at ? new Date(r.completed_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">{observationTypeName(r)}</td>
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
                      <Link
                        to={`${obsBasePath(r.kind)}/${r.id}`}
                        className="text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300"
                      >
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
  return <ObsListPage />
}
export function QosListPage() {
  return <ObsListPage kind="qos" />
}
export function PpoListPage() {
  return <ObsListPage kind="ppo" />
}
