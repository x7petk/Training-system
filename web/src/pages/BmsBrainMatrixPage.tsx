import { useCallback, useMemo, useRef, useState } from 'react'
import { Download, Filter, Minus, Plus, RotateCcw } from 'lucide-react'
import { BmsBrainFilterBar } from '../features/bmsBrain/BmsBrainFilterBar'
import { BmsBrainBlockLegend } from '../features/bmsBrain/BmsBrainBlockLegend'
import { BmsBrainMatrixView } from '../features/bmsBrain/BmsBrainMatrixView'
import { BmsBrainFlowView } from '../features/bmsBrain/BmsBrainFlowView'
import { exportElementToPdf, exportElementToPng } from '../features/bmsBrain/exportView'
import { clampMatrixZoom, MATRIX_ZOOM_MAX, MATRIX_ZOOM_MIN, MATRIX_ZOOM_STEP } from '../features/bmsBrain/matrixLayout'
import { useMatrixViewportWidth } from '../features/bmsBrain/useMatrixViewportWidth'
import { useBmsBrainFullCatalog } from '../features/bmsBrain/useBmsBrainCatalog'
import { useBmsBrainProcesses } from '../features/bmsBrain/useBmsBrainProcesses'
import { useBmsBrainViewPrefs } from '../features/bmsBrain/useBmsBrainViewPrefs'
import { filterProcesses } from '../features/bmsBrain/validateProcessPublish'
import type { BmsFlowNode, BmsProcessRow } from '../features/bmsBrain/types'
import { useAuth } from '../hooks/useAuth'

type FlowFocus = { processId: string; nodeId: string }

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

  const focusedProcess = focus ? visibleProcesses.find((p) => p.id === focus.processId) : null
  const primaryProcess = visibleProcesses[0]
  const zoom = clampMatrixZoom(prefs.viewport.zoom)
  const zoomPct = Math.round(zoom * 100)

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

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">Process Flow Matrix</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Role columns always fill the screen. Zoom adjusts block size; blocks wrap within each cell.
            {focusedProcess ? (
              <>
                {' '}
                Highlighting <span className="font-medium text-foreground">{focusedProcess.name}</span> — click the
                block again to clear.
              </>
            ) : null}
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
          <button
            type="button"
            onClick={() => prefs.updateViewport({ viewMode: prefs.viewport.viewMode === 'matrix' ? 'flow' : 'matrix' })}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-black/[0.04]"
          >
            {prefs.viewport.viewMode === 'matrix' ? 'Flow view' : 'Matrix view'}
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-border px-2 py-1">
            <button
              type="button"
              onClick={() => setZoom(zoom - MATRIX_ZOOM_STEP)}
              className="rounded p-1 hover:bg-black/[0.04]"
              aria-label="Smaller blocks"
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
              aria-label="Block size"
            />
            <button
              type="button"
              onClick={() => setZoom(zoom + MATRIX_ZOOM_STEP)}
              className="rounded p-1 hover:bg-black/[0.04]"
              aria-label="Larger blocks"
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
          {prefs.viewport.viewMode === 'matrix' ? (
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
          ) : primaryProcess ? (
            <BmsBrainFlowView flow={primaryProcess.flow} systems={catalog.systems} readOnly onFlowChange={() => {}} />
          ) : (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
              Select at least one tool tag to view the diagram.
            </p>
          )}
        </div>
      </div>

      {prefs.viewport.viewMode === 'matrix' ? (
        <>
          <BmsBrainBlockLegend compact />
          <p className="text-[11px] text-muted">
            Tip: click a block to highlight its system/tool flow. Ctrl + scroll adjusts block size.
          </p>
        </>
      ) : null}
    </div>
  )
}
