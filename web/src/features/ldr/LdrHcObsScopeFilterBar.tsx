import { Building2, Factory, LayoutGrid } from 'lucide-react'
import { useMemo } from 'react'
import { LdrLocationCreateActionButton } from './LdrLocationCreateActionButton'
import { useLdrWorkspace } from './LdrWorkspaceContext'

function sortMaster<T extends { sort_order: number; name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

export function LdrHcObsScopeFilterBar() {
  const {
    status,
    error,
    sites,
    allPlants,
    allCells,
    hcObsSiteId,
    hcObsPlantId,
    hcObsCellId,
    setHcObsSiteId,
    setHcObsPlantId,
    setHcObsCellId,
  } = useLdrWorkspace()

  const selectClass =
    'h-9 min-w-0 rounded-lg border border-border-strong bg-surface px-2.5 text-sm text-fg shadow-sm'

  const plantsForSite = useMemo(
    () => sortMaster(allPlants.filter((p) => p.site_id === hcObsSiteId)),
    [allPlants, hcObsSiteId],
  )

  const cellsForPlantScope = useMemo(() => {
    if (hcObsPlantId) {
      return sortMaster(allCells.filter((c) => c.plant_id === hcObsPlantId))
    }
    const plantIds = new Set(plantsForSite.map((p) => p.id))
    return sortMaster(allCells.filter((c) => plantIds.has(c.plant_id)))
  }, [allCells, hcObsPlantId, plantsForSite])

  if (status === 'error') {
    return (
      <div className="rounded-2xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
        {error ?? 'Could not load LDR scope.'}
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface-raised/60 px-4 py-3 text-sm text-fg/70">
        <span className="inline-block size-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        Loading master data…
      </div>
    )
  }

  if (!sites.length) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        No sites found in Master data. A super admin must add sites under <strong className="font-medium">Master data → Structure</strong> before LDR tools can use a scope.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border-strong bg-surface px-3 py-2 shadow-sm sm:px-4">
      <div className="flex min-w-max flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted">Location</span>
        <label className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs font-medium text-fg/75">
          <span className="inline-flex items-center gap-1">
            <Building2 className="size-3.5 opacity-70" aria-hidden />
            Site
          </span>
          <select value={hcObsSiteId} onChange={(e) => setHcObsSiteId(e.target.value)} className={`${selectClass} w-40`}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs font-medium text-fg/75">
          <span className="inline-flex items-center gap-1">
            <Factory className="size-3.5 opacity-70" aria-hidden />
            Plant
          </span>
          <select
            value={hcObsPlantId}
            onChange={(e) => setHcObsPlantId(e.target.value)}
            className={`${selectClass} w-36`}
            disabled={!plantsForSite.length}
          >
            <option value="">All plants</option>
            {plantsForSite.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs font-medium text-fg/75">
          <span className="inline-flex items-center gap-1">
            <LayoutGrid className="size-3.5 opacity-70" aria-hidden />
            Cell
          </span>
          <select
            value={hcObsCellId}
            onChange={(e) => setHcObsCellId(e.target.value)}
            className={`${selectClass} w-44`}
            disabled={!cellsForPlantScope.length}
          >
            <option value="">All cells{hcObsPlantId ? '' : ' (site)'}</option>
            {cellsForPlantScope.map((c) => {
              const plant = plantsForSite.find((p) => p.id === c.plant_id)
              const label = plant ? `${plant.name} · ${c.name}` : c.name
              return (
                <option key={c.id} value={c.id}>
                  {label}
                </option>
              )
            })}
          </select>
        </label>
        </div>
        <LdrLocationCreateActionButton />
      </div>
      <p className="mt-1.5 text-[11px] text-muted">
        Lists and reports show records for the selected location. Leave plant or cell empty to include all under the site or plant. New checks require a cell (auto-filled if empty).
      </p>
    </div>
  )
}
