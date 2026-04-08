import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PostgrestError, Session, User } from '@supabase/supabase-js'
import { AuthContext, type AppProfileRole } from './auth-context'
import { supabase, supabaseConfigured } from '../lib/supabase'

const PROFILE_SECTION_SELECT =
  'role, can_access_skill_matrix, can_access_ldr_tools, can_access_rtt_systems' as const

type ProfileSectionRow = {
  role: string | null
  can_access_skill_matrix: boolean | null
  can_access_ldr_tools: boolean | null
  can_access_rtt_systems: boolean | null
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
} {
  const isAdm = role === 'admin' || role === 'super_admin'
  return {
    matrix: isAdm || role === 'assessor' || role === 'operator',
    ldr: isAdm,
    rtt: isAdm,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [profileRole, setProfileRole] = useState<AppProfileRole | null>(null)
  const [canAccessSkillMatrix, setCanAccessSkillMatrix] = useState(false)
  const [canAccessLdrTools, setCanAccessLdrTools] = useState(false)
  const [canAccessRttSystems, setCanAccessRttSystems] = useState(false)
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null)

  const applyProfileRow = useCallback((data: ProfileSectionRow) => {
    setProfileRole(normalizeProfileRole(data.role))
    setCanAccessSkillMatrix(Boolean(data.can_access_skill_matrix))
    setCanAccessLdrTools(Boolean(data.can_access_ldr_tools))
    setCanAccessRttSystems(Boolean(data.can_access_rtt_systems))
    setProfileLoadError(null)
  }, [])

  const applyOperatorFallback = useCallback((errorMessage: string | null) => {
    setProfileRole('operator')
    setCanAccessSkillMatrix(false)
    setCanAccessLdrTools(false)
    setCanAccessRttSystems(false)
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
