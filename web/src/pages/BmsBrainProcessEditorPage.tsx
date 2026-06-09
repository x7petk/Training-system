import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Save, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { BmsBrainFlowView, createBmsNode } from '../features/bmsBrain/BmsBrainFlowView'
import { BmsBrainStepAttachments } from '../features/bmsBrain/BmsBrainStepAttachments'
import { BmsBrainVersionHistory } from '../features/bmsBrain/BmsBrainVersionHistory'
import { bmsBrainCanEdit } from '../features/bmsBrain/bmsBrainAccess'
import { useBmsBrainFullCatalog } from '../features/bmsBrain/useBmsBrainCatalog'
import { publishBmsProcess, saveBmsProcess } from '../features/bmsBrain/useBmsBrainProcesses'
import { validateProcessForPublish } from '../features/bmsBrain/validateProcessPublish'
import type { BmsFlowNode, BmsNodeKind, BmsProcessFlow, BmsProcessRow } from '../features/bmsBrain/types'
import { EMPTY_BMS_FLOW } from '../features/bmsBrain/types'

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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

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
    const n = createBmsNode(kind, BLOCK_KINDS.find((b) => b.kind === kind)?.label ?? kind, 80, 80 + flow.nodes.length * 40)
    setFlow((f) => ({ ...f, nodes: [...f.nodes, n] }))
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
          <ArrowLeft className="size-4" /> Processes
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
            placeholder="Process description"
            value={process.description}
            disabled={!canEdit}
            onChange={(e) => setProcess({ ...process, description: e.target.value })}
          />
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

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <BmsBrainFlowView
          flow={flow}
          systems={catalog.systems}
          readOnly={!canEdit}
          selectedNodeId={selectedId}
          onNodeSelect={setSelectedId}
          onFlowChange={setFlow}
        />
        {selectedNode ? (
          <div className="space-y-3 rounded-2xl border border-border bg-surface-raised/60 p-4 text-sm">
            <h3 className="font-semibold">Step properties</h3>
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
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted">
            Select a block in the flow to edit role, forum, systems, and metadata.
          </p>
        )}
      </div>

      <BmsBrainVersionHistory processId={process.id} />
    </div>
  )
}
