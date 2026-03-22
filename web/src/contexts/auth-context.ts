import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  adminLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
