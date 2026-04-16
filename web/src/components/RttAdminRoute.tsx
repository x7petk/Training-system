import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/** Admin or super_admin only (RTT in-module Admin link). */
export function RttAdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin, profileReady } = useAuth()

  if (!profileReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden />
        <span className="sr-only">Checking permissions</span>
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/rtt-systems/plan-24" replace />
  }

  return <>{children}</>
}
