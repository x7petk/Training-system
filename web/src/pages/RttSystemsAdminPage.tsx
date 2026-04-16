import { useState } from 'react'
import { LayoutDashboard } from 'lucide-react'
import { Plan24AdminRosterTab } from '../features/plan24/Plan24AdminRosterTab'

type Tab = 'roster' | 'checks'

export function RttSystemsAdminPage() {
  const [tab, setTab] = useState<Tab>('roster')

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-accent">
          <LayoutDashboard className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">RTT systems — Admin</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Plan 24 roster and shifts are managed here. Scheduling templates for recurring checks will live under the Checks tab
            when that engine is built.
          </p>
        </div>
      </header>

      <div className="inline-flex rounded-xl border border-border bg-surface p-1" role="tablist" aria-label="Admin sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'roster'}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            tab === 'roster' ? 'bg-accent-dim text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg'
          }`}
          onClick={() => setTab('roster')}
        >
          Plan 24 roster
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'checks'}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            tab === 'checks' ? 'bg-accent-dim text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg'
          }`}
          onClick={() => setTab('checks')}
        >
          Checks
        </button>
      </div>

      {tab === 'roster' ? <Plan24AdminRosterTab /> : null}

      {tab === 'checks' ? (
        <div className="rounded-2xl border border-border bg-surface-raised/40 px-4 py-6 text-sm text-muted">
          Recurring check templates and materialisation are planned next (see §3.2 in the Plan 24 spec). For now, operators can add
          ad hoc checks on the Plan 24 grid.
        </div>
      ) : null}
    </div>
  )
}
