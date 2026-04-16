import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

type TeamEmbed = { id: string; name: string } | { id: string; name: string }[] | null

type PersonRow = {
  id: string
  user_id: string | null
  display_name: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  team_id: string | null
  teams: TeamEmbed
}

type ProfileRow = { id: string; display_name: string | null; role: string }

type FormState = {
  first_name: string
  last_name: string
  email: string
  phone: string
  display_name: string
  user_id: string
  team_id: string
}

const inputClass =
  'w-full rounded-xl border border-border bg-canvas/60 px-3 py-2.5 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2'

function rosterTeamName(teams: TeamEmbed): string {
  if (teams == null) return ''
  return Array.isArray(teams) ? (teams[0]?.name ?? '') : teams.name
}

function emptyForm(): FormState {
  return {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    display_name: '',
    user_id: '',
    team_id: '',
  }
}

function displayFromParts(first: string, last: string, explicit: string): string {
  const e = explicit.trim()
  if (e) return e
  return `${first.trim()} ${last.trim()}`.trim()
}

function appAccessSuffix(role: string): string {
  if (role === 'super_admin') return ' · super admin'
  if (role === 'admin') return ' · admin'
  if (role === 'assessor') return ' · assessor'
  if (role === 'operator') return ' · operator'
  return ''
}

export function MasterDataPeoplePage() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [people, setPeople] = useState<PersonRow[]>([])
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = useCallback(() => {
    return Promise.all([
      supabase
        .from('people')
        .select(
          `
          id,
          user_id,
          display_name,
          first_name,
          last_name,
          email,
          phone,
          team_id,
          teams ( id, name )
        `,
        )
        .order('display_name'),
      supabase.from('teams').select('id, name').order('sort_order', { ascending: true }),
      supabase.from('profiles').select('id, display_name, role').order('display_name', { ascending: true }),
    ])
  }, [])

  useEffect(() => {
    let cancelled = false
    void load().then(([pRes, tRes, prRes]) => {
      if (cancelled) return
      if (pRes.error) {
        setError(pRes.error.message)
        setPeople([])
      } else {
        setPeople((pRes.data ?? []) as unknown as PersonRow[])
      }
      if (tRes.error) setTeams([])
      else setTeams((tRes.data ?? []) as { id: string; name: string }[])
      if (prRes.error) setProfiles([])
      else setProfiles((prRes.data ?? []) as ProfileRow[])
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [load])

  const linkedUserIds = useMemo(() => {
    const s = new Set<string>()
    for (const p of people) {
      if (p.user_id) s.add(p.user_id)
    }
    return s
  }, [people])

  const profileOptions = useMemo(() => {
    return profiles.filter((pr) => {
      if (editingId) {
        const current = people.find((x) => x.id === editingId)
        if (current?.user_id === pr.id) return true
      }
      return !linkedUserIds.has(pr.id)
    })
  }, [profiles, linkedUserIds, editingId, people])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setError(null)
    setDialogOpen(true)
    dialogRef.current?.showModal()
  }

  function openEdit(row: PersonRow) {
    setEditingId(row.id)
    setForm({
      first_name: row.first_name?.trim() ?? '',
      last_name: row.last_name?.trim() ?? '',
      email: row.email?.trim() ?? '',
      phone: row.phone?.trim() ?? '',
      display_name: row.display_name,
      user_id: row.user_id ?? '',
      team_id: row.team_id ?? '',
    })
    setError(null)
    setDialogOpen(true)
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    dialogRef.current?.close()
    setDialogOpen(false)
    setEditingId(null)
    setForm(emptyForm())
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const display = displayFromParts(form.first_name, form.last_name, form.display_name)
    if (!display) {
      setError('Enter a display name, or first and last name.')
      return
    }

    setSaving(true)
    setError(null)
    const uid = form.user_id.trim() || null
    const tid = form.team_id.trim() || null
    const payload = {
      display_name: display,
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      user_id: uid,
      team_id: tid,
    }

    try {
      if (editingId) {
        const { error: uErr } = await supabase.from('people').update(payload).eq('id', editingId)
        if (uErr) throw uErr
      } else {
        const { error: insErr } = await supabase.from('people').insert(payload)
        if (insErr) throw insErr
      }
      closeDialog()
      const [pRes] = await load()
      if (pRes.error) setError(pRes.error.message)
      else setPeople((pRes.data ?? []) as unknown as PersonRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, label: string) {
    if (
      !window.confirm(
        `Remove ${label} from the directory? This deletes their Skill Matrix role links and skill rows if they exist.`,
      )
    )
      return
    setError(null)
    const { error: delErr } = await supabase.from('people').delete().eq('id', id)
    if (delErr) {
      setError(delErr.message)
      return
    }
    const [pRes] = await load()
    if (pRes.error) setError(pRes.error.message)
    else setPeople((pRes.data ?? []) as unknown as PersonRow[])
  }

  function profileLabel(userId: string | null) {
    if (!userId) return '—'
    const pr = profiles.find((p) => p.id === userId)
    return pr?.display_name?.trim() || `${pr?.id.slice(0, 8)}…`
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">People</h1>
          <p className="mt-1 max-w-2xl text-sm text-fg/75">
            Master directory for the same <strong className="text-fg/90">people</strong> records used in Skill Matrix
            (matrix roster, training). First name, last name, email, phone, and optional login link. Job roles and
            skills are still managed under{' '}
            <Link to="/admin?tab=people" className="font-medium text-accent underline-offset-2 hover:underline">
              Skill Matrix → Admin → People
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          <Plus className="size-4" aria-hidden />
          Add person
        </button>
      </header>

      <div className="rounded-2xl border border-border bg-surface-raised/40 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Users className="size-4 text-teal-700 dark:text-teal-300" aria-hidden />
            <span>{people.length} people</span>
          </div>
          <Link
            to="/admin?tab=people"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            Open Skill Matrix roster
            <ExternalLink className="size-3.5 opacity-80" aria-hidden />
          </Link>
        </div>

        {error && !dialogOpen ? (
          <p className="border-b border-border px-4 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="overflow-x-auto">
          {loading ? (
            <p className="px-4 py-10 text-center text-sm text-muted">Loading…</p>
          ) : people.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">No people yet. Add someone or run migrations.</p>
          ) : (
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Display name</th>
                  <th className="px-4 py-3">First</th>
                  <th className="px-4 py-3">Last</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Login</th>
                  <th className="w-28 px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {people.map((row) => (
                  <tr key={row.id} className="hover:bg-black/[0.04]">
                    <td className="px-4 py-3 font-medium text-fg">{row.display_name}</td>
                    <td className="px-4 py-3 text-muted">{row.first_name?.trim() || '—'}</td>
                    <td className="px-4 py-3 text-muted">{row.last_name?.trim() || '—'}</td>
                    <td className="px-4 py-3 text-muted">{row.email?.trim() || '—'}</td>
                    <td className="px-4 py-3 text-muted">{row.phone?.trim() || '—'}</td>
                    <td className="px-4 py-3 text-muted">{rosterTeamName(row.teams) || '—'}</td>
                    <td className="px-4 py-3 text-muted">{profileLabel(row.user_id)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="rounded-lg p-2 text-muted hover:bg-black/[0.06] hover:text-fg"
                          aria-label={`Edit ${row.display_name}`}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(row.id, row.display_name)}
                          className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"
                          aria-label={`Delete ${row.display_name}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <dialog
        ref={dialogRef}
        className="w-[min(100%,32rem)] rounded-2xl border border-border bg-surface-raised p-0 text-fg shadow-glow backdrop:bg-black/30"
        onClose={() => {
          setDialogOpen(false)
          setEditingId(null)
          setForm(emptyForm())
        }}
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="p-6">
          <h3 className="font-display text-lg font-semibold">{editingId ? 'Edit person' : 'Add person'}</h3>
          <p className="mt-1 text-xs text-muted">
            Display name defaults to first + last if you leave it empty. Either fill display name, or both first and
            last name.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="md-first" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                First name
              </label>
              <input
                id="md-first"
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                className={inputClass}
                autoComplete="given-name"
              />
            </div>
            <div>
              <label htmlFor="md-last" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Last name
              </label>
              <input
                id="md-last"
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                className={inputClass}
                autoComplete="family-name"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="md-display" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Display name <span className="font-normal normal-case text-muted">(optional)</span>
              </label>
              <input
                id="md-display"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                className={inputClass}
                placeholder="Overrides first + last on the matrix and lists"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="md-email" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Email
              </label>
              <input
                id="md-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={inputClass}
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="md-phone" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Phone
              </label>
              <input
                id="md-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className={inputClass}
                autoComplete="tel"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="md-account" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Link to login account
              </label>
              <select
                id="md-account"
                value={form.user_id}
                onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
                className={inputClass}
              >
                <option value="">No link</option>
                {profileOptions.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {(pr.display_name?.trim() || 'User') + appAccessSuffix(pr.role)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted">Each account can link to at most one person.</p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="md-team" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Team
              </label>
              <select
                id="md-team"
                value={form.team_id}
                onChange={(e) => setForm((f) => ({ ...f, team_id: e.target.value }))}
                className={inputClass}
              >
                <option value="">No team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error ? (
            <p className="mt-4 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDialog}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted hover:bg-black/[0.06] hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
            >
              {saving ? 'Saving…' : editingId ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
