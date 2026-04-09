import { Building2, Factory, LayoutGrid } from 'lucide-react'
import { useLdrWorkspace, type LdrScopeLevel } from './LdrWorkspaceContext'

function ScopeLevelToggle(props: {
  value: LdrScopeLevel
  label: string
  active: boolean
  onSelect: (level: LdrScopeLevel) => void
}) {
  return (
    <button
      type="button"
      onClick={() => props.onSelect(props.value)}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        props.active
          ? 'bg-teal-600 text-white shadow-sm dark:bg-teal-500 dark:text-slate-950'
          : 'text-fg/80 hover:bg-slate-950/5 hover:text-fg dark:hover:bg-white/10'
      }`}
    >
      {props.label}
    </button>
  )
}

export function LdrScopeFilterBar() {
  const {
    status,
    error,
    workspaceId,
    scopeLevel,
    setScopeLevel,
    sites,
    plants,
    cells,
    siteId,
    plantId,
    cellId,
    setSiteId,
    setPlantId,
    setCellId,
  } = useLdrWorkspace()

  const selectClass =
    'h-9 min-w-0 rounded-lg border border-border-strong bg-surface px-2.5 text-sm text-fg shadow-sm'

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

  if (error && !workspaceId) {
    return (
      <div className="rounded-2xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
        {error}
      </div>
    )
  }

  if (!workspaceId) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface-raised/60 px-4 py-3 text-sm text-fg/70">
        <span className="inline-block size-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        {scopeLevel === 'cell' ? 'Select plant and cell, or wait for lists to load…' : 'Resolving workspace…'}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border-strong bg-surface px-3 py-2 shadow-sm sm:px-4">
      <div className="flex min-w-max items-center gap-2">
        <div
          className="inline-flex shrink-0 rounded-xl border border-border bg-slate-950/5 p-1 dark:bg-white/5"
          role="group"
          aria-label="Scope level"
        >
          <ScopeLevelToggle value="site" label="Site level" active={scopeLevel === 'site'} onSelect={setScopeLevel} />
          <ScopeLevelToggle value="cell" label="Cell level" active={scopeLevel === 'cell'} onSelect={setScopeLevel} />
        </div>
        <label className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs font-medium text-fg/75">
          <span className="inline-flex items-center gap-1">
            <Building2 className="size-3.5 opacity-70" aria-hidden />
            Site
          </span>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={`${selectClass} w-40`}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        {scopeLevel === 'cell' ? (
          <>
            <label className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs font-medium text-fg/75">
              <span className="inline-flex items-center gap-1">
                <Factory className="size-3.5 opacity-70" aria-hidden />
                Plant
              </span>
              <select
                value={plantId}
                onChange={(e) => setPlantId(e.target.value)}
                className={`${selectClass} w-36`}
                disabled={!plants.length}
              >
                {plants.map((p) => (
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
                value={cellId}
                onChange={(e) => setCellId(e.target.value)}
                className={`${selectClass} w-36`}
                disabled={!cells.length}
              >
                {cells.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
      </div>
    </div>
  )
}
