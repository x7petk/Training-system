import { localYMD } from '../../lib/dueDateUtils'
import type { EPlanAction, EPlanActionStatus, EPlanAdminStore } from './eplanTypes'
import { defaultEPlanAdmin, loadEPlanAdmin, saveEPlanAdmin } from './eplanAdminService'
import { loadEPlanActions, saveEPlanActions } from './eplanService'
import { eplanAddDaysYmd } from './eplanUtils'
import { eplanLoadJson, eplanSaveJson, eplanStorageKeys } from './eplanStorage'

type MasterCell = { id: string; plant_id: string }
type MasterPlant = { id: string; site_id: string }

const TITLES = [
  'Improve CIL completion for packing line',
  'Reduce unplanned downtime on evaporator',
  'Complete DDS coaching deployment',
  'Review quality check failure trend',
  'Close audit finding for chemical storage',
  'Standardise start-up checks for line 2',
  'Update training matrix for operators',
  'Investigate top 3 downtime losses',
  'Deploy new safety signage in wet area',
  'Reduce changeover time on filler',
  'Implement autonomous maintenance round',
  'Fix recurring metal detector trips',
  'Improve handover between shifts',
  'Roll out visual management boards',
  'Reduce scrap from film alignment',
]

const STATUSES: EPlanActionStatus[] = [
  'ON_TRACK',
  'NEED_HELP',
  'OFF_TRACK',
  'COMPLETED',
  'NOT_STARTED',
  'NOT_REQUIRED',
]

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!
}

export function ensureEPlanSeeded(
  cells: MasterCell[],
  plants: MasterPlant[],
): { admin: EPlanAdminStore; actions: EPlanAction[] } {
  let admin = loadEPlanAdmin()
  if (admin.ogsmPillars.length === 0) {
    admin = defaultEPlanAdmin()
    saveEPlanAdmin(admin)
  }

  const already = eplanLoadJson<boolean>(eplanStorageKeys.seeded, false)
  let actions = loadEPlanActions()
  if (already && actions.length > 0) {
    return { admin, actions }
  }

  const today = localYMD(new Date())
  const ogsm = admin.ogsmPillars.filter((x) => x.isActive)
  const forums = admin.forums.filter((x) => x.isActive)
  const labels = admin.labels.filter((x) => x.isActive)
  const lossTypes = admin.lossTypes.filter((x) => x.isActive)
  const owners = admin.owners.filter((x) => x.isActive)
  if (!ogsm.length || !forums.length || !owners.length) {
    return { admin, actions }
  }

  const plantById = new Map(plants.map((p) => [p.id, p]))
  const scopedCells = cells.slice(0, Math.min(6, cells.length))
  if (scopedCells.length === 0) {
    return { admin, actions }
  }

  const seeded: EPlanAction[] = []
  let titleIdx = 0

  scopedCells.forEach((cell, cellIdx) => {
    const plant = plantById.get(cell.plant_id)
    if (!plant) return
    const count = cellIdx < 2 ? 6 : 4
    const parents: EPlanAction[] = []

    for (let i = 0; i < count; i++) {
      const status = pick(STATUSES, titleIdx + cellIdx)
      const start = eplanAddDaysYmd(today, -14 + (titleIdx % 20))
      const end = eplanAddDaysYmd(start, 20 + (titleIdx % 40))
      const t = new Date().toISOString()
      const action: EPlanAction = {
        id: crypto.randomUUID(),
        title: pick(TITLES, titleIdx),
        description: 'Demo e-Plan action for manufacturing improvement tracking.',
        siteId: plant.site_id,
        plantId: cell.plant_id,
        cellId: cell.id,
        startDate: start,
        endDate: end,
        ogsmPillarId: pick(ogsm, titleIdx).id,
        forumId: pick(forums, titleIdx).id,
        status,
        actionOwnerId: pick(owners, titleIdx).id,
        labelId: labels.length ? pick(labels, titleIdx).id : undefined,
        lossTypeId: lossTypes.length ? pick(lossTypes, titleIdx).id : undefined,
        raisedById: pick(owners, titleIdx + 2).id,
        createdAt: t,
        updatedAt: t,
        progress: status === 'ON_TRACK' ? 35 : undefined,
      }
      parents.push(action)
      seeded.push(action)
      titleIdx += 1
    }

    parents.slice(0, 4).forEach((parent, pIdx) => {
      const subCount = 2 + (pIdx % 3)
      for (let s = 0; s < subCount; s++) {
        const subStatus: EPlanActionStatus =
          s === 0 ? 'COMPLETED' : s === 1 ? 'ON_TRACK' : pick(STATUSES, titleIdx)
        const t = new Date().toISOString()
        seeded.push({
          id: crypto.randomUUID(),
          title: `${parent.title} — step ${s + 1}`,
          siteId: parent.siteId,
          plantId: parent.plantId,
          cellId: parent.cellId,
          startDate: parent.startDate,
          endDate: eplanAddDaysYmd(parent.startDate, 10 + s * 5),
          ogsmPillarId: parent.ogsmPillarId,
          forumId: parent.forumId,
          status: subStatus,
          actionOwnerId: pick(owners, titleIdx).id,
          labelId: parent.labelId,
          lossTypeId: parent.lossTypeId,
          raisedById: parent.raisedById,
          createdAt: t,
          updatedAt: t,
          parentActionId: parent.id,
        })
        titleIdx += 1
      }
    })
  })

  saveEPlanActions(seeded)
  eplanSaveJson(eplanStorageKeys.seeded, true)
  return { admin, actions: seeded }
}
