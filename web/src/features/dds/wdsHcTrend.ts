import { eventLocalDate } from '../report/reportBucketUtils'
import { hcRagFromPercent, type HcRag } from '../health-checks/hcScore'
import type { WdsWeekSlot } from './ddsWds'
import type { WdsChartTone, WdsTrendSeries } from './WdsTrendChart'

/** Green band threshold (matches LDR HC RAG: >80% green). */
export const WDS_HC_GLIDE_TARGET = 80

export type WdsHcRecordLite = {
  id: string
  completed_at: string
  score: number
  status: HcRag
  hc_type_id: string
  type_name: string
}

export function hcRagToWdsTone(rag: HcRag | null | undefined): WdsChartTone {
  if (rag === 'green') return 'good'
  if (rag === 'amber') return 'warn'
  if (rag === 'red') return 'bad'
  return 'neutral'
}

export function buildWdsHcTrendSeries(
  records: WdsHcRecordLite[],
  weeks: WdsWeekSlot[],
  hcTypeId: string | null,
): WdsTrendSeries | null {
  if (!hcTypeId) return null
  const scoped = records.filter((r) => r.hc_type_id === hcTypeId)

  const valueByWeek: (number | null)[] = Array.from({ length: weeks.length }, () => null)
  const grouped: number[][] = Array.from({ length: weeks.length }, () => [])
  const recordCountByWeek: number[] = Array.from({ length: weeks.length }, () => 0)

  for (const r of scoped) {
    const ymd = eventLocalDate(r.completed_at)
    const ix = weeks.findIndex((w) => ymd >= w.startYmd && ymd <= w.endYmd)
    if (ix < 0) continue
    grouped[ix]!.push(r.score)
    recordCountByWeek[ix] = (recordCountByWeek[ix] ?? 0) + 1
  }

  for (let i = 0; i < weeks.length; i += 1) {
    const vals = grouped[i] ?? []
    if (vals.length === 0) {
      valueByWeek[i] = null
      continue
    }
    valueByWeek[i] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
  }

  const targetByWeek = valueByWeek.map(() => WDS_HC_GLIDE_TARGET)
  const toneByWeek = valueByWeek.map((v) => {
    if (v == null || !Number.isFinite(v)) return 'neutral'
    return hcRagToWdsTone(hcRagFromPercent(v))
  })

  return {
    valueByWeek,
    targetByWeek,
    toneByWeek,
    commentCountByWeek: recordCountByWeek,
  }
}
