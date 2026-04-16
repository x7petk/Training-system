import { BookOpenText, LayoutList, Network, PanelLeft } from 'lucide-react'

const overview = [
  'Use the left panel the same way as LDR tools: Plan 24, My Plan, and List view are top-level links, followed by Deviations, Defect Handling, and Quality Fails.',
  'Pick the route that matches the workflow you are running; each area can grow its own screens and permissions.',
  'User Guide and Admin sit below Sign out in the sidebar (Admin is visible only to admins).',
] as const

export function RttSystemsUserGuidePage() {
  return (
    <div className="space-y-8">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-800 dark:text-sky-300">
          <BookOpenText className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">RTT systems — User Guide</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Quick orientation for the RTT workspace. This page does not change production data.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-surface-raised/40 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <Network className="size-4 text-sky-700 dark:text-sky-300" aria-hidden />
          Overview
        </h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-muted">
          {overview.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-surface-raised/40 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <LayoutList className="size-4 text-sky-700 dark:text-sky-300" aria-hidden />
          Panel layout
        </h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="font-medium text-fg">Plan 24 / My Plan / List view</dt>
            <dd className="mt-1 text-muted">
              Primary routes at the top of the nav (same pattern as Calendar and Roster in LDR tools). Pick the view
              that matches how you work: daily plan, personal plan, or list.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Deviations / Defect Handling / Quality Fails</dt>
            <dd className="mt-1 text-muted">
              Additional top-level links for deviation tracking, defect handling, and quality-fail workflows. Each
              route is a placeholder until the real UI is wired in.
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 font-medium text-fg">
              <PanelLeft className="size-4 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
              Footer
            </dt>
            <dd className="mt-1 text-muted">
              After Sign out in the desktop sidebar you will find User Guide (this page) and Admin (settings for this
              module, admins only).
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
