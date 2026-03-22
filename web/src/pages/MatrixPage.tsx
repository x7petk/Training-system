import { Filter, Search } from 'lucide-react'

export function MatrixPage() {
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Skill matrix</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Compare required vs actual capability, spot gaps, and drill down by team — interactive grid coming next.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:border-border-strong"
          >
            <Search className="size-4 text-muted" aria-hidden />
            Quick find
            <kbd className="ml-1 hidden rounded border border-border bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-muted sm:inline">
              ⌘K
            </kbd>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:border-border-strong"
          >
            <Filter className="size-4 text-muted" aria-hidden />
            Filters
          </button>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface-raised/40 shadow-inner backdrop-blur-sm">
        <div className="grid grid-cols-[repeat(6,minmax(0,1fr))] gap-px bg-border text-xs font-medium uppercase tracking-wider text-muted">
          {['Person', 'Role', 'Skill', 'Required', 'Actual', 'Gap'].map((h) => (
            <div key={h} className="bg-surface px-3 py-2.5">
              {h}
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
          <p className="font-medium text-fg/90">No rows yet</p>
          <p className="max-w-sm text-sm text-muted">
            Connect Supabase, run the SQL migration in <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-xs">supabase/migrations</code>, then we&apos;ll load people and skills here.
          </p>
        </div>
      </div>
    </div>
  )
}
