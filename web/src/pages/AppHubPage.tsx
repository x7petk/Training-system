import { Link, useNavigate } from 'react-router-dom'
import { Grid3X3, KeyRound, LogOut, Network, UsersRound } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const cardClass =
  'group flex min-h-[9rem] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-border bg-surface-raised/60 p-8 text-center shadow-sm transition-all hover:border-accent/40 hover:bg-accent-dim/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas sm:min-h-[11rem]'

export function AppHubPage() {
  const {
    signOut,
    user,
    isAdmin,
    canAccessSkillMatrix,
    canAccessLdrTools,
    canAccessRttSystems,
    profileLoadError,
  } = useAuth()
  const navigate = useNavigate()

  const anyApp =
    canAccessSkillMatrix || canAccessLdrTools || canAccessRttSystems || isAdmin

  return (
    <div className="relative flex min-h-svh flex-col justify-center space-y-8 px-4 py-10 md:py-12">
      <div className="absolute right-4 top-4 flex max-w-[min(100%,20rem)] items-center gap-3 md:right-8 md:top-6">
        <p className="hidden truncate text-xs text-muted sm:block" title={user?.email ?? undefined}>
          {user?.email}
        </p>
        <button
          type="button"
          onClick={() => {
            void signOut().then(() => navigate('/login'))
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs font-medium text-muted hover:bg-black/[0.04] hover:text-fg"
        >
          <LogOut className="size-3.5" aria-hidden />
          Sign out
        </button>
      </div>
      <header className="text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Choose an area</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          Open the tools you have access to. Ask an administrator if something is missing.
        </p>
      </header>

      {profileLoadError ? (
        <div
          className="mx-auto max-w-2xl rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-center text-sm text-danger"
          role="alert"
        >
          <p className="font-medium">Could not load your account permissions</p>
          <p className="mt-1 text-balance text-danger/90">{profileLoadError}</p>
        </div>
      ) : null}

      {!anyApp ? (
        <p className="mx-auto max-w-md text-center text-sm text-muted">
          No applications are enabled for your account yet. Please contact an admin or sign out and try another
          login.
        </p>
      ) : (
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {canAccessSkillMatrix ? (
            <Link to="/matrix" className={cardClass}>
              <span className="flex size-14 items-center justify-center rounded-2xl bg-accent-dim text-accent transition-transform group-hover:scale-105">
                <Grid3X3 className="size-8" aria-hidden />
              </span>
              <span className="font-display text-xl font-semibold tracking-tight sm:text-2xl">Skill Matrix</span>
              <span className="text-xs text-muted">People, roles, skills, and gaps</span>
            </Link>
          ) : null}

          {canAccessLdrTools ? (
            <Link to="/ldr-tools" className={cardClass}>
              <span className="flex size-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-700 transition-transform group-hover:scale-105 dark:text-violet-300">
                <UsersRound className="size-8" aria-hidden />
              </span>
              <span className="font-display text-xl font-semibold tracking-tight sm:text-2xl">LDR tools</span>
              <span className="text-xs text-muted">Leadership workspace</span>
            </Link>
          ) : null}

          {canAccessRttSystems ? (
            <Link to="/rtt-systems" className={cardClass}>
              <span className="flex size-14 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-800 transition-transform group-hover:scale-105 dark:text-sky-300">
                <Network className="size-8" aria-hidden />
              </span>
              <span className="font-display text-xl font-semibold tracking-tight sm:text-2xl">RTT systems</span>
              <span className="text-xs text-muted">Systems workspace</span>
            </Link>
          ) : null}

          {isAdmin ? (
            <Link to="/login-accounts?tab=accounts" className={cardClass}>
              <span className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-900 transition-transform group-hover:scale-105 dark:text-amber-200">
                <KeyRound className="size-8" aria-hidden />
              </span>
              <span className="font-display text-xl font-semibold tracking-tight sm:text-2xl">Login accounts</span>
              <span className="text-xs text-muted">Roles and app access</span>
            </Link>
          ) : null}
        </div>
      )}
    </div>
  )
}
