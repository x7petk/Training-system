import { Shield } from 'lucide-react'
import { AccountsSummary } from '../features/admin/AccountsSummary'
import { CatalogManager } from '../features/admin/CatalogManager'
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
            Edit the <strong>skill catalog</strong> and <strong>role requirements</strong>, manage{' '}
            <strong>people</strong> on the matrix, and review <strong>accounts</strong>. All catalog changes are enforced
            by Row Level Security (admins only).
          </p>
        </div>
      </header>

      <CatalogManager />
      <PeopleRoster />
      <AccountsSummary />
    </div>
  )
}
