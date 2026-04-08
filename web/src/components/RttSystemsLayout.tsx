import { Home, Network } from 'lucide-react'
import { AppSectionLayout } from './AppSectionLayout'

export function RttSystemsLayout() {
  return (
    <AppSectionLayout
      storageKey="rtt-systems.sidebar-collapsed"
      title="RTT systems"
      subtitle="Systems workspace"
      headerIconClass="bg-sky-500/15 text-sky-800 dark:text-sky-300"
      HeaderIcon={Network}
      navItems={[{ to: '/rtt-systems', label: 'Overview', icon: Home, end: true }]}
    />
  )
}
