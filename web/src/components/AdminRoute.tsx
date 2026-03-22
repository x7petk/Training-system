import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin, adminLoading } = useAuth()

  if (adminLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden />
        <span className="sr-only">Checking permissions</span>
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
