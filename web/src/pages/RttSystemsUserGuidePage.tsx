import { BookOpenText, CheckCircle2, LayoutList, Network, PanelLeft } from 'lucide-react'

const overview = [
  'Plan 24 is the operational day view for one cell and one shift at a time (day or night).',
  'Use Plan 24 for role/time execution, My Plan for personal work focus, and List view for combined review.',
  'Defect Handling is live now; Deviations and Quality Fails remain planned in RTT and stay visible as roadmap routes.',
  'User Guide and Admin are below Sign out in the sidebar (Admin is visible only to admins).',
] as const

const plan24Rules = [
  'Shift window comes from Plan 24 roster setup (including continuous night spans across calendar midnight).',
  'Overlapping events in the same role/time are allowed and should be visually stacked.',
  'One person can be used in multiple role columns when needed; warnings are preferred over hard blocking.',
  'Normal users can run day-to-day Plan 24 operations; roster and schedule definitions are admin-only.',
  'Deleting events uses a soft-delete model with a required comment for auditability.',
] as const

const checksGuide = [
  'Checks are currently the active Plan 24 event type in v1 runtime.',
  'Schedules materialise into plan events and respect suppressions from cross-role manual moves.',
  'Ad-hoc work is supported and should remain clearly indicated as ad-hoc in the UI.',
  'Drag/drop supports role and time adjustments; schedule-linked metadata is preserved where possible.',
] as const

const dhGuide = [
  'Defect Handling is the first shipped RTT issue system with dedicated status and priority workflow.',
  'DH defect types are controlled in RTT Admin and are editable only by super admin users.',
  'Current create flow is manual from Defect Handling; check-linked auto-create is planned for later phases.',
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
            Operational reference for RTT users, aligned with current Plan 24 and Defect Handling implementation.
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
              RTT issue systems. Defect Handling is active now; Deviations and Quality Fails are retained as planned
              tracks and will follow the same product pattern as they ship.
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

      <section className="rounded-2xl border border-border bg-surface-raised/40 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <Network className="size-4 text-sky-700 dark:text-sky-300" aria-hidden />
          Plan 24 operating rules
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-fg">
          {plan24Rules.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface-raised/40 p-4 sm:p-5">
          <h2 className="font-display text-base font-semibold">Checks workflow (current v1)</h2>
          <ul className="mt-3 space-y-2 text-sm text-fg">
            {checksGuide.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-surface-raised/40 p-4 sm:p-5">
          <h2 className="font-display text-base font-semibold">Defect Handling and roadmap</h2>
          <ul className="mt-3 space-y-2 text-sm text-fg">
            {dhGuide.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 sm:p-5">
        <h2 className="font-display text-base font-semibold tracking-tight text-sky-950">Guide maintenance note</h2>
        <p className="mt-2 text-sm text-sky-900/90">
          Update this guide whenever Plan 24, checks, permissions, or RTT issue-system behaviour changes. Keep it
          aligned with `plan_24_rtt_planning.md` and `rtt_dh_deviations_quality_fails_plan.md` in the same change set.
        </p>
      </section>
    </div>
  )
}
