import { Bot } from 'lucide-react'
import { AppSectionLayout } from './AppSectionLayout'
import { AGENTS_NAV_ITEMS } from '../features/agents/agentsNavConfig'

export function AgentsLayout() {
  return (
    <AppSectionLayout
      storageKey="agents.sidebar-collapsed"
      title="Agents"
      subtitle="AI specialist workspace"
      headerIconClass="bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-300"
      HeaderIcon={Bot}
      navItems={AGENTS_NAV_ITEMS}
      outletFallback={
        <div
          className="flex min-h-[14rem] items-center justify-center rounded-2xl border border-border bg-surface-raised/50 text-sm text-muted"
          role="status"
          aria-live="polite"
        >
          Loading…
        </div>
      }
    />
  )
}
