/** Routes that use Site / Plant / Cell filters for Health Checks & Observation System (not Calendar/Roster). */
export function isHcObsScopedPath(pathname: string): boolean {
  if (pathname.startsWith('/ldr-tools/user-guide')) return false
  if (pathname.startsWith('/ldr-tools/admin')) return false
  if (pathname.startsWith('/ldr-tools/health-checks')) return true
  if (pathname.startsWith('/ldr-tools/sos')) return true
  return false
}

type MasterPlant = { id: string; site_id: string }
type MasterCell = { id: string; plant_id: string }

/** Master cell ids matching HC/Obs location filter (site → optional plant → optional cell). */
export function masterCellIdsForHcObsFilter(
  siteId: string,
  plantId: string,
  cellId: string,
  allPlants: MasterPlant[],
  allCells: MasterCell[],
): string[] {
  if (!siteId) return []
  if (cellId) return [cellId]
  const plants = plantId
    ? allPlants.filter((p) => p.id === plantId && p.site_id === siteId)
    : allPlants.filter((p) => p.site_id === siteId)
  const plantIds = new Set(plants.map((p) => p.id))
  return allCells.filter((c) => plantIds.has(c.plant_id)).map((c) => c.id)
}
