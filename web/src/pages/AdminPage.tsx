import { Suspense, lazy } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { AccountsSummary } from '../features/admin/AccountsSummary'
import { CatalogManager } from '../features/admin/CatalogManager'
import { ADMIN_NAV_FLAT, isCatalogSection, parseAdminTab } from '../features/admin/adminNavConfig'
import { PeopleRoster } from '../features/admin/PeopleRoster'
import { TeamsManager } from '../features/admin/TeamsManager'

const LazySkillTrainingManager = lazy(async () => {
  const mod = await import('../features/admin/SkillTrainingManager')
  return { default: mod.SkillTrainingManager }
})

export function AdminPage() {
  const [searchParams] = useSearchParams()
  const active = parseAdminTab(searchParams.get('tab'))
  const activeMeta = ADMIN_NAV_FLAT.find((i) => i.id === active) ?? ADMIN_NAV_FLAT[0]

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-accent">
          <Shield className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Admin</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Use the <strong className="text-fg/90">Admin</strong> section in the sidebar to pick a settings category.
            Assessors use the matrix; operators only see <strong className="text-fg/90">My skills</strong>.
          </p>
        </div>
      </header>

      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-border pb-3">
          <h2 className="font-display text-lg font-semibold tracking-tight text-fg">{activeMeta.label}</h2>
          {activeMeta.hint ? <span className="text-sm text-muted">· {activeMeta.hint}</span> : null}
        </div>

        {isCatalogSection(active) ? <CatalogManager activeSection={active} /> : null}

        {active === 'skill-training' ? (
          <Suspense fallback={<p className="text-sm text-muted">Loading training admin tools…</p>}>
            <LazySkillTrainingManager />
          </Suspense>
        ) : null}

        {active === 'teams' ? <TeamsManager /> : null}
        {active === 'people' ? <PeopleRoster /> : null}
        {active === 'accounts' ? <AccountsSummary /> : null}
      </div>
    </div>
  )
}
