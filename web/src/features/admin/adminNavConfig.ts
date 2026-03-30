import type { ComponentType } from 'react'
import {
  BookOpen,
  Briefcase,
  KeyRound,
  Layers,
  ListChecks,
  Tag,
  UserCircle,
  UsersRound,
} from 'lucide-react'

export type CatalogManagerSection = 'skill-groups' | 'skills' | 'job-roles' | 'role-requirements'

export type AdminNavId =
  | CatalogManagerSection
  | 'skill-training'
  | 'teams'
  | 'people'
  | 'accounts'

export type AdminNavItem = {
  id: AdminNavId
  label: string
  hint: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}

export const DEFAULT_ADMIN_TAB: AdminNavId = 'skill-groups'

export const ADMIN_NAV_GROUPS: { heading: string; items: AdminNavItem[] }[] = [
  {
    heading: 'Catalog',
    items: [
      { id: 'skill-groups', label: 'Skill groups', hint: 'Matrix columns', icon: Layers },
      { id: 'skills', label: 'Skills', hint: 'Numeric & certification', icon: Tag },
      { id: 'job-roles', label: 'Job roles', hint: 'Roster roles', icon: Briefcase },
      {
        id: 'role-requirements',
        label: 'Role skill requirements',
        hint: 'Levels per role',
        icon: ListChecks,
      },
    ],
  },
  {
    heading: 'Training',
    items: [{ id: 'skill-training', label: 'Skill training', hint: 'Operator L1→2 packs', icon: BookOpen }],
  },
  {
    heading: 'Organization',
    items: [
      { id: 'teams', label: 'Teams', hint: 'Shifts & cells', icon: UsersRound },
      { id: 'people', label: 'People', hint: 'Roster & roles', icon: UserCircle },
    ],
  },
  {
    heading: 'Access',
    items: [
      {
        id: 'accounts',
        label: 'Login accounts',
        hint: 'Operator / assessor / admin',
        icon: KeyRound,
      },
    ],
  },
]

export const ADMIN_NAV_FLAT = ADMIN_NAV_GROUPS.flatMap((g) => g.items)

const TAB_SET = new Set<string>(ADMIN_NAV_FLAT.map((i) => i.id))

export function parseAdminTab(raw: string | null): AdminNavId {
  if (raw && TAB_SET.has(raw)) return raw as AdminNavId
  return DEFAULT_ADMIN_TAB
}

export const CATALOG_SECTION_IDS: readonly CatalogManagerSection[] = [
  'skill-groups',
  'skills',
  'job-roles',
  'role-requirements',
] as const

export function isCatalogSection(id: AdminNavId): id is CatalogManagerSection {
  return (CATALOG_SECTION_IDS as readonly string[]).includes(id)
}
