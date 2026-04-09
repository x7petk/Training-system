import { BookOpenText, CheckCircle2, PlayCircle } from 'lucide-react'

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
    </div>
  )
}
