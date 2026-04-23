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
  'Use training packs for operator self-training from level 1 to level 2, and use assessor sign-off for higher steps or certification skills.',
] as const

const accessGuide = [
  {
    title: 'Operator access',
    body: 'Operators are redirected to My skills and use it in read-only mode for their linked person record.',
  },
  {
    title: 'Assessor access',
    body: 'Assessors can use Matrix, Dashboard, and Report, and can edit skill records for people.',
  },
  {
    title: 'Admin access',
    body: 'Admins have assessor permissions plus Admin setup and this User Guide page.',
  },
] as const

const coreRules = [
  {
    title: 'When you add a skill to a role',
    body:
      'Required level is determined per person by taking the highest requirement across all their assigned roles for each skill.',
  },
  {
    title: 'When you add a new person and assign a role',
    body:
      'Role requirements become visible for that person in Matrix and My skills. Actual levels are then tracked per person and can be updated by permitted users.',
  },
  {
    title: 'When you track an extra skill',
    body:
      'Extra skills are tracked outside role requirements. They appear with the Extra skill status and stay separate from required skills.',
  },
  {
    title: 'When you change levels manually',
    body:
      'Matrix and My skills update immediately. Dashboard and Report then reflect those saved levels, due dates, passed training attempts, and progression events.',
  },
] as const

const matrixTips = [
  'Use person and skill search to narrow large grids quickly.',
  'Use role, team, and skill-group chips together to focus the matrix on one work area.',
  'Use colour status to prioritise critical and minor gaps before reviewing meets/exceeds.',
  'Remember certification skills are binary: required yes/no vs actual yes/no.',
] as const

const mySkillsTips = [
  'Use the filter row to narrow by person, team, role, gap, or skill group.',
  'Use the compact target tiles to focus on overdue work, near-term due work, or missing target dates.',
  'Use Required for your roles and Extra skills tracked sections to keep required and optional skills clear.',
  'Open Training when a pack exists for a numeric skill at level 1. Use assessor workflow for higher progression and certifications.',
] as const

const trainingFlow = [
  'Training is available only when the skill is numeric, actual level is 1, and both a training pack and quiz questions exist.',
  'A submit always records a training attempt. Passed attempts can move actual level from 1 to 2 when the saved level is still 1.',
  'Level 2 to 3 progression appears in Report from progression events (where the migration/table exists).',
  'Certification skills are assessed as yes/no and do not use numeric progression steps.',
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
            Operational reference for Skill Matrix users. This page reflects current behaviour and is intended for
            admins, assessors, and team leads running day-to-day capability tracking.
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
          <h2 className="font-display text-lg font-semibold tracking-tight">Who can access what</h2>
        </div>
        <div className="mt-3 space-y-2">
          {accessGuide.map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-surface px-3 py-3">
              <p className="text-sm font-semibold text-fg">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-raised/40 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-accent" aria-hidden />
          <h2 className="font-display text-lg font-semibold tracking-tight">Core rules built into the system</h2>
        </div>
        <div className="mt-3 space-y-2">
          {coreRules.map((rule) => (
            <div key={rule.title} className="rounded-xl border border-border bg-surface px-3 py-3">
              <p className="text-sm font-semibold text-fg">{rule.title}</p>
              <p className="mt-1 text-sm text-muted">{rule.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface-raised/40 p-4 backdrop-blur-sm">
          <h2 className="font-display text-lg font-semibold tracking-tight">Using Matrix</h2>
          <ul className="mt-3 space-y-2 text-sm text-fg">
            {matrixTips.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

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
              Best for due-date management: overdue work, next 7 days, next 30 days, and no target date gaps.
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
              Best for leadership review: passed training completions, progression events, and current role gap views.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
        <h2 className="font-display text-lg font-semibold tracking-tight text-sky-950">Guide maintenance note</h2>
        <p className="mt-2 text-sm text-sky-900/90">
          Update this guide whenever workflow, permission, status colour, or action behaviour changes. Keep it aligned
          with `skill_matrix.md` in the same change set.
        </p>
      </section>
    </div>
  )
}
