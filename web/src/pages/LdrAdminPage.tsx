import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, LayoutDashboard, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { LdrPersonAvatar } from '../features/ldr/LdrPersonAvatar'
import {
  LDR_AVATAR_VARIANTS,
  LDR_PERSON_STATUS_OPTIONS,
  isMissingMasterCellColumnError,
  ldrInitialsFromNames,
  ldrMasterCellJoinFromId,
  ldrMasterCellLabel,
  ldrPersonFullName,
  type LdrActivity,
  type LdrPersonRow,
  type LdrPersonStatus,
} from '../features/ldr/types'
import { useLdrWorkspace } from '../features/ldr/LdrWorkspaceContext'

function visibleSiteActivitiesStorageKey(cellWorkspaceId: string, siteWorkspaceId: string) {
  return `ldr.site-activities.visible.v1:${cellWorkspaceId}:${siteWorkspaceId}`
}

function loadVisibleSiteActivityIds(cellWorkspaceId: string, siteWorkspaceId: string): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(visibleSiteActivitiesStorageKey(cellWorkspaceId, siteWorkspaceId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return new Set(parsed.filter((v): v is string => typeof v === 'string'))
  } catch {
    return null
  }
}

function saveVisibleSiteActivityIds(cellWorkspaceId: string, siteWorkspaceId: string, ids: string[]) {
  try {
    window.localStorage.setItem(visibleSiteActivitiesStorageKey(cellWorkspaceId, siteWorkspaceId), JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

export function LdrAdminPage() {
  const [tab, setTab] = useState<'people' | 'activities' | 'cells'>('people')
  const tabs = useMemo(
    () => [
      { id: 'people' as const, label: 'People' },
      { id: 'activities' as const, label: 'Activities' },
      { id: 'cells' as const, label: 'Cells' },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
          <LayoutDashboard className="size-6" aria-hidden />
        </span>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">LDR Admin</h1>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="LDR admin sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-accent-dim text-accent ring-1 ring-accent/25'
                : 'text-muted hover:bg-black/[0.06] hover:text-fg'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'people' ? <LdrAdminPeoplePanel /> : null}
      {tab === 'activities' ? <LdrAdminActivitiesPanel /> : null}
      {tab === 'cells' ? <LdrAdminCellsPanel /> : null}
    </div>
  )
}

function LdrAdminPeoplePanel() {
  const { workspaceId, siteCellOptions, masterCellJoinById } = useLdrWorkspace()
  const [rows, setRows] = useState<LdrPersonRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'add' | { edit: LdrPersonRow } | null>(null)

  const load = useCallback(async () => {
    setError(null)
    if (!workspaceId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const pRes = await supabase
      .from('ldr_people')
      .select(
        'id, site_id, location_id, master_cell_id, status, first_name, last_name, initials, avatar_variant',
      )
      .eq('workspace_id', workspaceId)
      .order('first_name')
      .order('last_name')
    if (pRes.error && isMissingMasterCellColumnError(pRes.error.message)) {
      const [legacyPeopleRes, legacyLocationsRes] = await Promise.all([
        supabase
          .from('ldr_people')
          .select('id, site_id, location_id, status, first_name, last_name, initials, avatar_variant')
          .eq('workspace_id', workspaceId)
          .order('first_name')
          .order('last_name'),
        supabase.from('ldr_locations').select('id, name').eq('workspace_id', workspaceId),
      ])
      if (legacyPeopleRes.error) setError(legacyPeopleRes.error.message)
      else if (legacyLocationsRes.error) setError(legacyLocationsRes.error.message)
      else {
        const legacyLocationById = new Map((legacyLocationsRes.data ?? []).map((row) => [row.id, row.name]))
        const raw = (legacyPeopleRes.data ?? []) as LdrPersonRow[]
        setRows(
          raw.map((r) => ({
            ...r,
            master_cell_id: null,
            master_cells: r.location_id ? { name: legacyLocationById.get(r.location_id) ?? '' } : undefined,
          })),
        )
      }
      setLoading(false)
      return
    }
    if (pRes.error) setError(pRes.error.message)
    else {
      const raw = (pRes.data ?? []) as LdrPersonRow[]
      setRows(
        raw.map((r) => ({
          ...r,
          master_cells: ldrMasterCellJoinFromId(r.master_cell_id, masterCellJoinById),
        })),
      )
    }
    setLoading(false)
  }, [workspaceId, masterCellJoinById])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load() updates people list after fetch
    void load()
  }, [load])

  return (
    <section className="rounded-2xl border border-border bg-surface-raised/50 p-4 backdrop-blur-sm md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">LDR people</h2>
        <button
          type="button"
          onClick={() => setDialog('add')}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium hover:border-accent/40"
        >
          <Plus className="size-4" />
          Add person
        </button>
      </div>
      {error ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No LDR people yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted">
              <tr>
                <th className="py-3 pl-2">Photo</th>
                <th className="py-3">Name</th>
                <th className="py-3">Initials</th>
                <th className="py-3">Cell</th>
                <th className="py-3">Status</th>
                <th className="w-28 py-3 pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const name = ldrPersonFullName(r)
                return (
                  <tr key={r.id}>
                    <td className="py-3 pl-2">
                      <LdrPersonAvatar initials={r.initials} variant={r.avatar_variant} />
                    </td>
                    <td className="py-3 font-medium text-fg">{name}</td>
                    <td className="py-3 text-muted">{r.initials}</td>
                    <td className="py-3 text-muted">{ldrMasterCellLabel(r.master_cells) || '—'}</td>
                    <td className="py-3 text-muted">{r.status}</td>
                    <td className="py-3 pr-2 text-right">
                      <button
                        type="button"
                        onClick={() => setDialog({ edit: r })}
                        className="rounded-lg p-2 text-muted hover:bg-black/[0.06] hover:text-fg"
                        aria-label={`Edit ${name}`}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteLdrPerson(r.id, load, setError)}
                        className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"
                        aria-label={`Remove ${name} from LDR`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialog && workspaceId ? (
        <LdrPersonDialog
          key={dialog === 'add' ? 'ldr-person-add' : dialog.edit.id}
          mode={dialog === 'add' ? 'add' : 'edit'}
          initial={dialog === 'add' ? null : dialog.edit}
          cellOptions={siteCellOptions}
          workspaceId={workspaceId}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            void load()
          }}
        />
      ) : null}
    </section>
  )
}

async function deleteLdrPerson(id: string, load: () => Promise<void>, setError: (s: string | null) => void) {
  if (!window.confirm('Remove this person from LDR tools?')) return
  setError(null)
  const { error: e } = await supabase.from('ldr_people').delete().eq('id', id)
  if (e) setError(e.message)
  else await load()
}

function LdrPersonDialog(props: {
  mode: 'add' | 'edit'
  initial: LdrPersonRow | null
  cellOptions: { id: string; label: string }[]
  workspaceId: string
  onClose: () => void
  onSaved: () => void
}) {
  const defaultForm =
    props.mode === 'edit' && props.initial
      ? {
          firstName: props.initial.first_name,
          lastName: props.initial.last_name ?? '',
          initials: props.initial.initials,
          avatarVariant: props.initial.avatar_variant,
          status: props.initial.status,
          masterCellId: props.initial.master_cell_id ?? '',
        }
      : {
          firstName: '',
          lastName: '',
          initials: '',
          avatarVariant: 1,
          status: 'available' as LdrPersonStatus,
          masterCellId: '',
        }

  const [firstName, setFirstName] = useState(defaultForm.firstName)
  const [lastName, setLastName] = useState(defaultForm.lastName)
  const [initials, setInitials] = useState(defaultForm.initials)
  const [avatarVariant, setAvatarVariant] = useState(defaultForm.avatarVariant)
  const [status, setStatus] = useState<LdrPersonStatus>(defaultForm.status)
  const [masterCellId, setMasterCellId] = useState(defaultForm.masterCellId)
  const [err, setErr] = useState<string | null>(null)

  const derivedInitialsAdd = ldrInitialsFromNames(firstName, lastName)
  const initialsValue = props.mode === 'add' ? derivedInitialsAdd : initials

  async function save() {
    setErr(null)
    const cleanFirst = firstName.trim()
    const cleanLast = lastName.trim()
    const cleanInitials = (props.mode === 'add' ? derivedInitialsAdd : initials).trim().toUpperCase()
    if (!cleanFirst || !cleanInitials) {
      setErr('First name and initials are required.')
      return
    }
    const payload = {
      workspace_id: props.workspaceId,
      first_name: cleanFirst,
      last_name: cleanLast || null,
      initials: cleanInitials,
      avatar_variant: avatarVariant,
      status,
      master_cell_id: masterCellId || null,
      location_id: null,
      site_id: null,
    }
    if (props.mode === 'add') {
      const { error: e } = await supabase.from('ldr_people').insert(payload)
      if (e && isMissingMasterCellColumnError(e.message)) {
        const { master_cell_id, ...legacyPayload } = payload
        void master_cell_id
        const { error: legacyErr } = await supabase.from('ldr_people').insert(legacyPayload)
        if (legacyErr) {
          setErr(legacyErr.message)
          return
        }
      } else if (e) {
        setErr(e.message)
        return
      }
    } else if (props.initial) {
      const { workspace_id, ...updatePayload } = payload
      void workspace_id
      const { error: e } = await supabase.from('ldr_people').update(updatePayload).eq('id', props.initial.id)
      if (e && isMissingMasterCellColumnError(e.message)) {
        const { master_cell_id: legacyMc, ...legacyPayload } = updatePayload
        void legacyMc
        const { error: legacyErr } = await supabase.from('ldr_people').update(legacyPayload).eq('id', props.initial.id)
        if (legacyErr) {
          setErr(legacyErr.message)
          return
        }
      } else if (e) {
        setErr(e.message)
        return
      }
    }
    props.onSaved()
  }

  return (
    <dialog open className="fixed inset-0 z-50 flex max-h-none max-w-none items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-glow">
        <h3 className="font-display text-lg font-semibold">{props.mode === 'add' ? 'Add LDR person' : 'Edit LDR person'}</h3>
        {err ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {err}
          </p>
        ) : null}
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted">
              Name
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium uppercase tracking-wider text-muted">
              Second name
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted">
            Initials
            <input
              value={initialsValue}
              readOnly={props.mode === 'add'}
              title={props.mode === 'add' ? 'Derived from name while adding' : undefined}
              onChange={props.mode === 'add' ? undefined : (e) => setInitials(e.target.value.toUpperCase().slice(0, 3))}
              className="mt-1 w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm read-only:bg-surface-raised/80 read-only:text-muted"
            />
          </label>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LdrPersonStatus)}
              className="mt-1 w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm"
            >
              {LDR_PERSON_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium uppercase tracking-wider text-muted">
            Cell
            <select
              value={masterCellId}
              onChange={(e) => setMasterCellId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm"
            >
              <option value="">No cell</option>
              {props.cellOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Colour</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {LDR_AVATAR_VARIANTS.map((variant) => (
                <button
                  key={variant}
                  type="button"
                  onClick={() => setAvatarVariant(variant)}
                  className={`rounded-2xl border p-2 transition ${
                    avatarVariant === variant ? 'border-accent bg-accent-dim/40' : 'border-border bg-canvas/30'
                  }`}
                >
                  <LdrPersonAvatar initials={initials || 'LD'} variant={variant} size="lg" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void save()}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Save
          </button>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm text-fg"
          >
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  )
}

function LdrAdminActivitiesPanel() {
  const { workspaceId, scopeLevel, siteId } = useLdrWorkspace()
  const [rows, setRows] = useState<LdrActivity[]>([])
  const [siteRows, setSiteRows] = useState<LdrActivity[]>([])
  const [siteWorkspaceId, setSiteWorkspaceId] = useState<string | null>(null)
  const [visibleSiteActivityIds, setVisibleSiteActivityIds] = useState<Set<string>>(new Set())
  const [visibilityLoadedKey, setVisibilityLoadedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<LdrActivity | null>(null)
  const [sortMode, setSortMode] = useState<'custom' | 'name_asc' | 'name_desc'>('custom')
  const [reorderingId, setReorderingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!workspaceId) {
      setRows([])
      setSiteRows([])
      setVisibilityLoadedKey(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: e } = await supabase
      .from('ldr_activities')
      .select('id, name, sort_order')
      .eq('workspace_id', workspaceId)
      .order('sort_order')
      .order('name')
    if (e) setError(e.message)
    else setRows((data ?? []) as LdrActivity[])

    if (scopeLevel === 'cell' && siteId) {
      const { data: sw, error: swErr } = await supabase.rpc('ldr_ensure_workspace_site', { p_master_site_id: siteId })
      const swid = !swErr && typeof sw === 'string' ? sw : null
      setSiteWorkspaceId(swid)
      if (swErr) setError(swErr.message)
      if (swid) {
        const { data: sActs, error: sActsErr } = await supabase
          .from('ldr_activities')
          .select('id, name, sort_order')
          .eq('workspace_id', swid)
          .order('sort_order')
          .order('name')
        if (sActsErr) setError(sActsErr.message)
        else {
          const siteActivities = (sActs ?? []) as LdrActivity[]
          setSiteRows(siteActivities)
          if (workspaceId) {
            const key = visibleSiteActivitiesStorageKey(workspaceId, swid)
            const stored = loadVisibleSiteActivityIds(workspaceId, swid)
            if (stored == null) {
              setVisibleSiteActivityIds(new Set(siteActivities.map((a) => a.id)))
            } else {
              const valid = siteActivities.filter((a) => stored.has(a.id)).map((a) => a.id)
              setVisibleSiteActivityIds(new Set(valid))
            }
            setVisibilityLoadedKey(key)
          }
        }
      } else {
        setSiteRows([])
        setVisibleSiteActivityIds(new Set())
        setVisibilityLoadedKey(null)
      }
    } else {
      setSiteWorkspaceId(null)
      setSiteRows([])
      setVisibleSiteActivityIds(new Set())
      setVisibilityLoadedKey(null)
    }
    setLoading(false)
  }, [workspaceId, scopeLevel, siteId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load() updates activities after fetch
    void load()
  }, [load])

  const sortedRows = useMemo(() => {
    if (sortMode === 'custom') return rows
    const collator = new Intl.Collator(undefined, { sensitivity: 'base' })
    const sorted = [...rows].sort((a, b) => collator.compare(a.name, b.name))
    return sortMode === 'name_desc' ? sorted.reverse() : sorted
  }, [rows, sortMode])

  async function add() {
    setError(null)
    const n = name.trim()
    if (!n || !workspaceId) return
    const nextSortOrder = rows.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1
    const { error: e } = await supabase
      .from('ldr_activities')
      .insert({ workspace_id: workspaceId, name: n, sort_order: nextSortOrder })
    if (e) setError(e.message)
    else {
      setName('')
      await load()
    }
  }

  useEffect(() => {
    if (scopeLevel !== 'cell' || !workspaceId || !siteWorkspaceId) return
    const key = visibleSiteActivitiesStorageKey(workspaceId, siteWorkspaceId)
    if (visibilityLoadedKey !== key) return
    saveVisibleSiteActivityIds(workspaceId, siteWorkspaceId, [...visibleSiteActivityIds])
  }, [scopeLevel, workspaceId, siteWorkspaceId, visibleSiteActivityIds, visibilityLoadedKey])

  async function applySortOrder() {
    if (sortMode === 'custom') return
    setError(null)
    const updates = sortedRows.map((row, index) =>
      supabase.from('ldr_activities').update({ sort_order: index }).eq('id', row.id),
    )
    const results = await Promise.all(updates)
    const failed = results.find((res) => res.error)
    if (failed?.error) {
      setError(failed.error.message)
      return
    }
    setSortMode('custom')
    await load()
  }

  async function moveActivity(id: string, direction: -1 | 1) {
    if (sortMode !== 'custom') {
      setError('Switch Sort to "Custom order" to move activities manually.')
      return
    }
    const index = rows.findIndex((r) => r.id === id)
    if (index < 0) return
    const target = index + direction
    if (target < 0 || target >= rows.length) return

    setError(null)
    const nextRows = [...rows]
    const [item] = nextRows.splice(index, 1)
    nextRows.splice(target, 0, item)
    setRows(nextRows)
    setReorderingId(id)

    const updates = nextRows.map((row, idx) =>
      supabase.from('ldr_activities').update({ sort_order: idx }).eq('id', row.id),
    )
    const results = await Promise.all(updates)
    const failed = results.find((res) => res.error)
    setReorderingId(null)
    if (failed?.error) {
      setError(failed.error.message)
      await load()
    }
  }

  async function saveEdit() {
    if (!editing) return
    setError(null)
    const { error: e } = await supabase.from('ldr_activities').update({ name: editing.name.trim() }).eq('id', editing.id)
    if (e) setError(e.message)
    else {
      setEditing(null)
      await load()
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this activity? Assignments will be removed.')) return
    setError(null)
    const { error: e } = await supabase.from('ldr_activities').delete().eq('id', id)
    if (e) setError(e.message)
    else await load()
  }

  return (
    <section className="rounded-2xl border border-border bg-surface-raised/50 p-4 backdrop-blur-sm md:p-6">
      <h2 className="font-display text-lg font-semibold">Activities</h2>
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New activity name"
          className="min-w-[12rem] flex-1 rounded-xl border border-border bg-canvas px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void add()}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="size-4" />
          Add
        </button>
      </div>
      {scopeLevel === 'cell' ? (
        <div className="mt-3 rounded-xl border border-border bg-surface px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Show site activities in cell roster</p>
            <button
              type="button"
              onClick={() => setVisibleSiteActivityIds(new Set(siteRows.map((r) => r.id)))}
              className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-fg hover:border-accent/40"
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setVisibleSiteActivityIds(new Set())}
              className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-fg hover:border-accent/40"
            >
              None
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {siteRows.map((r) => {
              const checked = visibleSiteActivityIds.has(r.id)
              return (
                <label
                  key={r.id}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${
                    checked
                      ? 'border-teal-600/55 bg-teal-600/20 text-slate-950 shadow-sm dark:border-teal-300/55 dark:bg-teal-400/35 dark:text-slate-950'
                      : 'border-border bg-canvas text-fg'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setVisibleSiteActivityIds((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(r.id)
                        else next.delete(r.id)
                        return next
                      })
                    }}
                    className="size-3.5 accent-teal-700 dark:accent-teal-300"
                  />
                  {r.name}
                </label>
              )
            })}
          </div>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted">
          Sort
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as 'custom' | 'name_asc' | 'name_desc')}
            className="ml-2 rounded-lg border border-border bg-canvas px-2 py-1.5 text-xs text-fg"
          >
            <option value="custom">Custom order</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
          </select>
        </label>
        {sortMode !== 'custom' ? (
          <button
            type="button"
            onClick={() => void applySortOrder()}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg hover:border-accent/40"
          >
            Apply order to roster
          </button>
        ) : null}
      </div>
      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : (
        <ul className="mt-6 divide-y divide-border">
          {sortedRows.map((r, idx) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-3">
              {editing?.id === r.id ? (
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="flex-1 rounded-lg border border-border bg-canvas px-2 py-1.5 text-sm"
                />
              ) : (
                <span className="font-medium text-fg">{r.name}</span>
              )}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => void moveActivity(r.id, -1)}
                  disabled={sortMode !== 'custom' || idx === 0 || reorderingId === r.id}
                  className="rounded-lg p-2 text-muted hover:bg-black/[0.06] disabled:opacity-40"
                  aria-label={`Move ${r.name} up`}
                  title="Move up"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void moveActivity(r.id, 1)}
                  disabled={sortMode !== 'custom' || idx === sortedRows.length - 1 || reorderingId === r.id}
                  className="rounded-lg p-2 text-muted hover:bg-black/[0.06] disabled:opacity-40"
                  aria-label={`Move ${r.name} down`}
                  title="Move down"
                >
                  <ArrowDown className="size-4" />
                </button>
                {editing?.id === r.id ? (
                  <button
                    type="button"
                    onClick={() => void saveEdit()}
                    className="rounded-lg px-2 py-1 text-sm font-medium text-accent"
                  >
                    Save
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing({ ...r })}
                    className="rounded-lg p-2 text-muted hover:bg-black/[0.06]"
                    aria-label={`Edit ${r.name}`}
                  >
                    <Pencil className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void remove(r.id)}
                  className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"
                  aria-label={`Delete ${r.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function LdrAdminCellsPanel() {
  const { status, siteCellOptions, siteId } = useLdrWorkspace()

  return (
    <section className="rounded-2xl border border-border bg-surface-raised/50 p-4 backdrop-blur-sm md:p-6">
      <h2 className="font-display text-lg font-semibold">Cells</h2>
      {status !== 'ready' ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : !siteId ? (
        <p className="mt-6 text-sm text-muted">Select a site above.</p>
      ) : siteCellOptions.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No cells for this site yet. Add plants and cells in Master data.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border">
          {siteCellOptions.map((opt) => (
            <li key={opt.id} className="py-2.5 text-sm font-medium text-fg">
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
