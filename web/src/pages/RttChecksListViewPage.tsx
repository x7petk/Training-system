import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { addDays, compareYMD, localYMD } from '../lib/dueDateUtils'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import type { Plan24EventRow } from '../features/plan24/plan24Types'

const inputClass =
  'mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2'

type Family = 'check' | 'cl_check' | 'cil_check' | 'quality_check'

type DateScope = 'all' | 'today' | 'range'

type ShiftFilter = 'all' | 'day' | 'night'

type SortKey = 'plan_date' | 'shift_kind' | 'start_at' | 'event_type' | 'title' | 'role_name' | 'status'

function familyLabel(v: Family) {
  if (v === 'cl_check') return 'CL'
  if (v === 'cil_check') return 'CIL'
  if (v === 'quality_check') return 'Quality'
  return 'Checks'
}

function familyPill(v: Family) {
  if (v === 'cl_check') return 'border-green-300 bg-green-100 text-green-900 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-200'
  if (v === 'cil_check') return 'border-teal-300 bg-teal-100 text-teal-900 dark:border-teal-900/40 dark:bg-teal-950/40 dark:text-teal-200'
  if (v === 'quality_check')
    return 'border-violet-300 bg-violet-100 text-violet-900 dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-200'
  return 'border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-200'
}

function shiftKindNorm(s: string | null | undefined): string {
  return String(s ?? '').trim().toLowerCase()
}

function formatStartLocal(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function statusRank(st: Plan24EventRow['status']): number {
  if (st === 'scheduled') return 0
  if (st === 'in_progress') return 1
  if (st === 'complete') return 2
  return 9
}

function compareRows(a: Plan24EventRow, b: Plan24EventRow, key: SortKey, dir: 1 | -1): number {
  let c = 0
  switch (key) {
    case 'plan_date':
      c = compareYMD(a.plan_date, b.plan_date)
      if (c === 0) c = (a.start_at ?? '').localeCompare(b.start_at ?? '')
      break
    case 'shift_kind':
      c = shiftKindNorm(a.shift_kind).localeCompare(shiftKindNorm(b.shift_kind))
      if (c === 0) c = compareYMD(a.plan_date, b.plan_date)
      break
    case 'start_at':
      c = (a.start_at ?? '').localeCompare(b.start_at ?? '')
      break
    case 'event_type':
      c = (a.event_type ?? '').localeCompare(b.event_type ?? '')
      break
    case 'title':
      c = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
      break
    case 'role_name':
      c = (a.role_name ?? '').localeCompare(b.role_name ?? '', undefined, { sensitivity: 'base' })
      break
    case 'status':
      c = statusRank(a.status) - statusRank(b.status)
      break
    default:
      c = 0
  }
  if (c === 0) c = a.id.localeCompare(b.id)
  return c * dir
}

function SortHeader(props: {
  label: string
  sortKey: SortKey
  active: boolean
  dir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
}) {
  const { label, sortKey, active, dir, onSort } = props
  return (
    <th className="px-3 py-2 text-left">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1.5 font-semibold tracking-wide text-muted hover:text-fg"
        aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {label}
        {active ? (
          dir === 'asc' ? (
            <ChevronUp className="size-3.5 shrink-0 text-fg" aria-hidden />
          ) : (
            <ChevronDown className="size-3.5 shrink-0 text-fg" aria-hidden />
          )
        ) : (
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-40" aria-hidden />
        )}
      </button>
    </th>
  )
}

export function RttChecksListViewPage() {
  const { cellId, status: scopeStatus } = usePlan24Workspace()
  const [rows, setRows] = useState<Plan24EventRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [family, setFamily] = useState<'all' | Family>('all')
  const [eventStatus, setEventStatus] = useState<'all' | Plan24EventRow['status']>('all')
  const [areaId, setAreaId] = useState('all')
  const [equipmentId, setEquipmentId] = useState('all')
  const [equipmentGroupId, setEquipmentGroupId] = useState('all')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([])
  const [equipment, setEquipment] = useState<{ id: string; area_id: string; name: string }[]>([])
  const [equipmentGroups, setEquipmentGroups] = useState<{ id: string; name: string }[]>([])
  const [equipmentGroupItems, setEquipmentGroupItems] = useState<{ equipment_group_id: string; equipment_id: string }[]>([])

  const [dateScope, setDateScope] = useState<DateScope>('all')
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('all')
  const [sortState, setSortState] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'plan_date', dir: 'desc' })

  const load = useCallback(async () => {
    if (!cellId) return
    setLoading(true)
    setError(null)
    const [eventsRes, areasRes, equipmentRes, groupsRes, groupItemsRes] = await Promise.all([
      supabase
        .from('plan24_events')
        .select('*')
        .eq('master_cell_id', cellId)
        .is('deleted_at', null)
        .in('event_type', ['check', 'cl_check', 'cil_check', 'quality_check'])
        .order('plan_date', { ascending: false })
        .order('start_at', { ascending: false })
        .limit(500),
      supabase.from('master_areas').select('id, name').eq('cell_id', cellId).order('sort_order').order('name'),
      supabase.from('master_equipment').select('id, area_id, name').order('sort_order').order('name'),
      supabase.from('master_equipment_groups').select('id, name').eq('cell_id', cellId).order('sort_order').order('name'),
      supabase.from('master_equipment_group_items').select('equipment_group_id, equipment_id'),
    ])
    setLoading(false)
    const firstErr = eventsRes.error ?? areasRes.error ?? equipmentRes.error ?? groupsRes.error ?? groupItemsRes.error
    if (firstErr) setError(firstErr.message)
    else {
      setRows((eventsRes.data ?? []) as Plan24EventRow[])
      setAreas((areasRes.data ?? []) as { id: string; name: string }[])
      setEquipment((equipmentRes.data ?? []) as { id: string; area_id: string; name: string }[])
      setEquipmentGroups((groupsRes.data ?? []) as { id: string; name: string }[])
      setEquipmentGroupItems((groupItemsRes.data ?? []) as { equipment_group_id: string; equipment_id: string }[])
    }
  }, [cellId])

  useEffect(() => {
    if (scopeStatus === 'ready') void load()
  }, [scopeStatus, load])

  const onDateScopeChange = useCallback((next: DateScope) => {
    setDateScope(next)
    if (next === 'range') {
      setRangeFrom((prevFrom) => {
        if (prevFrom) return prevFrom
        const t = new Date()
        return localYMD(addDays(t, -7))
      })
      setRangeTo((prevTo) => {
        if (prevTo) return prevTo
        return localYMD(new Date())
      })
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const todayYmd = localYMD(new Date())
    return rows.filter((r) => {
      const f = family === 'all' || (r.event_type as Family) === family
      const s = eventStatus === 'all' || r.status === eventStatus
      const a = areaId === 'all' || (r as unknown as { area_id?: string | null }).area_id === areaId
      const e = equipmentId === 'all' || (r as unknown as { equipment_id?: string | null }).equipment_id === equipmentId
      const groupEquipIds =
        equipmentGroupId === 'all'
          ? null
          : equipmentGroupItems.filter((gi) => gi.equipment_group_id === equipmentGroupId).map((gi) => gi.equipment_id)
      const rowEquipIds = (r as unknown as { equipment_ids?: string[] | null }).equipment_ids ?? []
      const g =
        groupEquipIds == null ||
        groupEquipIds.length === 0 ||
        groupEquipIds.some((id) => id === (r as unknown as { equipment_id?: string | null }).equipment_id || rowEquipIds.includes(id))
      const m = !q || r.title.toLowerCase().includes(q) || (r.role_name ?? '').toLowerCase().includes(q)

      let dateOk = true
      if (dateScope === 'today') dateOk = r.plan_date === todayYmd
      else if (dateScope === 'range' && rangeFrom && rangeTo) {
        dateOk = compareYMD(r.plan_date, rangeFrom) >= 0 && compareYMD(r.plan_date, rangeTo) <= 0
      } else if (dateScope === 'range' && (rangeFrom || rangeTo)) {
        if (rangeFrom) dateOk = compareYMD(r.plan_date, rangeFrom) >= 0
        if (rangeTo) dateOk = dateOk && compareYMD(r.plan_date, rangeTo) <= 0
      }

      const sk = shiftKindNorm(r.shift_kind)
      const shiftOk =
        shiftFilter === 'all' || (shiftFilter === 'day' && sk === 'day') || (shiftFilter === 'night' && sk === 'night')

      return f && s && a && e && g && m && dateOk && shiftOk
    })
  }, [
    rows,
    family,
    eventStatus,
    query,
    areaId,
    equipmentId,
    equipmentGroupId,
    equipmentGroupItems,
    dateScope,
    rangeFrom,
    rangeTo,
    shiftFilter,
  ])

  const sortedRows = useMemo(() => {
    const dir: 1 | -1 = sortState.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => compareRows(a, b, sortState.key, dir))
  }, [filtered, sortState])

  const toggleSort = useCallback((key: SortKey) => {
    setSortState((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      }
      const defaultDesc = key === 'plan_date' || key === 'start_at'
      return { key, dir: defaultDesc ? 'desc' : 'asc' }
    })
  }, [])

  async function markComplete(row: Plan24EventRow) {
    setBusyId(row.id)
    setError(null)
    const { error: uErr } = await supabase
      .from('plan24_events')
      .update({ status: 'complete', completed_at: new Date().toISOString() })
      .eq('id', row.id)
    setBusyId(null)
    if (uErr) setError(uErr.message)
    else await load()
  }

  if (scopeStatus !== 'ready') return <div className="text-sm text-muted">Loading scope...</div>
  if (!cellId) return <div className="text-sm text-muted">Select a cell in scope bar to view checks list.</div>

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">List view</h1>
        <p className="mt-2 text-sm text-muted">Combined list for Checks, CL, CIL, and Quality checks.</p>
      </header>

      {error ? <div className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div> : null}

      <div className="grid gap-3 rounded-xl border border-border bg-surface p-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="text-xs text-muted">
          Type
          <select className={inputClass} value={family} onChange={(e) => setFamily(e.target.value as 'all' | Family)}>
            <option value="all">All</option>
            <option value="check">Checks</option>
            <option value="cl_check">CL</option>
            <option value="cil_check">CIL</option>
            <option value="quality_check">Quality</option>
          </select>
        </label>
        <label className="text-xs text-muted">
          Status
          <select className={inputClass} value={eventStatus} onChange={(e) => setEventStatus(e.target.value as 'all' | Plan24EventRow['status'])}>
            <option value="all">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In progress</option>
            <option value="complete">Complete</option>
          </select>
        </label>
        <label className="text-xs text-muted">
          Search
          <input className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Title or role" />
        </label>
        <label className="text-xs text-muted">
          Area
          <select className={inputClass} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="all">All areas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Equipment
          <select className={inputClass} value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
            <option value="all">All equipment</option>
            {equipment
              .filter((eq) => areaId === 'all' || eq.area_id === areaId)
              .map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name}
                </option>
              ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Equipment set
          <select className={inputClass} value={equipmentGroupId} onChange={(e) => setEquipmentGroupId(e.target.value)}>
            <option value="all">All sets</option>
            {equipmentGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-muted">
          Timeframe
          <select className={inputClass} value={dateScope} onChange={(e) => onDateScopeChange(e.target.value as DateScope)}>
            <option value="all">All dates</option>
            <option value="today">Today</option>
            <option value="range">Date range (time slicer)</option>
          </select>
        </label>
        <label className="text-xs text-muted">
          Shift
          <select className={inputClass} value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value as ShiftFilter)}>
            <option value="all">All shifts</option>
            <option value="day">Day shift</option>
            <option value="night">Night shift</option>
          </select>
        </label>
        {dateScope === 'range' ? (
          <>
            <label className="text-xs text-muted">
              From (plan date)
              <input type="date" className={inputClass} value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
            </label>
            <label className="text-xs text-muted">
              To (plan date)
              <input type="date" className={inputClass} value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
            </label>
          </>
        ) : (
          <p className="self-end text-xs text-muted sm:col-span-2 lg:col-span-2">
            Shift filter applies on top of the timeframe. Use date range to slice the list by plan calendar dates.
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : sortedRows.length === 0 ? (
        <p className="text-sm text-muted">No matching checks.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="min-w-[1100px] w-full border-collapse text-sm">
            <thead className="bg-surface-raised/50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <SortHeader
                  label="Date"
                  sortKey="plan_date"
                  active={sortState.key === 'plan_date'}
                  dir={sortState.dir}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Shift"
                  sortKey="shift_kind"
                  active={sortState.key === 'shift_kind'}
                  dir={sortState.dir}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Start"
                  sortKey="start_at"
                  active={sortState.key === 'start_at'}
                  dir={sortState.dir}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Type"
                  sortKey="event_type"
                  active={sortState.key === 'event_type'}
                  dir={sortState.dir}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Title"
                  sortKey="title"
                  active={sortState.key === 'title'}
                  dir={sortState.dir}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Role"
                  sortKey="role_name"
                  active={sortState.key === 'role_name'}
                  dir={sortState.dir}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="Status"
                  sortKey="status"
                  active={sortState.key === 'status'}
                  dir={sortState.dir}
                  onSort={toggleSort}
                />
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const f = (r.event_type as Family) || 'check'
                const sk = shiftKindNorm(r.shift_kind)
                const shiftLabel = sk ? sk.charAt(0).toUpperCase() + sk.slice(1) : '—'
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2 text-xs text-muted">{r.plan_date}</td>
                    <td className="px-3 py-2 text-xs text-muted">{shiftLabel}</td>
                    <td className="px-3 py-2 text-xs text-muted">{formatStartLocal(r.start_at)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${familyPill(f)}`}>{familyLabel(f)}</span>
                    </td>
                    <td className="px-3 py-2">{r.title}</td>
                    <td className="px-3 py-2 text-xs text-muted">{r.role_name ?? 'Unassigned'}</td>
                    <td className="px-3 py-2 text-xs">{r.status.replace('_', ' ')}</td>
                    <td className="px-3 py-2">
                      {r.status !== 'complete' ? (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void markComplete(r)}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Complete
                        </button>
                      ) : (
                        <span className="text-xs text-muted">Done</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
