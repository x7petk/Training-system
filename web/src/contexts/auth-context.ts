import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

/** Login account role (profiles.role). Job roles on people are separate. */
export type AppProfileRole = 'super_admin' | 'admin' | 'assessor' | 'operator'

export type BmsBrainRoleLevel = 'viewer' | 'editor' | 'admin'

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
  canAccessAgents: boolean
  canAccessDdsProcess: boolean
  canAccessProblemSolve: boolean
  canAccessBmsBrain: boolean
  bmsBrainRole: BmsBrainRoleLevel
  /** False while logged in but `profiles.role` has not been loaded yet (avoids wrong redirects on refresh). */
  profileReady: boolean
  adminLoading: boolean
  /** Set when the profiles row could not be loaded (network, RLS, etc.). Empty after a successful load. */
  profileLoadError: string | null
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
