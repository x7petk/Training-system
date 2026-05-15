/** P2P Summary matrix filters (localStorage, per user + cell). */

export type DdsP2pSummaryViewPrefs = {
  roles: Record<string, boolean>
  questions: Record<string, boolean>
}

function storageKey(userId: string, cellId: string): string {
  return `rtt-systems.ddsP2pSummary.viewPrefs.v1:${userId}:${cellId}`
}

export function buildDefaultP2pSummaryPrefs(roleNames: string[], questionKeys: string[]): DdsP2pSummaryViewPrefs {
  const roles: Record<string, boolean> = {}
  for (const n of roleNames) roles[n] = true
  const questions: Record<string, boolean> = {}
  for (const k of questionKeys) questions[k] = true
  return { roles, questions }
}

export function mergeP2pSummaryViewPrefs(
  stored: DdsP2pSummaryViewPrefs | null,
  roleNames: string[],
  questionKeys: string[],
): DdsP2pSummaryViewPrefs {
  const roles: Record<string, boolean> = {}
  for (const n of roleNames) {
    roles[n] =
      stored?.roles && Object.prototype.hasOwnProperty.call(stored.roles, n) ? Boolean(stored.roles[n]) : true
  }
  const questions: Record<string, boolean> = {}
  for (const k of questionKeys) {
    questions[k] =
      stored?.questions && Object.prototype.hasOwnProperty.call(stored.questions, k)
        ? Boolean(stored.questions[k])
        : true
  }
  return { roles, questions }
}

export function loadP2pSummaryViewPrefs(userId: string | undefined, cellId: string | null | undefined): DdsP2pSummaryViewPrefs | null {
  if (!userId || !cellId) return null
  try {
    const raw = localStorage.getItem(storageKey(userId, cellId))
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<DdsP2pSummaryViewPrefs>
    if (!p || typeof p !== 'object' || !p.roles || !p.questions) return null
    return { roles: p.roles as Record<string, boolean>, questions: p.questions as Record<string, boolean> }
  } catch {
    return null
  }
}

export function saveP2pSummaryViewPrefs(userId: string, cellId: string, prefs: DdsP2pSummaryViewPrefs): void {
  try {
    localStorage.setItem(storageKey(userId, cellId), JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}
