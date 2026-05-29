import { ArrowDown, ChevronRight, GitBranch, Layers } from 'lucide-react'

const DATA_FLOW_STEPS = [
  {
    title: 'Admin — configure',
    body: 'Define KPI groups and KPIs (global), then use KPI set-up, P2P standard/soft points, triggers, and cell lines for each manufacturing cell. This is the master data the rest of the process reads.',
  },
  {
    title: 'Plan 24 — execute the day',
    body: 'Checks, CL, CIL, and Quality schedules materialise as plan events on the shift grid. Completing work, raising defects/deviations/quality fails, and DDS actions all write back to Plan 24 and linked issue tables.',
  },
  {
    title: 'Shift DDS — shift meeting',
    body: 'Enter KPI values and review shift-level performance for the scoped cell, date, and shift. Feeds Line DDS roll-ups.',
  },
  {
    title: 'Line → Plant → Site DDS — cascade up',
    body: 'Each level aggregates KPIs, planned actions, top losses, and recognition for the meeting scope. Line compliance and Site compliance add pass/fail views where configured.',
  },
  {
    title: 'P2P — people & process',
    body: 'Role-based P2P audits and P2P Summary connect roster roles to standard and soft-point questions. Results support DDS conversations at line and above.',
  },
  {
    title: 'Triggers, WDS, e-plan, PDCA',
    body: 'Supporting tools: trigger scorecards, weekly direction (WDS), longer-range actions (e-plan), and problem-solving (PDCA). They use the same cell/plant/site scope where applicable.',
  },
] as const

type Props = {
  /** When true, all sections start expanded (user guide page). */
  defaultOpenAll?: boolean
  /** Omit top border when used as standalone page. */
  standalone?: boolean
}

export function DdsProcessGuidelines({ defaultOpenAll = false, standalone = false }: Props) {
  return (
    <div
      id="dds-user-guide"
      className={standalone ? 'space-y-4' : 'mt-8 space-y-4 border-t border-border pt-6'}
    >
      <details
        open={defaultOpenAll || undefined}
        className="group rounded-2xl border border-border bg-surface-raised/40 open:shadow-sm"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-display text-sm font-semibold text-fg [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 shrink-0 text-muted transition group-open:rotate-90" aria-hidden />
          How the DDS process works
        </summary>
        <div className="space-y-4 border-t border-border/80 px-4 pb-4 pt-3 text-sm">
          <p className="text-muted leading-relaxed">
            <strong className="font-medium text-fg">Daily Direction Setting (DDS)</strong> aligns the line on safety,
            quality, delivery, and cost for the shift and the days ahead. Leadership enables the line; the line is
            where customer value is added. Meetings run from the shift outward — Shift DDS, then Line, Plant, and Site
            — so issues raised at the gemba are visible at the right level.
          </p>
          <ul className="list-inside list-disc space-y-2 text-muted">
            <li>
              <strong className="text-fg">Plan 24</strong> is the operational plan: who does what, when, on the roster
              grid.
            </li>
            <li>
              <strong className="text-fg">DDS meetings</strong> review KPIs, actions, losses, P2P, and triggers for the
              scoped cell and period.
            </li>
            <li>
              <strong className="text-fg">Admin</strong> (this section) configures KPIs and meeting content; it does
              not replace front-line execution in Plan 24 or DDS screens.
            </li>
          </ul>
        </div>
      </details>

      <details
        open={defaultOpenAll || undefined}
        className="group rounded-2xl border border-border bg-surface-raised/40 open:shadow-sm"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-display text-sm font-semibold text-fg [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 shrink-0 text-muted transition group-open:rotate-90" aria-hidden />
          How data flows in the app
        </summary>
        <div className="border-t border-border/80 px-4 pb-4 pt-3">
          <p className="mb-4 text-sm text-muted">
            Configuration flows <strong className="font-medium text-fg">down</strong> from Admin; execution and
            meeting data flow <strong className="font-medium text-fg">up</strong> from Plan 24 and Shift DDS into
            higher-level DDS views.
          </p>
          <ol className="space-y-3">
            {DATA_FLOW_STEPS.map((step, i) => (
              <li
                key={step.title}
                className="relative rounded-xl border border-border/80 bg-canvas/60 p-3 pl-4 text-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-fg">{step.title}</p>
                    <p className="mt-1 text-muted leading-relaxed">{step.body}</p>
                  </div>
                </div>
                {i < DATA_FLOW_STEPS.length - 1 ? (
                  <ArrowDown
                    className="absolute -bottom-4 left-[1.375rem] z-10 size-4 text-muted/50"
                    aria-hidden
                  />
                ) : null}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border bg-canvas/40 px-3 py-2 text-xs text-muted">
            <GitBranch className="size-3.5 shrink-0" aria-hidden />
            Scope bar (cell, plan date, shift) on most screens keeps Plan 24, DDS, and P2P views aligned to the same
            manufacturing cell.
          </div>
        </div>
      </details>

      <details
        open={defaultOpenAll || undefined}
        className="group rounded-2xl border border-border bg-surface-raised/40 open:shadow-sm"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-display text-sm font-semibold text-fg [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 shrink-0 text-muted transition group-open:rotate-90" aria-hidden />
          Additional information — reference diagrams
        </summary>
        <div className="space-y-6 border-t border-border/80 px-4 pb-5 pt-4">
          <figure className="space-y-2">
            <figcaption className="flex items-center gap-2 text-sm font-medium text-fg">
              <Layers className="size-4 text-emerald-700 dark:text-emerald-300" aria-hidden />
              Servant leadership on the line
            </figcaption>
            <p className="text-sm text-muted">
              Value is created at the team-member level. Team leaders and the plant manager enable the line through
              support systems and pillar capabilities — leadership adds value by developing people, not by doing the
              work for them.
            </p>
            <a
              href="/dds-process/servant-leadership-model.png"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-1/2 max-w-full overflow-hidden rounded-xl border border-border bg-white shadow-sm transition hover:ring-2 hover:ring-accent/30"
            >
              <img
                src="/dds-process/servant-leadership-model.png"
                alt="Inverted pyramid: plant manager supports team leaders who support team members where customer value is created; support systems feed in from the side."
                className="h-auto w-full"
                loading="lazy"
              />
            </a>
          </figure>

          <figure className="space-y-2">
            <figcaption className="flex items-center gap-2 text-sm font-medium text-fg">
              <Layers className="size-4 text-emerald-700 dark:text-emerald-300" aria-hidden />
              DDS core loop — planned work and troubleshooting
            </figcaption>
            <p className="text-sm text-muted">
              DDS sits at the centre: <strong className="text-fg">planned shiftly/daily work</strong> runs DMS content
              execution → in-process checks → output measures, while{' '}
              <strong className="text-fg">troubleshooting</strong> handles standards, deviations, root cause, and
              deploying updated standards. Both loops feed back into DDS.
            </p>
            <a
              href="/dds-process/dds-core-loop.png"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-1/2 max-w-full overflow-hidden rounded-xl border border-border bg-white shadow-sm transition hover:ring-2 hover:ring-accent/30"
            >
              <img
                src="/dds-process/dds-core-loop.png"
                alt="Diagram with DDS at centre: left loop for planned daily work through DMS execution and measures; right branch for problem definition, standards, root cause, and deploying updated standards."
                className="h-auto w-full"
                loading="lazy"
              />
            </a>
          </figure>
        </div>
      </details>
    </div>
  )
}
