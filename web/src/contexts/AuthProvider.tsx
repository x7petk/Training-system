import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { AuthContext } from './auth-context'
import { supabase, supabaseConfigured } from '../lib/supabase'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(false)

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
        setIsAdmin(false)
        setAdminLoading(false)
      }
    })

    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      const nextUser = s?.user ?? null
      setSession(s)
      setUser(nextUser)
      setLoading(false)
      if (!nextUser) {
        setIsAdmin(false)
        setAdminLoading(false)
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
      setAdminLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        console.warn('[profiles]', error.message)
        setIsAdmin(false)
      } else {
        setIsAdmin(data?.role === 'admin')
      }
      setAdminLoading(false)
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

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      isAdmin,
      adminLoading,
      signIn,
      signUp,
      signOut,
    }),
    [user, session, loading, isAdmin, adminLoading, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
