/** Selected roster role for P2P Op view (localStorage, per user + cell). */

function storageKey(userId: string, cellId: string): string {
  return `rtt-systems.ddsP2pOpView.roleId.v1:${userId}:${cellId}`
}

export function loadP2pOpViewRoleId(userId: string | undefined, cellId: string | null | undefined): string | null {
  if (!userId || !cellId) return null
  try {
    const raw = localStorage.getItem(storageKey(userId, cellId))
    return raw?.trim() || null
  } catch {
    return null
  }
}

export function saveP2pOpViewRoleId(userId: string, cellId: string, roleId: string): void {
  try {
    localStorage.setItem(storageKey(userId, cellId), roleId)
  } catch {
    /* ignore */
  }
}
