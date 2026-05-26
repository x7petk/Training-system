import { useCallback, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatDdsLabelHint, resolveDdsKpiId, type DdsKpiOption } from './cascadeDdsMatch'
import type { CascadeMetric, CascadeScope } from './cascadeTypes'
import type { KpiCascadeKpi } from './types'

export type LiveMetricPatch = {
  metricId: string
  budget: number
  fact: number
  ddsKpiId?: string
}

type DdsKpiRow = DdsKpiOption & { metric_scope?: string | null }

function sumByKpiId(
  rows: { kpi_id: string; value_numeric: number | null }[],
): Map<string, number> {
  const out = new Map<string, number>()
  for (const row of rows) {
    if (row.value_numeric == null || Number.isNaN(row.value_numeric)) continue
    out.set(row.kpi_id, (out.get(row.kpi_id) ?? 0) + row.value_numeric)
  }
  return out
}

function buildFactMap(
  ddsKpis: DdsKpiRow[],
  cellSums: Map<string, number>,
  siteSums: Map<string, number>,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const kpi of ddsKpis) {
    const scope = kpi.metric_scope ?? 'cell'
    if (scope === 'site') {
      const v = siteSums.get(kpi.id)
      if (v !== undefined) out.set(kpi.id, v)
    } else {
      const v = cellSums.get(kpi.id)
      if (v !== undefined) out.set(kpi.id, v)
    }
  }
  for (const [kpiId, v] of cellSums) {
    if (!out.has(kpiId)) out.set(kpiId, v)
  }
  for (const [kpiId, v] of siteSums) {
    if (!out.has(kpiId)) out.set(kpiId, v)
  }
  return out
}

function buildBudgetMap(
  rows: {
    kpi_id: string
    target_flat: number | null
    target_start: number | null
    target_end: number | null
  }[],
): Map<string, number> {
  const out = new Map<string, number>()
  for (const row of rows) {
    const budget = row.target_flat ?? row.target_end ?? row.target_start ?? null
    if (budget == null || Number.isNaN(budget)) continue
    out.set(row.kpi_id, (out.get(row.kpi_id) ?? 0) + budget)
  }
  return out
}

export function useCascadeLiveData() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLiveValues = useCallback(
    async (
      scope: CascadeScope,
      catalogKpis: KpiCascadeKpi[],
      metrics: CascadeMetric[],
    ): Promise<LiveMetricPatch[]> => {
      if (!scope.dateFrom || !scope.dateTo) {
        setError('Set a date range.')
        return []
      }

      setLoading(true)
      setError(null)

      try {
        const [ddsKpisRes, cellEntriesRes, siteEntriesRes, trendsRes] = await Promise.all([
          supabase.from('dds_kpis').select('id, label, metric_scope').order('sort_order').order('label'),
          supabase
            .from('dds_kpi_cell_entries')
            .select('kpi_id, value_numeric')
            .gte('plan_date', scope.dateFrom)
            .lte('plan_date', scope.dateTo),
          supabase
            .from('dds_kpi_site_entries')
            .select('kpi_id, value_numeric')
            .gte('plan_date', scope.dateFrom)
            .lte('plan_date', scope.dateTo),
          supabase
            .from('dds_wds_trends')
            .select('kpi_id, target_flat, target_start, target_end')
            .eq('is_active', true),
        ])

        if (ddsKpisRes.error) throw ddsKpisRes.error
        if (cellEntriesRes.error) throw cellEntriesRes.error
        if (siteEntriesRes.error) throw siteEntriesRes.error
        if (trendsRes.error) throw trendsRes.error

        const ddsKpis = (ddsKpisRes.data ?? []) as DdsKpiRow[]
        const catalogById = new Map(catalogKpis.map((k) => [k.id, k]))

        const cellSums = sumByKpiId((cellEntriesRes.data ?? []) as { kpi_id: string; value_numeric: number | null }[])
        const siteSums = sumByKpiId((siteEntriesRes.data ?? []) as { kpi_id: string; value_numeric: number | null }[])
        const factByDdsKpi = buildFactMap(ddsKpis, cellSums, siteSums)
        const budgetByDdsKpi = buildBudgetMap(
          (trendsRes.data ?? []) as {
            kpi_id: string
            target_flat: number | null
            target_start: number | null
            target_end: number | null
          }[],
        )

        const entryKpiIds = new Set([...cellSums.keys(), ...siteSums.keys()])

        const patches: LiveMetricPatch[] = []
        const unmatched: string[] = []

        for (const metric of metrics) {
          const catalog = catalogById.get(metric.kpiId)
          if (!catalog) continue

          const ddsId = resolveDdsKpiId(
            catalog.name,
            metric.ddsKpiId ?? catalog.ddsKpiId,
            ddsKpis,
          )

          if (!ddsId) {
            unmatched.push(catalog.name)
            continue
          }

          patches.push({
            metricId: metric.id,
            fact: factByDdsKpi.get(ddsId) ?? metric.fact,
            budget: budgetByDdsKpi.get(ddsId) ?? metric.budget,
            ddsKpiId: ddsId,
          })
        }

        if (patches.length === 0) {
          const withEntries = ddsKpis.filter((d) => entryKpiIds.has(d.id))
          const hintPool = withEntries.length ? withEntries : ddsKpis
          const entryHint =
            entryKpiIds.size === 0
              ? ` No DDS entries between ${scope.dateFrom} and ${scope.dateTo} (all sites and lines).`
              : ''

          setError(
            unmatched.length
              ? `Could not match cascade KPIs (${unmatched.join(', ')}) to DDS labels.${entryHint} DDS labels: ${formatDdsLabelHint(hintPool)}. Set DDS link under Admin → KPIs.`
              : `No cascade metrics to sync.${entryHint}`,
          )
        } else if (unmatched.length > 0) {
          setError(
            `Synced ${patches.length} metric(s) from all sites/lines. Unmatched: ${unmatched.join(', ')}.`,
          )
        }

        return patches
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load live data'
        setError(msg)
        return []
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { fetchLiveValues, loading, error, clearError: () => setError(null) }
}
