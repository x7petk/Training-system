import type { SupabaseClient } from '@supabase/supabase-js'
import { planDateUtcBounds } from './ddsP2pPlanDayStats'
import { computePlan24KpiMetrics, plan24MetricValue, type Plan24KpiDefectRow, type Plan24KpiEventRow } from './ddsPlan24KpiMetrics'
import {
  isDdsPlan24ValueSource,
  PLAN24_LINE_CONSOLIDATED_SHIFT_KIND,
  type DdsPlan24ValueSource,
} from './ddsPlan24ValueSource'

export type Plan24KpiRollupMode = 'per_shift' | 'line_consolidated'

type KpiWithSource = { id: string; plan24_value_source: string }

/**
 * Refresh Plan 24–sourced KPI cell entries on DDS load.
 * Skips rows with `plan24_manual_override`. Line DDS uses `day_night` shift_kind for consolidated day+night.
 */
export async function refreshKpiPlan24Rollups(
  supabase: SupabaseClient,
  args: {
    masterCellId: string
    planDate: string
    mode: Plan24KpiRollupMode
    shiftKind?: string
    updatedBy: string | null
  },
): Promise<void> {
  const { masterCellId, planDate, mode, updatedBy } = args
  const shiftKind = args.shiftKind?.trim() ?? ''

  const { data: kpiRows, error: kpiErr } = await supabase
    .from('dds_kpis')
    .select('id, plan24_value_source')
    .not('plan24_value_source', 'is', null)
  if (kpiErr) throw new Error(kpiErr.message)

  const kpis = ((kpiRows ?? []) as KpiWithSource[]).filter((k) => isDdsPlan24ValueSource(k.plan24_value_source))
  if (kpis.length === 0) return

  if (mode === 'per_shift' && !shiftKind) return

  const entryShiftKind = mode === 'line_consolidated' ? PLAN24_LINE_CONSOLIDATED_SHIFT_KIND : shiftKind

  const eventShiftFilter =
    mode === 'line_consolidated' ? (['day', 'night'] as const) : ([shiftKind] as const)

  const [evRes, defRes, openRes] = await Promise.all([
    supabase
      .from('plan24_events')
      .select('shift_kind, event_type, status, linked_issue_kind, linked_issue_id')
      .eq('master_cell_id', masterCellId)
      .eq('plan_date', planDate)
      .is('deleted_at', null)
      .in('event_type', ['check', 'cl_check', 'cil_check', 'quality_check'])
      .in('shift_kind', [...eventShiftFilter]),
    loadDefectsForDayMetrics(supabase, masterCellId, planDate),
    supabase
      .from('dh_defects')
      .select('status, created_at, resolved_at, closed_at')
      .eq('master_cell_id', masterCellId)
      .is('deleted_at', null)
      .in('status', ['open', 'in_progress']),
  ])

  if (evRes.error) throw new Error(evRes.error.message)
  if (defRes.error) throw new Error(defRes.error.message)
  if (openRes.error) throw new Error(openRes.error.message)

  const events = (evRes.data ?? []) as Plan24KpiEventRow[]
  const dayDefects = (defRes.data ?? []) as Plan24KpiDefectRow[]
  const openDefects = (openRes.data ?? []) as Plan24KpiDefectRow[]

  const metrics = computePlan24KpiMetrics({ planDate, events, defects: dayDefects })
  metrics.defects_open_count = computePlan24KpiMetrics({
    planDate,
    events: [],
    defects: openDefects,
  }).defects_open_count

  for (const kpi of kpis) {
    const source = kpi.plan24_value_source as DdsPlan24ValueSource
    const value = plan24MetricValue(metrics, source)

    const { data: existing, error: exErr } = await supabase
      .from('dds_kpi_cell_entries')
      .select('id, plan24_manual_override')
      .eq('master_cell_id', masterCellId)
      .eq('kpi_id', kpi.id)
      .eq('plan_date', planDate)
      .eq('shift_kind', entryShiftKind)
      .maybeSingle()
    if (exErr) throw new Error(exErr.message)
    if (existing?.plan24_manual_override) continue

    const { error: upErr } = await supabase.from('dds_kpi_cell_entries').upsert(
      {
        master_cell_id: masterCellId,
        kpi_id: kpi.id,
        plan_date: planDate,
        shift_kind: entryShiftKind,
        value_numeric: value,
        comment: null,
        plan24_manual_override: false,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'master_cell_id,kpi_id,plan_date,shift_kind' },
    )
    if (upErr) throw new Error(upErr.message)
  }
}

async function loadDefectsForDayMetrics(
  supabase: SupabaseClient,
  masterCellId: string,
  planDate: string,
): Promise<{ data: Plan24KpiDefectRow[] | null; error: { message: string } | null }> {
  const { start, end } = planDateUtcBounds(planDate)
  return supabase
    .from('dh_defects')
    .select('status, created_at, resolved_at, closed_at')
    .eq('master_cell_id', masterCellId)
    .is('deleted_at', null)
    .or(`created_at.gte.${start},resolved_at.gte.${start},closed_at.gte.${start}`)
    .or(`created_at.lt.${end},resolved_at.lt.${end},closed_at.lt.${end}`)
}
