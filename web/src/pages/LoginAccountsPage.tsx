import { useEffect } from 'react'
import { Link, NavLink, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { AccountsSummary } from '../features/admin/AccountsSummary'
import { SectionAccessPanel } from '../features/admin/SectionAccessPanel'
import { LoginAccountsUserGuide } from './LoginAccountsUserGuide'
import { useAuth } from '../hooks/useAuth'

const tabClass = (active: boolean) =>
  `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
    active
      ? 'bg-accent-dim text-accent ring-1 ring-accent/25'
      : 'text-muted hover:bg-black/[0.06] hover:text-fg'
  }`

export function LoginAccountsPage() {
  const { isSuperAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const tab = rawTab === 'guide' ? 'guide' : rawTab === 'access' && isSuperAdmin ? 'access' : 'accounts'

  useEffect(() => {
    if (rawTab === 'access' && !isSuperAdmin) {
      setSearchParams({ tab: 'accounts' }, { replace: true })
    }
  }, [rawTab, isSuperAdmin, setSearchParams])

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-accent hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to apps
        </Link>
        <nav className="flex flex-wrap gap-2" aria-label="Login accounts sections">
          <NavLink to="/login-accounts?tab=accounts" className={() => tabClass(tab === 'accounts')}>
            Login accounts
          </NavLink>
          {isSuperAdmin ? (
            <NavLink to="/login-accounts?tab=access" className={() => tabClass(tab === 'access')}>
              Section access
            </NavLink>
          ) : null}
          <NavLink to="/login-accounts?tab=guide" className={() => tabClass(tab === 'guide')}>
            User Guide
          </NavLink>
        </nav>
      </div>

      {tab === 'guide' ? (
        <LoginAccountsUserGuide />
      ) : tab === 'accounts' ? (
        <AccountsSummary />
      ) : (
        <SectionAccessPanel />
      )}
    </div>
  )
}
