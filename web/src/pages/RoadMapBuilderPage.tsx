import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { invokeRoadMapBuilderViaProxy } from '../lib/roadMapBuilderProxy'
import {
  EMPTY_INPUTS,
  type RoadMapInputs,
  type RoadMapResult,
  type RoadMapRow,
  type RoadMapViewMode,
} from '../features/agents/roadMapBuilderTypes'
import { useRoadMaps } from '../features/agents/useRoadMaps'
import { RoadMapVisual } from '../features/agents/RoadMapVisual'
import { exportSvgAsPdf, exportSvgAsPng } from '../features/agents/roadMapExport'

type VisualView = 'quarterly' | 'now_next_later' | 'gantt'

function resolveVisualView(view: RoadMapViewMode, result: RoadMapResult | null): VisualView {
  if (view === 'auto') {
    if (result?.chosenView === 'quarterly' || result?.chosenView === 'now_next_later' || result?.chosenView === 'gantt') {
      return result.chosenView
    }
    return 'quarterly'
  }
  return view
}

export function RoadMapBuilderPage() {
  const { session } = useAuth()
  const { rows, loading: rowsLoading, error: rowsError, createRoadMap, updateRoadMap, deleteRoadMap } = useRoadMaps()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [inputs, setInputs] = useState<RoadMapInputs>(EMPTY_INPUTS)
  const [result, setResult] = useState<RoadMapResult | null>(null)
  const [view, setView] = useState<RoadMapViewMode>('auto')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [compact, setCompact] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    vision: true,
    objective: true,
    timeline: true,
    workstreams: true,
    audience: false,
    state: false,
    constraints: false,
    metrics: false,
    notes: false,
  })

  const svgRef = useRef<SVGSVGElement | null>(null)
  const visualView = useMemo(() => resolveVisualView(view, result), [view, result])

  // Auto-select most recent row on first load.
  useEffect(() => {
    if (activeId || rows.length === 0) return
    const r = rows[0]
    setActiveId(r.id)
    setInputs(r.inputs)
    setResult(r.result)
    setView(r.view_mode)
  }, [rows, activeId])

  const startNew = useCallback(() => {
    setActiveId(null)
    setInputs(EMPTY_INPUTS)
    setResult(null)
    setView('auto')
    setError(null)
    setCompact(false)
  }, [])

  const openRow = useCallback((row: RoadMapRow) => {
    setActiveId(row.id)
    setInputs(row.inputs)
    setResult(row.result)
    setView(row.view_mode)
    setError(null)
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!session?.access_token) {
      setError('Your session is missing. Please sign out and sign in again.')
      return
    }
    if (!inputs.objective.trim() && !inputs.vision.trim()) {
      setError('Add at least a vision or objective before generating.')
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const { data, errorMessage } = await invokeRoadMapBuilderViaProxy(session.access_token, inputs)
      if (errorMessage || !data) {
        setError(errorMessage ?? 'Generation failed.')
        return
      }
      const generated = data.result
      setResult(generated)
      // Auto-save: persist as a new roadmap if there's no active one yet.
      const titleForRow = (generated.title || inputs.title || 'Untitled roadmap').slice(0, 160)
      if (!activeId) {
        const created = await createRoadMap(titleForRow, { ...inputs, title: titleForRow })
        if (created) {
          setActiveId(created.id)
          await updateRoadMap(created.id, { result: generated })
        }
      } else {
        await updateRoadMap(activeId, { result: generated, inputs: { ...inputs, title: titleForRow }, title: titleForRow })
      }
      if (generated.title) {
        setInputs((prev) => ({ ...prev, title: generated.title }))
      }
    } finally {
      setGenerating(false)
    }
  }, [activeId, createRoadMap, inputs, session?.access_token, updateRoadMap])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const title = (inputs.title || result?.title || 'Untitled roadmap').slice(0, 160)
      if (activeId) {
        await updateRoadMap(activeId, { title, inputs, result, view_mode: view })
      } else {
        const created = await createRoadMap(title, inputs)
        if (created) {
          setActiveId(created.id)
          if (result) await updateRoadMap(created.id, { result, view_mode: view })
        }
      }
    } finally {
      setSaving(false)
    }
  }, [activeId, createRoadMap, inputs, result, updateRoadMap, view])

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this roadmap? This cannot be undone.')) return
      const ok = await deleteRoadMap(id)
      if (ok && id === activeId) startNew()
    },
    [activeId, deleteRoadMap, startNew],
  )

  const handleViewChange = useCallback(
    async (next: RoadMapViewMode) => {
      setView(next)
      if (activeId) {
        await updateRoadMap(activeId, { view_mode: next })
      }
    },
    [activeId, updateRoadMap],
  )

  const handleDownloadPng = useCallback(async () => {
    if (!svgRef.current || !result) return
    const filename = `${(result.title || inputs.title || 'roadmap').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'roadmap'}.png`
    await exportSvgAsPng(svgRef.current, filename, { scale: 2 })
  }, [inputs.title, result])

  const handleDownloadPdf = useCallback(() => {
    if (!svgRef.current || !result) return
    exportSvgAsPdf(svgRef.current, result.title || inputs.title || 'Roadmap')
  }, [inputs.title, result])

  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const showHero = !compact

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Road Map Builder</h1>
          {showHero ? (
            <p className="mt-2 max-w-3xl text-sm text-muted">
              Set your inputs and a rough vision — the agent will polish your vision, structure the
              workstreams, and produce a best-in-class visual roadmap. Edit anything and re-generate as
              your plan evolves.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCompact((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm font-medium text-fg hover:bg-black/[0.04]"
            title={compact ? 'Show full editor' : 'Compact view — focus on the visual roadmap'}
          >
            {compact ? <Maximize2 className="size-4" /> : <Minimize2 className="size-4" />}
            {compact ? 'Show editor' : 'Compact view'}
          </button>
          <button
            type="button"
            onClick={startNew}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm font-medium text-fg hover:bg-black/[0.04]"
          >
            <Plus className="size-4" />
            New roadmap
          </button>
        </div>
      </header>

      {/* Saved roadmaps strip */}
      {rows.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {rows.map((r) => {
            const active = r.id === activeId
            return (
              <div key={r.id} className="group relative">
                <button
                  type="button"
                  onClick={() => openRow(r)}
                  className={`max-w-[18rem] truncate rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'border-accent bg-accent text-white'
                      : 'border-border bg-canvas text-fg hover:border-accent/40 hover:bg-accent-dim/30'
                  }`}
                  title={r.title}
                >
                  {r.title || 'Untitled roadmap'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(r.id)}
                  className={`absolute -right-1 -top-1 hidden size-5 items-center justify-center rounded-full border border-border bg-canvas text-muted shadow group-hover:flex hover:text-rose-600`}
                  aria-label="Delete roadmap"
                  title="Delete"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            )
          })}
          {rowsLoading ? <span className="text-xs text-muted">Loading…</span> : null}
        </div>
      ) : null}

      {rowsError ? (
        <p className="rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger">
          Could not load saved roadmaps: {rowsError}
        </p>
      ) : null}

      {/* Editor panel */}
      <section
        className={`rounded-2xl border border-border bg-surface-raised/40 backdrop-blur-sm transition-all ${
          compact ? 'p-3' : 'p-4 sm:p-6'
        }`}
      >
        {compact ? (
          <CompactInputs inputs={inputs} setInputs={setInputs} onGenerate={() => void handleGenerate()} generating={generating} />
        ) : (
          <FullEditor
            inputs={inputs}
            setInputs={setInputs}
            openSections={openSections}
            toggleSection={toggleSection}
          />
        )}

        {error ? (
          <p className={`${compact ? 'mt-2' : 'mt-4'} rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger`}>
            {error}
          </p>
        ) : null}

        {!compact ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={generating || !session?.access_token}
              onClick={() => void handleGenerate()}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="size-4" />
              {generating ? 'Drafting roadmap…' : result ? 'Regenerate roadmap' : 'Generate roadmap'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-canvas px-4 py-2 text-sm font-medium text-fg hover:bg-black/[0.04] disabled:opacity-60"
            >
              <Save className="size-4" />
              {saving ? 'Saving…' : activeId ? 'Save changes' : 'Save draft'}
            </button>
            <p className="text-xs text-muted">
              Tip: generating also saves automatically. You can come back any time to edit and re-run.
            </p>
          </div>
        ) : null}
      </section>

      {/* Visual roadmap */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold text-fg">Visual roadmap</h2>
            {result?.viewRationale && !compact ? (
              <span className="text-xs text-muted">· {result.viewRationale}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ViewSwitcher value={view} onChange={(v) => void handleViewChange(v)} disabled={!result} />
            <button
              type="button"
              onClick={() => void handleDownloadPng()}
              disabled={!result}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm font-medium text-fg hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
              title="Download PNG"
            >
              <ImageIcon className="size-4" />
              PNG
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!result}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm font-medium text-fg hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
              title="Open print dialog and save as PDF"
            >
              <Download className="size-4" />
              PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-canvas">
          {result ? (
            <div className="min-w-[1280px]">
              <RoadMapVisual ref={svgRef} result={result} view={visualView} width={1280} />
            </div>
          ) : (
            <EmptyState onGenerate={() => void handleGenerate()} canGenerate={Boolean(session?.access_token)} />
          )}
        </div>
      </section>

      {/* Supporting detail */}
      {result && !compact ? <DetailPanels result={result} /> : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Editor — full + compact                                                    */
/* -------------------------------------------------------------------------- */

type EditorProps = {
  inputs: RoadMapInputs
  setInputs: React.Dispatch<React.SetStateAction<RoadMapInputs>>
  openSections: Record<string, boolean>
  toggleSection: (id: string) => void
}

function FullEditor({ inputs, setInputs, openSections, toggleSection }: EditorProps) {
  function update<K extends keyof RoadMapInputs>(key: K, value: RoadMapInputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="md:col-span-2 space-y-1 text-sm">
        <span className="font-medium text-fg">Working title (optional)</span>
        <input
          value={inputs.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="e.g. Site OEE turnaround"
          className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
        />
      </label>

      <CollapsibleSection
        id="vision"
        title="Vision"
        subtitle="A rough vision is fine — AI will polish it for you."
        open={openSections.vision}
        onToggle={toggleSection}
      >
        <textarea
          value={inputs.vision}
          onChange={(e) => update('vision', e.target.value)}
          rows={4}
          placeholder="Example: In 12 months we are the most reliable producer of X, with zero unplanned downtime on critical lines."
          className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="objective"
        title="Primary objective"
        subtitle="What outcome must this roadmap deliver?"
        open={openSections.objective}
        onToggle={toggleSection}
      >
        <textarea
          value={inputs.objective}
          onChange={(e) => update('objective', e.target.value)}
          rows={3}
          placeholder="Example: Lift OEE from 62% to 78% and reduce defect ppm by 60%."
          className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="timeline"
        title="Timeline & visual style"
        subtitle="Horizon and how the diagram is bucketed."
        open={openSections.timeline}
        onToggle={toggleSection}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs">
            <span className="font-medium text-muted">Horizon (months)</span>
            <input
              type="number"
              min={3}
              max={36}
              value={inputs.horizonMonths}
              onChange={(e) => update('horizonMonths', Math.max(1, Math.min(36, Number(e.target.value) || 12)))}
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium text-muted">Bucket</span>
            <select
              value={inputs.bucket}
              onChange={(e) => update('bucket', e.target.value as RoadMapInputs['bucket'])}
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
            >
              <option value="quarters">Quarters</option>
              <option value="months">Months</option>
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium text-muted">Preferred view</span>
            <select
              value={inputs.preferredView}
              onChange={(e) => update('preferredView', e.target.value as RoadMapInputs['preferredView'])}
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
            >
              <option value="auto">Let AI choose</option>
              <option value="quarterly">Quarterly swim-lanes</option>
              <option value="now_next_later">Now / Next / Later</option>
              <option value="gantt">Gantt timeline</option>
            </select>
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="workstreams"
        title="Initial workstreams"
        subtitle="Seed themes — AI will refine, merge, and rename as needed."
        open={openSections.workstreams}
        onToggle={toggleSection}
      >
        <textarea
          value={inputs.workstreams}
          onChange={(e) => update('workstreams', e.target.value)}
          rows={3}
          placeholder="One per line: e.g.&#10;Reliability & maintenance&#10;Quality & defect reduction&#10;Operator capability&#10;Digital & data foundations"
          className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="audience"
        title="Audience & stakeholders"
        subtitle="Who will read this? Who needs to act?"
        open={openSections.audience}
        onToggle={toggleSection}
      >
        <textarea
          value={inputs.audience}
          onChange={(e) => update('audience', e.target.value)}
          rows={2}
          placeholder="Example: Site leadership, production managers, central engineering, finance review board."
          className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="state"
        title="Current state / pain points"
        subtitle="What's broken or limiting today?"
        open={openSections.state}
        onToggle={toggleSection}
      >
        <textarea
          value={inputs.currentState}
          onChange={(e) => update('currentState', e.target.value)}
          rows={3}
          placeholder="Example: Reactive maintenance, no FMEA, two ageing fillers, no central anomaly detection."
          className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="constraints"
        title="Constraints"
        subtitle="Budget, headcount, tech, regulatory, dependencies."
        open={openSections.constraints}
        onToggle={toggleSection}
      >
        <textarea
          value={inputs.constraints}
          onChange={(e) => update('constraints', e.target.value)}
          rows={2}
          placeholder="Example: No new CAPEX in H1; can hire 2 reliability engineers; SAP migration in Q3."
          className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="metrics"
        title="Success metrics / KPIs"
        subtitle="Numbers that will tell us we won."
        open={openSections.metrics}
        onToggle={toggleSection}
      >
        <textarea
          value={inputs.successMetrics}
          onChange={(e) => update('successMetrics', e.target.value)}
          rows={2}
          placeholder="Example: OEE +16 pp, MTBF +40%, defect ppm -60%, training pass rate >= 95%."
          className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="notes"
        title="Additional context"
        subtitle="Paste any extra background or notes."
        open={openSections.notes}
        onToggle={toggleSection}
      >
        <textarea
          value={inputs.contextNotes}
          onChange={(e) => update('contextNotes', e.target.value)}
          rows={4}
          placeholder="Paste any extra notes that should inform the plan — recent audit findings, board feedback, customer commitments, etc."
          className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
        />
      </CollapsibleSection>
    </div>
  )
}

function CompactInputs({
  inputs,
  setInputs,
  onGenerate,
  generating,
}: {
  inputs: RoadMapInputs
  setInputs: React.Dispatch<React.SetStateAction<RoadMapInputs>>
  onGenerate: () => void
  generating: boolean
}) {
  function update<K extends keyof RoadMapInputs>(key: K, value: RoadMapInputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }))
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex-1 min-w-[12rem] space-y-1 text-xs">
        <span className="font-medium text-muted">Title</span>
        <input
          value={inputs.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="Roadmap title"
          className="w-full rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-sm"
        />
      </label>
      <label className="flex-[2] min-w-[16rem] space-y-1 text-xs">
        <span className="font-medium text-muted">Objective</span>
        <input
          value={inputs.objective}
          onChange={(e) => update('objective', e.target.value)}
          placeholder="What this roadmap must deliver"
          className="w-full rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-sm"
        />
      </label>
      <label className="space-y-1 text-xs">
        <span className="font-medium text-muted">Horizon</span>
        <input
          type="number"
          min={3}
          max={36}
          value={inputs.horizonMonths}
          onChange={(e) => update('horizonMonths', Math.max(1, Math.min(36, Number(e.target.value) || 12)))}
          className="w-20 rounded-lg border border-border bg-canvas px-2 py-1.5 text-sm"
        />
      </label>
      <button
        type="button"
        onClick={onGenerate}
        disabled={generating}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Sparkles className="size-4" />
        {generating ? 'Drafting…' : 'Regenerate'}
      </button>
    </div>
  )
}

function CollapsibleSection({
  id,
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  id: string
  title: string
  subtitle?: string
  open: boolean
  onToggle: (id: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-canvas/60">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-black/[0.03]"
        aria-expanded={open}
      >
        <span>
          <span className="block text-sm font-semibold text-fg">{title}</span>
          {subtitle ? <span className="block text-[11px] text-muted">{subtitle}</span> : null}
        </span>
        {open ? <ChevronUp className="size-4 text-muted" /> : <ChevronDown className="size-4 text-muted" />}
      </button>
      {open ? <div className="px-3 pb-3">{children}</div> : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* View switcher                                                              */
/* -------------------------------------------------------------------------- */

function ViewSwitcher({
  value,
  onChange,
  disabled,
}: {
  value: RoadMapViewMode
  onChange: (v: RoadMapViewMode) => void
  disabled?: boolean
}) {
  const options: { id: RoadMapViewMode; label: string; Icon: typeof LayoutGrid }[] = [
    { id: 'auto', label: 'Auto', Icon: Sparkles },
    { id: 'quarterly', label: 'Swim-lanes', Icon: LayoutGrid },
    { id: 'now_next_later', label: 'Now / Next / Later', Icon: MapIcon },
    { id: 'gantt', label: 'Gantt', Icon: Calendar },
  ]
  return (
    <div className="inline-flex rounded-lg border border-border bg-canvas p-0.5">
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              active ? 'bg-accent text-white' : 'text-muted hover:bg-black/[0.04] hover:text-fg'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <o.Icon className="size-3.5" />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Empty + detail panels                                                       */
/* -------------------------------------------------------------------------- */

function EmptyState({ onGenerate, canGenerate }: { onGenerate: () => void; canGenerate: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent-dim text-accent">
        <MapIcon className="size-6" />
      </span>
      <p className="font-display text-base font-semibold text-fg">No roadmap yet</p>
      <p className="max-w-md text-sm text-muted">
        Fill in your vision, objective and a few workstreams above, then generate. The visual
        roadmap will appear here and you'll be able to download it as PNG or PDF.
      </p>
      <button
        type="button"
        onClick={onGenerate}
        disabled={!canGenerate}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Sparkles className="size-4" />
        Generate roadmap
      </button>
    </div>
  )
}

function DetailPanels({ result }: { result: RoadMapResult }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-surface-raised/40 p-4 sm:p-5">
        <p className="text-xs uppercase tracking-wider text-muted">Polished vision</p>
        <p className="mt-1 text-sm font-medium text-fg">{result.polishedVision}</p>
        <p className="mt-4 text-xs uppercase tracking-wider text-muted">Executive summary</p>
        <p className="mt-1 text-sm text-fg">{result.executiveSummary}</p>
        {result.quickWins?.length > 0 ? (
          <>
            <p className="mt-4 text-xs uppercase tracking-wider text-muted">Quick wins</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-fg">
              {result.quickWins.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border bg-surface-raised/40 p-4 sm:p-5">
        <p className="text-xs uppercase tracking-wider text-muted">Success metrics</p>
        <ul className="mt-2 space-y-2">
          {result.successMetrics.map((m, i) => (
            <li key={`${m.name}-${i}`} className="rounded-lg border border-border bg-canvas px-3 py-2 text-sm">
              <p className="font-semibold text-fg">{m.name}</p>
              <p className="text-xs text-muted">
                Target: <span className="font-medium text-fg">{m.target}</span>
                {m.baseline ? ` · Baseline: ${m.baseline}` : ''}
                {m.timeframe ? ` · ${m.timeframe}` : ''}
                {m.owner ? ` · Owner: ${m.owner}` : ''}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-surface-raised/40 p-4 sm:p-5">
        <p className="text-xs uppercase tracking-wider text-muted">Key milestones</p>
        <ul className="mt-2 space-y-2">
          {result.keyMilestones.map((m) => (
            <li key={m.id} className="rounded-lg border border-border bg-canvas px-3 py-2 text-sm">
              <p className="font-semibold text-fg">M{m.month} · {m.title}</p>
              <p className="text-xs text-muted">{m.description}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-surface-raised/40 p-4 sm:p-5">
        <p className="text-xs uppercase tracking-wider text-muted">Risks & mitigations</p>
        <ul className="mt-2 space-y-2">
          {result.risks.map((r, i) => (
            <li key={`${r.description}-${i}`} className="rounded-lg border border-border bg-canvas px-3 py-2 text-sm">
              <p className="flex items-center gap-2 font-semibold text-fg">
                <span
                  className={`inline-flex size-2 rounded-full ${
                    r.severity === 'high' ? 'bg-rose-500' : r.severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  aria-hidden
                />
                {r.description}
              </p>
              <p className="text-xs text-muted">
                <span className="font-medium text-fg">Mitigation:</span> {r.mitigation}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-surface-raised/40 p-4 sm:p-5 lg:col-span-2">
        <p className="text-xs uppercase tracking-wider text-muted">Items</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((it) => {
            const ws = result.workstreams.find((w) => w.id === it.workstreamId)
            return (
              <article key={it.id} className="rounded-lg border border-border bg-canvas px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-fg">{it.title}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      it.priority === 'high'
                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                        : it.priority === 'medium'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {it.priority}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {ws?.name ?? 'Workstream'} · M{it.startMonth}–M{it.endMonth}
                  {it.owner ? ` · ${it.owner}` : ''}
                </p>
                <p className="mt-1 text-xs text-fg">{it.description}</p>
                {it.outcome ? (
                  <p className="mt-1 text-xs text-muted">
                    <FileText className="mr-1 inline size-3" />
                    {it.outcome}
                  </p>
                ) : null}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
