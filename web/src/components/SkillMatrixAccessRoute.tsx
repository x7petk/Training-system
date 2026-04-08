import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/** Requires hub flag can_access_skill_matrix (Skill Matrix shell + admin catalog). */
export function SkillMatrixAccessRoute({ children }: { children?: ReactNode }) {
  const { profileReady, canAccessSkillMatrix } = useAuth()

  if (!profileReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  if (!canAccessSkillMatrix) {
    return <Navigate to="/" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
