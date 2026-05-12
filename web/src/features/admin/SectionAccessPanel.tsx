import { useCallback, useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

type AccessRow = {
  id: string
  display_name: string | null
  role: string
  can_access_skill_matrix: boolean
  can_access_ldr_tools: boolean
  can_access_rtt_systems: boolean
  can_access_agents: boolean
}

function isMissingAgentsColumnError(message: string, code?: string): boolean {
  if (String(code ?? '') === '42703') return true
  const m = message.toLowerCase()
  return m.includes('can_access_agents') && m.includes('does not exist')
}

export function SectionAccessPanel() {
  const { user, refreshProfile } = useAuth()
  const [rows, setRows] = useState<AccessRow[]>([])
  const [agentsColumnAvailable, setAgentsColumnAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const withAgents = await supabase
      .from('profiles')
      .select(
        'id, display_name, role, can_access_skill_matrix, can_access_ldr_tools, can_access_rtt_systems, can_access_agents',
      )
      .order('display_name', { ascending: true })

    if (!withAgents.error && withAgents.data) {
      setAgentsColumnAvailable(true)
      setRows(withAgents.data as AccessRow[])
      setError(null)
      return null
    }

    const primaryErr = withAgents.error
    if (!primaryErr || !isMissingAgentsColumnError(primaryErr.message, primaryErr.code)) {
      return primaryErr
    }

    const legacy = await supabase
      .from('profiles')
      .select('id, display_name, role, can_access_skill_matrix, can_access_ldr_tools, can_access_rtt_systems')
      .order('display_name', { ascending: true })

    if (legacy.error) return legacy.error

    setAgentsColumnAvailable(false)
    setRows(
      (legacy.data ?? []).map((row) => ({
        ...(row as Omit<AccessRow, 'can_access_agents'>),
        can_access_agents: false,
      })),
    )
    setError(
      'Agents access is unavailable until the latest database migration is applied (missing profiles.can_access_agents column).',
    )
    return null
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

  async function toggleField(
    profileId: string,
    field:
      | 'can_access_skill_matrix'
      | 'can_access_ldr_tools'
      | 'can_access_rtt_systems'
      | 'can_access_agents',
    next: boolean,
  ) {
    setError(null)
    setSavingId(profileId)
    const { error: upErr } = await supabase.from('profiles').update({ [field]: next }).eq('id', profileId)
    setSavingId(null)
    if (upErr) {
      setError(upErr.message)
      return
    }
    setRows((prev) =>
      prev.map((r) => (r.id === profileId ? { ...r, [field]: next } : r)),
    )
    if (profileId === user?.id) {
      await refreshProfile()
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface-raised/40 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <Shield className="size-5 text-violet-600 dark:text-violet-400" aria-hidden />
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Section access</h2>
          <p className="text-xs text-muted">
            Choose which hub areas each login can open. New accounts start with no sections until you enable them
            here.
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
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Display name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-center">Skill Matrix</th>
                <th className="px-4 py-3 text-center">LDR tools</th>
                <th className="px-4 py-3 text-center">RTT systems</th>
                {agentsColumnAvailable ? <th className="px-4 py-3 text-center">Agents</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-black/[0.04]">
                  <td className="px-4 py-3 font-medium text-fg">
                    {r.display_name?.trim() || '—'}
                    {r.id === user?.id ? (
                      <span className="ml-2 text-[11px] font-normal text-muted">You</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{r.role}</td>
                  {(
                    [
                      ['can_access_skill_matrix', r.can_access_skill_matrix],
                      ['can_access_ldr_tools', r.can_access_ldr_tools],
                      ['can_access_rtt_systems', r.can_access_rtt_systems],
                      ...(agentsColumnAvailable
                        ? ([['can_access_agents', r.can_access_agents]] as const)
                        : []),
                    ] as const
                  ).map(([field, checked]) => (
                    <td key={field} className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-border accent-violet-600"
                        checked={checked}
                        disabled={savingId === r.id}
                        aria-label={`${field} for ${r.display_name ?? r.id}`}
                        onChange={(e) => void toggleField(r.id, field, e.target.checked)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
