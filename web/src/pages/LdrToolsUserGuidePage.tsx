import { BookOpenText, CheckCircle2, Layers3, Palette, PlayCircle, Repeat2 } from 'lucide-react'

const quickStart = [
  'Open LDR tools from App Hub, then choose Site or Cell in the scope bar.',
  'Use Calendar to add or drag events for the current week and next weeks.',
  'Use Roster to assign people per activity/day and update cell, RAG, and comments.',
  'Use the left panel groups: LDR checks (Health Checks, SOS, QOS, PPO) and Reports (HC/SOS/QOS/PPO reports).',
  'Use Health Checks to start or resume checks at cell level; HC Report for trends and history (no scope bar on that page — all accessible locations).',
  'Use SOS, QOS, and PPO the same way (each has its own list, new flow, record screen, and report). SOS/QOS/PPO reports also hide the scope bar.',
  'Use User Guide and Admin links in the footer (Admin appears below User Guide for admin and super-admin users).',
] as const

const runFlow = [
  {
    title: '1) Set scope first',
    body: 'Pick Site for site-wide planning, or switch to Cell and choose Plant + Cell for local execution.',
  },
  {
    title: '2) Plan in Calendar',
    body: 'Create all-day events, move them by drag-and-drop, and keep a clean weekly context before assigning roster work.',
  },
  {
    title: '3) Execute in Roster',
    body: 'Open a day cell, add person, choose cell (site scope), set one-click RAG, add comments, then save by blur/update.',
  },
  {
    title: '4) Maintain in Admin',
    body: 'Keep people, activities, and template settings up to date so roster and record flows stay accurate and fast to use.',
  },
] as const

const designProcessBlocks = [
  {
    title: 'What each area is for',
    body: [
      'Calendar — shared leadership dates: multi-day events, colours, and notes. Use it so everyone sees the same week context before you fill the roster.',
      'Roster — who is on which activity and day: people, optional cell tag (site view), RAG, comments, and drag between days/activities.',
      'Health Checks — run standardised checks at a cell: draft/save, submit with score and RAG. From Roster, Complete HC opens a new check with assignment link, completion date, and location prefilled; submitting can sync RAG and comments back to the assignment.',
      'HC Report — submitted checks only: compact filters (date range, type, completer). No site/cell scope bar on this page; the report includes all HC records you can access under LDR (RLS). Summary cards, RAG distribution, weekly volume/avg trend, by-type and by-completer tables, and a record list.',
      'SOS / QOS / PPO — observation apps tied to their own LDR activities: roster shortcuts (Complete SOS / QOS / PPO) when an active template exists; duplicate guard and roster RAG/comment sync like HC. SOS uses one Full/Partly/Not outcome plus reference checklist with optional good/bad images. QOS and PPO use Pass/Fail/N/A per question (N/A excluded from score), optional per-question operator text, comments, and optional reference images.',
      'SOS / QOS / PPO Reports — charts for volume by day/week/month, counts by type and by completer, filters, and a record list (no scope bar; RLS-wide).',
      'Record screens (HC/SOS/QOS/PPO) keep submit/delete controls in a sticky bottom action bar with autosave status, so you can submit or delete without scrolling back to the top.',
      'Admin — lists you maintain so Roster stays usable: LDR people, activity names/order, (in cell scope) site-activity visibility for the cell roster, plus HC and SOS/QOS/PPO types and templates (including question images uploaded to secure storage). Admin link lives below User Guide in the footer.',
      'User Guide — this page; it does not change data. Use Calendar, Roster, Health Checks, and Admin after you finish reading.',
    ],
  },
  {
    title: 'Site scope vs Cell scope',
    body: [
      'Site scope — you are working in the site’s LDR workspace. The roster shows every activity for that site and assignments across the whole site. Good for planners and site-wide oversight.',
      'Cell scope — you are working in one cell’s LDR workspace. The roster is focused on that cell: you pick Plant and Cell so the app knows which workspace and which physical cell you mean.',
      'Switching scope does not delete data; it changes which workspace and which filtered view you see. Your last choice is remembered on this device.',
    ],
  },
  {
    title: 'How site-level planning shows when you use Cell scope',
    body: [
      'Some activities belong to the site workspace; others belong to the cell workspace. On the roster, rows can be labelled so you can tell site-sourced activities from cell-sourced ones.',
      'In Cell scope, Admins can choose which site activities are visible on the cell roster (Activities tab → site-activity visibility). That keeps the cell view relevant instead of listing the entire site plan.',
      'Assignments you see in Cell scope still respect the cell: you will see people and slots that apply to this cell — including site-planned work that is tied to this cell (for example by person or assignment cell).',
      'If something looks missing, check Admin → Activities visibility for the cell, or switch to Site scope to see the full site roster.',
    ],
  },
  {
    title: 'Design choices you will notice',
    body: [
      'RAG is one tap (None / Green / Yellow / Red) so updates are fast on the floor.',
      'Cell on an assignment (site scope) is also one tap — no long dropdowns in the edit popup.',
      'Conflict warnings highlight the same person on multiple activities the same day; they never block saving, so coordinators can record reality first.',
      'Avatar colours are fixed presets (solid) so people are easy to spot in dense grids.',
    ],
  },
] as const

const colourCodingBlocks = [
  {
    title: 'RAG colours (Roster + HC + SOS/QOS/PPO)',
    body: [
      'Green = healthy / acceptable outcome.',
      'Yellow (Amber) = caution; some gaps or partial compliance.',
      'Red = high concern; action required.',
      'None/blank = not yet assessed.',
    ],
  },
  {
    title: 'Question answer colours',
    body: [
      'PASS buttons use green styling.',
      'FAIL buttons use red styling and require a comment before submit.',
      'QOS/PPO also include N/A (neutral/dark) and N/A is excluded from score calculations.',
    ],
  },
  {
    title: 'Reference image colours',
    body: [
      'Good example image frame = green, Bad example image frame = red.',
      'If no image is uploaded, users still see framed placeholders to keep the standard visible.',
    ],
  },
  {
    title: 'Alerts and confirmations',
    body: [
      'Validation errors show in danger styling and must be fixed before submit.',
      'Successful submit notices are high-contrast confirmation banners.',
      'Conflict warnings in roster are visible but non-blocking so coordinators can keep working.',
    ],
  },
] as const

const feedbackLoopBlocks = [
  {
    title: 'Roster -> check/observation',
    body: [
      'From the roster assignment modal, Complete HC / SOS / QOS / PPO opens a new record with assignment context.',
      'The system prefills date and location context from the selected assignment where available.',
    ],
  },
  {
    title: 'Submit -> roster update',
    body: [
      'When a linked assignment is present, submitting HC/observations updates roster feedback fields.',
      'RAG can be synced to the assignment and comment history is appended for traceability.',
      'Duplicate-submit protection prevents accidental repeat submits for the same user/type/cell/day and assignment context.',
    ],
  },
  {
    title: 'Scope continuity',
    body: [
      'If you start from roster in Site scope, returning keeps you in Site scope.',
      'If you start from roster in Cell scope, returning keeps the same Site/Plant/Cell context.',
    ],
  },
] as const

const roleTrainingChecklist = [
  {
    title: 'Operators / Team leads',
    body: [
      'Set the correct scope before editing data.',
      'Use roster for daily assignment and quick RAG updates.',
      'Complete HC/SOS/QOS/PPO from roster when possible to keep assignment linkage.',
      'Ensure FAIL answers have clear comments (what happened, where, what next).',
      'Use report pages to review trends by type, date, and completer.',
    ],
  },
  {
    title: 'Admins / Super admins',
    body: [
      'Maintain people and activities so roster stays accurate.',
      'Control site-activity visibility for cell scope views.',
      'Maintain HC and SOS/QOS/PPO types/templates and activate only current versions.',
      'Upload/maintain good-bad reference images in templates where useful.',
      'Audit report trends and stale drafts during weekly review.',
    ],
  },
] as const

const troubleshooting = [
  'No complete buttons in roster: check that the activity is linked and at least one active type has an active template.',
  'Plant/Cell shows dash on new record: verify assignment has a valid cell mapping (or choose cell manually).',
  'Cannot submit: check unanswered questions and FAIL comments.',
  'Missing expected activities in cell scope: review Admin > Activities visibility for that cell.',
  'Unexpected data visibility: confirm current scope and page type (report pages intentionally run without scope bar and show all accessible records).',
] as const

export function LdrToolsUserGuidePage() {
  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
          <BookOpenText className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">LDR User Guide</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Operational reference for LDR users, aligned with current calendar, roster, checks, observations, reports,
            and admin behaviour.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-surface-raised/50 p-4 backdrop-blur-sm md:p-6">
        <div className="flex items-center gap-2">
          <PlayCircle className="size-5 text-accent" aria-hidden />
          <h2 className="font-display text-lg font-semibold tracking-tight">Quick start</h2>
        </div>
        <ul className="mt-3 space-y-2 text-sm text-fg">
          {quickStart.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-surface-raised/50 p-4 backdrop-blur-sm md:p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight">Recommended operating flow</h2>
        <div className="mt-3 space-y-3">
          {runFlow.map((step) => (
            <div key={step.title} className="rounded-xl border border-border bg-surface px-3 py-3">
              <p className="text-sm font-semibold text-fg">{step.title}</p>
              <p className="mt-1 text-sm text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-raised/50 p-4 backdrop-blur-sm md:p-6">
        <div className="flex items-center gap-2">
          <Layers3 className="size-5 text-accent" aria-hidden />
          <h2 className="font-display text-lg font-semibold tracking-tight">Design {'&'} process</h2>
        </div>
        <p className="mt-2 text-sm text-muted">
          How the pieces fit together, what the main choices mean, and why site-level content can appear while you are in
          cell scope.
        </p>
        <div className="mt-4 space-y-5">
          {designProcessBlocks.map((block) => (
            <div key={block.title}>
              <h3 className="text-sm font-semibold text-fg">{block.title}</h3>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                {block.body.map((line) => (
                  <li key={line} className="border-l-2 border-border pl-3">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-raised/50 p-4 backdrop-blur-sm md:p-6">
        <div className="flex items-center gap-2">
          <Palette className="size-5 text-accent" aria-hidden />
          <h2 className="font-display text-lg font-semibold tracking-tight">Colour coding legend</h2>
        </div>
        <p className="mt-2 text-sm text-muted">
          Use this as a common language in training: colours are part of operational meaning, not decoration.
        </p>
        <div className="mt-4 space-y-5">
          {colourCodingBlocks.map((block) => (
            <div key={block.title}>
              <h3 className="text-sm font-semibold text-fg">{block.title}</h3>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                {block.body.map((line) => (
                  <li key={line} className="border-l-2 border-border pl-3">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-raised/50 p-4 backdrop-blur-sm md:p-6">
        <div className="flex items-center gap-2">
          <Repeat2 className="size-5 text-accent" aria-hidden />
          <h2 className="font-display text-lg font-semibold tracking-tight">Feedback loops and system behaviour</h2>
        </div>
        <div className="mt-4 space-y-5">
          {feedbackLoopBlocks.map((block) => (
            <div key={block.title}>
              <h3 className="text-sm font-semibold text-fg">{block.title}</h3>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                {block.body.map((line) => (
                  <li key={line} className="border-l-2 border-border pl-3">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-raised/50 p-4 backdrop-blur-sm md:p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight">Training checklists by role</h2>
        <div className="mt-4 space-y-5">
          {roleTrainingChecklist.map((block) => (
            <div key={block.title}>
              <h3 className="text-sm font-semibold text-fg">{block.title}</h3>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                {block.body.map((line) => (
                  <li key={line} className="border-l-2 border-border pl-3">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-raised/50 p-4 backdrop-blur-sm md:p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight">Common issues and quick fixes</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          {troubleshooting.map((item) => (
            <li key={item} className="border-l-2 border-border pl-3">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 md:p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight text-sky-950">Guide maintenance note</h2>
        <p className="mt-2 text-sm text-sky-900/90">
          Update this guide whenever LDR scope behaviour, roster/check flows, report behaviour, or admin controls
          change. Keep it aligned with `ldr_tools_roster_calendar_spec.md` in the same change set.
        </p>
      </section>
    </div>
  )
}
