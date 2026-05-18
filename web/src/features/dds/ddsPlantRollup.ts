/** Plant DDS roll-up filter for Top losses and Reward & recognition. */
export type DdsPlantRollupMode = 'all' | 'promoted_only'

export function ddsPlantRollupVisibleSurface(mode: DdsPlantRollupMode): 'line-dds' | 'site-dds' {
  return mode === 'promoted_only' ? 'site-dds' : 'line-dds'
}
