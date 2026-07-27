import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { usePlan24Workspace } from '../plan24/Plan24WorkspaceContext'
import {
  BdeKpiCard,
  BdeReportTabs,
  BdeReportToolbar,
} from './BdeReportChrome'
import { bdeActionStatusLabel, bdeStatusLabel, personLabel, type BdeActionStatus } from './bdeTypes'
import {
  actionStatusCounts,
  defaultBdeReportFilters,
  formatReportDate,
  formatReportWhen,
  inTimeRange,
  localYmd,
  rangeForPreset,
} from './bdeReportUtils'
import { useBdeReportBundle, useFilteredRecords, type BdeReportFilters } from './useBdeReportData'

function actionPill(status: BdeActionStatus) {
  if (status === 'completed') return 'bg-emerald-600/90 text-white'
  if (status === 'in_progress') return 'bg-sky-600/90 text-white'
  return 'bg-zinc-500/80 text-white'
}

export function BdeActionsReportPage() {
  const { cellId, status: scopeStatus } = usePlan24Workspace()
  const bundle = useBdeReportBundle(cellId)
  const [filters, setFilters] = useState<BdeReportFilters>(defaultBdeReportFilters)
  const [ownerFilter, setOwnerFilter] = useState('')
  const [bdeIdFilter, setBdeIdFilter] = useState('')
  const [actionStatusFilter, setActionStatusFilter] = useState<'' | BdeActionStatus>('')
  const [selectedBdeId, setSelectedBdeId] = useState<string | null>(null)

  const filteredRecords = useFilteredRecords(bundle.records, filters)
  const recordIds = useMemo(() => new Set(filteredRecords.map((r) => r.id)), [filteredRecords])
  const recordById = useMemo(() => new Map(filteredRecords.map((r) => [r.id, r])), [filteredRecords])

  const { from, to } = useMemo(() => rangeForPreset(filters.preset), [filters.preset])

  const filteredActions = useMemo(() => {
    return bundle.actions.filter((a) => {
      if (!recordIds.has(a.bde_id)) return false
      if (!inTimeRange(a.created_at, from, to)) return false
      if (ownerFilter && a.owner_person_id !== ownerFilter) return false
      if (bdeIdFilter && a.bde_id !== bdeIdFilter) return false
      if (actionStatusFilter && a.status !== actionStatusFilter) return false
      const q = filters.search.trim().toLowerCase()
      if (q) {
        const rec = recordById.get(a.bde_id)
        const owner = a.owner_person_id ? bundle.peopleById.get(a.owner_person_id) : null
        const hay = [a.display_id, a.title, a.system_text, rec?.display_id, rec?.title, owner ? personLabel(owner) : '']
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [
    actionStatusFilter,
    bdeIdFilter,
    bundle.actions,
    bundle.peopleById,
    filters.search,
    from,
    ownerFilter,
    recordById,
    recordIds,
    to,
  ])

  const actionCounts = useMemo(() => actionStatusCounts(filteredActions), [filteredActions])

  const createdByOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of bundle.records) {
      if (r.created_by_name?.trim()) set.add(r.created_by_name.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [bundle.records])

  const ownerOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const a of bundle.actions) {
      if (a.owner_person_id) ids.add(a.owner_person_id)
    }
    return Array.from(ids)
      .map((id) => ({ id, label: bundle.peopleById.get(id) ? personLabel(bundle.peopleById.get(id)!) : id.slice(0, 8) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [bundle.actions, bundle.peopleById])

  const bdesWithActions = useMemo(() => {
    const ids = new Set(filteredActions.map((a) => a.bde_id))
    return filteredRecords.filter((r) => ids.has(r.id))
  }, [filteredActions, filteredRecords])

  const selectedBde = useMemo(() => {
    if (selectedBdeId && bdesWithActions.some((r) => r.id === selectedBdeId)) {
      return bdesWithActions.find((r) => r.id === selectedBdeId) ?? null
    }
    return bdesWithActions[0] ?? null
  }, [bdesWithActions, selectedBdeId])

  const selectedActions = useMemo(() => {
    if (!selectedBde) return []
    return filteredActions.filter((a) => a.bde_id === selectedBde.id)
  }, [filteredActions, selectedBde])

  const statusByDay = useMemo(() => {
    const map = new Map<string, { date: string; open: number; in_progress: number; completed: number }>()
    for (const a of filteredActions) {
      const day = localYmd(new Date(a.created_at))
      const row = map.get(day) ?? { date: day, open: 0, in_progress: 0, completed: 0 }
      if (a.status === 'completed') row.completed += 1
      else if (a.status === 'in_progress') row.in_progress += 1
      else row.open += 1
      map.set(day, row)
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredActions])

  const openSummary = useMemo(() => {
    const today = localYmd(new Date())
    const in7 = (() => {
      const d = new Date()
      d.setDate(d.getDate() + 7)
      return localYmd(d)
    })()
    let dueNext7 = 0
    let noDue = 0
    for (const a of filteredActions) {
      if (a.status === 'completed') continue
      if (!a.due_date) {
        noDue += 1
        continue
      }
      if (a.due_date >= today && a.due_date <= in7) dueNext7 += 1
    }
    return { dueNext7, noDue }
  }, [filteredActions])

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
          <>
            <select
              className={selectClass}
              aria-label="Action owner"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
            >
              <option value="">Owner: All</option>
              {ownerOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              aria-label="BDE ID"
              value={bdeIdFilter}
              onChange={(e) => setBdeIdFilter(e.target.value)}
            >
              <option value="">BDE: All</option>
              {filteredRecords.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.display_id}
                </option>
              ))}
            </select>
          </>
        }
      />

      {bundle.error ? (
        <p className="shrink-0 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {bundle.error}
        </p>
      ) : null}

      <div className="grid shrink-0 gap-2 sm:grid-cols-2">
        <BdeKpiCard title="Total actions">
          <p className="font-display text-2xl font-semibold tabular-nums">{actionCounts.total}</p>
        </BdeKpiCard>
        <BdeKpiCard title="Action status">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['completed', actionCounts.completed, 'Completed'],
                ['in_progress', actionCounts.in_progress, 'In Progress'],
                ['open', actionCounts.open, 'Open'],
              ] as const
            ).map(([key, n, label]) => (
              <button
                key={key}
                type="button"
                className={`rounded-lg border px-2 py-0.5 text-xs ${
                  actionStatusFilter === key ? 'border-fg bg-fg text-white' : 'border-border bg-canvas/60'
                }`}
                onClick={() => setActionStatusFilter((s) => (s === key ? '' : key))}
              >
                {label} <strong className="ml-1 tabular-nums">{n}</strong>
              </button>
            ))}
          </div>
        </BdeKpiCard>
      </div>

      {bundle.loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-2">
            <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border">
              <header className="shrink-0 border-b border-border bg-surface-raised/80 px-3 py-2 text-sm font-semibold">
                Overview
              </header>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 border-b border-border bg-surface text-xs uppercase text-muted">
                    <tr>
                      <th className="px-3 py-2">BDE ID</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bdesWithActions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-muted">
                          No BDEs with matching actions.
                        </td>
                      </tr>
                    ) : (
                      bdesWithActions.map((row) => (
                        <tr
                          key={row.id}
                          className={`cursor-pointer border-b border-border/60 ${
                            selectedBde?.id === row.id ? 'bg-accent-dim/50' : 'hover:bg-black/[0.02]'
                          }`}
                          onClick={() => setSelectedBdeId(row.id)}
                        >
                          <td className="px-3 py-2 font-mono text-xs text-accent">{row.display_id}</td>
                          <td className="max-w-[10rem] truncate px-3 py-2">{row.title}</td>
                          <td className="px-3 py-2 text-muted">{row.problem_type_label ?? '—'}</td>
                          <td className="px-3 py-2">{bdeStatusLabel(row.status)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-muted">
                            {formatReportWhen(row.created_at)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border">
              <header className="shrink-0 border-b border-border bg-surface-raised/80 px-3 py-2 text-sm font-semibold">
                Action details
                {selectedBde ? (
                  <span className="ml-2 font-normal text-muted">({selectedBde.display_id})</span>
                ) : null}
              </header>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 border-b border-border bg-surface text-xs uppercase text-muted">
                    <tr>
                      <th className="px-3 py-2">Action ID</th>
                      <th className="px-3 py-2">Title</th>
                      <th className="px-3 py-2">Owner</th>
                      <th className="px-3 py-2">Due</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedActions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-muted">
                          Select a BDE to see actions.
                        </td>
                      </tr>
                    ) : (
                      selectedActions.map((a) => {
                        const owner = a.owner_person_id ? bundle.peopleById.get(a.owner_person_id) : null
                        return (
                          <tr key={a.id} className="border-b border-border/60">
                            <td className="px-3 py-2 font-mono text-xs">{a.display_id}</td>
                            <td className="px-3 py-2">{a.title}</td>
                            <td className="px-3 py-2 text-muted">{owner ? personLabel(owner) : '—'}</td>
                            <td className="px-3 py-2 text-muted">
                              {a.due_date ? formatReportDate(a.due_date) : '—'}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${actionPill(a.status)}`}>
                                {bdeActionStatusLabel(a.status)}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="grid shrink-0 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
            <section className="rounded-2xl border border-border p-3">
              <h3 className="mb-2 text-sm font-semibold"># Actions by status</h3>
              <div className="h-40 w-full min-w-0">
                {statusByDay.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-muted">No data</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusByDay} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => formatReportDate(String(v))}
                      />
                      <YAxis allowDecimals={false} width={28} tick={{ fontSize: 10 }} />
                      <Tooltip
                        labelFormatter={(v) => formatReportDate(String(v))}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Legend />
                      <Bar dataKey="completed" stackId="s" fill="#059669" name="Completed" />
                      <Bar dataKey="in_progress" stackId="s" fill="#0284c7" name="In Progress" />
                      <Bar dataKey="open" stackId="s" fill="#71717a" name="Open" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border p-3">
              <h3 className="mb-2 text-sm font-semibold">Open actions summary</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex min-h-[5.5rem] flex-col justify-between rounded-xl bg-sky-800 p-3 text-white">
                  <p className="text-xs font-medium uppercase tracking-wide text-white/80">Due next 7 days</p>
                  <p className="font-display text-3xl font-semibold tabular-nums">{openSummary.dueNext7}</p>
                </div>
                <div className="flex min-h-[5.5rem] flex-col justify-between rounded-xl bg-sky-500/80 p-3 text-white">
                  <p className="text-xs font-medium uppercase tracking-wide text-white/80">No due date</p>
                  <p className="font-display text-3xl font-semibold tabular-nums">{openSummary.noDue}</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
