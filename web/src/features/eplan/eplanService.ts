import type { EPlanAction, EPlanPageFilters } from './eplanTypes'
import { eplanDefaultDateRange } from './eplanUtils'
import { eplanLoadJson, eplanSaveJson, eplanStorageKeys } from './eplanStorage'

function nowIso(): string {
  return new Date().toISOString()
}

export function loadEPlanActions(): EPlanAction[] {
  return eplanLoadJson<EPlanAction[]>(eplanStorageKeys.actions, [])
}

export function saveEPlanActions(actions: EPlanAction[]): void {
  eplanSaveJson(eplanStorageKeys.actions, actions)
}

export function loadEPlanFilters(): EPlanPageFilters {
  const defaults: EPlanPageFilters = {
    status: 'all',
    ogsmPillarId: 'all',
    forumId: 'all',
    actionOwnerId: 'all',
    labelId: 'all',
    lossTypeId: 'all',
    raisedById: 'all',
    dateFrom: eplanDefaultDateRange().from,
    dateTo: eplanDefaultDateRange().to,
    showNotRequired: false,
  }
  const stored = eplanLoadJson<Partial<EPlanPageFilters> | null>(eplanStorageKeys.filters, null)
  if (!stored) return defaults
  return { ...defaults, ...stored }
}

export function saveEPlanFilters(filters: EPlanPageFilters): void {
  eplanSaveJson(eplanStorageKeys.filters, filters)
}

export function createEPlanAction(
  patch: Omit<EPlanAction, 'id' | 'createdAt' | 'updatedAt'>,
): EPlanAction {
  const t = nowIso()
  return { ...patch, id: crypto.randomUUID(), createdAt: t, updatedAt: t }
}

export function updateEPlanAction(actions: EPlanAction[], next: EPlanAction): EPlanAction[] {
  return actions.map((a) => (a.id === next.id ? { ...next, updatedAt: nowIso() } : a))
}

export function deleteEPlanAction(actions: EPlanAction[], id: string): EPlanAction[] {
  const childIds = new Set(actions.filter((a) => a.parentActionId === id).map((a) => a.id))
  return actions.filter((a) => a.id !== id && a.parentActionId !== id && !childIds.has(a.id))
}

export function actionsForCell(actions: EPlanAction[], cellId: string): EPlanAction[] {
  return actions.filter((a) => a.cellId === cellId)
}
