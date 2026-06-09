import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function SectionAccessRoute({
  section,
  children,
}: {
  section: 'ldr' | 'rtt' | 'agents' | 'dds' | 'problem-solve' | 'bms-brain',
  children?: ReactNode
}) {
  const {
    profileReady,
    canAccessLdrTools,
    canAccessRttSystems,
    canAccessAgents,
    canAccessDdsProcess,
    canAccessProblemSolve,
    isAdmin,
    canAccessBmsBrain,
  } = useAuth()

  if (!profileReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  const ok =
    section === 'ldr'
      ? canAccessLdrTools
      : section === 'rtt'
        ? canAccessRttSystems
        : section === 'agents'
          ? canAccessAgents
          : section === 'dds'
            ? canAccessDdsProcess
            : section === 'bms-brain'
              ? canAccessBmsBrain || isAdmin
              : canAccessProblemSolve
  if (!ok) {
    return <Navigate to="/" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
