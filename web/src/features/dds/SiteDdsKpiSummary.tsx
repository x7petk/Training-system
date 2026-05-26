import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { DdsByLineKpiTable, type ByLineKpiDef, type ByLineTableColumn } from './DdsByLineKpiTable'
import { DdsByCellKpiTable, type ByCellKpiDef, type ByCellTableColumn } from './DdsByCellKpiTable'
import { SiteDdsConsolidatedKpiStrip, type ConsolidatedKpiDef } from './SiteDdsConsolidatedKpiStrip'
import { ddsKpiCellColumnLabel, type DdsCellLine, type DdsKpiCellEntry, type DdsKpiLineEntry } from './ddsCellLines'
import { kpiShowsOnDdsSurface } from './ddsKpiDdsSetupSurfaces'
import {
  isDdsKpiSiteByLine,
  parseDdsKpiSiteRollupMode,
} from './ddsKpiSitePresentation'
import { parseDdsKpiScoring, buildLineScoringMap, type DdsKpiScoring } from './ddsKpiScoring'
import { parseDdsKpiUnit } from './ddsKpiUnits'
import { subscribeDdsP2pKpiRollupDone } from './ddsP2pKpiRollupEvents'
import {
  mergeMeetingDayCellEntries,
  mergeMeetingDayKpiCellEntry,
  mergeMeetingDayLineEntries,
  p2pRollupEventMatchesMeetingDay,
  type DdsP2pKpiBreakdownItem,
} from './ddsKpiP2pRollup'

type CellLite = { id: string; name: string }

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
  siteId: string
  cells: CellLite[]
  planDate: string
  shiftKind: string
  shellLoading?: boolean
}

export function SiteDdsKpiSummary({ siteId, cells, planDate, shiftKind, shellLoading }: Props) {
  const cellIds = useMemo(() => cells.map((c) => c.id), [cells])
  const [groups, setGroups] = useState<KpiGroup[]>([])
  const [kpis, setKpis] = useState<KpiRow[]>([])
  const [overridesByCell, setOverridesByCell] = useState<Map<string, Map<string, string[]>>>(new Map())
  const [cellEntries, setCellEntries] = useState<
    {
      id: string
      kpi_id: string
      master_cell_id: string
      shift_kind: string
      value_numeric: number | null
      comment: string | null
      p2p_breakdown: unknown
    }[]
  >([])
  const [siteEntries, setSiteEntries] = useState<
    Record<string, { id: string; kpi_id: string; value_numeric: number | null; comment: string | null }>
  >({})
  const [cellLines, setCellLines] = useState<DdsCellLine[]>([])
  const [lineEntries, setLineEntries] = useState<DdsKpiLineEntry[]>([])
  const [mergedCellEntries, setMergedCellEntries] = useState<DdsKpiCellEntry[]>([])
  const [lineScoringByKey, setLineScoringByKey] = useState<Map<string, DdsKpiScoring>>(new Map())
  const [loading, setLoading] = useState(true)
  const [epoch, setEpoch] = useState(0)
  const load = useCallback(async () => {
    if (!siteId || !planDate || cellIds.length === 0) {
      setGroups([])
      setKpis([])
      setLoading(false)
      return
    }
    setLoading(true)
    const [gRes, kRes, oRes, eRes, sRes, linesRes, lineEntRes] = await Promise.all([
      supabase.from('dds_kpi_groups').select('id, name, sort_order').order('sort_order').order('name'),
      supabase
        .from('dds_kpis')
        .select('id, kpi_group_id, label, sort_order, point_kind, display_sections, site_dds_presentation, unit, scoring, plan24_value_source')
        .order('sort_order')
        .order('label'),
      supabase.from('dds_kpi_cell_dds_display').select('master_cell_id, kpi_id, surfaces').in('master_cell_id', cellIds),
      supabase
        .from('dds_kpi_cell_entries')
        .select('id, kpi_id, master_cell_id, shift_kind, value_numeric, comment, p2p_breakdown')
        .in('master_cell_id', cellIds)
        .eq('plan_date', planDate),
      supabase
        .from('dds_kpi_site_entries')
        .select('id, kpi_id, value_numeric, comment')
        .eq('master_site_id', siteId)
        .eq('plan_date', planDate)
        .eq('shift_kind', shiftKind),
      supabase
        .from('dds_cell_lines')
        .select('id, master_cell_id, name, sort_order, active')
        .in('master_cell_id', cellIds)
        .eq('active', true)
        .order('sort_order')
        .order('name'),
      supabase
        .from('dds_kpi_line_entries')
        .select('id, master_cell_id, line_id, kpi_id, shift_kind, value_numeric, comment, p2p_breakdown')
        .in('master_cell_id', cellIds)
        .eq('plan_date', planDate),
    ])
    setLoading(false)
    if (gRes.error || kRes.error || oRes.error || eRes.error || sRes.error || linesRes.error || lineEntRes.error) {
      return
    }

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
    const oMap = new Map<string, Map<string, string[]>>()
    for (const row of (oRes.data ?? []) as { master_cell_id: string; kpi_id: string; surfaces: string[] }[]) {
      if (!oMap.has(row.master_cell_id)) oMap.set(row.master_cell_id, new Map())
      oMap.get(row.master_cell_id)!.set(row.kpi_id, row.surfaces ?? [])
    }
    setOverridesByCell(oMap)
    setCellEntries(
      (eRes.data ?? []) as {
        id: string
        kpi_id: string
        master_cell_id: string
        shift_kind: string
        value_numeric: number | null
        comment: string | null
        p2p_breakdown: unknown
      }[],
    )
    const se: typeof siteEntries = {}
    for (const row of (sRes.data ?? []) as {
      id: string
      kpi_id: string
      value_numeric: number | null
      comment: string | null
    }[]) {
      se[row.kpi_id] = row
    }
    setSiteEntries(se)
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
        (eRes.data ?? []) as Array<{
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
  }, [siteId, cellIds, planDate, shiftKind])

  useEffect(() => {
    void load()
  }, [load, epoch])

  useEffect(() => {
    return subscribeDdsP2pKpiRollupDone((d) => {
      if (d.planDate !== planDate) return
      if (!p2pRollupEventMatchesMeetingDay({ eventShiftKind: d.shiftKind, viewShiftKind: shiftKind, meetingSurface: true })) {
        return
      }
      if (d.masterCellId && cellIds.includes(d.masterCellId)) setEpoch((n) => n + 1)
    })
  }, [cellIds, planDate, shiftKind])

  const kpiVisibleOnSiteDds = useCallback(
    (kpi: KpiRow): boolean => {
      for (const cellId of cellIds) {
        const cellMap = overridesByCell.get(cellId)
        const override = cellMap?.has(kpi.id) ? cellMap.get(kpi.id)! : null
        if (
          kpiShowsOnDdsSurface(
            { point_kind: kpi.point_kind, display_sections: kpi.display_sections },
            'site-dds',
            override,
          )
        ) {
          return true
        }
      }
      return false
    },
    [cellIds, overridesByCell],
  )

  const linesByCell = useMemo(() => {
    const m = new Map<string, DdsCellLine[]>()
    for (const line of cellLines) {
      const list = m.get(line.master_cell_id) ?? []
      list.push(line)
      m.set(line.master_cell_id, list)
    }
    for (const [, list] of m) {
      list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    }
    return m
  }, [cellLines])

  const siteLineColumns = useMemo((): ByLineTableColumn[] => {
    const cols: ByLineTableColumn[] = []
    for (const cell of [...cells].sort((a, b) => a.name.localeCompare(b.name))) {
      for (const line of linesByCell.get(cell.id) ?? []) {
        cols.push({
          line,
          cellId: cell.id,
          columnLabel: line.name,
        })
      }
    }
    return cols
  }, [cells, linesByCell])

  const { perCellKpiIds, perCellByGroup, byLineByGroup, consolidatedByGroup, cellValuesByKpi, p2pBreakdownByKpi } = useMemo(() => {
    const perCell = new Set<string>()
    const perCellGroups = new Map<string, ByCellKpiDef[]>()
    const byLine = new Map<string, ByLineKpiDef[]>()
    const consolidated = new Map<string, ConsolidatedKpiDef[]>()
    const valuesByKpi = new Map<string, number[]>()
    const breakdownByKpi = new Map<string, DdsP2pKpiBreakdownItem[]>()
    const cellNameById = new Map(cells.map((c) => [c.id, c.name]))
    const multiCell = cells.length > 1

    const mergedForCell = (cellId: string, kpiId: string) =>
      mergeMeetingDayKpiCellEntry(
        cellEntries.filter((row) => row.master_cell_id === cellId && row.kpi_id === kpiId),
      )

    for (const k of kpis) {
      if (!kpiVisibleOnSiteDds(k)) continue
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
        continue
      }
      const rollupMode = parseDdsKpiSiteRollupMode(k.site_dds_presentation)
      if (rollupMode) {
        const list = consolidated.get(k.kpi_group_id) ?? []
        list.push({
          id: k.id,
          label: k.label,
          sort_order: k.sort_order,
          unit: parseDdsKpiUnit(k.unit),
          scoring: parseDdsKpiScoring(k.scoring),
          site_dds_presentation: rollupMode,
        })
        consolidated.set(k.kpi_group_id, list)
        const vals: number[] = []
        const breakdown: DdsP2pKpiBreakdownItem[] = []
        for (const cellId of cellIds) {
          const merged = mergedForCell(cellId, k.id)
          if (merged?.value_numeric != null && Number.isFinite(merged.value_numeric)) vals.push(merged.value_numeric)
          for (const item of merged?.p2p_breakdown ?? []) {
            const cellName = cellNameById.get(cellId)
            breakdown.push({
              ...item,
              role_name: multiCell && cellName ? `${cellName} · ${item.role_name}` : item.role_name,
            })
          }
        }
        valuesByKpi.set(k.id, vals)
        if (breakdown.length > 0) breakdownByKpi.set(k.id, breakdown)
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

    for (const [, list] of consolidated) {
      list.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
    }
    for (const [, list] of byLine) {
      list.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
    }
    for (const [, list] of perCellGroups) {
      list.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
    }

    return {
      perCellKpiIds: perCell,
      perCellByGroup: perCellGroups,
      byLineByGroup: byLine,
      consolidatedByGroup: consolidated,
      cellValuesByKpi: valuesByKpi,
      p2pBreakdownByKpi: breakdownByKpi,
    }
  }, [kpis, kpiVisibleOnSiteDds, cellEntries, cellIds, cells])

  const sortedGroups = useMemo(() => {
    const withContent = groups.filter((g) => {
      const hasConsolidated = (consolidatedByGroup.get(g.id) ?? []).length > 0
      const hasByLine = (byLineByGroup.get(g.id) ?? []).length > 0
      const hasPerCell = kpis.some(
        (k) => k.kpi_group_id === g.id && perCellKpiIds.has(k.id) && kpiVisibleOnSiteDds(k),
      )
      return hasConsolidated || hasByLine || hasPerCell
    })
    return [...withContent].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  }, [groups, consolidatedByGroup, byLineByGroup, perCellByGroup, kpis, perCellKpiIds, kpiVisibleOnSiteDds])

  const cellColumns = useMemo((): ByCellTableColumn[] => {
    return [...cells].sort((a, b) => a.name.localeCompare(b.name)).map((cell) => ({
      cellId: cell.id,
      columnLabel: ddsKpiCellColumnLabel(cell.name),
    }))
  }, [cells])

  if (shellLoading || loading) {
    return (
      <p className="flex items-center gap-1 text-[11px] text-muted" role="status">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading…
      </p>
    )
  }

  if (cells.length === 0) {
    return <p className="text-[11px] text-muted">No cells in this site.</p>
  }

  if (sortedGroups.length === 0) {
    return (
      <p className="text-[11px] text-muted">
        No KPIs on <strong className="text-fg/80">Site DDS</strong> for this site. Configure under Admin → KPIs / KPI
        set-up.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      {sortedGroups.map((g) => {
        const consolidated = consolidatedByGroup.get(g.id) ?? []
        const byLineKpis = byLineByGroup.get(g.id) ?? []
        const perCellKpis = perCellByGroup.get(g.id) ?? []

        return (
          <section key={g.id}>
            <h3 className="mb-px border-b border-border/60 pb-px text-[8px] font-semibold uppercase tracking-wide text-muted">
              {g.name}
            </h3>
            <div className="space-y-1">
              {byLineKpis.length > 0 ? (
                <DdsByLineKpiTable
                  columns={siteLineColumns}
                  kpis={byLineKpis}
                  entries={lineEntries}
                  planDate={planDate}
                  shiftKind={shiftKind}
                  lineScoringByKey={lineScoringByKey}
                  emptyLinesMessage="No lines on this site. Add lines per cell under Admin → Cell lines."
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
                  kpiSurface="site-dds"
                  onSaved={() => setEpoch((n) => n + 1)}
                />
              ) : null}
            </div>
            <SiteDdsConsolidatedKpiStrip
              siteId={siteId}
              cellIds={cellIds}
              kpis={consolidated}
              cellValuesByKpi={cellValuesByKpi}
              p2pBreakdownByKpi={p2pBreakdownByKpi}
              siteEntries={siteEntries}
              planDate={planDate}
              shiftKind={shiftKind}
              onSaved={() => setEpoch((n) => n + 1)}
            />
          </section>
        )
      })}
    </div>
  )
}
