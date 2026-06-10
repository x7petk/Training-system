import { useCallback, useMemo, useRef, useState } from 'react'
import { Download, Filter, Loader2, Minus, Plus, RotateCcw, Sparkles } from 'lucide-react'
import { BmsBrainFilterBar } from '../features/bmsBrain/BmsBrainFilterBar'
import { BmsBrainBlockLegend } from '../features/bmsBrain/BmsBrainBlockLegend'
import { BmsBrainMatrixView } from '../features/bmsBrain/BmsBrainMatrixView'
import { BmsBrainRoleForumMatrixView } from '../features/bmsBrain/BmsBrainRoleForumMatrixView'
import { BmsBrainRoleSummaryMatrixView } from '../features/bmsBrain/BmsBrainRoleSummaryMatrixView'
import { exportElementToPdf, exportElementToPng } from '../features/bmsBrain/exportView'
import { clampMatrixZoom, MATRIX_ZOOM_MAX, MATRIX_ZOOM_MIN, MATRIX_ZOOM_STEP } from '../features/bmsBrain/matrixLayout'
import { useMatrixViewportWidth } from '../features/bmsBrain/useMatrixViewportWidth'
import { useBmsBrainRoleForumMatrix } from '../features/bmsBrain/useBmsBrainRoleForumMatrix'
import { useBmsBrainRoleSummaryMatrix } from '../features/bmsBrain/useBmsBrainRoleSummaryMatrix'
import { useBmsBrainFullCatalog } from '../features/bmsBrain/useBmsBrainCatalog'
import { useBmsBrainProcesses } from '../features/bmsBrain/useBmsBrainProcesses'
import { useBmsBrainViewPrefs } from '../features/bmsBrain/useBmsBrainViewPrefs'
import { filterProcesses } from '../features/bmsBrain/validateProcessPublish'
import type { BmsFlowNode, BmsProcessRow, BmsViewViewport } from '../features/bmsBrain/types'
import { useAuth } from '../hooks/useAuth'

type FlowFocus = { processId: string; nodeId: string }

const VIEW_MODES: { id: BmsViewViewport['viewMode']; label: string }[] = [
  { id: 'matrix', label: 'Matrix view' },
  { id: 'roleSummaries', label: 'Role summaries' },
  { id: 'matrixAi', label: 'Matrix AI' },
]

export function BmsBrainMatrixPage() {
  const { user } = useAuth()
  const exportRef = useRef<HTMLDivElement>(null)
  const { ref: viewportRef, width: viewportWidth } = useMatrixViewportWidth()
  const catalog = useBmsBrainFullCatalog()
  const processes = useBmsBrainProcesses(true)
  const prefs = useBmsBrainViewPrefs(user?.id)
  const [focus, setFocus] = useState<FlowFocus | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(true)

  const visibleProcesses = useMemo(
    () => filterProcesses(processes.rows, prefs.filters),
    [processes.rows, prefs.filters],
  )

  const viewMode = prefs.viewport.viewMode
  const isMatrixView = viewMode === 'matrix'
  const isRoleSummaries = viewMode === 'roleSummaries'
  const isMatrixAi = viewMode === 'matrixAi'

  const roleSummaries = useBmsBrainRoleSummaryMatrix(
    isRoleSummaries,
    visibleProcesses,
    catalog.roles,
    catalog.forums,
    prefs.filters,
    catalog.systems,
  )

  const matrixAi = useBmsBrainRoleForumMatrix(
    isMatrixAi,
    visibleProcesses,
    catalog.roles,
    catalog.forums,
    prefs.filters,
    catalog.systems,
  )

  const focusedProcess = focus ? visibleProcesses.find((p) => p.id === focus.processId) : null
  const zoom = clampMatrixZoom(prefs.viewport.zoom)
  const zoomPct = Math.round(zoom * 100)
  const aiLoading = isRoleSummaries ? roleSummaries.loading : isMatrixAi ? matrixAi.loading : false

  const setZoom = useCallback(
    (next: number) => prefs.updateViewport({ zoom: clampMatrixZoom(next) }),
    [prefs],
  )

  const onMatrixWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -MATRIX_ZOOM_STEP : MATRIX_ZOOM_STEP
      setZoom(zoom + delta)
    },
    [setZoom, zoom],
  )

  const onSelectNode = useCallback((node: BmsFlowNode, process: BmsProcessRow) => {
    setFocus((prev) =>
      prev?.processId === process.id && prev?.nodeId === node.id
        ? null
        : { processId: process.id, nodeId: node.id },
    )
  }, [])

  const focusedNodeKey = focus ? `${focus.processId}::${focus.nodeId}` : null

  const reloadAi = () => {
    if (isRoleSummaries) void roleSummaries.reload()
    if (isMatrixAi) void matrixAi.reload()
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">Process Flow Matrix</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {isMatrixAi ? (
              <>
                Same role × forum grid, simplified by AI — consolidated groups with key actions and tools, optimised to
                read on one page. Regenerate after changing filters.
              </>
            ) : isRoleSummaries ? (
              <>
                AI summaries of what each role must do in each forum — structured by purpose, must-do actions,
                decisions, handoffs, and systems. Regenerate after changing filters.
              </>
            ) : (
              <>
                Role columns always fill the screen. Zoom adjusts block size; blocks wrap within each cell.
                {focusedProcess ? (
                  <>
                    {' '}
                    Highlighting <span className="font-medium text-foreground">{focusedProcess.name}</span> — click
                    the block again to clear.
                  </>
                ) : null}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={[
              'inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium',
              filtersOpen ? 'border-accent/40 bg-accent/5 text-accent' : 'border-border hover:bg-black/[0.04]',
            ].join(' ')}
          >
            <Filter className="size-3.5" aria-hidden />
            Filters
          </button>

          <div className="inline-flex rounded-lg border border-border p-0.5">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => prefs.updateViewport({ viewMode: mode.id })}
                className={[
                  'rounded-md px-2.5 py-1 text-xs font-medium transition',
                  viewMode === mode.id
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-muted hover:bg-black/[0.04] hover:text-foreground',
                ].join(' ')}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {isRoleSummaries || isMatrixAi ? (
            <button
              type="button"
              onClick={reloadAi}
              disabled={aiLoading}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-black/[0.04] disabled:opacity-50"
            >
              {aiLoading ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-3.5" aria-hidden />
              )}
              Regenerate
            </button>
          ) : null}

          <div className="flex items-center gap-1 rounded-lg border border-border px-2 py-1">
            <button
              type="button"
              onClick={() => setZoom(zoom - MATRIX_ZOOM_STEP)}
              className="rounded p-1 hover:bg-black/[0.04]"
              aria-label="Smaller text"
              disabled={zoom <= MATRIX_ZOOM_MIN}
            >
              <Minus className="size-4" />
            </button>
            <input
              type="range"
              min={MATRIX_ZOOM_MIN}
              max={MATRIX_ZOOM_MAX}
              step={MATRIX_ZOOM_STEP}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-24 accent-accent"
              aria-label="Text size"
            />
            <button
              type="button"
              onClick={() => setZoom(zoom + MATRIX_ZOOM_STEP)}
              className="rounded p-1 hover:bg-black/[0.04]"
              aria-label="Larger text"
              disabled={zoom >= MATRIX_ZOOM_MAX}
            >
              <Plus className="size-4" />
            </button>
            <span className="min-w-[2.75rem] text-center text-xs font-medium tabular-nums text-muted">{zoomPct}%</span>
          </div>

          <button
            type="button"
            onClick={() => setZoom(1)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-black/[0.04]"
          >
            Default size
          </button>

          <button
            type="button"
            onClick={prefs.resetView}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-black/[0.04]"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Reset
          </button>
          <button
            type="button"
            onClick={() => exportRef.current && void exportElementToPng(exportRef.current, 'bms-brain-matrix.png')}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-black/[0.04]"
          >
            <Download className="size-3.5" aria-hidden />
            PNG
          </button>
          <button
            type="button"
            onClick={() => exportRef.current && void exportElementToPdf(exportRef.current, 'bms-brain-matrix.pdf')}
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
          >
            <Download className="size-3.5" aria-hidden />
            PDF
          </button>
        </div>
      </header>

      {filtersOpen ? (
        <BmsBrainFilterBar
          roles={catalog.roles}
          forums={catalog.forums}
          systems={catalog.systems}
          filters={prefs.filters}
          onChange={prefs.updateFilters}
          onReset={prefs.resetView}
        />
      ) : null}

      <div ref={viewportRef} className="relative min-h-[28rem] min-w-0" onWheel={onMatrixWheel}>
        <div ref={exportRef} className="min-w-0">
          {isMatrixView ? (
            <BmsBrainMatrixView
              processes={visibleProcesses}
              roles={catalog.roles}
              forums={catalog.forums}
              systems={catalog.systems}
              filters={prefs.filters}
              viewportWidth={viewportWidth}
              zoom={zoom}
              highlightProcessId={focus?.processId ?? null}
              focusedNodeKey={focusedNodeKey}
              onSelectNode={onSelectNode}
            />
          ) : isRoleSummaries ? (
            <BmsBrainRoleSummaryMatrixView
              roles={catalog.roles}
              forums={catalog.forums}
              filters={prefs.filters}
              viewportWidth={viewportWidth}
              zoom={zoom}
              cells={roleSummaries.cells}
              stepPresence={roleSummaries.stepPresence}
              loading={roleSummaries.loading}
              error={roleSummaries.error}
            />
          ) : (
            <BmsBrainRoleForumMatrixView
              roles={catalog.roles}
              forums={catalog.forums}
              filters={prefs.filters}
              viewportWidth={viewportWidth}
              zoom={zoom}
              cells={matrixAi.cells}
              stepPresence={matrixAi.stepPresence}
              loading={matrixAi.loading}
              error={matrixAi.error}
            />
          )}
        </div>
      </div>

      {isMatrixView ? (
        <>
          <BmsBrainBlockLegend compact />
          <p className="text-[11px] text-muted">
            Tip: click a block to highlight its system/tool flow. Ctrl + scroll adjusts block size.
          </p>
        </>
      ) : isRoleSummaries ? (
        <p className="text-[11px] text-muted">
          Each cell lists purpose, must-do actions, decisions, handoffs, and systems for that role in that forum. Use
          Regenerate after filter changes.
        </p>
      ) : isMatrixAi ? (
        <p className="text-[11px] text-muted">
          Matrix AI merges overlapping steps into compact groups. All key actions are kept — wording is simplified for
          one-page reading. Use Regenerate after filter changes.
        </p>
      ) : null}
    </div>
  )
}
