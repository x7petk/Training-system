import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { ShiftDdsKpiSummary } from './ShiftDdsKpiSummary'
import { DdsByLineKpiTable, type ByLineKpiDef, type ByLineTableColumn } from './DdsByLineKpiTable'
import { DdsKpiTableTilesLayout } from './DdsKpiTableTilesLayout'
import type { DdsCellLine, DdsKpiLineEntry } from './ddsCellLines'
import { kpiShowsOnDdsSurface } from './ddsKpiDdsSetupSurfaces'
import { isDdsKpiSiteByLine, isDdsKpiSiteConsolidated } from './ddsKpiSitePresentation'
import { parseDdsKpiScoring } from './ddsKpiScoring'
import { parseDdsKpiUnit } from './ddsKpiUnits'
import { subscribeDdsP2pKpiRollupDone } from './ddsP2pKpiRollupEvents'
import { p2pRollupEventMatchesMeetingDay } from './ddsKpiP2pRollup'

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
}

type Props = {
  cellId: string
  cellName?: string
  planDate: string
  shiftKind: string
  shellLoading?: boolean
}

export function LineDdsKpiSummary({ cellId, cellName, planDate, shiftKind, shellLoading }: Props) {
  const [groups, setGroups] = useState<KpiGroup[]>([])
  const [kpis, setKpis] = useState<KpiRow[]>([])
  const [surfaceOverrides, setSurfaceOverrides] = useState<Map<string, string[]>>(new Map())
  const [cellLines, setCellLines] = useState<DdsCellLine[]>([])
  const [lineEntries, setLineEntries] = useState<DdsKpiLineEntry[]>([])
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
    const [gRes, kRes, oRes, linesRes, lineEntRes] = await Promise.all([
      supabase.from('dds_kpi_groups').select('id, name, sort_order').order('sort_order').order('name'),
      supabase
        .from('dds_kpis')
        .select('id, kpi_group_id, label, sort_order, point_kind, display_sections, site_dds_presentation, unit, scoring')
        .order('sort_order')
        .order('label'),
      supabase.from('dds_kpi_cell_dds_display').select('kpi_id, surfaces').eq('master_cell_id', cellId),
      supabase
        .from('dds_cell_lines')
        .select('id, master_cell_id, name, sort_order, active')
        .eq('master_cell_id', cellId)
        .eq('active', true)
        .order('sort_order')
        .order('name'),
      supabase
        .from('dds_kpi_line_entries')
        .select('id, master_cell_id, line_id, kpi_id, value_numeric, comment, p2p_breakdown')
        .eq('master_cell_id', cellId)
        .eq('plan_date', planDate)
        .eq('shift_kind', shiftKind),
    ])
    setLoading(false)
    if (gRes.error || kRes.error || oRes.error || linesRes.error || lineEntRes.error) return

    setGroups((gRes.data ?? []) as KpiGroup[])
    setKpis((kRes.data ?? []) as KpiRow[])
    const oMap = new Map<string, string[]>()
    for (const row of (oRes.data ?? []) as { kpi_id: string; surfaces: string[] }[]) {
      oMap.set(row.kpi_id, row.surfaces ?? [])
    }
    setSurfaceOverrides(oMap)
    setCellLines((linesRes.data ?? []) as DdsCellLine[])
    setLineEntries((lineEntRes.data ?? []) as DdsKpiLineEntry[])
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

  const { byLineByGroup, excludeKpiIds } = useMemo(() => {
    const byLine = new Map<string, ByLineKpiDef[]>()
    const exclude = new Set<string>()

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
        exclude.add(k.id)
      } else if (isDdsKpiSiteConsolidated(k.site_dds_presentation)) {
        exclude.add(k.id)
      }
    }

    for (const [, list] of byLine) {
      list.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
    }

    return { byLineByGroup: byLine, excludeKpiIds: exclude }
  }, [kpis, kpiVisibleOnLineDds])

  const sortedGroups = useMemo(() => {
    const withContent = groups.filter((g) => {
      const hasByLine = (byLineByGroup.get(g.id) ?? []).length > 0
      const hasTiles = kpis.some(
        (k) => k.kpi_group_id === g.id && kpiVisibleOnLineDds(k) && !excludeKpiIds.has(k.id),
      )
      return hasByLine || hasTiles
    })
    return [...withContent].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  }, [groups, byLineByGroup, kpis, kpiVisibleOnLineDds, excludeKpiIds])

  const firstByLineGroupId = useMemo(() => {
    const g = sortedGroups.find((sg) => (byLineByGroup.get(sg.id) ?? []).length > 0)
    return g?.id ?? null
  }, [sortedGroups, byLineByGroup])

  const byLineCaption = cellName ? `${cellName} — by line` : 'By line'

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
    <div className="space-y-1.5">
      {sortedGroups.map((g) => {
        const byLineKpis = byLineByGroup.get(g.id) ?? []
        const hasTiles = kpis.some((k) => k.kpi_group_id === g.id && kpiVisibleOnLineDds(k) && !excludeKpiIds.has(k.id))

        return (
          <section key={g.id}>
            <h3 className="mb-px border-b border-border/60 pb-px text-[8px] font-semibold uppercase tracking-wide text-muted">
              {g.name}
            </h3>
            <DdsKpiTableTilesLayout
              table={
                byLineKpis.length > 0 ? (
                  <DdsByLineKpiTable
                    columns={lineColumns}
                    kpis={byLineKpis}
                    entries={lineEntries}
                    planDate={planDate}
                    shiftKind={shiftKind}
                    tableTitle={g.id === firstByLineGroupId ? byLineCaption : undefined}
                    emptyLinesMessage="No lines for this cell. Add lines under Admin → Cell lines."
                    onSaved={() => setEpoch((n) => n + 1)}
                  />
                ) : undefined
              }
              tiles={
                hasTiles ? (
                  <ShiftDdsKpiSummary
                    cellId={cellId}
                    planDate={planDate}
                    shiftKind={shiftKind}
                    kpiSurface="line-dds"
                    compact
                    excludeKpiIds={excludeKpiIds}
                    groupId={g.id}
                  />
                ) : undefined
              }
            />
          </section>
        )
      })}
    </div>
  )
}
