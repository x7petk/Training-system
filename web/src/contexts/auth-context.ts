import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

/** Login account role (profiles.role). Job roles on people are separate. */
export type AppProfileRole = 'admin' | 'assessor' | 'operator'

export type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  profileRole: AppProfileRole | null
  isAdmin: boolean
  isAssessor: boolean
  isOperator: boolean
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
