import type { LucideIcon } from 'lucide-react'
import { Building2, Factory, HardHat, Headphones, User, Users } from 'lucide-react'
import type { SwpRoleKey } from './types'

export const SWP_ROLE_KEY_ORDER: SwpRoleKey[] = [
  'operator',
  'team-lead',
  'cell-team',
  'plant-manager',
  'site-manager',
  'support',
]

export type SwpLaneTheme = {
  label: string
  headerClass: string
  laneClass: string
  icon: LucideIcon
}

export const SWP_LANE_THEMES: Record<SwpRoleKey, SwpLaneTheme> = {
  operator: {
    label: 'Operator',
    headerClass: 'bg-sky-600 text-white',
    laneClass: 'bg-sky-50/80 dark:bg-sky-950/25',
    icon: HardHat,
  },
  'team-lead': {
    label: 'Team Lead',
    headerClass: 'bg-emerald-600 text-white',
    laneClass: 'bg-emerald-50/80 dark:bg-emerald-950/25',
    icon: User,
  },
  'cell-team': {
    label: 'Cell Team',
    headerClass: 'bg-violet-600 text-white',
    laneClass: 'bg-violet-50/80 dark:bg-violet-950/25',
    icon: Users,
  },
  'plant-manager': {
    label: 'Plant Manager',
    headerClass: 'bg-amber-600 text-white',
    laneClass: 'bg-amber-50/80 dark:bg-amber-950/25',
    icon: Factory,
  },
  'site-manager': {
    label: 'Site Manager',
    headerClass: 'bg-cyan-700 text-white',
    laneClass: 'bg-cyan-50/80 dark:bg-cyan-950/25',
    icon: Building2,
  },
  support: {
    label: 'Support',
    headerClass: 'bg-indigo-800 text-white',
    laneClass: 'bg-indigo-50/80 dark:bg-indigo-950/25',
    icon: Headphones,
  },
}

const ROLE_NAME_ALIASES: Record<SwpRoleKey, string[]> = {
  operator: ['operator'],
  'team-lead': ['team lead', 'teamlead'],
  'cell-team': ['cell team', 'cellteam', 'cell'],
  'plant-manager': ['plant manager', 'plantmanager'],
  'site-manager': ['site manager', 'sitemanager', 'site mgr'],
  support: ['support'],
}

export function matchRoleKey(roleName: string): SwpRoleKey | null {
  const n = roleName.toLowerCase().trim()
  for (const key of SWP_ROLE_KEY_ORDER) {
    if (ROLE_NAME_ALIASES[key].some((alias) => n === alias || n.includes(alias))) return key
  }
  return null
}
