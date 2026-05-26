import { ensureWorkspaceFlows } from './processFlowTemplates'
import type { SwpSystem, SwpWorkspace } from './types'

function system(name: string, description = ''): SwpSystem {
  return {
    id: `seed-swp-system-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    description,
    active: true,
  }
}

const SWP_SYSTEMS: SwpSystem[] = [
  system('CL', 'Centerline checks'),
  system('CIL', 'Clean, inspect, lubricate'),
  system('DH', 'Defect handling'),
  system('DDS', 'Daily direction setting'),
]

export const SWP_SEED: SwpWorkspace = {
  version: 1,
  systems: SWP_SYSTEMS,
  flows: ensureWorkspaceFlows(SWP_SYSTEMS, []),
}
