import type { LdrScopeLevel } from './LdrWorkspaceContext'

const STORAGE_KEY = 'ldr.roster.returnScope.v1'
const MAX_AGE_MS = 60 * 60 * 1000

export type LdrRosterReturnScopePayload = {
  scopeLevel: LdrScopeLevel
  siteId: string
  plantId: string
  cellId: string
}

/** Call before navigating from the leadership roster to HC / observation flows. */
export function stashLdrRosterReturnScope(p: LdrRosterReturnScopePayload): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...p, savedAt: Date.now() }))
  } catch {
    /* ignore quota / private mode */
  }
}

/** Read and clear stashed roster scope (one shot). Returns null if missing, stale, or invalid. */
export function consumeLdrRosterReturnScope(): LdrRosterReturnScopePayload | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    sessionStorage.removeItem(STORAGE_KEY)
    const o = JSON.parse(raw) as {
      scopeLevel?: string
      siteId?: string
      plantId?: string
      cellId?: string
      savedAt?: number
    }
    if (typeof o.savedAt !== 'number' || Date.now() - o.savedAt > MAX_AGE_MS) return null
    if (o.scopeLevel !== 'site' && o.scopeLevel !== 'cell') return null
    if (typeof o.siteId !== 'string' || !o.siteId) return null
    const plantId = typeof o.plantId === 'string' ? o.plantId : ''
    const cellId = typeof o.cellId === 'string' ? o.cellId : ''
    if (o.scopeLevel === 'cell' && (!plantId || !cellId)) return null
    return {
      scopeLevel: o.scopeLevel,
      siteId: o.siteId,
      plantId,
      cellId,
    }
  } catch {
    return null
  }
}
