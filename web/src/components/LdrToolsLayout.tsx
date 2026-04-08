import { CalendarDays, Users, UsersRound } from 'lucide-react'
import { AppSectionLayout } from './AppSectionLayout'

export function LdrToolsLayout() {
  return (
    <AppSectionLayout
      storageKey="ldr-tools.sidebar-collapsed"
      title="LDR tools"
      subtitle="Leadership workspace"
      headerIconClass="bg-violet-500/15 text-violet-700 dark:text-violet-300"
      HeaderIcon={UsersRound}
      navItems={[
        { to: '/ldr-tools/roster', label: 'Leadership roster', icon: Users, end: true },
        { to: '/ldr-tools/calendar', label: 'Calendar', icon: CalendarDays, end: true },
      ]}
    />
  )
}
