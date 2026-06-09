import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PostgrestError, Session, User } from '@supabase/supabase-js'
import { AuthContext, type AppProfileRole, type BmsBrainRoleLevel } from './auth-context'
import { supabase, supabaseConfigured } from '../lib/supabase'

const PROFILE_SECTION_SELECT =
  'role, can_access_skill_matrix, can_access_ldr_tools, can_access_rtt_systems, can_access_agents, can_access_dds_process, can_access_problem_solve, can_access_bms_brain, bms_brain_role' as const

type ProfileSectionRow = {
  role: string | null
  can_access_skill_matrix: boolean | null
  can_access_ldr_tools: boolean | null
  can_access_rtt_systems: boolean | null
  can_access_agents: boolean | null
  can_access_dds_process: boolean | null
  can_access_problem_solve: boolean | null
  can_access_bms_brain: boolean | null
  bms_brain_role: string | null
}

function normalizeBmsBrainRole(raw: string | null | undefined): BmsBrainRoleLevel {
  if (raw === 'editor' || raw === 'admin') return raw
  return 'viewer'
}

function normalizeProfileRole(raw: string | undefined | null): AppProfileRole {
  if (raw === 'super_admin' || raw === 'admin' || raw === 'assessor' || raw === 'operator') return raw
  if (raw === 'user') return 'operator'
  return 'operator'
}

/** PostgREST / Postgres when `can_access_*` columns are not migrated yet. */
function isMissingSectionColumnsError(error: PostgrestError | null): boolean {
  if (!error) return false
  const code = String((error as { code?: string }).code ?? '')
  if (code === '42703') return true
  const m = error.message.toLowerCase()
  return m.includes('column') && m.includes('does not exist')
}

/** Same rules as migration backfill when section flags are unavailable. */
function inferSectionFlagsFromRole(role: AppProfileRole): {
  matrix: boolean
  ldr: boolean
  rtt: boolean
  agents: boolean
  ddsProcess: boolean
  problemSolve: boolean
} {
  const isAdm = role === 'admin' || role === 'super_admin'
  return {
    matrix: isAdm || role === 'assessor' || role === 'operator',
    ldr: isAdm,
    rtt: isAdm,
    agents: isAdm,
    ddsProcess: role === 'super_admin',
    problemSolve: role === 'super_admin',
  }
}

/** Recover profile when newer `can_access_*` columns are not migrated yet. */
function isMissingProfilesColumn(error: PostgrestError | null, column: string): boolean {
  if (!error) return false
  const m = error.message.toLowerCase()
  const c = column.toLowerCase()
  if (!m.includes(c)) return false
  return String(error.code ?? '') === '42703' || m.includes('does not exist')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [profileRole, setProfileRole] = useState<AppProfileRole | null>(null)
  const [canAccessSkillMatrix, setCanAccessSkillMatrix] = useState(false)
  const [canAccessLdrTools, setCanAccessLdrTools] = useState(false)
  const [canAccessRttSystems, setCanAccessRttSystems] = useState(false)
  const [canAccessAgents, setCanAccessAgents] = useState(false)
  const [canAccessDdsProcess, setCanAccessDdsProcess] = useState(false)
  const [canAccessProblemSolve, setCanAccessProblemSolve] = useState(false)
  const [canAccessBmsBrain, setCanAccessBmsBrain] = useState(false)
  const [bmsBrainRole, setBmsBrainRole] = useState<BmsBrainRoleLevel>('viewer')
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null)

  const applyProfileRow = useCallback((data: ProfileSectionRow) => {
    const role = normalizeProfileRole(data.role)
    const isAdm = role === 'admin' || role === 'super_admin'
    setProfileRole(role)
    setCanAccessSkillMatrix(Boolean(data.can_access_skill_matrix))
    setCanAccessLdrTools(Boolean(data.can_access_ldr_tools))
    setCanAccessRttSystems(Boolean(data.can_access_rtt_systems))
    setCanAccessAgents(Boolean(data.can_access_agents))
    setCanAccessDdsProcess(Boolean(data.can_access_dds_process))
    setCanAccessProblemSolve(Boolean(data.can_access_problem_solve))
    setCanAccessBmsBrain(Boolean(data.can_access_bms_brain) || isAdm)
    setBmsBrainRole(isAdm ? normalizeBmsBrainRole(data.bms_brain_role ?? 'admin') : normalizeBmsBrainRole(data.bms_brain_role))
    setProfileLoadError(null)
  }, [])

  const applyOperatorFallback = useCallback((errorMessage: string | null) => {
    setProfileRole('operator')
    setCanAccessSkillMatrix(false)
    setCanAccessLdrTools(false)
    setCanAccessRttSystems(false)
    setCanAccessAgents(false)
    setCanAccessDdsProcess(false)
    setCanAccessProblemSolve(false)
    setCanAccessBmsBrain(false)
    setBmsBrainRole('viewer')
    setProfileLoadError(errorMessage)
  }, [])

  const loadProfileForUser = useCallback(
    async (userId: string, cancelled: () => boolean) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(PROFILE_SECTION_SELECT)
          .eq('id', userId)
          .maybeSingle()

        if (cancelled()) return

        if (!error && data) {
          applyProfileRow(data as ProfileSectionRow)
          return
        }

        if (error && isMissingProfilesColumn(error, 'can_access_bms_brain')) {
          const { data: rowNoBms, error: errNoBms } = await supabase
            .from('profiles')
            .select(
              'role, can_access_skill_matrix, can_access_ldr_tools, can_access_rtt_systems, can_access_agents, can_access_dds_process, can_access_problem_solve',
            )
            .eq('id', userId)
            .maybeSingle()
          if (cancelled()) return
          if (!errNoBms && rowNoBms) {
            applyProfileRow({
              ...(rowNoBms as Omit<ProfileSectionRow, 'can_access_bms_brain' | 'bms_brain_role'>),
              can_access_bms_brain: false,
              bms_brain_role: 'viewer',
            })
            return
          }
        }

        if (error && isMissingProfilesColumn(error, 'can_access_problem_solve')) {
          const { data: rowNoPs, error: errNoPs } = await supabase
            .from('profiles')
            .select(
              'role, can_access_skill_matrix, can_access_ldr_tools, can_access_rtt_systems, can_access_agents, can_access_dds_process',
            )
            .eq('id', userId)
            .maybeSingle()
          if (cancelled()) return
          if (!errNoPs && rowNoPs) {
            applyProfileRow({
              ...(rowNoPs as Omit<ProfileSectionRow, 'can_access_problem_solve'>),
              can_access_problem_solve: false,
            })
            return
          }
          if (errNoPs && isMissingProfilesColumn(errNoPs, 'can_access_dds_process')) {
            const { data: rowNoDds, error: errNoDds } = await supabase
              .from('profiles')
              .select(
                'role, can_access_skill_matrix, can_access_ldr_tools, can_access_rtt_systems, can_access_agents',
              )
              .eq('id', userId)
              .maybeSingle()
            if (cancelled()) return
            if (!errNoDds && rowNoDds) {
              applyProfileRow({
                ...(rowNoDds as Omit<
                  ProfileSectionRow,
                  'can_access_dds_process' | 'can_access_problem_solve'
                >),
                can_access_dds_process: false,
                can_access_problem_solve: false,
              })
              return
            }
            if (errNoDds && isMissingProfilesColumn(errNoDds, 'can_access_agents')) {
              const { data: rowCore, error: errCore } = await supabase
                .from('profiles')
                .select('role, can_access_skill_matrix, can_access_ldr_tools, can_access_rtt_systems')
                .eq('id', userId)
                .maybeSingle()
              if (cancelled()) return
              if (!errCore && rowCore) {
                applyProfileRow({
                  ...(rowCore as Omit<
                    ProfileSectionRow,
                    'can_access_agents' | 'can_access_dds_process' | 'can_access_problem_solve'
                  >),
                  can_access_agents: false,
                  can_access_dds_process: false,
                  can_access_problem_solve: false,
                })
                return
              }
            }
          }
        }

        if (error && isMissingProfilesColumn(error, 'can_access_dds_process')) {
          const { data: rowNoDds, error: errNoDds } = await supabase
            .from('profiles')
            .select(
              'role, can_access_skill_matrix, can_access_ldr_tools, can_access_rtt_systems, can_access_agents, can_access_problem_solve',
            )
            .eq('id', userId)
            .maybeSingle()
          if (cancelled()) return
          if (!errNoDds && rowNoDds) {
            applyProfileRow({
              ...(rowNoDds as Omit<ProfileSectionRow, 'can_access_dds_process'>),
              can_access_dds_process: false,
            })
            return
          }
          if (errNoDds && isMissingProfilesColumn(errNoDds, 'can_access_agents')) {
            const { data: rowCore, error: errCore } = await supabase
              .from('profiles')
              .select('role, can_access_skill_matrix, can_access_ldr_tools, can_access_rtt_systems')
              .eq('id', userId)
              .maybeSingle()
            if (cancelled()) return
            if (!errCore && rowCore) {
              applyProfileRow({
                ...(rowCore as Omit<
                  ProfileSectionRow,
                  'can_access_agents' | 'can_access_dds_process' | 'can_access_problem_solve'
                >),
                can_access_agents: false,
                can_access_dds_process: false,
                can_access_problem_solve: false,
              })
              return
            }
          }
        }

        if (error && isMissingProfilesColumn(error, 'can_access_agents')) {
          const { data: rowCore, error: errCore } = await supabase
            .from('profiles')
            .select('role, can_access_skill_matrix, can_access_ldr_tools, can_access_rtt_systems')
            .eq('id', userId)
            .maybeSingle()
          if (cancelled()) return
          if (!errCore && rowCore) {
            applyProfileRow({
              ...(rowCore as Omit<
                ProfileSectionRow,
                'can_access_agents' | 'can_access_dds_process' | 'can_access_problem_solve'
              >),
              can_access_agents: false,
              can_access_dds_process: false,
              can_access_problem_solve: false,
            })
            return
          }
        }

        if (error && isMissingSectionColumnsError(error)) {
          const { data: legacy, error: legacyErr } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle()
          if (cancelled()) return
          if (legacyErr || !legacy) {
            console.warn('[profiles] legacy role fetch', legacyErr?.message)
            applyOperatorFallback(legacyErr?.message ?? 'Could not load your profile.')
            return
          }
          const role = normalizeProfileRole(legacy.role)
          const inferred = inferSectionFlagsFromRole(role)
          setProfileRole(role)
          setCanAccessSkillMatrix(inferred.matrix)
          setCanAccessLdrTools(inferred.ldr)
          setCanAccessRttSystems(inferred.rtt)
          setCanAccessAgents(inferred.agents)
          setCanAccessDdsProcess(inferred.ddsProcess)
          setCanAccessProblemSolve(inferred.problemSolve)
          setCanAccessBmsBrain(role === 'admin' || role === 'super_admin')
          setBmsBrainRole(role === 'admin' || role === 'super_admin' ? 'admin' : 'viewer')
          setProfileLoadError(null)
          return
        }

        if (error) {
          console.warn('[profiles]', error.message)
          applyOperatorFallback(error.message)
          return
        }

        applyOperatorFallback('No profile row found for this account.')
      } catch (e) {
        if (cancelled()) return
        const msg = e instanceof Error ? e.message : 'Network error'
        console.warn('[profiles]', msg)
        applyOperatorFallback(msg)
      }
    },
    [applyOperatorFallback, applyProfileRow],
  )

  useEffect(() => {
    if (!supabaseConfigured) {
      return
    }

    const init = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextUser = nextSession?.user ?? null
      setSession(nextSession)
      setUser(nextUser)
      setLoading(false)
      if (!nextUser) {
        setProfileRole(null)
        setCanAccessSkillMatrix(false)
        setCanAccessLdrTools(false)
        setCanAccessRttSystems(false)
        setCanAccessAgents(false)
        setCanAccessDdsProcess(false)
        setCanAccessProblemSolve(false)
        setCanAccessBmsBrain(false)
        setBmsBrainRole('viewer')
        setProfileLoadError(null)
      }
    })

    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      const nextUser = s?.user ?? null
      setSession(s)
      setUser(nextUser)
      setLoading(false)
      if (!nextUser) {
        setProfileRole(null)
        setCanAccessSkillMatrix(false)
        setCanAccessLdrTools(false)
        setCanAccessRttSystems(false)
        setCanAccessAgents(false)
        setCanAccessDdsProcess(false)
        setCanAccessProblemSolve(false)
        setCanAccessBmsBrain(false)
        setBmsBrainRole('viewer')
        setProfileLoadError(null)
      }
    })

    return () => init.data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabaseConfigured || !user) {
      return
    }

    let cancelled = false
    const isCancelled = () => cancelled
     
    void loadProfileForUser(user.id, isCancelled)

    return () => {
      cancelled = true
    }
  }, [user, loadProfileForUser])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase is not configured') }
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? new Error(error.message) : null }
  }, [])

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      if (!supabaseConfigured) {
        return { error: new Error('Supabase is not configured') }
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
        },
      })
      return { error: error ? new Error(error.message) : null }
    },
    [],
  )

  const signOut = useCallback(async () => {
    if (!supabaseConfigured) return
    await supabase.auth.signOut()
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!supabaseConfigured) return
    const { data: sessionData } = await supabase.auth.getSession()
    const uid = sessionData.session?.user?.id
    if (!uid) return
    await loadProfileForUser(uid, () => false)
  }, [loadProfileForUser])

  const isSuperAdmin = profileRole === 'super_admin'
  const isAdmin = profileRole === 'admin' || profileRole === 'super_admin'
  const isAssessor = profileRole === 'assessor'
  const isOperator = profileRole === 'operator'
  const profileReady = user == null || profileRole != null
  const adminLoading = Boolean(user) && profileRole === null

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      profileRole,
      isAdmin,
      isSuperAdmin,
      isAssessor,
      isOperator,
      canAccessSkillMatrix,
      canAccessLdrTools,
      canAccessRttSystems,
      canAccessAgents,
      canAccessDdsProcess,
      canAccessProblemSolve,
      canAccessBmsBrain,
      bmsBrainRole,
      profileReady,
      adminLoading,
      profileLoadError,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [
      user,
      session,
      loading,
      profileRole,
      isAdmin,
      isSuperAdmin,
      isAssessor,
      isOperator,
      canAccessSkillMatrix,
      canAccessLdrTools,
      canAccessRttSystems,
      canAccessAgents,
      canAccessDdsProcess,
      canAccessProblemSolve,
      canAccessBmsBrain,
      bmsBrainRole,
      profileReady,
      adminLoading,
      profileLoadError,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
