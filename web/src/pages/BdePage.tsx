import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import {
  bdeStatusLabel,
  type BdeCatalogOption,
  type BdeRecordListRow,
  type BdeStatus,
} from '../features/bde/bdeTypes'

function statusPill(status: BdeStatus) {
  if (status === 'completed') {
    return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100'
  }
  return 'border-sky-500/40 bg-sky-500/15 text-sky-950 dark:text-sky-100'
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function BdePage() {
  const location = useLocation()
  const { isAdmin, profileReady } = useAuth()
  const onReports = location.pathname.includes('/problem-solve/bde/reports')
  const onEditor =
    location.pathname.includes('/problem-solve/bde/new') ||
    (/\/problem-solve\/bde\/[^/]+$/.test(location.pathname) && !onReports)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {!onEditor ? (
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">BDE</h1>
            <p className="text-sm text-muted">Breakdown Elimination</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {profileReady && isAdmin ? (
              <Link
                to="/problem-solve/admin"
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-canvas hover:text-fg"
              >
                BDE Admin
              </Link>
            ) : null}
            <nav
              className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-surface-raised/50 p-1"
              aria-label="BDE sections"
            >
              <NavLink
                to="/problem-solve/bde"
                end
                className={({ isActive }) =>
                  [
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                    isActive && !onReports ? 'bg-accent text-white shadow-sm' : 'text-muted hover:bg-canvas hover:text-fg',
                  ].join(' ')
                }
              >
                Records
              </NavLink>
              <NavLink
                to="/problem-solve/bde/reports"
                className={({ isActive }) =>
                  [
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                    isActive ? 'bg-accent text-white shadow-sm' : 'text-muted hover:bg-canvas hover:text-fg',
                  ].join(' ')
                }
              >
                Reports
              </NavLink>
            </nav>
          </div>
        </header>
      ) : null}
      <Outlet />
    </div>
  )
}

export function BdeRecordsListPage() {
  const navigate = useNavigate()
  const { cellId, status: scopeStatus } = usePlan24Workspace()
  const [rows, setRows] = useState<BdeRecordListRow[]>([])
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([])
  const [equipment, setEquipment] = useState<{ id: string; area_id: string; name: string }[]>([])
  const [types, setTypes] = useState<BdeCatalogOption[]>([])
  const [areaFilter, setAreaFilter] = useState('')
  const [equipmentFilter, setEquipmentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | BdeStatus>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const equipmentOptions = useMemo(() => {
    if (!areaFilter) return equipment
    return equipment.filter((e) => e.area_id === areaFilter)
  }, [areaFilter, equipment])

  const load = useCallback(async () => {
    if (!cellId) {
      setRows([])
      return
    }
    setLoading(true)
    setError(null)

    const [areaRes, eqRes, typeRes, recRes] = await Promise.all([
      supabase.from('master_areas').select('id, name').eq('cell_id', cellId).order('sort_order').order('name'),
      supabase.from('master_equipment').select('id, area_id, name').order('sort_order').order('name'),
      supabase
        .from('bde_problem_types')
        .select('id, label, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('bde_records')
        .select('*')
        .eq('master_cell_id', cellId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    ])

    setLoading(false)

    if (areaRes.error || eqRes.error || typeRes.error || recRes.error) {
      setError(
        areaRes.error?.message ??
          eqRes.error?.message ??
          typeRes.error?.message ??
          recRes.error?.message ??
          'Load failed',
      )
      return
    }

    const areaList = (areaRes.data ?? []) as { id: string; name: string }[]
    const eqList = (eqRes.data ?? []) as { id: string; area_id: string; name: string }[]
    const areaIds = new Set(areaList.map((a) => a.id))
    setAreas(areaList)
    setEquipment(eqList.filter((e) => areaIds.has(e.area_id)))
    setTypes((typeRes.data ?? []) as BdeCatalogOption[])

    const areaMap = new Map(areaList.map((a) => [a.id, a.name]))
    const eqMap = new Map(eqList.map((e) => [e.id, e.name]))
    const typeMap = new Map(((typeRes.data ?? []) as BdeCatalogOption[]).map((t) => [t.id, t.label]))

    let list = ((recRes.data ?? []) as BdeRecordListRow[]).map((r) => ({
      ...r,
      area_name: r.area_id ? areaMap.get(r.area_id) ?? null : null,
      equipment_name: r.equipment_id ? eqMap.get(r.equipment_id) ?? null : null,
      problem_type_label: r.problem_type_id ? typeMap.get(r.problem_type_id) ?? null : null,
    }))

    if (areaFilter) list = list.filter((r) => r.area_id === areaFilter)
    if (equipmentFilter) list = list.filter((r) => r.equipment_id === equipmentFilter)
    if (statusFilter) list = list.filter((r) => r.status === statusFilter)
    setRows(list)
  }, [areaFilter, cellId, equipmentFilter, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  async function softDelete(row: BdeRecordListRow) {
    if (!window.confirm(`Delete ${row.display_id} — ${row.title}?`)) return
    const { error: uErr } = await supabase
      .from('bde_records')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', row.id)
    if (uErr) {
      setError(uErr.message)
      return
    }
    await load()
  }

  if (scopeStatus === 'loading') {
    return <p className="text-sm text-muted">Loading scope…</p>
  }

  if (!cellId) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        Select a site, plant, and cell to view BDE records.
      </div>
    )
  }

  const selectClass =
    'h-9 min-w-[8rem] rounded-lg border border-border-strong bg-surface px-2.5 text-sm text-fg shadow-sm'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-raised/40 px-3 py-2">
        <select
          className={selectClass}
          aria-label="Area"
          value={areaFilter}
          onChange={(e) => {
            setAreaFilter(e.target.value)
            setEquipmentFilter('')
          }}
        >
          <option value="">Area: All</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          aria-label="Equipment"
          value={equipmentFilter}
          onChange={(e) => setEquipmentFilter(e.target.value)}
        >
          <option value="">Equipment: All</option>
          {equipmentOptions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          aria-label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | BdeStatus)}
        >
          <option value="">Status: All</option>
          <option value="saved">Saved</option>
          <option value="completed">Completed</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            className="h-9 rounded-lg border border-border px-3 text-sm text-muted hover:bg-canvas hover:text-fg"
            onClick={() => void load()}
          >
            Refresh
          </button>
          <Link
            to="/problem-solve/bde/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="size-4" />
            New BDE
          </Link>
        </div>
      </div>

      {error ? (
        <p className="shrink-0 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-[1] border-b border-border bg-surface-raised text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-2.5 font-medium">ID</th>
              <th className="px-3 py-2.5 font-medium">Title</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
              <th className="px-3 py-2.5 font-medium">Area</th>
              <th className="px-3 py-2.5 font-medium">Equipment</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Created By</th>
              <th className="px-3 py-2.5 font-medium">Created On</th>
              <th className="px-3 py-2.5 font-medium">Modified By</th>
              <th className="px-3 py-2.5 font-medium">Modified On</th>
              <th className="px-3 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-muted">
                  No BDE records for this cell yet.{' '}
                  <Link to="/problem-solve/bde/new" className="font-medium text-accent hover:underline">
                    Create the first one
                  </Link>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border/70 hover:bg-black/[0.02]">
                  <td className="px-3 py-2.5 font-mono text-xs">{row.display_id}</td>
                  <td className="max-w-[14rem] truncate px-3 py-2.5 font-medium">{row.title}</td>
                  <td className="px-3 py-2.5 text-muted">{row.problem_type_label ?? '—'}</td>
                  <td className="px-3 py-2.5 text-muted">{row.area_name ?? '—'}</td>
                  <td className="px-3 py-2.5 text-muted">{row.equipment_name ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusPill(row.status)}`}
                    >
                      {bdeStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{row.created_by_name ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted">{formatWhen(row.created_at)}</td>
                  <td className="px-3 py-2.5 text-muted">{row.updated_by_name ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted">{formatWhen(row.updated_at)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-muted hover:bg-black/[0.06] hover:text-fg"
                        title="View"
                        onClick={() => navigate(`/problem-solve/bde/${row.id}`)}
                      >
                        <Eye className="size-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-muted hover:bg-black/[0.06] hover:text-fg"
                        title="Edit"
                        onClick={() => navigate(`/problem-solve/bde/${row.id}`)}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-danger hover:bg-danger/10"
                        title="Delete"
                        onClick={() => void softDelete(row)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {types.length === 0 ? (
        <p className="shrink-0 text-xs text-muted">
          No problem types configured. Admins can add them under Problem Solve → Admin.
        </p>
      ) : null}
    </div>
  )
}
