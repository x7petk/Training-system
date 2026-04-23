import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import type { DhDefectPriority, DhDefectRow, DhDefectStatus, DhDefectTypeRow } from '../features/dh/dhTypes'

const inputClass =
  'mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2'

type PersonMini = { id: string; display_name: string }
type InlineMenuState = { rowId: string; field: 'type' | 'status' | 'priority' } | null
type DhBoardConfig = {
  title: string
  intro: string
  issueTable: 'dh_defects' | 'deviations' | 'quality_fails'
  typeTable: 'dh_defect_types' | 'deviation_types' | 'quality_fail_types'
  itemLabel: string
  itemLabelPlural: string
}

function normalizeOptions(values: Array<string | null>) {
  return Array.from(new Set(values.map((v) => (v ?? '').trim()))).filter(Boolean).sort((a, b) => a.localeCompare(b))
}

function statusPillClass(status: DhDefectStatus) {
  if (status === 'open') return 'border-red-300 bg-red-100 text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200'
  if (status === 'in_progress')
    return 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200'
  if (status === 'resolved')
    return 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200'
  return 'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200'
}

function priorityPillClass(priority: DhDefectPriority) {
  if (priority === 'critical') return 'border-red-300 bg-red-100 text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200'
  if (priority === 'high')
    return 'border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-900/40 dark:bg-orange-950/40 dark:text-orange-200'
  if (priority === 'medium')
    return 'border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-200'
  return 'border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-200'
}

function typePillClass(label: string) {
  const key = label.toLowerCase()
  if (key.includes('safety')) return 'border-red-300 bg-red-100 text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200'
  if (key.includes('quality')) return 'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200'
  if (key.includes('base')) return 'border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-200'
  if (key.includes('contamination'))
    return 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200'
  if (key.includes('hard')) return 'border-teal-300 bg-teal-100 text-teal-800 dark:border-teal-900/40 dark:bg-teal-950/40 dark:text-teal-200'
  if (key.includes('minor')) return 'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200'
  return 'border-pink-300 bg-pink-100 text-pink-800 dark:border-pink-900/40 dark:bg-pink-950/40 dark:text-pink-200'
}

export function DhDefectHandlingPage({
  config = {
    title: 'Defect Handling',
    intro: 'Main DH board for the selected cell. Type catalogue is configurable only by super admin in RTT Admin.',
    issueTable: 'dh_defects',
    typeTable: 'dh_defect_types',
    itemLabel: 'defect',
    itemLabelPlural: 'defects',
  },
}: {
  config?: DhBoardConfig
}) {
  const { cellId, status: scopeStatus } = usePlan24Workspace()
  const [searchParams, setSearchParams] = useSearchParams()
  const [types, setTypes] = useState<DhDefectTypeRow[]>([])
  const [defects, setDefects] = useState<DhDefectRow[]>([])
  const [people, setPeople] = useState<PersonMini[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterArea, setFilterArea] = useState('all')
  const [filterEquipment, setFilterEquipment] = useState('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DhDefectRow | null>(null)
  const [formTypeId, setFormTypeId] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPriority, setFormPriority] = useState<DhDefectPriority>('medium')
  const [formStatus, setFormStatus] = useState<DhDefectStatus>('open')
  const [formArea, setFormArea] = useState('')
  const [formEquipment, setFormEquipment] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formOwnerId, setFormOwnerId] = useState('')
  const [formDue, setFormDue] = useState('')
  const [saving, setSaving] = useState(false)
  const [inlineMenu, setInlineMenu] = useState<InlineMenuState>(null)
  const linkedIssueId = searchParams.get('linkedIssueId')

  const activeTypes = useMemo(() => types.filter((t) => t.is_active), [types])
  const areaOptions = useMemo(() => normalizeOptions(defects.map((d) => d.area)), [defects])
  const equipmentOptions = useMemo(() => normalizeOptions(defects.map((d) => d.equipment)), [defects])
  const peopleMap = useMemo(() => new Map(people.map((p) => [p.id, p.display_name])), [people])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [tRes, pRes] = await Promise.all([
      supabase.from(config.typeTable).select('*').order('sort_order').order('label'),
      supabase.from('people').select('id, display_name').order('display_name').limit(400),
    ])
    if (tRes.error) setError(tRes.error.message)
    setTypes((tRes.data ?? []) as DhDefectTypeRow[])
    setPeople((pRes.data ?? []) as PersonMini[])

    if (cellId) {
      const dRes = await supabase
        .from(config.issueTable)
        .select('*')
        .eq('master_cell_id', cellId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (dRes.error) setError(dRes.error.message)
      else setDefects((dRes.data ?? []) as DhDefectRow[])
    } else {
      setDefects([])
    }
    setLoading(false)
  }, [cellId, config.issueTable, config.typeTable])

  useEffect(() => {
    if (scopeStatus === 'ready') void load()
  }, [load, scopeStatus])

  useEffect(() => {
    function closeInlineMenu() {
      setInlineMenu(null)
    }
    window.addEventListener('click', closeInlineMenu)
    return () => window.removeEventListener('click', closeInlineMenu)
  }, [])

  const openEdit = useCallback((row: DhDefectRow) => {
    setEditing(row)
    setFormTypeId(row.defect_type_id)
    setFormTitle(row.title)
    setFormDescription(row.description ?? '')
    setFormPriority(row.priority)
    setFormStatus(row.status)
    setFormArea(row.area ?? '')
    setFormEquipment(row.equipment ?? '')
    setFormLocation(row.location_summary ?? '')
    setFormOwnerId(row.owner_person_id ?? '')
    setFormDue(row.due_at ? row.due_at.slice(0, 10) : '')
    setDialogOpen(true)
  }, [])

  useEffect(() => {
    if (!linkedIssueId || defects.length === 0) return
    const row = defects.find((d) => d.id === linkedIssueId)
    if (!row) return
    openEdit(row)
    const next = new URLSearchParams(searchParams)
    next.delete('linkedIssueId')
    setSearchParams(next, { replace: true })
  }, [linkedIssueId, defects, searchParams, setSearchParams, openEdit])

  const filteredDefects = useMemo(() => {
    return defects.filter((d) => {
      const statusOk = filterStatus === 'all' || d.status === filterStatus
      const areaOk = filterArea === 'all' || (d.area ?? '').trim() === filterArea
      const equipmentOk = filterEquipment === 'all' || (d.equipment ?? '').trim() === filterEquipment
      return statusOk && areaOk && equipmentOk
    })
  }, [defects, filterArea, filterEquipment, filterStatus])

  function openCreate() {
    setEditing(null)
    setFormTypeId(activeTypes[0]?.id ?? '')
    setFormTitle('')
    setFormDescription('')
    setFormPriority('medium')
    setFormStatus('open')
    setFormArea('')
    setFormEquipment('')
    setFormLocation('')
    setFormOwnerId('')
    setFormDue('')
    setDialogOpen(true)
  }

  function timestampsForStatus(status: DhDefectStatus, currentResolved: string | null, currentClosed: string | null) {
    let resolved_at = currentResolved
    let closed_at = currentClosed
    if (status === 'open' || status === 'in_progress') {
      resolved_at = null
      closed_at = null
    } else if (status === 'resolved') {
      if (!resolved_at) resolved_at = new Date().toISOString()
      closed_at = null
    } else if (status === 'closed') {
      if (!resolved_at) resolved_at = new Date().toISOString()
      if (!closed_at) closed_at = new Date().toISOString()
    }
    return { resolved_at, closed_at }
  }

  async function updateDefectInline(row: DhDefectRow, patch: Partial<Pick<DhDefectRow, 'defect_type_id' | 'status' | 'priority'>>) {
    setError(null)
    const nextStatus = patch.status ?? row.status
    const { resolved_at, closed_at } = timestampsForStatus(nextStatus, row.resolved_at, row.closed_at)
    const { error: uErr } = await supabase
      .from(config.issueTable)
      .update({ ...patch, resolved_at, closed_at })
      .eq('id', row.id)
    if (uErr) setError(uErr.message)
    else await load()
  }

  async function saveDefect() {
    if (!cellId || !formTypeId || !formTitle.trim()) {
      setError('Select a cell, defect type, and title.')
      return
    }
    setSaving(true)
    setError(null)
    const base = {
      defect_type_id: formTypeId,
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      area: formArea.trim() || null,
      equipment: formEquipment.trim() || null,
      priority: formPriority,
      status: formStatus,
      location_summary: formLocation.trim() || null,
      owner_person_id: formOwnerId || null,
      due_at: formDue ? `${formDue}T12:00:00.000Z` : null,
    }
    if (editing) {
      const { resolved_at, closed_at } = timestampsForStatus(formStatus, editing.resolved_at, editing.closed_at)
      const { error: uErr } = await supabase
        .from(config.issueTable)
        .update({ ...base, resolved_at, closed_at })
        .eq('id', editing.id)
      setSaving(false)
      if (uErr) setError(uErr.message)
      else {
        setDialogOpen(false)
        await load()
      }
    } else {
      const { data: sessionData } = await supabase.auth.getSession()
      const uid = sessionData.session?.user?.id ?? null
      const { error: iErr } = await supabase.from(config.issueTable).insert({
        master_cell_id: cellId,
        ...base,
        created_by: uid,
        resolved_at: null,
        closed_at: null,
      })
      setSaving(false)
      if (iErr) setError(iErr.message)
      else {
        setDialogOpen(false)
        await load()
      }
    }
  }

  async function softDelete(row: DhDefectRow) {
    if (!confirm(`Archive ${config.itemLabel} "${row.title}"?`)) return
    setError(null)
    const { error: uErr } = await supabase.from(config.issueTable).update({ deleted_at: new Date().toISOString() }).eq('id', row.id)
    if (uErr) setError(uErr.message)
    else await load()
  }

  if (scopeStatus !== 'ready') {
    return <div className="text-sm text-muted">Loading scope...</div>
  }

  if (!cellId) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        Select a <strong className="font-medium text-fg">cell</strong> in the scope bar to view and manage defects.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{config.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">{config.intro}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={activeTypes.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden />
          {`Report ${config.itemLabel}`}
        </button>
      </header>

      {error ? <div className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div> : null}

      <div className="grid gap-3 rounded-xl border border-border bg-surface p-3 sm:grid-cols-3">
        <label className="text-xs text-muted">
          Status
          <select className={inputClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label className="text-xs text-muted">
          Area
          <select className={inputClass} value={filterArea} onChange={(e) => setFilterArea(e.target.value)}>
            <option value="all">All areas</option>
            {areaOptions.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Equipment
          <select className={inputClass} value={filterEquipment} onChange={(e) => setFilterEquipment(e.target.value)}>
            <option value="all">All equipment</option>
            {equipmentOptions.map((equipment) => (
              <option key={equipment} value={equipment}>
                {equipment}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : filteredDefects.length === 0 ? (
        <p className="text-sm text-muted">{`No ${config.itemLabelPlural} for this filter.`}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="min-w-[1080px] w-full border-collapse text-sm">
            <thead className="bg-surface-raised/50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Area</th>
                <th className="px-3 py-2 text-left">Equipment</th>
                <th className="px-3 py-2 text-left">{`${config.itemLabel[0].toUpperCase()}${config.itemLabel.slice(1)} description`}</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Priority</th>
                <th className="px-3 py-2 text-left">Owner</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDefects.map((d) => (
                <tr key={d.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 text-xs text-muted">{d.created_at.slice(0, 10)}</td>
                  <td className="px-3 py-2">{d.area ?? '—'}</td>
                  <td className="px-3 py-2">{d.equipment ?? '—'}</td>
                  <td className="max-w-[340px] px-3 py-2">
                    <button type="button" className="text-left font-medium hover:underline" onClick={() => openEdit(d)}>
                      {d.title}
                    </button>
                    {d.description ? <p className="mt-1 line-clamp-2 text-xs text-muted">{d.description}</p> : null}
                  </td>
                  <td className="px-3 py-2">
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setInlineMenu((prev) => (prev?.rowId === d.id && prev.field === 'type' ? null : { rowId: d.id, field: 'type' }))
                        }}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${typePillClass(
                          activeTypes.find((t) => t.id === d.defect_type_id)?.label ?? 'Type',
                        )}`}
                      >
                        {activeTypes.find((t) => t.id === d.defect_type_id)?.label ?? 'Type'}
                      </button>
                      {inlineMenu?.rowId === d.id && inlineMenu.field === 'type' ? (
                        <div
                          className="absolute left-0 top-9 z-20 min-w-[190px] rounded-xl border border-border bg-surface p-1 shadow-xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {activeTypes.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-surface-raised/60"
                              onClick={() => {
                                setInlineMenu(null)
                                void updateDefectInline(d, { defect_type_id: t.id })
                              }}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setInlineMenu((prev) => (prev?.rowId === d.id && prev.field === 'status' ? null : { rowId: d.id, field: 'status' }))
                        }}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPillClass(d.status)}`}
                      >
                        {d.status.replace('_', ' ')}
                      </button>
                      {inlineMenu?.rowId === d.id && inlineMenu.field === 'status' ? (
                        <div
                          className="absolute left-0 top-9 z-20 min-w-[165px] rounded-xl border border-border bg-surface p-1 shadow-xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {(['open', 'in_progress', 'resolved', 'closed'] as DhDefectStatus[]).map((status) => (
                            <button
                              key={status}
                              type="button"
                              className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-surface-raised/60"
                              onClick={() => {
                                setInlineMenu(null)
                                void updateDefectInline(d, { status })
                              }}
                            >
                              {status.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setInlineMenu((prev) =>
                            prev?.rowId === d.id && prev.field === 'priority' ? null : { rowId: d.id, field: 'priority' },
                          )
                        }}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityPillClass(d.priority)}`}
                      >
                        {d.priority}
                      </button>
                      {inlineMenu?.rowId === d.id && inlineMenu.field === 'priority' ? (
                        <div
                          className="absolute left-0 top-9 z-20 min-w-[145px] rounded-xl border border-border bg-surface p-1 shadow-xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {(['low', 'medium', 'high', 'critical'] as DhDefectPriority[]).map((priority) => (
                            <button
                              key={priority}
                              type="button"
                              className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-surface-raised/60"
                              onClick={() => {
                                setInlineMenu(null)
                                void updateDefectInline(d, { priority })
                              }}
                            >
                              {priority}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{(d.owner_person_id && peopleMap.get(d.owner_person_id)) || '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(d)}
                        className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-surface-raised/60"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void softDelete(d)}
                        className="rounded-lg border border-danger/30 px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/10"
                      >
                        Archive
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDialogOpen(false)
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-xl">
            <h2 className="text-lg font-semibold">{editing ? `Edit ${config.itemLabel}` : `Report ${config.itemLabel}`}</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-xs text-muted">
                Type
                <select className={inputClass} value={formTypeId} onChange={(e) => setFormTypeId(e.target.value)}>
                  {activeTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-muted">
                Title
                <input className={inputClass} value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
              </label>
              <label className="block text-xs text-muted">
                Description
                <textarea
                  className="mt-1 min-h-[88px] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-muted">
                  Area
                  <input
                    className={inputClass}
                    value={formArea}
                    onChange={(e) => setFormArea(e.target.value)}
                    list="dh-area-options"
                    placeholder="Select or type area"
                  />
                </label>
                <label className="text-xs text-muted">
                  Equipment
                  <input
                    className={inputClass}
                    value={formEquipment}
                    onChange={(e) => setFormEquipment(e.target.value)}
                    list="dh-equipment-options"
                    placeholder="Select or type equipment"
                  />
                </label>
                <label className="text-xs text-muted">
                  Priority
                  <select
                    className={inputClass}
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as DhDefectPriority)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
                <label className="text-xs text-muted">
                  Status
                  <select
                    className={inputClass}
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as DhDefectStatus)}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
              </div>
              <datalist id="dh-area-options">
                {areaOptions.map((area) => (
                  <option key={area} value={area} />
                ))}
              </datalist>
              <datalist id="dh-equipment-options">
                {equipmentOptions.map((equipment) => (
                  <option key={equipment} value={equipment} />
                ))}
              </datalist>
              <label className="block text-xs text-muted">
                Location summary (optional)
                <input className={inputClass} value={formLocation} onChange={(e) => setFormLocation(e.target.value)} />
              </label>
              <label className="block text-xs text-muted">
                Owner (optional)
                <select className={inputClass} value={formOwnerId} onChange={(e) => setFormOwnerId(e.target.value)}>
                  <option value="">— None —</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-muted">
                Due date (optional)
                <input className={inputClass} type="date" value={formDue} onChange={(e) => setFormDue(e.target.value)} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-border px-3 py-2 text-sm" onClick={() => setDialogOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !formTitle.trim() || !formTypeId}
                onClick={() => void saveDefect()}
                className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
