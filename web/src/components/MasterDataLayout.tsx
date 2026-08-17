import { Database, Layers, Users } from 'lucide-react'
import { AppSectionLayout } from './AppSectionLayout'
import { UserGuideFooterLink, UserGuideMobileNavLink } from './userGuide/UserGuideKit'

export function MasterDataLayout() {
  return (
    <AppSectionLayout
      storageKey="master-data.sidebar-collapsed"
      title="Master data"
      subtitle="Sites, structure, and people"
      headerIconClass="bg-teal-500/15 text-teal-800 dark:text-teal-300"
      HeaderIcon={Database}
      navFooter={<UserGuideMobileNavLink to="/master-data/user-guide" />}
      navItems={[
        { to: '/master-data/structure', label: 'Structure', icon: Layers, end: true },
        { to: '/master-data/people', label: 'People', icon: Users, end: true },
      ]}
      accountFooter={<UserGuideFooterLink to="/master-data/user-guide" />}
    />
  )
}
