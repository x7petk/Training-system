import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, LayoutDashboard, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { LdrPersonAvatar } from '../features/ldr/LdrPersonAvatar'
import {
  LDR_AVATAR_VARIANTS,
  LDR_PERSON_STATUS_OPTIONS,
  ldrInitialsFromNames,
  ldrLocationName,
  ldrPersonFullName,
  type LdrActivity,
  type LdrLocation,
  type LdrPersonRow,
  type LdrPersonStatus,
} from '../features/ldr/types'

export function LdrAdminPage() {
  const [tab, setTab] = useState<'people' | 'activities' | 'locations'>('people')
  const tabs = useMemo(
    () => [
      { id: 'people' as const, label: 'People' },
      { id: 'activities' as const, label: 'Activities' },
      { id: 'locations' as const, label: 'Locations' },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
          <LayoutDashboard className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">LDR Admin</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Build your LDR people list and create the activities that appear in the roster.
          </p>
        </div>
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
      {tab === 'locations' ? <LdrAdminLocationsPanel /> : null}
    </div>
  )
}

function LdrAdminPeoplePanel() {
  const [rows, setRows] = useState<LdrPersonRow[]>([])
  const [locations, setLocations] = useState<LdrLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'add' | { edit: LdrPersonRow } | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    const [pRes, lRes] = await Promise.all([
      supabase
        .from('ldr_people')
        .select(
          'id, person_id, site_id, location_id, status, first_name, last_name, initials, avatar_variant, ldr_locations(name)',
        )
        .order('first_name')
        .order('last_name'),
      supabase.from('ldr_locations').select('id, name, sort_order').order('sort_order').order('name'),
    ])
    if (pRes.error) setError(pRes.error.message)
    else if (lRes.error) setError(lRes.error.message)
    else {
      setRows((pRes.data ?? []) as LdrPersonRow[])
      setLocations((lRes.data ?? []) as LdrLocation[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
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
                <th className="py-3">Location</th>
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
                    <td className="py-3 text-muted">{ldrLocationName(r.ldr_locations) || '—'}</td>
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

      {dialog ? (
        <LdrPersonDialog
          mode={dialog === 'add' ? 'add' : 'edit'}
          initial={dialog === 'add' ? null : dialog.edit}
          locations={locations}
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
  locations: LdrLocation[]
  onClose: () => void
  onSaved: () => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [initials, setInitials] = useState('')
  const [avatarVariant, setAvatarVariant] = useState<number>(1)
  const [status, setStatus] = useState<LdrPersonStatus>('available')
  const [locationId, setLocationId] = useState<string>('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (props.mode === 'edit' && props.initial) {
      setFirstName(props.initial.first_name)
      setLastName(props.initial.last_name ?? '')
      setInitials(props.initial.initials)
      setAvatarVariant(props.initial.avatar_variant)
      setStatus(props.initial.status)
      setLocationId(props.initial.location_id ?? '')
      return
    }
    setFirstName('')
    setLastName('')
    setInitials('')
    setAvatarVariant(1)
    setStatus('available')
    setLocationId('')
  }, [props.mode, props.initial])

  useEffect(() => {
    if (props.mode === 'add') {
      setInitials(ldrInitialsFromNames(firstName, lastName))
    }
  }, [firstName, lastName, props.mode])

  async function save() {
    setErr(null)
    const cleanFirst = firstName.trim()
    const cleanLast = lastName.trim()
    const cleanInitials = initials.trim().toUpperCase()
    if (!cleanFirst || !cleanInitials) {
      setErr('First name and initials are required.')
      return
    }
    const payload = {
      first_name: cleanFirst,
      last_name: cleanLast || null,
      initials: cleanInitials,
      avatar_variant: avatarVariant,
      status,
      location_id: locationId || null,
      person_id: null,
      site_id: null,
    }
    if (props.mode === 'add') {
      const { error: e } = await supabase.from('ldr_people').insert(payload)
      if (e) {
        setErr(e.message)
        return
      }
    } else if (props.initial) {
      const { error: e } = await supabase.from('ldr_people').update(payload).eq('id', props.initial.id)
      if (e) {
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
              value={initials}
              onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 3))}
              className="mt-1 w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm"
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
            Location
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm"
            >
              <option value="">No location</option>
              {props.locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Photo placeholder</p>
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
  const [rows, setRows] = useState<LdrActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<LdrActivity | null>(null)
  const [sortMode, setSortMode] = useState<'custom' | 'name_asc' | 'name_desc'>('custom')
  const [reorderingId, setReorderingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: e } = await supabase.from('ldr_activities').select('id, name, sort_order').order('sort_order').order('name')
    if (e) setError(e.message)
    else setRows((data ?? []) as LdrActivity[])
    setLoading(false)
  }, [])

  useEffect(() => {
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
    if (!n) return
    const nextSortOrder = rows.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1
    const { error: e } = await supabase.from('ldr_activities').insert({ name: n, sort_order: nextSortOrder })
    if (e) setError(e.message)
    else {
      setName('')
      await load()
    }
  }

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

function LdrAdminLocationsPanel() {
  const [rows, setRows] = useState<LdrLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<LdrLocation | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: e } = await supabase
      .from('ldr_locations')
      .select('id, name, sort_order')
      .order('sort_order')
      .order('name')
    if (e) setError(e.message)
    else setRows((data ?? []) as LdrLocation[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function add() {
    setError(null)
    const n = name.trim()
    if (!n) return
    const { error: e } = await supabase
      .from('ldr_locations')
      .insert({ name: n, sort_order: rows.length })
    if (e) setError(e.message)
    else {
      setName('')
      await load()
    }
  }

  async function saveEdit() {
    if (!editing) return
    setError(null)
    const { error: e } = await supabase
      .from('ldr_locations')
      .update({ name: editing.name.trim() })
      .eq('id', editing.id)
    if (e) setError(e.message)
    else {
      setEditing(null)
      await load()
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this location? People linked to it will become no-location.')) return
    setError(null)
    const { error: e } = await supabase.from('ldr_locations').delete().eq('id', id)
    if (e) setError(e.message)
    else await load()
  }

  return (
    <section className="rounded-2xl border border-border bg-surface-raised/50 p-4 backdrop-blur-sm md:p-6">
      <h2 className="font-display text-lg font-semibold">Locations</h2>
      <p className="mt-1 text-sm text-muted">Create locations used next to initials in roster assignments.</p>
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New location name"
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

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : (
        <ul className="mt-6 divide-y divide-border">
          {rows.map((r) => (
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
