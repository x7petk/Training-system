import { useCallback, useEffect, useState } from 'react'
import { UserCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { AppProfileRole } from '../../contexts/auth-context'

type ProfileRow = { id: string; display_name: string | null; role: string }

/** Roles assignable from this UI (never promote to super_admin here). */
const ASSIGNABLE_ROLES: { value: Exclude<AppProfileRole, 'super_admin'>; label: string }[] = [
  { value: 'operator', label: 'Operator (read-only)' },
  { value: 'assessor', label: 'Assessor (edit scores)' },
  { value: 'admin', label: 'Admin (full)' },
]

function roleDisplayLabel(role: string): string {
  if (role === 'super_admin') return 'Super admin'
  if (role === 'admin') return 'Admin'
  if (role === 'assessor') return 'Assessor'
  if (role === 'operator') return 'Operator'
  return role
}

function roleBadgeClass(role: string): string {
  if (role === 'super_admin')
    return 'rounded-lg border border-border-strong bg-violet-500/12 px-2.5 py-1 text-xs font-semibold text-fg'
  if (role === 'admin') return 'rounded-lg bg-accent-dim px-2 py-0.5 text-xs font-medium text-accent'
  if (role === 'assessor') return 'rounded-lg bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900'
  return 'rounded-lg bg-zinc-100 px-2 py-0.5 text-xs text-muted'
}

export function AccountsSummary() {
  const { user, isSuperAdmin } = useAuth()
  const [rows, setRows] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    return supabase
      .from('profiles')
      .select('id, display_name, role')
      .order('display_name', { ascending: true })
      .then(({ data, error: err }) => {
        if (!err && data) setRows(data as ProfileRow[])
        return err
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    void load().then((loadErr) => {
      if (cancelled) return
      if (loadErr) setError(loadErr.message)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [load])

  async function setAccountRole(profileId: string, role: AppProfileRole) {
    setError(null)
    setSavingId(profileId)
    const { error: upErr } = await supabase.from('profiles').update({ role }).eq('id', profileId)
    setSavingId(null)
    if (upErr) {
      setError(upErr.message)
      return
    }
    setRows((prev) => prev.map((r) => (r.id === profileId ? { ...r, role } : r)))
  }

  return (
    <section className="rounded-2xl border border-border bg-surface-raised/40 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <UserCircle className="size-5 text-accent" aria-hidden />
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Login accounts</h2>
          <p className="text-xs text-muted">
            App roles: operator, assessor, admin. Which <strong className="text-fg/90">hub sections</strong> each login
            sees is managed on the <strong className="text-fg/90">Section access</strong> tab (super admin only). Job roles
            on people stay under Skill Matrix → Admin → People.
          </p>
        </div>
      </div>
      {error ? (
        <p className="border-b border-border px-4 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No profiles yet.</p>
        ) : (
          <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-sm">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[36%]" />
              <col className="w-[36%]" />
            </colgroup>
            <thead className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 align-bottom">Display name</th>
                <th className="px-4 py-3 align-bottom">App access</th>
                <th className="px-4 py-3 align-bottom text-right font-mono normal-case tracking-normal">
                  User id
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const isSuperRow = r.role === 'super_admin'
                const lockedForNonSuper = isSuperRow && !isSuperAdmin

                const selectClass =
                  'min-w-[12rem] max-w-full shrink-0 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-fg outline-none ring-accent/30 focus:border-accent/50 focus:ring-2 disabled:opacity-50'

                return (
                  <tr key={r.id} className="hover:bg-black/[0.04]">
                    <td className="align-middle px-4 py-3 font-medium text-fg">
                      <span className="line-clamp-2 break-words">{r.display_name?.trim() || '—'}</span>
                    </td>
                    <td className="align-middle px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className={roleBadgeClass(r.role)}>{roleDisplayLabel(r.role)}</span>
                        {lockedForNonSuper ? (
                          <span className="text-[11px] font-medium text-fg/80">Managed by super admin</span>
                        ) : isSuperRow && isSuperAdmin ? (
                          <select
                            aria-label={`App role for ${r.display_name ?? r.id}`}
                            disabled={savingId === r.id}
                            value="super_admin"
                            onChange={(e) => void setAccountRole(r.id, e.target.value as AppProfileRole)}
                            className={selectClass}
                          >
                            <option value="super_admin">Super admin</option>
                            {ASSIGNABLE_ROLES.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label} (demote)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            aria-label={`App role for ${r.display_name ?? r.id}`}
                            disabled={savingId === r.id}
                            value={
                              ASSIGNABLE_ROLES.some((o) => o.value === r.role) ? r.role : 'operator'
                            }
                            onChange={(e) =>
                              void setAccountRole(r.id, e.target.value as AppProfileRole)
                            }
                            className={selectClass}
                          >
                            {ASSIGNABLE_ROLES.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        )}
                        {r.id === user?.id ? (
                          <span className="text-[11px] font-medium text-fg/70">You</span>
                        ) : null}
                      </div>
                    </td>
                    <td
                      className="align-middle px-4 py-3 text-right font-mono text-[11px] leading-snug text-muted"
                      title={r.id}
                    >
                      <span className="inline-block w-full break-all">{r.id}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
