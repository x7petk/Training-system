import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { bmsBrainCanAdmin } from '../features/bmsBrain/bmsBrainAccess'

export function BmsBrainAdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin, profileReady, bmsBrainRole } = useAuth()

  if (!profileReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden />
      </div>
    )
  }

  if (!bmsBrainCanAdmin({ isAdmin, bmsBrainRole })) {
    return <Navigate to="/bms-brain/matrix" replace />
  }

  return <>{children}</>
}
