import type { BmsBrainRoleLevel } from '../../contexts/auth-context'

type AuthSlice = {
  isAdmin: boolean
  bmsBrainRole: BmsBrainRoleLevel
}

export function bmsBrainCanView(_auth: AuthSlice): boolean {
  return true
}

export function bmsBrainCanEdit(auth: AuthSlice): boolean {
  return auth.isAdmin || auth.bmsBrainRole === 'editor' || auth.bmsBrainRole === 'admin'
}

export function bmsBrainCanAdmin(auth: AuthSlice): boolean {
  return auth.isAdmin || auth.bmsBrainRole === 'admin'
}
