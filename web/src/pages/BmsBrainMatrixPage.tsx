import { useMemo, useRef, useState } from 'react'
import { Download, Minus, Plus, RotateCcw } from 'lucide-react'
import { BmsBrainFilterBar } from '../features/bmsBrain/BmsBrainFilterBar'
import { BmsBrainMatrixView } from '../features/bmsBrain/BmsBrainMatrixView'
import { BmsBrainFlowView } from '../features/bmsBrain/BmsBrainFlowView'
import { BmsBrainProcessSummaryPanel } from '../features/bmsBrain/BmsBrainProcessSummaryPanel'
import { BmsBrainStepPanel } from '../features/bmsBrain/BmsBrainStepPanel'
import { exportElementToPdf, exportElementToPng } from '../features/bmsBrain/exportView'
import { useBmsBrainFullCatalog } from '../features/bmsBrain/useBmsBrainCatalog'
import { useBmsBrainProcesses } from '../features/bmsBrain/useBmsBrainProcesses'
import { useBmsBrainViewPrefs } from '../features/bmsBrain/useBmsBrainViewPrefs'
import { filterProcesses } from '../features/bmsBrain/validateProcessPublish'
import type { BmsFlowNode, BmsProcessRow } from '../features/bmsBrain/types'
import { useAuth } from '../hooks/useAuth'

export function BmsBrainMatrixPage() {
  const { user } = useAuth()
  const exportRef = useRef<HTMLDivElement>(null)
  const catalog = useBmsBrainFullCatalog()
  const processes = useBmsBrainProcesses(true)
  const prefs = useBmsBrainViewPrefs(user?.id)
  const [selected, setSelected] = useState<{ node: BmsFlowNode; process: BmsProcessRow } | null>(null)

  const visibleProcesses = useMemo(
    () => filterProcesses(processes.rows, prefs.filters),
    [processes.rows, prefs.filters],
  )

  const primaryProcess = visibleProcesses[0]

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">Process Flow Matrix</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Forums as rows, roles as columns. Filter systems, roles, forums, and processes to focus the view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => prefs.updateViewport({ viewMode: prefs.viewport.viewMode === 'matrix' ? 'flow' : 'matrix' })}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-black/[0.04]"
          >
            {prefs.viewport.viewMode === 'matrix' ? 'Flow view' : 'Matrix view'}
          </button>
          <button
            type="button"
            onClick={() => prefs.updateViewport({ zoom: Math.min(2, prefs.viewport.zoom + 0.1) })}
            className="rounded-lg border border-border p-2 hover:bg-black/[0.04]"
            aria-label="Zoom in"
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => prefs.updateViewport({ zoom: Math.max(0.5, prefs.viewport.zoom - 0.1) })}
            className="rounded-lg border border-border p-2 hover:bg-black/[0.04]"
            aria-label="Zoom out"
          >
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            onClick={prefs.resetView}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-black/[0.04]"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Reset view
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

      <BmsBrainFilterBar
        processes={processes.rows}
        roles={catalog.roles}
        forums={catalog.forums}
        systems={catalog.systems}
        filters={prefs.filters}
        onChange={prefs.updateFilters}
        onReset={prefs.resetView}
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        <div ref={exportRef} className="min-w-0 flex-1">
          {prefs.viewport.viewMode === 'matrix' ? (
            <BmsBrainMatrixView
              processes={visibleProcesses}
              roles={catalog.roles}
              forums={catalog.forums}
              systems={catalog.systems}
              filters={prefs.filters}
              zoom={prefs.viewport.zoom}
              selectedNodeId={selected?.node.id ?? null}
              onSelectNode={(node, process) => setSelected({ node, process })}
            />
          ) : primaryProcess ? (
            <BmsBrainFlowView flow={primaryProcess.flow} systems={catalog.systems} readOnly onFlowChange={() => {}} />
          ) : (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
              Select at least one process to view the flow.
            </p>
          )}
        </div>
        {selected ? (
          <BmsBrainStepPanel
            node={selected.node}
            process={selected.process}
            roles={catalog.roles}
            forums={catalog.forums}
            systems={catalog.systems}
            onClose={() => setSelected(null)}
          />
        ) : (
          <BmsBrainProcessSummaryPanel
            processes={visibleProcesses}
            roles={catalog.roles}
            forums={catalog.forums}
            systems={catalog.systems}
          />
        )}
      </div>
    </div>
  )
}
