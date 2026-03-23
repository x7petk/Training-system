import { useCallback, useEffect, useState } from 'react'
import { UserCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { AppProfileRole } from '../../contexts/auth-context'

type ProfileRow = { id: string; display_name: string | null; role: string }

const ROLE_OPTIONS: { value: AppProfileRole; label: string }[] = [
  { value: 'operator', label: 'Operator (read-only)' },
  { value: 'assessor', label: 'Assessor (edit scores)' },
  { value: 'admin', label: 'Admin (full)' },
]

function roleBadgeClass(role: string): string {
  if (role === 'admin') return 'rounded-lg bg-accent-dim px-2 py-0.5 text-xs font-medium text-accent'
  if (role === 'assessor') return 'rounded-lg bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900'
  return 'rounded-lg bg-zinc-100 px-2 py-0.5 text-xs text-muted'
}

export function AccountsSummary() {
  const { user } = useAuth()
  const [rows, setRows] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    return supabase
      .from('profiles')
      .select('id, display_name, role')
      .order('display_name', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setRows(data as ProfileRow[])
        return error
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
            Set <strong className="text-fg/90">app access</strong>: operator (My skills read-only), assessor (matrix
            scoring), admin (includes this page). Separate from job roles on people.
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
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Display name</th>
                <th className="px-4 py-3">App access</th>
                <th className="px-4 py-3 font-mono text-[11px]">User id</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-black/[0.04]">
                  <td className="px-4 py-3 font-medium text-fg">{r.display_name?.trim() || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <span className={roleBadgeClass(r.role)}>{r.role}</span>
                      <select
                        aria-label={`App role for ${r.display_name ?? r.id}`}
                        disabled={savingId === r.id}
                        value={ROLE_OPTIONS.some((o) => o.value === r.role) ? r.role : 'operator'}
                        onChange={(e) => void setAccountRole(r.id, e.target.value as AppProfileRole)}
                        className="max-w-[14rem] rounded-lg border border-border bg-canvas px-2 py-1.5 text-xs outline-none ring-accent/30 focus:border-accent/50 focus:ring-2 disabled:opacity-50"
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {r.id === user?.id ? (
                        <span className="text-[11px] text-muted">You</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted">{r.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
