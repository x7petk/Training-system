import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { AuthContext, type AppProfileRole } from './auth-context'
import { supabase, supabaseConfigured } from '../lib/supabase'

function normalizeProfileRole(raw: string | undefined | null): AppProfileRole {
  if (raw === 'super_admin' || raw === 'admin' || raw === 'assessor' || raw === 'operator') return raw
  if (raw === 'user') return 'operator'
  return 'operator'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [profileRole, setProfileRole] = useState<AppProfileRole | null>(null)
  const [canAccessSkillMatrix, setCanAccessSkillMatrix] = useState(false)
  const [canAccessLdrTools, setCanAccessLdrTools] = useState(false)
  const [canAccessRttSystems, setCanAccessRttSystems] = useState(false)

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
      }
    })

    return () => init.data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabaseConfigured || !user) {
      return
    }

    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, can_access_skill_matrix, can_access_ldr_tools, can_access_rtt_systems')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        console.warn('[profiles]', error.message)
        setProfileRole('operator')
        setCanAccessSkillMatrix(false)
        setCanAccessLdrTools(false)
        setCanAccessRttSystems(false)
        return
      }
      if (!data) {
        setProfileRole('operator')
        setCanAccessSkillMatrix(false)
        setCanAccessLdrTools(false)
        setCanAccessRttSystems(false)
        return
      }
      setProfileRole(normalizeProfileRole(data.role))
      setCanAccessSkillMatrix(Boolean(data.can_access_skill_matrix))
      setCanAccessLdrTools(Boolean(data.can_access_ldr_tools))
      setCanAccessRttSystems(Boolean(data.can_access_rtt_systems))
    })()

    return () => {
      cancelled = true
    }
  }, [user, session])

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
    const { data, error } = await supabase
      .from('profiles')
      .select('role, can_access_skill_matrix, can_access_ldr_tools, can_access_rtt_systems')
      .eq('id', uid)
      .maybeSingle()
    if (error) {
      console.warn('[profiles refresh]', error.message)
      return
    }
    if (!data) {
      setProfileRole('operator')
      setCanAccessSkillMatrix(false)
      setCanAccessLdrTools(false)
      setCanAccessRttSystems(false)
      return
    }
    setProfileRole(normalizeProfileRole(data.role))
    setCanAccessSkillMatrix(Boolean(data.can_access_skill_matrix))
    setCanAccessLdrTools(Boolean(data.can_access_ldr_tools))
    setCanAccessRttSystems(Boolean(data.can_access_rtt_systems))
  }, [])

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
      signIn,
      signUp,
      signOut,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
