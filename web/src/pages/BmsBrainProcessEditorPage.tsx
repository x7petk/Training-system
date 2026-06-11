import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Minus, Plus, Save, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { BmsBrainFlowView, createBmsNode } from '../features/bmsBrain/BmsBrainFlowView'
import { BmsBrainBlockLegend } from '../features/bmsBrain/BmsBrainBlockLegend'
import { BmsBrainMatrixView } from '../features/bmsBrain/BmsBrainMatrixView'
import { BmsBrainSlidePanel } from '../features/bmsBrain/BmsBrainSlidePanel'
import { BmsBrainStepAttachments } from '../features/bmsBrain/BmsBrainStepAttachments'
import { BmsBrainVersionHistory } from '../features/bmsBrain/BmsBrainVersionHistory'
import { normalizeBmsFlowLayout } from '../features/bmsBrain/bmsFlowAutoLayout'
import { bmsBrainCanEdit } from '../features/bmsBrain/bmsBrainAccess'
import { clampMatrixZoom, MATRIX_ZOOM_MAX, MATRIX_ZOOM_MIN, MATRIX_ZOOM_STEP } from '../features/bmsBrain/matrixLayout'
import { useBmsBrainFullCatalog } from '../features/bmsBrain/useBmsBrainCatalog'
import { useMatrixViewportWidth } from '../features/bmsBrain/useMatrixViewportWidth'
import { publishBmsProcess, saveBmsProcess } from '../features/bmsBrain/useBmsBrainProcesses'
import { validateProcessForPublish } from '../features/bmsBrain/validateProcessPublish'
import type { BmsFlowNode, BmsNodeKind, BmsProcessFlow, BmsProcessRow, BmsViewFilters } from '../features/bmsBrain/types'
import { EMPTY_BMS_FLOW } from '../features/bmsBrain/types'

type EditorViewMode = 'matrix' | 'flow'

const MATRIX_FILTERS: BmsViewFilters = { systemIds: [], roleIds: [], forumIds: [] }

const BLOCK_KINDS: { kind: BmsNodeKind; label: string }[] = [
  { kind: 'start', label: 'Start' },
  { kind: 'process', label: 'Process' },
  { kind: 'decision', label: 'Decision' },
  { kind: 'review', label: 'Review' },
  { kind: 'document', label: 'Document' },
  { kind: 'subprocess', label: 'Subprocess' },
  { kind: 'end', label: 'End' },
]

export function BmsBrainProcessEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAdmin, bmsBrainRole } = useAuth()
  const canEdit = bmsBrainCanEdit({ isAdmin, bmsBrainRole })
  const catalog = useBmsBrainFullCatalog()
  const [process, setProcess] = useState<BmsProcessRow | null>(null)
  const [flow, setFlow] = useState<BmsProcessFlow>(EMPTY_BMS_FLOW)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<EditorViewMode>('matrix')
  const [matrixZoom, setMatrixZoomState] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const { ref: matrixViewportRef, width: matrixViewportWidth } = useMatrixViewportWidth()

  useEffect(() => {
    if (!id) return
    void (async () => {
      setLoading(true)
      const { data, error } = await supabase.from('bms_brain_processes').select('*').eq('id', id).maybeSingle()
      if (error || !data) {
        setMsg(error?.message ?? 'Process not found')
        setProcess(null)
      } else {
        const row = data as BmsProcessRow
        setProcess(row)
        setFlow(row.flow ?? EMPTY_BMS_FLOW)
      }
      setLoading(false)
    })()
  }, [id])

  const selectedNode = useMemo(
    () => flow.nodes.find((n) => n.id === selectedId) ?? null,
    [flow.nodes, selectedId],
  )

  const processWithFlow = useMemo(
    () => (process ? { ...process, flow } : null),
    [process, flow],
  )

  const unplacedNodes = useMemo(() => {
    const roleIds = new Set(catalog.roles.map((r) => r.id))
    const forumIds = new Set(catalog.forums.map((f) => f.id))
    return flow.nodes.filter((n) => !n.roleId || !n.forumId || !roleIds.has(n.roleId) || !forumIds.has(n.forumId))
  }, [catalog.forums, catalog.roles, flow.nodes])

  const focusedNodeKey = process && selectedId ? `${process.id}::${selectedId}` : null
  const matrixZoomPct = Math.round(matrixZoom * 100)

  const setMatrixZoom = useCallback((next: number) => {
    setMatrixZoomState(clampMatrixZoom(next))
  }, [])

  const onMatrixWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setMatrixZoom(matrixZoom + (e.deltaY > 0 ? -MATRIX_ZOOM_STEP : MATRIX_ZOOM_STEP))
    },
    [matrixZoom, setMatrixZoom],
  )

  const onMatrixSelectNode = useCallback((node: BmsFlowNode, _process: BmsProcessRow) => {
    setSelectedId(node.id)
  }, [])

  async function persist(status = process?.status ?? 'draft') {
    if (!user || !process || !canEdit) return
    setSaving(true)
    const { row, error } = await saveBmsProcess(
      process.id,
      {
        name: process.name,
        description: process.description,
        status,
        flow,
        owner_role_id: process.owner_role_id,
        catalog_system_id: process.catalog_system_id ?? null,
      },
      user.id,
    )
    setSaving(false)
    if (error) setMsg(error)
    else if (row) {
      setProcess(row)
      setMsg('Saved')
    }
  }

  async function publish() {
    if (!user || !process) return
    const issues = validateProcessForPublish(
      { ...process, flow },
      catalog.roles,
      catalog.forums,
      catalog.systems,
    )
    if (issues.length) {
      setMsg(issues.map((i) => i.message).join(' · '))
      return
    }
    await persist('draft')
    const { error } = await publishBmsProcess({ ...process, flow }, user.id)
    setMsg(error ?? 'Published')
    if (!error) navigate('/bms-brain/processes')
  }

  function addBlock(kind: BmsNodeKind) {
    const i = flow.nodes.length
    const col = i % 3
    const row = Math.floor(i / 3)
    const n = createBmsNode(
      kind,
      BLOCK_KINDS.find((b) => b.kind === kind)?.label ?? kind,
      100 + col * 260,
      100 + row * 200,
    )
    setFlow((f) => normalizeBmsFlowLayout({ ...f, nodes: [...f.nodes, n] }, { lockedNodeId: n.id }))
    setSelectedId(n.id)
  }

  function patchNode(id: string, patch: Partial<BmsFlowNode>) {
    setFlow((f) => ({
      ...f,
      nodes: f.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }))
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted" />
      </div>
    )
  }

  if (!process) {
    return (
      <p className="text-sm text-danger">{msg ?? 'Process not found'}</p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/bms-brain/processes" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" /> Systems &amp; Tools
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <input
            className="w-full max-w-xl rounded-lg border border-border bg-canvas px-3 py-2 font-display text-lg font-semibold"
            value={process.name}
            disabled={!canEdit}
            onChange={(e) => setProcess({ ...process, name: e.target.value })}
          />
          <textarea
            className="w-full max-w-xl rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
            rows={2}
            placeholder="Flow description"
            value={process.description}
            disabled={!canEdit}
            onChange={(e) => setProcess({ ...process, description: e.target.value })}
          />
          <label className="block max-w-xl space-y-1 text-sm">
            <span className="text-xs text-muted">Linked system / tool</span>
            <select
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
              value={process.catalog_system_id ?? ''}
              disabled={!canEdit}
              onChange={(e) => setProcess({ ...process, catalog_system_id: e.target.value || null })}
            >
              <option value="">Cross-system flow (none)</option>
              {catalog.systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void persist()}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium"
            >
              <Save className="size-4" /> Save draft
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void publish()}
              className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
            >
              <Upload className="size-4" /> Publish
            </button>
          </div>
        ) : null}
      </header>

      {msg ? <p className="text-xs text-muted">{msg}</p> : null}

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          {BLOCK_KINDS.map((b) => (
            <button
              key={b.kind}
              type="button"
              onClick={() => addBlock(b.kind)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-black/[0.04]"
            >
              + {b.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-surface-raised/50 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={[
                'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                viewMode === 'matrix' ? 'bg-accent text-accent-fg shadow-sm' : 'text-muted hover:text-fg',
              ].join(' ')}
            >
              Role × forum matrix
            </button>
            <button
              type="button"
              onClick={() => setViewMode('flow')}
              className={[
                'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                viewMode === 'flow' ? 'bg-accent text-accent-fg shadow-sm' : 'text-muted hover:text-fg',
              ].join(' ')}
            >
              Flow diagram
            </button>
          </div>

          {viewMode === 'matrix' ? (
            <>
              <div className="flex items-center gap-1 rounded-lg border border-border px-2 py-1">
                <button
                  type="button"
                  onClick={() => setMatrixZoom(matrixZoom - MATRIX_ZOOM_STEP)}
                  className="rounded p-1 hover:bg-black/[0.04]"
                  aria-label="Zoom out matrix"
                  disabled={matrixZoom <= MATRIX_ZOOM_MIN}
                >
                  <Minus className="size-4" />
                </button>
                <input
                  type="range"
                  min={MATRIX_ZOOM_MIN}
                  max={MATRIX_ZOOM_MAX}
                  step={MATRIX_ZOOM_STEP}
                  value={matrixZoom}
                  onChange={(e) => setMatrixZoom(Number(e.target.value))}
                  className="w-24 accent-accent"
                  aria-label="Matrix zoom"
                />
                <button
                  type="button"
                  onClick={() => setMatrixZoom(matrixZoom + MATRIX_ZOOM_STEP)}
                  className="rounded p-1 hover:bg-black/[0.04]"
                  aria-label="Zoom in matrix"
                  disabled={matrixZoom >= MATRIX_ZOOM_MAX}
                >
                  <Plus className="size-4" />
                </button>
                <span className="min-w-[2.75rem] text-center text-xs font-medium tabular-nums text-muted">
                  {matrixZoomPct}%
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMatrixZoom(1)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-black/[0.04]"
              >
                Default size
              </button>
            </>
          ) : null}
        </div>
        <p className="text-[11px] text-muted">
          {viewMode === 'matrix'
            ? 'Same grid as Process Flow Matrix — forums as rows, roles as columns. Ctrl + scroll zooms.'
            : 'Sequence view with role and forum on each block.'}
        </p>
      </div>

      {unplacedNodes.length > 0 ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
          {unplacedNodes.length} step{unplacedNodes.length === 1 ? '' : 's'} missing a role or forum and will not appear in the
          matrix: {unplacedNodes.map((n) => n.label).join(', ')}. Assign both in step properties.
        </p>
      ) : null}

      <div className="relative min-h-[min(70vh,720px)] min-w-0">
        {viewMode === 'matrix' && processWithFlow ? (
          <div ref={matrixViewportRef} className="min-w-0" onWheel={onMatrixWheel}>
            <BmsBrainMatrixView
              processes={[processWithFlow]}
              roles={catalog.roles}
              forums={catalog.forums}
              systems={catalog.systems}
              filters={MATRIX_FILTERS}
              viewportWidth={matrixViewportWidth}
              zoom={matrixZoom}
              highlightProcessId={process.id}
              focusedNodeKey={focusedNodeKey}
              onSelectNode={onMatrixSelectNode}
              relaxedBlockSpacing
            />
          </div>
        ) : (
          <BmsBrainFlowView
            flow={flow}
            systems={catalog.systems}
            roles={catalog.roles}
            forums={catalog.forums}
            readOnly={!canEdit}
            selectedNodeId={selectedId}
            onNodeSelect={setSelectedId}
            onFlowChange={setFlow}
          />
        )}

        <BmsBrainSlidePanel
          open={Boolean(selectedNode)}
          onClose={() => setSelectedId(null)}
          title="Step properties"
          subtitle={selectedNode?.label}
        >
          {selectedNode ? (
            <div className="space-y-3 p-4 text-sm">
              <label className="block space-y-1">
                <span className="text-xs text-muted">Name</span>
                <input
                  className="w-full rounded border border-border px-2 py-1 text-xs"
                  value={selectedNode.label}
                  disabled={!canEdit}
                  onChange={(e) => patchNode(selectedNode.id, { label: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted">Description</span>
                <textarea
                  className="w-full rounded border border-border px-2 py-1 text-xs"
                  rows={3}
                  value={selectedNode.description ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => patchNode(selectedNode.id, { description: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted">Role</span>
                <select
                  className="w-full rounded border border-border px-2 py-1 text-xs"
                  value={selectedNode.roleId ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => patchNode(selectedNode.id, { roleId: e.target.value || null })}
                >
                  <option value="">—</option>
                  {catalog.roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted">Forum</span>
                <select
                  className="w-full rounded border border-border px-2 py-1 text-xs"
                  value={selectedNode.forumId ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => patchNode(selectedNode.id, { forumId: e.target.value || null })}
                >
                  <option value="">—</option>
                  {catalog.forums.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </label>
              <div>
                <span className="text-xs text-muted">Systems</span>
                <div className="mt-1 max-h-32 space-y-1 overflow-y-auto">
                  {catalog.systems.map((s) => {
                    const on = selectedNode.systemIds.includes(s.id)
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={!canEdit}
                          onChange={() => {
                            const next = on
                              ? selectedNode.systemIds.filter((x) => x !== s.id)
                              : [...selectedNode.systemIds, s.id]
                            patchNode(selectedNode.id, { systemIds: next })
                          }}
                        />
                        {s.name}
                      </label>
                    )
                  })}
                </div>
              </div>
              <label className="block space-y-1">
                <span className="text-xs text-muted">Owner</span>
                <input
                  className="w-full rounded border border-border px-2 py-1 text-xs"
                  value={selectedNode.owner ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => patchNode(selectedNode.id, { owner: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted">Inputs</span>
                <textarea
                  className="w-full rounded border border-border px-2 py-1 text-xs"
                  rows={2}
                  value={selectedNode.inputs ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => patchNode(selectedNode.id, { inputs: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted">Outputs</span>
                <textarea
                  className="w-full rounded border border-border px-2 py-1 text-xs"
                  rows={2}
                  value={selectedNode.outputs ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => patchNode(selectedNode.id, { outputs: e.target.value })}
                />
              </label>
              <BmsBrainStepAttachments processId={process.id} stepId={selectedNode.id} canEdit={canEdit} />
            </div>
          ) : null}
        </BmsBrainSlidePanel>
      </div>

      {!selectedNode ? (
        <p className="text-xs text-muted">Click a block in the matrix or flow diagram to open step properties.</p>
      ) : null}

      <BmsBrainVersionHistory processId={process.id} />

      <BmsBrainBlockLegend compact />
    </div>
  )
}
