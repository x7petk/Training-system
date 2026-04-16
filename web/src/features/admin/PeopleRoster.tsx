import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { addMonths, localYMD, startOfDay } from '../../lib/dueDateUtils'
import { classifyCell, type SkillKind } from '../matrix/gapLogic'

type RoleRow = { id: string; name: string }
type TeamRow = { id: string; name: string }
type RequirementRow = { role_id: string; skill_id: string; required_level: number }
type SkillKindRow = { id: string; kind: SkillKind }
type PersonSkillRow = {
  person_id: string
  skill_id: string
  actual_level: number | null
  is_extra: boolean
  due_date: string | null
}

type PersonRoleJoin = {
  role_id: string
  roles: { id: string; name: string } | null
}

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
  person_roles: PersonRoleJoin[] | null
}

function rosterTeamName(teams: TeamEmbed): string {
  if (teams == null) return ''
  return Array.isArray(teams) ? (teams[0]?.name ?? '') : teams.name
}

type ProfileRow = { id: string; display_name: string | null; role: string }

type FormState = {
  display_name: string
  first_name: string
  last_name: string
  email: string
  phone: string
  user_id: string
  team_id: string
  role_ids: string[]
}

const emptyForm = (): FormState => ({
  display_name: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  user_id: '',
  team_id: '',
  role_ids: [],
})

function appAccessSuffix(role: string): string {
  if (role === 'admin') return ' · admin'
  if (role === 'assessor') return ' · assessor'
  if (role === 'operator' || role === 'user') return ' · operator'
  return ''
}

export function PeopleRoster() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [people, setPeople] = useState<PersonRow[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [dialogOpen, setDialogOpen] = useState(false)

  function fetchRosterData() {
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
          teams ( id, name ),
          person_roles ( role_id, roles ( id, name ) )
        `,
        )
        .order('display_name'),
      supabase.from('roles').select('id, name').order('sort_order', { ascending: true }),
      supabase.from('teams').select('id, name').order('sort_order', { ascending: true }),
      supabase.from('profiles').select('id, display_name, role').order('display_name', { ascending: true }),
    ])
  }

  function applyRosterQuad(
    pRes: Awaited<ReturnType<typeof fetchRosterData>>[0],
    rRes: Awaited<ReturnType<typeof fetchRosterData>>[1],
    tRes: Awaited<ReturnType<typeof fetchRosterData>>[2],
    prRes: Awaited<ReturnType<typeof fetchRosterData>>[3],
  ) {
    if (pRes.error) {
      setError(pRes.error.message)
      setPeople([])
    } else {
      setPeople((pRes.data ?? []) as unknown as PersonRow[])
    }
    if (rRes.error) setRoles([])
    else setRoles((rRes.data ?? []) as RoleRow[])
    if (tRes.error) setTeams([])
    else setTeams((tRes.data ?? []) as TeamRow[])
    if (prRes.error) setProfiles([])
    else setProfiles((prRes.data ?? []) as ProfileRow[])
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    void fetchRosterData().then(([pRes, rRes, tRes, prRes]) => {
      if (cancelled) return
      applyRosterQuad(pRes, rRes, tRes, prRes)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only fetch; applyRoster only wraps stable setters
  }, [])

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
      display_name: row.display_name,
      first_name: row.first_name?.trim() ?? '',
      last_name: row.last_name?.trim() ?? '',
      email: row.email?.trim() ?? '',
      phone: row.phone?.trim() ?? '',
      user_id: row.user_id ?? '',
      team_id: row.team_id ?? '',
      role_ids: (row.person_roles ?? []).map((x) => x.role_id),
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

  async function seedRequiredSkillsForPerson(personId: string, roleIds: string[]) {
    if (roleIds.length === 0) return

    const [reqRes, skillRes, psRes] = await Promise.all([
      supabase.from('role_skill_requirements').select('role_id, skill_id, required_level').in('role_id', roleIds),
      supabase.from('skills').select('id, kind'),
      supabase.from('person_skills').select('person_id, skill_id, actual_level, is_extra, due_date').eq('person_id', personId),
    ])

    if (reqRes.error) throw reqRes.error
    if (skillRes.error) throw skillRes.error
    if (psRes.error) throw psRes.error

    const requiredBySkill = new Map<string, number>()
    for (const row of (reqRes.data ?? []) as RequirementRow[]) {
      const current = requiredBySkill.get(row.skill_id)
      requiredBySkill.set(row.skill_id, current == null ? row.required_level : Math.max(current, row.required_level))
    }
    if (requiredBySkill.size === 0) return

    const kindBySkill = new Map<string, SkillKind>()
    for (const row of (skillRes.data ?? []) as SkillKindRow[]) kindBySkill.set(row.id, row.kind)

    const existingBySkill = new Map<string, PersonSkillRow>()
    for (const row of (psRes.data ?? []) as PersonSkillRow[]) existingBySkill.set(row.skill_id, row)

    const targetDate = localYMD(addMonths(startOfDay(new Date()), 3))
    const payload = [...requiredBySkill.entries()].map(([skillId, required]) => {
      const existing = existingBySkill.get(skillId)
      const kind = kindBySkill.get(skillId) ?? 'numeric'
      const actual = existing?.actual_level ?? 1
      const gap = classifyCell({
        kind,
        required,
        actual,
        isExtra: false,
      })
      return {
        person_id: personId,
        skill_id: skillId,
        actual_level: actual,
        is_extra: false,
        due_date: existing?.due_date?.trim() || (gap === 'critical' || gap === 'minor' ? targetDate : null),
      }
    })

    const { error } = await supabase.from('person_skills').upsert(payload, {
      onConflict: 'person_id,skill_id',
    })
    if (error) throw error
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const name = form.display_name.trim()
    if (!name) {
      setError('Display name is required.')
      return
    }

    setSaving(true)
    setError(null)

    const uid = form.user_id.trim() || null
    const tid = form.team_id.trim() || null
    const contact = {
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    }

    try {
      if (editingId) {
        const { error: uErr } = await supabase
          .from('people')
          .update({ display_name: name, user_id: uid, team_id: tid, ...contact })
          .eq('id', editingId)
        if (uErr) throw uErr

        const { error: dErr } = await supabase.from('person_roles').delete().eq('person_id', editingId)
        if (dErr) throw dErr

        if (form.role_ids.length > 0) {
          const { error: iErr } = await supabase.from('person_roles').insert(
            form.role_ids.map((role_id) => ({ person_id: editingId, role_id })),
          )
          if (iErr) throw iErr
          await seedRequiredSkillsForPerson(editingId, form.role_ids)
        }
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from('people')
          .insert({ display_name: name, user_id: uid, team_id: tid, ...contact })
          .select('id')
          .single()
        if (insErr) throw insErr
        const pid = inserted.id as string
        if (form.role_ids.length > 0) {
          const { error: rErr } = await supabase.from('person_roles').insert(
            form.role_ids.map((role_id) => ({ person_id: pid, role_id })),
          )
          if (rErr) throw rErr
          await seedRequiredSkillsForPerson(pid, form.role_ids)
        }
      }

      closeDialog()
      const quad = await fetchRosterData()
      applyRosterQuad(quad[0], quad[1], quad[2], quad[3])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!window.confirm(`Remove ${label} from the roster? This deletes their role links and skill rows.`)) return
    setError(null)
    const { error: delErr } = await supabase.from('people').delete().eq('id', id)
    if (delErr) {
      setError(delErr.message)
      return
    }
    void fetchRosterData().then(([pRes, rRes, tRes, prRes]) => applyRosterQuad(pRes, rRes, tRes, prRes))
  }

  function profileLabel(userId: string | null) {
    if (!userId) return '—'
    const pr = profiles.find((p) => p.id === userId)
    return pr?.display_name?.trim() || pr?.id.slice(0, 8) + '…'
  }

  function toggleRole(id: string) {
    setForm((f) => ({
      ...f,
      role_ids: f.role_ids.includes(id) ? f.role_ids.filter((x) => x !== id) : [...f.role_ids, id],
    }))
  }

  return (
    <section className="rounded-2xl border border-border bg-surface-raised/40 backdrop-blur-sm">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-accent" aria-hidden />
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">People</h2>
            <p className="text-xs text-muted">
              Roster for the matrix — contact fields sync with{' '}
              <span className="text-fg/80">Master data → People</span>. Link login and assign job roles here.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          <Plus className="size-4" aria-hidden />
          Add person
        </button>
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
          <p className="px-4 py-10 text-center text-sm text-muted">No people yet. Add your first roster row.</p>
        ) : (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Login link</th>
                <th className="px-4 py-3">Job roles</th>
                <th className="w-28 px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {people.map((row) => (
                <tr key={row.id} className="hover:bg-black/[0.04]">
                  <td className="px-4 py-3 font-medium text-fg">{row.display_name}</td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {[row.first_name, row.last_name].filter(Boolean).join(' ') || '—'}
                    {row.email ? (
                      <>
                        <br />
                        <span className="text-fg/70">{row.email}</span>
                      </>
                    ) : null}
                    {row.phone ? (
                      <>
                        <br />
                        {row.phone}
                      </>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted">{rosterTeamName(row.teams) || '—'}</td>
                  <td className="px-4 py-3 text-muted">{profileLabel(row.user_id)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(row.person_roles ?? []).map((pr) => (
                        <span
                          key={pr.role_id}
                          className="rounded-lg bg-accent-dim px-2 py-0.5 text-xs font-medium text-accent"
                        >
                          {pr.roles?.name ?? pr.role_id.slice(0, 6)}
                        </span>
                      ))}
                      {(row.person_roles ?? []).length === 0 ? (
                        <span className="text-xs text-muted">None</span>
                      ) : null}
                    </div>
                  </td>
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

      <dialog
        ref={dialogRef}
        className="w-[min(100%,28rem)] rounded-2xl border border-border bg-surface-raised p-0 text-fg shadow-glow backdrop:bg-black/30"
        onClose={() => {
          setDialogOpen(false)
          setEditingId(null)
          setForm(emptyForm())
        }}
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="p-6">
          <h3 className="font-display text-lg font-semibold">{editingId ? 'Edit person' : 'Add person'}</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="roster-name" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Display name
              </label>
              <input
                id="roster-name"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                className="w-full rounded-xl border border-border bg-canvas/60 px-3 py-2.5 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2"
                placeholder="e.g. Alex Morgan"
                autoComplete="off"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="roster-fn" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                  First name
                </label>
                <input
                  id="roster-fn"
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-canvas/60 px-3 py-2.5 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2"
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label htmlFor="roster-ln" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                  Last name
                </label>
                <input
                  id="roster-ln"
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-canvas/60 px-3 py-2.5 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2"
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="roster-email" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                  Email
                </label>
                <input
                  id="roster-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-canvas/60 px-3 py-2.5 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2"
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="roster-phone" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                  Phone
                </label>
                <input
                  id="roster-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-canvas/60 px-3 py-2.5 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2"
                  autoComplete="tel"
                />
              </div>
            </div>
            <div>
              <label htmlFor="roster-link" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Link to login account
              </label>
              <select
                id="roster-link"
                value={form.user_id}
                onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
                className="w-full rounded-xl border border-border bg-canvas/60 px-3 py-2.5 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2"
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
            <div>
              <label htmlFor="roster-team" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Team
              </label>
              <select
                id="roster-team"
                value={form.team_id}
                onChange={(e) => setForm((f) => ({ ...f, team_id: e.target.value }))}
                className="w-full rounded-xl border border-border bg-canvas/60 px-3 py-2.5 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2"
              >
                <option value="">No team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Job roles</p>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-border bg-canvas/40 p-3">
                {roles.length === 0 ? (
                  <p className="text-xs text-muted">No roles in database.</p>
                ) : (
                  roles.map((r) => (
                    <label key={r.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.role_ids.includes(r.id)}
                        onChange={() => toggleRole(r.id)}
                        className="size-4 rounded border-border text-accent focus:ring-accent"
                      />
                      {r.name}
                    </label>
                  ))
                )}
              </div>
            </div>
            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
          </div>
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
    </section>
  )
}
