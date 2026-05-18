import type { EPlanAdminItem, EPlanAdminStore, EPlanOwner } from './eplanTypes'
import { eplanLoadJson, eplanSaveJson, eplanStorageKeys } from './eplanStorage'

const EMPTY: EPlanAdminStore = {
  ogsmPillars: [],
  forums: [],
  labels: [],
  lossTypes: [],
  owners: [],
}

function nowIso(): string {
  return new Date().toISOString()
}

export function loadEPlanAdmin(): EPlanAdminStore {
  return eplanLoadJson(eplanStorageKeys.admin, EMPTY)
}

export function saveEPlanAdmin(store: EPlanAdminStore): void {
  eplanSaveJson(eplanStorageKeys.admin, store)
}

export function defaultEPlanAdmin(): EPlanAdminStore {
  const t = nowIso()
  const item = (name: string, description?: string): EPlanAdminItem => ({
    id: crypto.randomUUID(),
    name,
    description,
    isActive: true,
    createdAt: t,
    updatedAt: t,
  })
  const owner = (name: string, email?: string): EPlanOwner => ({
    id: crypto.randomUUID(),
    name,
    email,
    isActive: true,
    createdAt: t,
    updatedAt: t,
  })
  return {
    ogsmPillars: [
      item('Safety'),
      item('Quality'),
      item('Cost'),
      item('Delivery'),
      item('People'),
      item('Sustainability'),
      item('Asset Management'),
      item('Operational Excellence'),
    ],
    forums: [
      item('Shift DDS'),
      item('Daily DDS'),
      item('Weekly DDS'),
      item('Monthly PDCA'),
      item('Leadership Review'),
      item('Project Review'),
      item('Audit Review'),
      item('Improvement Review'),
    ],
    labels: [
      item('High Priority'),
      item('Compliance'),
      item('Improvement'),
      item('Audit Finding'),
      item('Risk'),
      item('Follow Up'),
      item('Project'),
      item('Behaviour'),
      item('System'),
    ],
    lossTypes: [
      item('Safety'),
      item('Quality'),
      item('Breakdown'),
      item('Rate Loss'),
      item('Planned Downtime'),
      item('Unplanned Downtime'),
      item('Material Issue'),
      item('People Capability'),
      item('System Gap'),
      item('Process Gap'),
    ],
    owners: [
      owner('Alyssa Develter', 'alyssa.develter@example.com'),
      owner('Nick Meynell', 'nick.meynell@example.com'),
      owner('Sam Taylor', 'sam.taylor@example.com'),
      owner('Jordan Lee', 'jordan.lee@example.com'),
      owner('Casey Morgan', 'casey.morgan@example.com'),
      owner('Riley Chen', 'riley.chen@example.com'),
      owner('Morgan Patel', 'morgan.patel@example.com'),
      owner('Jamie Wright', 'jamie.wright@example.com'),
    ],
  }
}

export function activeAdminItems(items: EPlanAdminItem[]): EPlanAdminItem[] {
  return items.filter((i) => i.isActive).sort((a, b) => a.name.localeCompare(b.name))
}

export function activeOwners(owners: EPlanOwner[]): EPlanOwner[] {
  return owners.filter((o) => o.isActive).sort((a, b) => a.name.localeCompare(b.name))
}

export function upsertAdminItem(
  store: EPlanAdminStore,
  key: keyof Pick<EPlanAdminStore, 'ogsmPillars' | 'forums' | 'labels' | 'lossTypes'>,
  item: EPlanAdminItem,
): EPlanAdminStore {
  const list = store[key]
  const idx = list.findIndex((x) => x.id === item.id)
  const next = [...list]
  if (idx >= 0) next[idx] = item
  else next.push(item)
  return { ...store, [key]: next }
}

export function upsertOwner(store: EPlanAdminStore, owner: EPlanOwner): EPlanAdminStore {
  const idx = store.owners.findIndex((o) => o.id === owner.id)
  const next = [...store.owners]
  if (idx >= 0) next[idx] = owner
  else next.push(owner)
  return { ...store, owners: next }
}
