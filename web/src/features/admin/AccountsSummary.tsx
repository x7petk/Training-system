import { useEffect, useState } from 'react'
import { UserCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type ProfileRow = { id: string; display_name: string | null; role: string }

export function AccountsSummary() {
  const [rows, setRows] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('profiles')
      .select('id, display_name, role')
      .order('display_name', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error && data) setRows(data as ProfileRow[])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="rounded-2xl border border-border bg-surface-raised/40 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <UserCircle className="size-5 text-accent" aria-hidden />
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Login accounts</h2>
          <p className="text-xs text-muted">
            Profiles from Supabase Auth. App <strong>admin</strong> is separate from job roles on people.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No profiles yet.</p>
        ) : (
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Display name</th>
                <th className="px-4 py-3">App access</th>
                <th className="px-4 py-3 font-mono text-[11px]">User id</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium text-fg">{r.display_name?.trim() || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        r.role === 'admin'
                          ? 'rounded-lg bg-accent-dim px-2 py-0.5 text-xs font-medium text-accent'
                          : 'rounded-lg bg-white/5 px-2 py-0.5 text-xs text-muted'
                      }
                    >
                      {r.role}
                    </span>
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
