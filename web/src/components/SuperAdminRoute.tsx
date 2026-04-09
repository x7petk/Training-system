import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/** Only `super_admin` may access wrapped routes. */
export function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, profileReady } = useAuth()

  if (!profileReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />
  }

  return children
}
