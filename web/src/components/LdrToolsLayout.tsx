import { CalendarDays, LayoutDashboard, Users, UsersRound } from 'lucide-react'
import { AppSectionLayout } from './AppSectionLayout'
import { useAuth } from '../hooks/useAuth'

export function LdrToolsLayout() {
  const { isAdmin, profileReady } = useAuth()
  return (
    <AppSectionLayout
      storageKey="ldr-tools.sidebar-collapsed"
      title="LDR tools"
      subtitle="Leadership workspace"
      headerIconClass="bg-violet-500/15 text-violet-700 dark:text-violet-300"
      HeaderIcon={UsersRound}
      navItems={[
        { to: '/ldr-tools/calendar', label: 'Calendar', icon: CalendarDays, end: true },
        { to: '/ldr-tools/roster', label: 'Roster', icon: Users, end: true },
        ...(profileReady && isAdmin
          ? [{ to: '/ldr-tools/admin', label: 'Admin', icon: LayoutDashboard, end: true }]
          : []),
      ]}
    />
  )
}
