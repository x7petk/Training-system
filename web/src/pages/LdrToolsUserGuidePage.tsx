import { BookOpenText, CheckCircle2, Layers3, PlayCircle } from 'lucide-react'

const quickStart = [
  'Open LDR tools from App Hub, then choose Site or Cell in the scope bar.',
  'Use Calendar to add or drag events for the current week and next weeks.',
  'Use Roster to assign people per activity/day and update cell, RAG, and comments.',
  'Use Admin (admin/super admin) to maintain LDR people and activity lists.',
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
    body: 'Keep people and activities up to date so roster assignment lists remain accurate and fast to use.',
  },
] as const

const designProcessBlocks = [
  {
    title: 'What each area is for',
    body: [
      'Calendar — shared leadership dates: multi-day events, colours, and notes. Use it so everyone sees the same week context before you fill the roster.',
      'Roster — who is on which activity and day: people, optional cell tag (site view), RAG, comments, and drag between days/activities.',
      'Admin — lists you maintain so Roster stays usable: LDR people, activity names/order, and (in cell scope) which site activities also appear on the cell roster.',
      'User Guide — this page; it does not change data. Use Calendar, Roster, and Admin after you finish reading.',
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

export function LdrToolsUserGuidePage() {
  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
          <BookOpenText className="size-6" aria-hidden />
        </span>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">LDR User Guide</h1>
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
    </div>
  )
}
