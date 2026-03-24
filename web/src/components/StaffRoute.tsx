import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/** Same access as matrix: operators redirect to My skills. */
export function StaffRoute({ children }: { children: ReactNode }) {
  const { isOperator, adminLoading } = useAuth()

  if (adminLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  if (isOperator) {
    return <Navigate to="/my-skills" replace />
  }

  return <>{children}</>
}
