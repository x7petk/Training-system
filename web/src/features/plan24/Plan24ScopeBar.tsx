import { Building2, ChevronLeft, ChevronRight, Factory, LayoutGrid, Plus } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { usePlan24Workspace } from './Plan24WorkspaceContext'
import { useShiftDdsShellOptional } from '../dds/ShiftDdsShellContext'

export function Plan24ScopeBar() {
  const location = useLocation()
  const shiftDds = useShiftDdsShellOptional()
  const onDdsDayShiftShell = Boolean(shiftDds?.routeActive)

  const {
    status,
    error,
    sites,
    plants,
    cells,
    siteId,
    plantId,
    cellId,
    setSiteId,
    setPlantId,
    setCellId,
  } = usePlan24Workspace()

  const selectClass =
    'h-9 min-w-0 rounded-lg border border-border-strong bg-surface px-2.5 text-sm text-fg shadow-sm'

  const compactSelectClass =
    'h-8 min-w-0 max-w-[9.5rem] shrink-0 rounded-lg border border-border-strong bg-surface px-2 text-xs text-fg shadow-sm'

  if (status === 'error') {
    return (
      <div className="rounded-2xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
        {error ?? 'Could not load master data for Plan 24.'}
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
        No sites found. Add structure under <strong className="font-medium">Master data → Structure</strong> first.
      </div>
    )
  }

  const p = location.pathname
  const complianceDayOnly = Boolean(shiftDds?.complianceDayOnly)
  const meetingDayOnly = Boolean(shiftDds?.meetingDayOnly)
  const onSiteCompliance = p.endsWith('/site-compliance') || p.includes('/dds-process/site-compliance')
  const onSiteDds = p.endsWith('/site-dds') || p.includes('/dds-process/site-dds')
  const onPlantDds = p.endsWith('/plant-dds') || p.includes('/dds-process/plant-dds')
  const showDdsDayShiftStrip = onDdsDayShiftShell && !complianceDayOnly && !meetingDayOnly && shiftDds && cellId
  const showDdsComplianceDateStrip =
    (complianceDayOnly || meetingDayOnly) &&
    shiftDds &&
    (complianceDayOnly
      ? onSiteCompliance
        ? Boolean(siteId)
        : Boolean(cellId)
      : onSiteDds
        ? Boolean(siteId)
        : onPlantDds
          ? Boolean(plantId)
          : Boolean(cellId))
  const onWdsPage = p.endsWith('/wds') || p.includes('/dds-process/wds')
  const ddsDayShiftLabel =
    p.endsWith('/site-dds') || p.includes('/dds-process/site-dds')
      ? 'Site DDS'
      : p.endsWith('/plant-dds') || p.includes('/dds-process/plant-dds')
        ? 'Plant DDS'
        : p.endsWith('/line-dds') || p.includes('/dds-process/line-dds')
          ? 'Line DDS'
          : p.endsWith('/p2p-op-view') || p.includes('/dds-process/p2p-op-view')
            ? 'P2P Op view'
            : 'Shift DDS'
  const complianceDateLabel = onSiteCompliance ? 'Site compliance' : 'Line compliance'
  const dateOnlyStripLabel = complianceDayOnly ? complianceDateLabel : ddsDayShiftLabel

  return (
    <div className="overflow-x-auto rounded-2xl border border-border-strong bg-surface px-3 py-2 shadow-sm sm:px-4">
      <div className="flex min-w-max flex-wrap items-center gap-2 sm:gap-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg/60">Cell scope</span>
        <label className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs font-medium text-fg/75">
          <span className="inline-flex items-center gap-1">
            <Building2 className="size-3.5 opacity-70" aria-hidden />
            Site
          </span>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)} aria-label="Site">
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
            className={selectClass}
            value={plantId}
            onChange={(e) => setPlantId(e.target.value)}
            aria-label="Plant"
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
            className={selectClass}
            value={cellId}
            onChange={(e) => setCellId(e.target.value)}
            aria-label="Cell"
            disabled={!cells.length}
          >
            {cells.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {showDdsDayShiftStrip ? (
          <>
            <span className="hidden h-6 w-px shrink-0 bg-border/80 sm:block" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-fg/50">{ddsDayShiftLabel}</span>
            <div className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-surface-raised/50 p-0.5">
              <button
                type="button"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-black/[0.06] hover:text-fg"
                aria-label="Previous day"
                onClick={() => shiftDds.stepPlanDay(-1)}
              >
                <ChevronLeft className="size-3.5" aria-hidden />
              </button>
              <input
                type="date"
                className="h-7 max-w-[7.25rem] shrink-0 rounded-md border-0 bg-transparent px-1 text-[11px] font-semibold text-fg outline-none"
                value={shiftDds.planDate}
                min={shiftDds.minPlanYmd}
                max={shiftDds.maxPlanYmd}
                onChange={(e) => shiftDds.setPlanDate(shiftDds.clampPlanDate(e.target.value))}
                aria-label="Plan date"
              />
              <button
                type="button"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-black/[0.06] hover:text-fg disabled:opacity-35"
                aria-label="Next day"
                disabled={shiftDds.planDate >= shiftDds.maxPlanYmd}
                onClick={() => shiftDds.stepPlanDay(1)}
              >
                <ChevronRight className="size-3.5" aria-hidden />
              </button>
            </div>
            <label className="flex min-w-0 shrink-0 items-center gap-1 text-[10px] font-medium text-fg/70">
              <span className="whitespace-nowrap">Shift</span>
              <select
                className={compactSelectClass}
                value={shiftDds.shiftKind}
                onChange={(e) => shiftDds.setShiftKind(e.target.value)}
                aria-label="Shift"
                disabled={shiftDds.shellLoading || shiftDds.shifts.length === 0}
              >
                {shiftDds.shifts.length === 0 ? (
                  <option value="">—</option>
                ) : (
                  shiftDds.shifts.map((s) => (
                    <option key={s.kind} value={s.kind}>
                      {s.display_name?.trim() || s.kind}
                    </option>
                  ))
                )}
              </select>
            </label>
          </>
        ) : null}

        {showDdsComplianceDateStrip ? (
          <>
            <span className="hidden h-6 w-px shrink-0 bg-border/80 sm:block" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-fg/50">{dateOnlyStripLabel}</span>
            <div className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-surface-raised/50 p-0.5">
              <button
                type="button"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-black/[0.06] hover:text-fg"
                aria-label="Previous day"
                onClick={() => shiftDds.stepPlanDay(-1)}
              >
                <ChevronLeft className="size-3.5" aria-hidden />
              </button>
              <input
                type="date"
                className="h-7 max-w-[7.25rem] shrink-0 rounded-md border-0 bg-transparent px-1 text-[11px] font-semibold text-fg outline-none"
                value={shiftDds.planDate}
                min={shiftDds.minPlanYmd}
                max={shiftDds.maxPlanYmd}
                onChange={(e) => shiftDds.setPlanDate(shiftDds.clampPlanDate(e.target.value))}
                aria-label="Plan date"
              />
              <button
                type="button"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-black/[0.06] hover:text-fg disabled:opacity-35"
                aria-label="Next day"
                disabled={shiftDds.planDate >= shiftDds.maxPlanYmd}
                onClick={() => shiftDds.stepPlanDay(1)}
              >
                <ChevronRight className="size-3.5" aria-hidden />
              </button>
            </div>
            <span className="text-[10px] text-muted">24h day</span>
          </>
        ) : null}

        {!cellId && !meetingDayOnly ? (
          <span className="text-xs text-amber-700 dark:text-amber-200">
            {onDdsDayShiftShell ? `Select a cell for ${ddsDayShiftLabel}.` : 'Select a cell to use Plan 24.'}
          </span>
        ) : null}
        {meetingDayOnly && onPlantDds && !plantId ? (
          <span className="text-xs text-amber-700 dark:text-amber-200">Select a plant for Plant DDS.</span>
        ) : null}
        {meetingDayOnly && onSiteDds && !siteId ? (
          <span className="text-xs text-amber-700 dark:text-amber-200">Select a site for Site DDS.</span>
        ) : null}
        {onWdsPage ? (
          <button
            type="button"
            className="ml-auto inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-surface px-2 text-xs font-semibold hover:bg-black/[0.04] disabled:opacity-40 dark:hover:bg-white/[0.06]"
            disabled={!cellId}
            onClick={() => {
              window.dispatchEvent(new CustomEvent('dds-wds-add-column'))
            }}
          >
            <Plus className="size-3.5" aria-hidden />
            Add
          </button>
        ) : null}
      </div>
    </div>
  )
}
