import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { usePlan24Workspace } from '../plan24/Plan24WorkspaceContext'
import {
  BdeKpiCard,
  BdeReportTabs,
  BdeReportToolbar,
} from './BdeReportChrome'
import { BDE_CODE_KIND_META, type BdeCodeKind } from './bdeTypes'
import {
  aodcPatternKey,
  defaultBdeReportFilters,
  formatReportDate,
  formatReportWhen,
  problemTypeCounts,
  statusCounts,
} from './bdeReportUtils'
import { useBdeReportBundle, useFilteredRecords, type BdeReportFilters } from './useBdeReportData'

const EQUIP_COLORS = [
  '#0284c7',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#dc2626',
  '#0d9488',
  '#4f46e5',
  '#db2777',
  '#65a30d',
  '#0891b2',
]

export function BdeTrendsReportPage() {
  const { cellId, status: scopeStatus } = usePlan24Workspace()
  const bundle = useBdeReportBundle(cellId)
  const [filters, setFilters] = useState<BdeReportFilters>(defaultBdeReportFilters)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('')

  const baseFiltered = useFilteredRecords(bundle.records, filters)

  const filtered = useMemo(() => {
    if (!selectedEquipmentId) return baseFiltered
    return baseFiltered.filter((r) => r.equipment_id === selectedEquipmentId)
  }, [baseFiltered, selectedEquipmentId])

  const createdByOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of bundle.records) {
      if (r.created_by_name?.trim()) set.add(r.created_by_name.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [bundle.records])

  const counts = useMemo(() => statusCounts(filtered), [filtered])
  const typeCounts = useMemo(() => problemTypeCounts(filtered), [filtered])

  const byEquipment = useMemo(() => {
    const map = new Map<string, { name: string; count: number; equipmentId: string | null }>()
    for (const r of baseFiltered) {
      const key = r.equipment_id ?? '__none__'
      const name = r.equipment_name?.trim() || r.area_name?.trim() || 'Unspecified'
      const row = map.get(key) ?? { name, count: 0, equipmentId: r.equipment_id }
      row.count += 1
      map.set(key, row)
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [baseFiltered])

  const trendPoints = useMemo(() => {
    const equipIndex = new Map<string, number>()
    let i = 0
    for (const r of baseFiltered) {
      const key = r.equipment_id ?? r.area_id ?? r.id
      if (!equipIndex.has(key)) {
        equipIndex.set(key, i % EQUIP_COLORS.length)
        i += 1
      }
    }
    return baseFiltered.map((r) => {
      const key = r.equipment_id ?? r.area_id ?? r.id
      const colorIdx = equipIndex.get(key) ?? 0
      return {
        x: new Date(r.created_at).getTime(),
        y: 1,
        label: r.display_id,
        name: r.equipment_name || r.area_name || 'Unspecified',
        fill: EQUIP_COLORS[colorIdx],
      }
    })
  }, [baseFiltered])

  const aodcStats = useMemo(() => {
    const patternCounts = new Map<string, number>()
    const optionCounts = new Map<string, { optionType: string; option: string; count: number }>()

    for (const r of filtered) {
      const links = bundle.codesByBde.get(r.id) ?? []
      const kinds = new Set<BdeCodeKind>()
      for (const link of links) {
        kinds.add(link.code_kind)
        const optKey = `${link.code_kind}::${link.code_label}`
        const prev = optionCounts.get(optKey) ?? {
          optionType: BDE_CODE_KIND_META[link.code_kind].label,
          option: link.code_label,
          count: 0,
        }
        prev.count += 1
        optionCounts.set(optKey, prev)
      }
      const pattern = aodcPatternKey(kinds)
      patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1)
    }

    const patterns = Array.from(patternCounts.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count || a.pattern.localeCompare(b.pattern))

    const topPattern = patterns[0] ?? null
    const aodcFull = patternCounts.get('AODC') ?? 0
    const withAnyCode = Array.from(patternCounts.entries())
      .filter(([p]) => p !== '—')
      .reduce((s, [, c]) => s + c, 0)
    const aodcShare = withAnyCode > 0 ? aodcFull / withAnyCode : 0

    const relatedOptions = Array.from(optionCounts.values()).sort(
      (a, b) => b.count - a.count || a.optionType.localeCompare(b.optionType),
    )

    return { patterns, topPattern, aodcFull, withAnyCode, aodcShare, relatedOptions }
  }, [bundle.codesByBde, filtered])

  const firstLatest = useMemo(() => {
    if (filtered.length === 0) return { first: null as string | null, latest: null as string | null }
    let first = filtered[0].created_at
    let latest = filtered[0].created_at
    for (const r of filtered) {
      if (r.created_at < first) first = r.created_at
      if (r.created_at > latest) latest = r.created_at
    }
    return { first, latest }
  }, [filtered])

  const trendDirection = useMemo(() => {
    if (filtered.length < 2) return 'Stable'
    const latestTs = Math.max(...filtered.map((r) => new Date(r.created_at).getTime()))
    const mid = latestTs - 14 * 24 * 60 * 60 * 1000
    let recent = 0
    let older = 0
    for (const r of filtered) {
      if (new Date(r.created_at).getTime() >= mid) recent += 1
      else older += 1
    }
    if (recent > older) return 'Up — Worsening'
    if (recent < older) return 'Down — Improving'
    return 'Stable'
  }, [filtered])

  const recentEvents = useMemo(() => filtered.slice(0, 12), [filtered])

  const donutData = useMemo(() => {
    const aodc = aodcStats.aodcFull
    const other = Math.max(0, aodcStats.withAnyCode - aodc)
    if (aodc === 0 && other === 0) {
      return [
        { name: 'No codes', value: filtered.length || 1 },
      ]
    }
    return [
      { name: 'AODC', value: aodc },
      { name: 'Other patterns', value: other },
    ]
  }, [aodcStats.aodcFull, aodcStats.withAnyCode, filtered.length])

  if (scopeStatus === 'loading') return <p className="text-sm text-muted">Loading scope…</p>
  if (!cellId) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
        Select a site, plant, and cell to view BDE reports.
      </div>
    )
  }

  const selectClass =
    'h-8 min-w-[7rem] max-w-[11rem] rounded-lg border border-border-strong bg-surface px-2 text-xs text-fg shadow-sm'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <BdeReportTabs />
      <BdeReportToolbar
        filters={filters}
        onChange={setFilters}
        areas={bundle.areas}
        equipment={bundle.equipment}
        createdByOptions={createdByOptions}
        extraFilters={
          <select
            className={selectClass}
            aria-label="Selected equipment"
            value={selectedEquipmentId}
            onChange={(e) => setSelectedEquipmentId(e.target.value)}
          >
            <option value="">Equipment focus: All</option>
            {bundle.equipment.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        }
      />

      {bundle.error ? (
        <p className="shrink-0 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {bundle.error}
        </p>
      ) : null}

      <div className="grid shrink-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <BdeKpiCard title="Total BDE">
          <p className="font-display text-2xl font-semibold tabular-nums">{counts.total}</p>
        </BdeKpiCard>
        <BdeKpiCard title="Status">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={`rounded-lg border px-2 py-0.5 text-xs ${
                filters.statusFilter === 'completed' ? 'border-fg bg-fg text-white' : 'border-emerald-500/30 bg-emerald-500/10'
              }`}
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  statusFilter: f.statusFilter === 'completed' ? '' : 'completed',
                }))
              }
            >
              Completed <strong className="ml-1 tabular-nums">{counts.completed}</strong>
            </button>
            <button
              type="button"
              className={`rounded-lg border px-2 py-0.5 text-xs ${
                filters.statusFilter === 'saved' ? 'border-fg bg-fg text-white' : 'border-sky-500/30 bg-sky-500/10'
              }`}
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  statusFilter: f.statusFilter === 'saved' ? '' : 'saved',
                }))
              }
            >
              Saved <strong className="ml-1 tabular-nums">{counts.saved}</strong>
            </button>
          </div>
        </BdeKpiCard>
        <BdeKpiCard title="Problem type">
          <div className="flex flex-wrap gap-1.5">
            {typeCounts.length === 0 ? (
              <span className="text-sm text-muted">—</span>
            ) : (
              typeCounts.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  className={`rounded-lg border px-2 py-0.5 text-xs ${
                    filters.problemTypeLabel === t.label ? 'border-fg bg-fg text-white' : 'border-border bg-canvas/60'
                  }`}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      problemTypeLabel: f.problemTypeLabel === t.label ? '' : t.label,
                    }))
                  }
                >
                  {t.label} <strong className="ml-1 tabular-nums">{t.count}</strong>
                </button>
              ))
            )}
          </div>
        </BdeKpiCard>
      </div>

      {bundle.loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 overflow-auto xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.85fr)]">
          <div className="flex min-h-0 flex-col gap-3">
              <section className="shrink-0 rounded-2xl border border-border p-3">
                <h3 className="mb-2 text-sm font-semibold">BDE by equipment / area</h3>
                <div className="h-44 w-full min-w-0">
                  {byEquipment.length === 0 ? (
                    <p className="flex h-full items-center justify-center text-sm text-muted">No data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byEquipment} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10 }}
                          interval={0}
                          angle={-28}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis allowDecimals={false} width={28} tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Bar
                          dataKey="count"
                          name="BDEs"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={48}
                          cursor="pointer"
                          onClick={(data) => {
                            const row = data as unknown as { equipmentId?: string | null }
                            if (row.equipmentId) {
                              setSelectedEquipmentId((id) => (id === row.equipmentId ? '' : row.equipmentId!))
                            }
                          }}
                        >
                          {byEquipment.map((e, idx) => (
                            <Cell
                              key={e.name}
                              fill={
                                selectedEquipmentId && e.equipmentId === selectedEquipmentId
                                  ? '#0f172a'
                                  : EQUIP_COLORS[idx % EQUIP_COLORS.length]
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              <section className="shrink-0 rounded-2xl border border-border p-3">
                <h3 className="mb-2 text-sm font-semibold">BDE trend over time</h3>
                <div className="h-36 w-full min-w-0">
                  {trendPoints.length === 0 ? (
                    <p className="flex h-full items-center justify-center text-sm text-muted">No data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                          type="number"
                          dataKey="x"
                          domain={['dataMin', 'dataMax']}
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) => formatReportDate(new Date(Number(v)).toISOString())}
                          name="Date"
                        />
                        <YAxis type="number" dataKey="y" domain={[0, 2]} hide />
                        <ZAxis range={[60, 60]} />
                        <Tooltip
                          cursor={{ strokeDasharray: '3 3' }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null
                            const p = payload[0].payload as { label: string; name: string; x: number }
                            return (
                              <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow">
                                <p className="font-medium">{p.label}</p>
                                <p className="text-muted">{p.name}</p>
                                <p className="text-muted">{formatReportWhen(new Date(p.x).toISOString())}</p>
                              </div>
                            )
                          }}
                        />
                        <Scatter data={trendPoints} fill="#0284c7">
                          {trendPoints.map((p, idx) => (
                            <Cell key={`${p.label}-${idx}`} fill={p.fill} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              <section className="flex min-h-[10rem] flex-1 flex-col overflow-hidden rounded-2xl border border-border">
                <header className="shrink-0 border-b border-border bg-surface-raised/80 px-3 py-2 text-sm font-semibold">
                  Recent breakdown events
                </header>
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 border-b border-border bg-surface text-xs uppercase text-muted">
                      <tr>
                        <th className="px-3 py-2">Occurred On</th>
                        <th className="px-3 py-2">BDE ID</th>
                        <th className="px-3 py-2">Problem Type</th>
                        <th className="px-3 py-2">Area / Equipment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentEvents.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-muted">
                            No events
                          </td>
                        </tr>
                      ) : (
                        recentEvents.map((r) => (
                          <tr key={r.id} className="border-b border-border/60">
                            <td className="whitespace-nowrap px-3 py-2 text-muted">
                              {formatReportWhen(r.created_at)}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">{r.display_id}</td>
                            <td className="px-3 py-2">{r.problem_type_label ?? '—'}</td>
                            <td className="px-3 py-2 text-muted">
                              {[r.area_name, r.equipment_name].filter(Boolean).join(' · ') || '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="flex min-h-0 flex-col gap-3">
              <section className="shrink-0 rounded-2xl border border-border bg-surface-raised/40 p-3">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted">Total BDEs</dt>
                    <dd className="font-display text-2xl font-semibold tabular-nums">{counts.total}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted">Trend</dt>
                    <dd className="font-medium">{trendDirection}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted">First</dt>
                    <dd>{firstLatest.first ? formatReportDate(firstLatest.first) : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted">Latest</dt>
                    <dd>{firstLatest.latest ? formatReportDate(firstLatest.latest) : '—'}</dd>
                  </div>
                </dl>
                <div className="mt-3 border-t border-border pt-2">
                  <p className="text-xs uppercase tracking-wider text-muted">Top AODC pattern</p>
                  <p className="mt-1 font-display text-lg font-semibold">
                    {aodcStats.topPattern
                      ? `${aodcStats.topPattern.pattern} × ${aodcStats.topPattern.count}`
                      : '—'}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    AODC = Activity + Object Part + Damage + Cause codes present on a record.
                  </p>
                </div>
              </section>

              <section className="shrink-0 rounded-2xl border border-border p-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold">AODC pattern share</h3>
                  {aodcStats.withAnyCode > 0 ? (
                    <p className="text-xs text-muted">
                      Full AODC: {((aodcStats.aodcShare || 0) * 100).toFixed(1)}% of coded BDEs
                    </p>
                  ) : null}
                </div>
                <div className="h-36 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={36} outerRadius={56} paddingAngle={2}>
                        {donutData.map((d, i) => (
                          <Cell key={d.name} fill={i === 0 ? '#0284c7' : '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </section>

            <section className="flex min-h-[10rem] flex-1 flex-col overflow-hidden rounded-2xl border border-border">
              <header className="shrink-0 border-b border-border bg-surface-raised/80 px-3 py-2 text-sm font-semibold">
                Related object breakdown (AODC codes)
              </header>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 border-b border-border bg-surface text-xs uppercase text-muted">
                    <tr>
                      <th className="px-3 py-2">Option type</th>
                      <th className="px-3 py-2">Option</th>
                      <th className="px-3 py-2">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aodcStats.relatedOptions.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-muted">
                          No codes selected on filtered BDEs
                        </td>
                      </tr>
                    ) : (
                      aodcStats.relatedOptions.slice(0, 40).map((row) => (
                        <tr key={`${row.optionType}-${row.option}`} className="border-b border-border/60">
                          <td className="px-3 py-2 text-muted">{row.optionType}</td>
                          <td className="px-3 py-2">{row.option}</td>
                          <td className="px-3 py-2 tabular-nums">{row.count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
