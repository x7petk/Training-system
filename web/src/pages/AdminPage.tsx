import { Shield } from 'lucide-react'

export function AdminPage() {
  return (
    <div className="space-y-8">
      <header className="flex items-start gap-3">
        <span className="mt-1 flex size-10 items-center justify-center rounded-xl bg-accent-dim text-accent">
          <Shield className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Admin</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Manage accounts, roles, and matrix data. User directory and invitations will plug into{' '}
            <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs">profiles</code> with RLS.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-dashed border-border-strong bg-surface-raised/30 p-8 text-center">
        <p className="text-sm font-medium text-fg">Admin tools are stubbed</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Next step: list users from <code className="font-mono text-xs">profiles</code>, promote admins in SQL until
          this UI can update roles safely.
        </p>
      </section>
    </div>
  )
}
