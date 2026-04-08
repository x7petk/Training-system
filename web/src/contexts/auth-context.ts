import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

/** Login account role (profiles.role). Job roles on people are separate. */
export type AppProfileRole = 'super_admin' | 'admin' | 'assessor' | 'operator'

export type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  profileRole: AppProfileRole | null
  /** Admin or super_admin (Skill Matrix admin UI, login accounts, RLS-aligned). */
  isAdmin: boolean
  isSuperAdmin: boolean
  isAssessor: boolean
  isOperator: boolean
  canAccessSkillMatrix: boolean
  canAccessLdrTools: boolean
  canAccessRttSystems: boolean
  /** False while logged in but `profiles.role` has not been loaded yet (avoids wrong redirects on refresh). */
  profileReady: boolean
  adminLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  /** Re-read profiles row for the signed-in user (e.g. after super admin changes own section access). */
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
