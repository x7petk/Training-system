import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { DdsByLineKpiTable, type ByLineKpiDef, type ByLineTableColumn } from './DdsByLineKpiTable'
import { DdsByCellKpiTable, type ByCellKpiDef, type ByCellTableColumn } from './DdsByCellKpiTable'
import { ddsKpiCellColumnLabel, type DdsCellLine, type DdsKpiCellEntry, type DdsKpiLineEntry } from './ddsCellLines'
import { kpiShowsOnDdsSurface } from './ddsKpiDdsSetupSurfaces'
import { isDdsKpiSiteByLine, isDdsKpiSiteConsolidated } from './ddsKpiSitePresentation'
import { buildLineScoringMap, parseDdsKpiScoring } from './ddsKpiScoring'
import type { DdsKpiScoring } from './ddsKpiScoring'
import { parseDdsKpiUnit } from './ddsKpiUnits'
import { subscribeDdsP2pKpiRollupDone } from './ddsP2pKpiRollupEvents'
import { mergeMeetingDayCellEntries, mergeMeetingDayLineEntries, p2pRollupEventMatchesMeetingDay } from './ddsKpiP2pRollup'

type KpiGroup = { id: string; name: string; sort_order: number }

type KpiRow = {
  id: string
  kpi_group_id: string
  label: string
  sort_order: number
  point_kind: string | null
  display_sections: string[] | null
  site_dds_presentation: string | null
  unit: string | null
  scoring: unknown
  plan24_value_source: string | null
}

type Props = {
  cellId: string
  planDate: string
  shiftKind: string
  shellLoading?: boolean
}

export function LineDdsKpiSummary({ cellId, planDate, shiftKind, shellLoading }: Props) {
  const [groups, setGroups] = useState<KpiGroup[]>([])
  const [kpis, setKpis] = useState<KpiRow[]>([])
  const [surfaceOverrides, setSurfaceOverrides] = useState<Map<string, string[]>>(new Map())
  const [cellName, setCellName] = useState('')
  const [cellLines, setCellLines] = useState<DdsCellLine[]>([])
  const [lineEntries, setLineEntries] = useState<DdsKpiLineEntry[]>([])
  const [mergedCellEntries, setMergedCellEntries] = useState<DdsKpiCellEntry[]>([])
  const [lineScoringByKey, setLineScoringByKey] = useState<Map<string, DdsKpiScoring>>(new Map())
  const [loading, setLoading] = useState(true)
  const [epoch, setEpoch] = useState(0)

  const load = useCallback(async () => {
    if (!cellId || !planDate) {
      setGroups([])
      setKpis([])
      setLoading(false)
      return
    }
    setLoading(true)
    const [gRes, kRes, oRes, cellRes, linesRes, lineEntRes, cellEntRes] = await Promise.all([
      supabase.from('dds_kpi_groups').select('id, name, sort_order').order('sort_order').order('name'),
      supabase
        .from('dds_kpis')
        .select('id, kpi_group_id, label, sort_order, point_kind, display_sections, site_dds_presentation, unit, scoring, plan24_value_source')
        .order('sort_order')
        .order('label'),
      supabase.from('dds_kpi_cell_dds_display').select('kpi_id, surfaces').eq('master_cell_id', cellId),
      supabase.from('master_cells').select('name').eq('id', cellId).maybeSingle(),
      supabase
        .from('dds_cell_lines')
        .select('id, master_cell_id, name, sort_order, active')
        .eq('master_cell_id', cellId)
        .eq('active', true)
        .order('sort_order')
        .order('name'),
      supabase
        .from('dds_kpi_line_entries')
        .select('id, master_cell_id, line_id, kpi_id, shift_kind, value_numeric, comment, p2p_breakdown')
        .eq('master_cell_id', cellId)
        .eq('plan_date', planDate),
      supabase
        .from('dds_kpi_cell_entries')
        .select('id, kpi_id, master_cell_id, shift_kind, value_numeric, comment, p2p_breakdown')
        .eq('master_cell_id', cellId)
        .eq('plan_date', planDate),
    ])
    setLoading(false)
    if (gRes.error || kRes.error || oRes.error || linesRes.error || lineEntRes.error || cellEntRes.error) return

    const kpiList = (kRes.data ?? []) as KpiRow[]
    const lineList = (linesRes.data ?? []) as DdsCellLine[]
    const byLineKpiIds = kpiList.filter((k) => isDdsKpiSiteByLine(k.site_dds_presentation)).map((k) => k.id)
    const lineIds = lineList.map((l) => l.id)
    let nextLineScoring = new Map<string, DdsKpiScoring>()
    if (byLineKpiIds.length > 0 && lineIds.length > 0) {
      const { data: lsData, error: lsErr } = await supabase
        .from('dds_kpi_line_scoring')
        .select('kpi_id, line_id, scoring')
        .in('kpi_id', byLineKpiIds)
        .in('line_id', lineIds)
      if (lsErr) return
      nextLineScoring = buildLineScoringMap((lsData ?? []) as { kpi_id: string; line_id: string; scoring: unknown }[])
    }

    setGroups((gRes.data ?? []) as KpiGroup[])
    setKpis(kpiList)
    setCellName((cellRes.data as { name?: string } | null)?.name ?? '')
    const oMap = new Map<string, string[]>()
    for (const row of (oRes.data ?? []) as { kpi_id: string; surfaces: string[] }[]) {
      oMap.set(row.kpi_id, row.surfaces ?? [])
    }
    setSurfaceOverrides(oMap)
    setCellLines(lineList)
    setLineScoringByKey(nextLineScoring)
    setLineEntries(
      mergeMeetingDayLineEntries(
        (lineEntRes.data ?? []) as Array<{
          id: string
          master_cell_id: string
          line_id: string
          kpi_id: string
          shift_kind: string
          value_numeric: number | null
          comment: string | null
          p2p_breakdown: unknown
        }>,
      ),
    )
    setMergedCellEntries(
      mergeMeetingDayCellEntries(
        (cellEntRes.data ?? []) as Array<{
          id: string
          master_cell_id: string
          kpi_id: string
          shift_kind: string
          value_numeric: number | null
          comment: string | null
          p2p_breakdown: unknown
        }>,
      ),
    )
  }, [cellId, planDate, shiftKind])

  useEffect(() => {
    void load()
  }, [load, epoch])

  useEffect(() => {
    return subscribeDdsP2pKpiRollupDone((d) => {
      if (d.masterCellId !== cellId || d.planDate !== planDate) return
      if (!p2pRollupEventMatchesMeetingDay({ eventShiftKind: d.shiftKind, viewShiftKind: shiftKind, meetingSurface: true })) {
        return
      }
      setEpoch((n) => n + 1)
    })
  }, [cellId, planDate, shiftKind])

  const kpiVisibleOnLineDds = useCallback(
    (kpi: KpiRow) =>
      kpiShowsOnDdsSurface(
        { point_kind: kpi.point_kind, display_sections: kpi.display_sections },
        'line-dds',
        surfaceOverrides.has(kpi.id) ? surfaceOverrides.get(kpi.id)! : null,
      ),
    [surfaceOverrides],
  )

  const lineColumns = useMemo((): ByLineTableColumn[] => {
    return [...cellLines]
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((line) => ({
        line,
        cellId,
        columnLabel: line.name,
      }))
  }, [cellLines, cellId])

  const cellColumns = useMemo((): ByCellTableColumn[] => {
    return [{ cellId, columnLabel: ddsKpiCellColumnLabel(cellName || 'Cell') }]
  }, [cellId, cellName])

  const { perCellKpiIds, perCellByGroup, byLineByGroup } = useMemo(() => {
    const perCell = new Set<string>()
    const perCellGroups = new Map<string, ByCellKpiDef[]>()
    const byLine = new Map<string, ByLineKpiDef[]>()

    for (const k of kpis) {
      if (!kpiVisibleOnLineDds(k)) continue
      if (isDdsKpiSiteByLine(k.site_dds_presentation)) {
        const list = byLine.get(k.kpi_group_id) ?? []
        list.push({
          id: k.id,
          label: k.label,
          sort_order: k.sort_order,
          unit: parseDdsKpiUnit(k.unit),
          scoring: parseDdsKpiScoring(k.scoring),
        })
        byLine.set(k.kpi_group_id, list)
      } else if (isDdsKpiSiteConsolidated(k.site_dds_presentation)) {
        continue
      } else {
        perCell.add(k.id)
        const list = perCellGroups.get(k.kpi_group_id) ?? []
        list.push({
          id: k.id,
          label: k.label,
          sort_order: k.sort_order,
          unit: parseDdsKpiUnit(k.unit),
          scoring: parseDdsKpiScoring(k.scoring),
          plan24_value_source: k.plan24_value_source ?? null,
        })
        perCellGroups.set(k.kpi_group_id, list)
      }
    }

    for (const [, list] of byLine) {
      list.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
    }
    for (const [, list] of perCellGroups) {
      list.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
    }

    return { perCellKpiIds: perCell, perCellByGroup: perCellGroups, byLineByGroup: byLine }
  }, [kpis, kpiVisibleOnLineDds])

  const sortedGroups = useMemo(() => {
    const withContent = groups.filter((g) => {
      const hasByLine = (byLineByGroup.get(g.id) ?? []).length > 0
      const hasPerCell = kpis.some(
        (k) => k.kpi_group_id === g.id && perCellKpiIds.has(k.id) && kpiVisibleOnLineDds(k),
      )
      return hasByLine || hasPerCell
    })
    return [...withContent].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  }, [groups, byLineByGroup, perCellByGroup, kpis, perCellKpiIds, kpiVisibleOnLineDds])

  if (shellLoading || loading) {
    return (
      <p className="flex items-center gap-1 text-[11px] text-muted" role="status">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading…
      </p>
    )
  }

  if (sortedGroups.length === 0) {
    return (
      <p className="text-[11px] text-muted">
        No KPIs on <strong className="text-fg/80">Line DDS</strong> for this cell. Configure under Admin → KPIs / KPI
        set-up.
      </p>
    )
  }

  return (
    <div className="space-y-1">
      {sortedGroups.map((g) => {
        const byLineKpis = byLineByGroup.get(g.id) ?? []
        const perCellKpis = perCellByGroup.get(g.id) ?? []

        return (
          <section key={g.id}>
            <h3 className="mb-0 border-b border-border/60 pb-0 text-[8px] font-semibold uppercase tracking-wide text-muted">
              {g.name}
            </h3>
            <div className="space-y-0.5">
              {byLineKpis.length > 0 ? (
                <DdsByLineKpiTable
                  columns={lineColumns}
                  kpis={byLineKpis}
                  entries={lineEntries}
                  planDate={planDate}
                  shiftKind={shiftKind}
                  lineScoringByKey={lineScoringByKey}
                  compact
                  emptyLinesMessage="No lines for this cell. Add lines under Admin → Cell lines."
                  onSaved={() => setEpoch((n) => n + 1)}
                />
              ) : null}
              {perCellKpis.length > 0 ? (
                <DdsByCellKpiTable
                  columns={cellColumns}
                  kpis={perCellKpis}
                  entries={mergedCellEntries}
                  planDate={planDate}
                  shiftKind={shiftKind}
                  kpiSurface="line-dds"
                  hideHeader
                  compact
                  onSaved={() => setEpoch((n) => n + 1)}
                />
              ) : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}
