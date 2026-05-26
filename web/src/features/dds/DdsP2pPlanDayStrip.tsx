import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  buildP2pPlanFamilyTrends,
  buildP2pPlanRoleIssueCounts,
  countUnlinkedCilDefectsForRole,
  p2pPlanCompletionTone,
  p2pPlanRaisedCountClass,
  planDateUtcBounds,
  trendDateRange,
  type P2pPlanEventRow,
  type P2pPlanFamilyTrend,
} from './ddsP2pPlanDayStats'

const LANE_MAX_PX = 14

function FamilyTrendChip({ fam, roleName }: { fam: P2pPlanFamilyTrend; roleName: string }) {
  return (
    <div
      className="flex shrink-0 items-center gap-1"
      title={`${fam.label}: ${fam.todayPct}% complete for ${roleName || 'role'} on this shift (7-day lanes, oldest→today)`}
    >
      <span className="text-[9px] font-semibold uppercase tracking-wide text-muted">{fam.label}</span>
      <span className="min-w-[1.75rem] text-right text-[10px] font-bold tabular-nums text-black dark:text-black">
        {fam.todayPct}%
      </span>
      <div
        className="flex h-[14px] shrink-0 items-end gap-px"
        role="img"
        aria-label={`${fam.label} completion last 7 days`}
      >
        {fam.trendPct.map((pct, i) => {
          const tone = p2pPlanCompletionTone(pct)
          const isToday = i === fam.trendPct.length - 1
          const barH = pct <= 0 ? 2 : Math.max(3, Math.round((pct / 100) * LANE_MAX_PX))
          return (
            <div
              key={i}
              className={`w-[3px] rounded-[1px] ${tone.bar} ${isToday ? 'ring-1 ring-fg/25' : 'opacity-85'}`}
              style={{ height: `${barH}px` }}
              title={`Day ${i + 1}: ${pct}%`}
            />
          )
        })}
      </div>
    </div>
  )
}

type Props = {
  cellId: string
  planDate: string
  shiftKind: string
  /** Selected roster role — completion % matches “My plan” for this role. */
  roleName: string
  refreshToken?: number
}

export function DdsP2pPlanDayStrip({
  cellId,
  planDate,
  shiftKind,
  roleName,
  refreshToken = 0,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [events, setEvents] = useState<P2pPlanEventRow[]>([])
  const [extraDefectCount, setExtraDefectCount] = useState(0)

  const fetchEvents = useCallback(async () => {
    const dates = trendDateRange(planDate)
    const fromDate = dates[0]!
    const { start, end } = planDateUtcBounds(planDate)
    const [evRes, defRes] = await Promise.all([
      supabase
        .from('plan24_events')
        .select(
          'plan_date, shift_kind, event_type, status, role_name, linked_issue_kind, linked_issue_id, cil_template_id',
        )
        .eq('master_cell_id', cellId)
        .eq('shift_kind', shiftKind)
        .gte('plan_date', fromDate)
        .lte('plan_date', planDate)
        .is('deleted_at', null)
        .in('event_type', ['check', 'cl_check', 'cil_check', 'quality_check']),
      supabase
        .from('dh_defects')
        .select('id, cil_template_id, cil_template_task_id')
        .eq('master_cell_id', cellId)
        .is('deleted_at', null)
        .gte('created_at', start)
        .lt('created_at', end),
    ])
    if (evRes.error) throw evRes.error
    const evs = (evRes.data ?? []) as P2pPlanEventRow[]
    setEvents(evs)
    if (defRes.error) throw defRes.error
    const extraDefects = roleName.trim()
      ? countUnlinkedCilDefectsForRole(
          (defRes.data ?? []) as {
            id: string
            cil_template_id: string | null
            cil_template_task_id: string | null
          }[],
          evs,
          planDate,
          roleName,
        )
      : 0
    setExtraDefectCount(extraDefects)
  }, [cellId, planDate, shiftKind, roleName])

  const loadFull = useCallback(async () => {
    if (!cellId || !planDate || !shiftKind) {
      setEvents([])
      setExtraDefectCount(0)
      return
    }
    setLoading(true)
    setLoadErr(null)
    try {
      await Promise.all([
        supabase.rpc('plan24_materialize_check_schedules', {
          p_master_cell_id: cellId,
          p_from_date: planDate,
          p_to_date: planDate,
        }),
        supabase.rpc('plan24_materialize_cl_check_schedules', {
          p_master_cell_id: cellId,
          p_from_date: planDate,
          p_to_date: planDate,
        }),
        supabase.rpc('plan24_materialize_cil_check_schedules', {
          p_master_cell_id: cellId,
          p_from_date: planDate,
          p_to_date: planDate,
        }),
        supabase.rpc('plan24_materialize_quality_check_schedules', {
          p_master_cell_id: cellId,
          p_from_date: planDate,
          p_to_date: planDate,
        }),
      ])
      await fetchEvents()
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not load plan stats')
      setEvents([])
      setExtraDefectCount(0)
    } finally {
      setLoading(false)
    }
  }, [cellId, planDate, shiftKind, fetchEvents])

  const reloadQuick = useCallback(async () => {
    if (!cellId || !planDate || !shiftKind) return
    setLoadErr(null)
    try {
      await fetchEvents()
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Could not refresh plan stats')
    }
  }, [cellId, planDate, shiftKind, fetchEvents])

  const scopeKey = `${cellId}|${planDate}|${shiftKind}`

  useEffect(() => {
    void loadFull()
  }, [scopeKey, loadFull])

  useEffect(() => {
    if (refreshToken === 0) return
    void reloadQuick()
  }, [refreshToken, reloadQuick])

  const familyTrends = useMemo(
    () => buildP2pPlanFamilyTrends(events, planDate, roleName),
    [events, planDate, roleName],
  )
  const roleRaised = useMemo(() => {
    if (!roleName.trim()) return { deviations: 0, defects: 0, qualityFails: 0 }
    const rows = buildP2pPlanRoleIssueCounts(events, planDate, [roleName])
    const row = rows[0]
    return {
      deviations: row?.deviations ?? 0,
      defects: (row?.defects ?? 0) + extraDefectCount,
      qualityFails: row?.qualityFails ?? 0,
    }
  }, [events, planDate, roleName, extraDefectCount])

  if (!cellId || !shiftKind) return null

  return (
    <div
      className="flex shrink-0 items-center gap-2 overflow-x-auto rounded-md border border-border/70 bg-surface-raised/30 px-2 py-1 text-[10px] leading-none"
      aria-label={`Plan completion for ${roleName} and issues raised today`}
    >
      {loading ? (
        <Loader2 className="size-3 shrink-0 animate-spin text-muted" aria-hidden />
      ) : (
        familyTrends.map((fam) => <FamilyTrendChip key={fam.key} fam={fam} roleName={roleName} />)
      )}
      <span className="shrink-0 text-border" aria-hidden>
        |
      </span>
      <span className="shrink-0 text-muted">Deviations:</span>
      <span
        className={`inline-block min-w-[1ch] shrink-0 text-[11px] font-bold leading-normal tabular-nums ${p2pPlanRaisedCountClass(roleRaised.deviations)}`}
      >
        {roleRaised.deviations}
      </span>
      <span className="shrink-0 text-muted">Defects:</span>
      <span
        className={`inline-block min-w-[1ch] shrink-0 text-[11px] font-bold leading-normal tabular-nums ${p2pPlanRaisedCountClass(roleRaised.defects)}`}
      >
        {roleRaised.defects}
      </span>
      <span className="shrink-0 text-muted">Fails:</span>
      <span
        className={`inline-block min-w-[1ch] shrink-0 text-[11px] font-bold leading-normal tabular-nums ${p2pPlanRaisedCountClass(roleRaised.qualityFails)}`}
      >
        {roleRaised.qualityFails}
      </span>
      {loadErr ? <span className="shrink-0 text-[9px] text-rose-600 dark:text-rose-400">{loadErr}</span> : null}
    </div>
  )
}
