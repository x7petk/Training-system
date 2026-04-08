import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function SectionAccessRoute({
  section,
  children,
}: {
  section: 'ldr' | 'rtt'
  children?: ReactNode
}) {
  const { profileReady, canAccessLdrTools, canAccessRttSystems } = useAuth()

  if (!profileReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  const ok = section === 'ldr' ? canAccessLdrTools : canAccessRttSystems
  if (!ok) {
    return <Navigate to="/" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
