/** After a successful P2P submit + KPI rollup: same-tab `window` event + `BroadcastChannel` for other tabs. */

const CHANNEL_NAME = 'dds-p2p-kpi-rollup'

export const DDS_P2P_KPI_ROLLUP_DONE = 'dds-p2p-kpi-rollup-done'

export type DdsP2pKpiRollupDoneDetail = {
  masterCellId: string
  planDate: string
  shiftKind: string
}

function isRollupDetail(d: unknown): d is DdsP2pKpiRollupDoneDetail {
  if (!d || typeof d !== 'object') return false
  const o = d as Record<string, unknown>
  return (
    typeof o.masterCellId === 'string' &&
    typeof o.planDate === 'string' &&
    typeof o.shiftKind === 'string'
  )
}

export function dispatchDdsP2pKpiRollupDone(detail: DdsP2pKpiRollupDoneDetail): void {
  if (typeof window === 'undefined') return
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const ch = new BroadcastChannel(CHANNEL_NAME)
      ch.postMessage(detail)
      ch.close()
    } catch {
      window.dispatchEvent(new CustomEvent<DdsP2pKpiRollupDoneDetail>(DDS_P2P_KPI_ROLLUP_DONE, { detail }))
    }
  } else {
    window.dispatchEvent(new CustomEvent<DdsP2pKpiRollupDoneDetail>(DDS_P2P_KPI_ROLLUP_DONE, { detail }))
  }
}

function parseRollupDoneDetail(ev: Event): DdsP2pKpiRollupDoneDetail | null {
  if (!(ev instanceof CustomEvent)) return null
  return isRollupDetail(ev.detail) ? ev.detail : null
}

export function subscribeDdsP2pKpiRollupDone(handler: (detail: DdsP2pKpiRollupDoneDetail) => void): () => void {
  const onWin = (ev: Event) => {
    const d = parseRollupDoneDetail(ev)
    if (d) handler(d)
  }
  window.addEventListener(DDS_P2P_KPI_ROLLUP_DONE, onWin)

  let bc: BroadcastChannel | null = null
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      bc = new BroadcastChannel(CHANNEL_NAME)
      bc.onmessage = (msg: MessageEvent<unknown>) => {
        if (isRollupDetail(msg.data)) handler(msg.data)
      }
    } catch {
      bc = null
    }
  }

  return () => {
    window.removeEventListener(DDS_P2P_KPI_ROLLUP_DONE, onWin)
    bc?.close()
  }
}
