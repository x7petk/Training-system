import { Shield } from 'lucide-react'
import { AccountsSummary } from '../features/admin/AccountsSummary'
import { PeopleRoster } from '../features/admin/PeopleRoster'

export function AdminPage() {
  return (
    <div className="space-y-10">
      <header className="flex items-start gap-3">
        <span className="mt-1 flex size-10 items-center justify-center rounded-xl bg-accent-dim text-accent">
          <Shield className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Admin</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Manage who appears on the matrix: link Supabase logins to <strong>people</strong>, then assign job{' '}
            <strong>roles</strong>. Catalog edits (skills / requirements) can follow in a later pass.
          </p>
        </div>
      </header>

      <PeopleRoster />
      <AccountsSummary />
    </div>
  )
}
