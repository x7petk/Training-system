import { BookOpenText, CheckCircle2, Compass, Layers3, ShieldCheck } from 'lucide-react'

const colorGuide = [
  { label: 'Critical gap', tone: 'bg-rose-100 text-rose-950 border-rose-200', meaning: 'The person is well below the required level and needs attention first.' },
  { label: 'Minor gap', tone: 'bg-amber-100 text-amber-950 border-amber-200', meaning: 'The person is close, but still needs progress to meet the role requirement.' },
  { label: 'Meets', tone: 'bg-emerald-100 text-emerald-950 border-emerald-200', meaning: 'The person currently meets the required level.' },
  { label: 'Exceeds', tone: 'bg-teal-100 text-teal-950 border-teal-200', meaning: 'The person is above the required level.' },
  { label: 'Extra skill', tone: 'bg-sky-100 text-sky-950 border-sky-200', meaning: 'The skill is tracked for the person, but it is not required by their current role.' },
  { label: 'N/A', tone: 'bg-zinc-100 text-zinc-700 border-zinc-200', meaning: 'There is no requirement and no recorded level to compare.' },
] as const

const quickSteps = [
  'Create or tidy up skill groups first so the matrix and My skills stay easy to scan.',
  'Add skills next, then add job roles, then connect skills to roles in Role skill requirements.',
  'Add people after that, link their login if needed, give them a team, and assign one or more job roles.',
  'Use training packs for operator self-training from level 1 to level 2, and use assessor sign-off for higher steps or yes/no qualifications.',
] as const

const rules = [
  {
    title: 'When you add a skill to a role',
    body:
      'A new role requirement starts at required level 3 by default. People who already have that role are seeded with actual level 1 for that skill, and a target date is set three months ahead when the new requirement creates a gap.',
  },
  {
    title: 'When you add a new person and assign a role',
    body:
      'The system creates their required skills automatically. Their starting actual level is 1 for those required skills, and target dates are added where the person still needs to close a gap.',
  },
  {
    title: 'When you track an extra skill',
    body:
      'Extra skills sit outside the person’s role requirements. They still appear in My skills and can still show training or assessor actions when relevant.',
  },
  {
    title: 'When you change levels manually',
    body:
      'The matrix and My skills always reflect the latest saved level. Dashboard and reports then use those levels, due dates, training passes, and assessor-driven progress to show status and movement.',
  },
] as const

const mySkillsTips = [
  'Use the filter row to narrow by person, team, role, gap, or group.',
  'Use the compact target tiles to focus on overdue work, near-term due work, or missing target dates.',
  'Collapse skill groups when you want a quick summary of levels, certifications, and gaps without opening every row.',
  'Open Training when a self-training pack is available for a level 1 skill. Open Show assessors when a skill needs assessor support or sign-off.',
] as const

const trainingFlow = [
  'Level 1 to 2 can be managed with training material plus quiz where a training pack exists.',
  'Level 2 to 3 and higher practical progression is supported by assessor involvement.',
  'Yes/No qualification skills can also show assessors when the person still needs to be signed off.',
  'Training standards can include page layouts, images, links, and supporting documents to guide learners step by step.',
] as const

export function UserGuidePage() {
  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-accent">
          <BookOpenText className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">User Guide</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            This guide explains how to run the skill matrix day to day. It is written for admins and team leads so the
            system can be maintained consistently as the process grows.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-surface-raised/40 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Compass className="size-5 text-accent" aria-hidden />
          <h2 className="font-display text-lg font-semibold tracking-tight">Recommended setup order</h2>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {quickSteps.map((step) => (
            <div key={step} className="rounded-xl border border-border bg-surface px-3 py-3 text-sm text-fg">
              {step}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-raised/40 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Layers3 className="size-5 text-accent" aria-hidden />
          <h2 className="font-display text-lg font-semibold tracking-tight">Colour guide</h2>
        </div>
        <p className="mt-1 text-sm text-muted">Use the colours as a quick visual check before opening row details.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {colorGuide.map((item) => (
            <div key={item.label} className={`rounded-xl border px-3 py-3 ${item.tone}`}>
              <p className="font-semibold">{item.label}</p>
              <p className="mt-1 text-sm opacity-90">{item.meaning}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-raised/40 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-accent" aria-hidden />
          <h2 className="font-display text-lg font-semibold tracking-tight">Core rules already built into the system</h2>
        </div>
        <div className="mt-3 space-y-2">
          {rules.map((rule) => (
            <div key={rule.title} className="rounded-xl border border-border bg-surface px-3 py-3">
              <p className="text-sm font-semibold text-fg">{rule.title}</p>
              <p className="mt-1 text-sm text-muted">{rule.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface-raised/40 p-4 backdrop-blur-sm">
          <h2 className="font-display text-lg font-semibold tracking-tight">Using My skills</h2>
          <ul className="mt-3 space-y-2 text-sm text-fg">
            {mySkillsTips.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-surface-raised/40 p-4 backdrop-blur-sm">
          <h2 className="font-display text-lg font-semibold tracking-tight">Training and assessor flow</h2>
          <ul className="mt-3 space-y-2 text-sm text-fg">
            {trainingFlow.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-raised/40 p-4 backdrop-blur-sm">
        <h2 className="font-display text-lg font-semibold tracking-tight">Reading the rest of the app</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface px-3 py-3">
            <p className="text-sm font-semibold text-fg">Dashboard</p>
            <p className="mt-1 text-sm text-muted">
              Best for quick management checks: overdue work, work due soon, missing target dates, and trend views.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface px-3 py-3">
            <p className="text-sm font-semibold text-fg">Matrix</p>
            <p className="mt-1 text-sm text-muted">
              Best for managing many people at once and updating actual levels directly against role requirements.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface px-3 py-3">
            <p className="text-sm font-semibold text-fg">Report</p>
            <p className="mt-1 text-sm text-muted">
              Best for leadership review: training completions, assessor-driven progression, and current role gap views.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
        <h2 className="font-display text-lg font-semibold tracking-tight text-sky-950">How to keep this guide useful</h2>
        <p className="mt-2 text-sm text-sky-900/90">
          Update this page whenever a workflow changes, a new rule is introduced, or the meaning of a status colour or
          action button changes. Treat it like training material for future admins, not just release notes.
        </p>
      </section>
    </div>
  )
}
