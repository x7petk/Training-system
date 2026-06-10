const ACTIONS_KEY = 'rtt-systems.eplan.actions.v1'
const ADMIN_KEY = 'rtt-systems.eplan.admin.v1'
const FILTERS_KEY = 'rtt-systems.eplan.filters.v1'
const SEEDED_KEY = 'rtt-systems.eplan.seeded.v1'
const SAMPLE_PACK_CELLS_KEY = 'rtt-systems.eplan.sample-pack-cells.v2'

export function eplanLoadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function eplanSaveJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota */
  }
}

export const eplanStorageKeys = {
  actions: ACTIONS_KEY,
  admin: ADMIN_KEY,
  filters: FILTERS_KEY,
  seeded: SEEDED_KEY,
  samplePackCells: SAMPLE_PACK_CELLS_KEY,
} as const
