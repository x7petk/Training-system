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
    />
  )
}
