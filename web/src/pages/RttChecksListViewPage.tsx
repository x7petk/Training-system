import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import type { Plan24EventRow } from '../features/plan24/plan24Types'

const inputClass =
  'mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2'

type Family = 'check' | 'cl_check' | 'cil_check' | 'quality_check'

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
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
      return f && s && a && e && g && m
    })
  }, [rows, family, eventStatus, query, areaId, equipmentId, equipmentGroupId, equipmentGroupItems])

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

      {loading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted">No matching checks.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="min-w-[980px] w-full border-collapse text-sm">
            <thead className="bg-surface-raised/50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const f = (r.event_type as Family) || 'check'
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2 text-xs text-muted">{r.plan_date}</td>
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
