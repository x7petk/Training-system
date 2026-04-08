import { Network } from 'lucide-react'

export function RttSystemsPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-800 dark:text-sky-300">
          <Network className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">RTT systems</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            This area is reserved for RTT systems. Add integrations, dashboards, or external links here when you define
            what belongs in this section.
          </p>
        </div>
      </header>
    </div>
  )
}
