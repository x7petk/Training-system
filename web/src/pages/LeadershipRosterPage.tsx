import { Users } from 'lucide-react'

export function LeadershipRosterPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
          <Users className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Leadership roster</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Track and manage leadership contacts and assignments here. Replace this placeholder with your roster UI or
            data when ready.
          </p>
        </div>
      </header>
    </div>
  )
}
