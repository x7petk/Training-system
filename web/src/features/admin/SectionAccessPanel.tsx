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
  can_access_dds_process: boolean
  can_access_problem_solve: boolean
}

const SELECT_FULL =
  'id, display_name, role, can_access_skill_matrix, can_access_ldr_tools, can_access_rtt_systems, can_access_agents, can_access_dds_process, can_access_problem_solve' as const

const SELECT_NO_PS =
  'id, display_name, role, can_access_skill_matrix, can_access_ldr_tools, can_access_rtt_systems, can_access_agents, can_access_dds_process' as const

const SELECT_NO_DDS =
  'id, display_name, role, can_access_skill_matrix, can_access_ldr_tools, can_access_rtt_systems, can_access_agents, can_access_problem_solve' as const

const SELECT_NO_DDS_NO_PS =
  'id, display_name, role, can_access_skill_matrix, can_access_ldr_tools, can_access_rtt_systems, can_access_agents' as const

const SELECT_LEGACY = 'id, display_name, role, can_access_skill_matrix, can_access_ldr_tools, can_access_rtt_systems' as const

function isMissingColumnError(message: string, code: string | undefined, columnSnake: string): boolean {
  const m = message.toLowerCase()
  const c = columnSnake.toLowerCase()
  if (!m.includes(c)) return false
  return String(code ?? '') === '42703' || m.includes('does not exist')
}

export function SectionAccessPanel() {
  const { user, refreshProfile } = useAuth()
  const [rows, setRows] = useState<AccessRow[]>([])
  const [agentsColumnAvailable, setAgentsColumnAvailable] = useState(true)
  const [ddsColumnAvailable, setDdsColumnAvailable] = useState(true)
  const [problemSolveColumnAvailable, setProblemSolveColumnAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    let res = await supabase
      .from('profiles')
      .select(SELECT_FULL)
      .order('display_name', { ascending: true })

    if (!res.error && res.data) {
      setAgentsColumnAvailable(true)
      setDdsColumnAvailable(true)
      setProblemSolveColumnAvailable(true)
      setRows(res.data as AccessRow[])
      setError(null)
      return null
    }

    const primaryErr = res.error
    if (
      primaryErr &&
      isMissingColumnError(primaryErr.message, primaryErr.code, 'can_access_problem_solve')
    ) {
      const noPs = await supabase
        .from('profiles')
        .select(SELECT_NO_PS)
        .order('display_name', { ascending: true })
      if (!noPs.error && noPs.data) {
        setAgentsColumnAvailable(true)
        setDdsColumnAvailable(true)
        setProblemSolveColumnAvailable(false)
        setRows(
          (noPs.data as Omit<AccessRow, 'can_access_problem_solve'>[]).map((row) => ({
            ...row,
            can_access_problem_solve: false,
          })),
        )
        setError(
          'Problem Solve access is unavailable until the latest database migration is applied (missing profiles.can_access_problem_solve column).',
        )
        return null
      }
      res = noPs
    }

    if (res.error && isMissingColumnError(res.error.message, res.error.code, 'can_access_dds_process')) {
      const noDdsFirst = await supabase
        .from('profiles')
        .select(SELECT_NO_DDS)
        .order('display_name', { ascending: true })

      const noDds =
        noDdsFirst.error &&
        isMissingColumnError(noDdsFirst.error.message, noDdsFirst.error.code, 'can_access_problem_solve')
          ? await supabase
              .from('profiles')
              .select(SELECT_NO_DDS_NO_PS)
              .order('display_name', { ascending: true })
          : noDdsFirst

      if (!noDds.error && noDds.data) {
        setAgentsColumnAvailable(true)
        setDdsColumnAvailable(false)
        const hasPsCol =
          noDds.data.length > 0 && Object.prototype.hasOwnProperty.call(noDds.data[0], 'can_access_problem_solve')
        setProblemSolveColumnAvailable(hasPsCol)
        setRows(
          noDds.data.map((row) => ({
            ...(row as AccessRow),
            can_access_dds_process: false,
            can_access_problem_solve: hasPsCol ? Boolean((row as AccessRow).can_access_problem_solve) : false,
          })),
        )
        setError(
          'DDS Process access is unavailable until the latest database migration is applied (missing profiles.can_access_dds_process column).',
        )
        return null
      }
      res = noDds as typeof res
    }

    const errForAgents = res.error ?? primaryErr
    if (errForAgents && isMissingColumnError(errForAgents.message, errForAgents.code, 'can_access_agents')) {
      const legacy = await supabase
        .from('profiles')
        .select(SELECT_LEGACY)
        .order('display_name', { ascending: true })
      if (!legacy.error && legacy.data) {
        setAgentsColumnAvailable(false)
        setDdsColumnAvailable(false)
        setProblemSolveColumnAvailable(false)
        setRows(
          (legacy.data as Omit<
            AccessRow,
            'can_access_agents' | 'can_access_dds_process' | 'can_access_problem_solve'
          >[]).map((row) => ({
            ...row,
            can_access_agents: false,
            can_access_dds_process: false,
            can_access_problem_solve: false,
          })),
        )
        setError(
          'Agents, DDS Process, and Problem Solve access are unavailable until the latest database migrations are applied (missing column on profiles).',
        )
        return null
      }
      return legacy.error ?? errForAgents
    }

    return primaryErr
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
      | 'can_access_agents'
      | 'can_access_dds_process'
      | 'can_access_problem_solve',
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
    setRows((prev) => prev.map((r) => (r.id === profileId ? { ...r, [field]: next } : r)))
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
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Display name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-center">Skill Matrix</th>
                <th className="px-4 py-3 text-center">LDR tools</th>
                <th className="px-4 py-3 text-center">RTT systems</th>
                {agentsColumnAvailable ? <th className="px-4 py-3 text-center">Agents</th> : null}
                {ddsColumnAvailable ? <th className="px-4 py-3 text-center">DDS Process</th> : null}
                {problemSolveColumnAvailable ? (
                  <th className="px-4 py-3 text-center">Problem Solve</th>
                ) : null}
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
                      ...(agentsColumnAvailable ? ([['can_access_agents', r.can_access_agents]] as const) : []),
                      ...(ddsColumnAvailable
                        ? ([['can_access_dds_process', r.can_access_dds_process]] as const)
                        : []),
                      ...(problemSolveColumnAvailable
                        ? ([['can_access_problem_solve', r.can_access_problem_solve]] as const)
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
