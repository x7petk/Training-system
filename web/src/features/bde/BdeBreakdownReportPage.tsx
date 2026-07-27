import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlan24Workspace } from '../plan24/Plan24WorkspaceContext'
import { signedBdePhotoUrl } from './bdeApi'
import {
  BdeKpiCard,
  BdeReportTabs,
  BdeReportToolbar,
} from './BdeReportChrome'
import { bdeStatusLabel, type BdePhotoRow } from './bdeTypes'
import { defaultBdeReportFilters, formatReportWhen, problemTypeCounts, statusCounts } from './bdeReportUtils'
import { useBdeReportBundle, useFilteredRecords, type BdeReportFilters } from './useBdeReportData'

function statusPill(status: string) {
  if (status === 'completed') {
    return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100'
  }
  return 'border-sky-500/40 bg-sky-500/15 text-sky-950 dark:text-sky-100'
}

export function BdeBreakdownReportPage() {
  const { cellId, status: scopeStatus } = usePlan24Workspace()
  const bundle = useBdeReportBundle(cellId)
  const [filters, setFilters] = useState<BdeReportFilters>(defaultBdeReportFilters)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})

  const filtered = useFilteredRecords(bundle.records, filters)

  const createdByOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of bundle.records) {
      if (r.created_by_name?.trim()) set.add(r.created_by_name.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [bundle.records])

  const counts = useMemo(() => statusCounts(filtered), [filtered])
  const typeCounts = useMemo(() => problemTypeCounts(filtered), [filtered])

  const selected = useMemo(
    () => filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  )

  const selectedPhotos: BdePhotoRow[] = useMemo(
    () => (selected ? (bundle.photosByBde.get(selected.id) ?? []) : []),
    [bundle.photosByBde, selected],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const next: Record<string, string> = {}
      await Promise.all(
        selectedPhotos.map(async (p) => {
          const u = await signedBdePhotoUrl(p.storage_path)
          if (u) next[p.id] = u
        }),
      )
      if (!cancelled) setPhotoUrls(next)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedPhotos])

  if (scopeStatus === 'loading') return <p className="text-sm text-muted">Loading scope…</p>
  if (!cellId) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
        Select a site, plant, and cell to view BDE reports.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <BdeReportTabs />
      <BdeReportToolbar
        filters={filters}
        onChange={setFilters}
        areas={bundle.areas}
        equipment={bundle.equipment}
        createdByOptions={createdByOptions}
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
                filters.statusFilter === 'completed'
                  ? 'border-fg bg-fg text-white'
                  : 'border-emerald-500/30 bg-emerald-500/10'
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
                    filters.problemTypeLabel === t.label
                      ? 'border-fg bg-fg text-white'
                      : 'border-border bg-canvas/60'
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
        <p className="text-sm text-muted">Loading records…</p>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col gap-3">
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border">
              <header className="shrink-0 border-b border-border bg-surface-raised/80 px-3 py-2 text-sm font-semibold">
                Overview
              </header>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 border-b border-border bg-surface text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-3 py-2">BDE ID</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Area</th>
                      <th className="px-3 py-2">Equipment</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-muted">
                          No BDEs match the current filters.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((row) => {
                        const active = selected?.id === row.id
                        return (
                          <tr
                            key={row.id}
                            className={`cursor-pointer border-b border-border/60 ${
                              active ? 'bg-accent-dim/50' : 'hover:bg-black/[0.02]'
                            }`}
                            onClick={() => setSelectedId(row.id)}
                          >
                            <td className="px-3 py-2 font-mono text-xs text-accent">{row.display_id}</td>
                            <td className="max-w-[10rem] truncate px-3 py-2 font-medium">{row.title}</td>
                            <td className="px-3 py-2 text-muted">{row.problem_type_label ?? '—'}</td>
                            <td className="px-3 py-2 text-muted">{row.area_name ?? '—'}</td>
                            <td className="px-3 py-2 text-muted">{row.equipment_name ?? '—'}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusPill(row.status)}`}
                              >
                                {bdeStatusLabel(row.status)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-muted">
                              {formatReportWhen(row.created_at)}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="shrink-0 rounded-2xl border border-border p-3">
              <header className="mb-2 text-sm font-semibold">Photos</header>
              {selectedPhotos.length === 0 ? (
                <p className="text-sm text-muted">No photos on the selected BDE.</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {selectedPhotos.map((p) => (
                    <div
                      key={p.id}
                      className="size-24 shrink-0 overflow-hidden rounded-lg border border-border bg-canvas"
                    >
                      {photoUrls[p.id] ? (
                        <img
                          src={photoUrls[p.id]}
                          alt={p.file_name ?? 'BDE photo'}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-xs text-muted">…</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="min-h-0 overflow-auto rounded-2xl border border-border bg-surface-raised/30 p-4">
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">BDE Details</h2>
              {selected ? (
                <Link to={`/problem-solve/bde/${selected.id}`} className="text-xs font-medium text-accent hover:underline">
                  Open record
                </Link>
              ) : null}
            </header>
            {!selected ? (
              <p className="text-sm text-muted">Select a BDE ID in the overview to show details.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="rounded-xl bg-canvas/70 px-3 py-2 font-medium">
                  {selected.problem_statement?.trim() || selected.title}
                </div>
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted">Title</dt>
                    <dd>{selected.title}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted">Status</dt>
                    <dd>{bdeStatusLabel(selected.status)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted">Functional location</dt>
                    <dd>{selected.functional_location || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted">Component / Part</dt>
                    <dd>{selected.component_part || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted">Notification #</dt>
                    <dd>{selected.notification_number || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted">Work order #</dt>
                    <dd>{selected.work_order_number || '—'}</dd>
                  </div>
                </dl>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">What happened?</p>
                  <p className="mt-1 whitespace-pre-wrap">{selected.what_happened || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">What was checked?</p>
                  <p className="mt-1 whitespace-pre-wrap">{selected.what_was_checked || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">What were the results?</p>
                  <p className="mt-1 whitespace-pre-wrap">{selected.what_were_the_results || '—'}</p>
                </div>
                {(selected.plan24_event_label || selected.dds_tl_label || selected.ips_reference) && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted">Soft links</p>
                    <ul className="mt-1 space-y-1">
                      {selected.plan24_event_label ? (
                        <li>
                          Plan 24:{' '}
                          <Link to="/problem-solve/plan-24" className="text-accent hover:underline">
                            {selected.plan24_event_label}
                          </Link>
                        </li>
                      ) : null}
                      {selected.dds_tl_label ? <li>DDS Top Loss: {selected.dds_tl_label}</li> : null}
                      {selected.ips_reference ? (
                        <li>
                          IPS:{' '}
                          <Link to="/problem-solve/ips" className="text-accent hover:underline">
                            {selected.ips_reference}
                          </Link>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
