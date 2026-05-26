import { Copy, Trash2 } from 'lucide-react'
import { SWP_LANE_THEMES, SWP_ROLE_KEY_ORDER } from './roleLaneTheme'
import type { SwpFlowNode, SwpFlowNodeMeta, SwpNodeKind, SwpNodeStatus, SwpRoleKey } from './types'

type Props = {
  node: SwpFlowNode | null
  onUpdate: (nodeId: string, patch: Partial<SwpFlowNode>) => void
  onDelete: (nodeId: string) => void
  onDuplicate: (nodeId: string) => void
}

const KIND_OPTIONS: { value: SwpNodeKind; label: string }[] = [
  { value: 'start', label: 'Start' },
  { value: 'task', label: 'Task' },
  { value: 'decision', label: 'Decision' },
  { value: 'end', label: 'End' },
]

const STATUS_OPTIONS: { value: SwpNodeStatus | ''; label: string }[] = [
  { value: '', label: '—' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
]

function fieldLabel(text: string) {
  return <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{text}</label>
}

function updateMeta(node: SwpFlowNode, patch: Partial<SwpFlowNodeMeta>): SwpFlowNodeMeta {
  return { ...node.meta, ...patch }
}

export function SwpPropertiesPanel({ node, onUpdate, onDelete, onDuplicate }: Props) {
  if (!node) {
    return (
      <aside className="w-72 shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">Block properties</h3>
        <p className="mt-3 text-xs text-slate-500">
          Select a block on the diagram to edit its title, type, lane, and metadata.
        </p>
      </aside>
    )
  }

  const meta = node.meta ?? {}

  return (
    <aside className="flex w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3 py-2.5">
        <h3 className="text-sm font-semibold text-slate-800">Block properties</h3>
        <p className="text-[10px] text-slate-500">ID: {node.id}</p>
      </div>

      <div className="max-h-[min(62vh,560px)] space-y-2.5 overflow-y-auto px-3 py-2.5">
        <div>
          {fieldLabel('Title')}
          <input
            value={node.label}
            onChange={(e) => onUpdate(node.id, { label: e.target.value })}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </div>

        <div>
          {fieldLabel('Block type')}
          <select
            value={node.kind}
            onChange={(e) => onUpdate(node.id, { kind: e.target.value as SwpNodeKind })}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          {fieldLabel('Role lane')}
          <select
            value={node.roleKey}
            onChange={(e) => onUpdate(node.id, { roleKey: e.target.value as SwpRoleKey })}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          >
            {SWP_ROLE_KEY_ORDER.map((key) => (
              <option key={key} value={key}>
                {SWP_LANE_THEMES[key].label}
              </option>
            ))}
          </select>
        </div>

        <div>
          {fieldLabel('Accent colour')}
          <input
            type="color"
            value={meta.color ?? '#2563eb'}
            onChange={(e) =>
              onUpdate(node.id, { meta: updateMeta(node, { color: e.target.value }) })
            }
            className="h-8 w-full cursor-pointer rounded border border-slate-300"
          />
        </div>

        <div>
          {fieldLabel('Description')}
          <textarea
            value={meta.description ?? ''}
            onChange={(e) =>
              onUpdate(node.id, { meta: updateMeta(node, { description: e.target.value }) })
            }
            rows={2}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </div>

        <div>
          {fieldLabel('Owner role')}
          <input
            value={meta.ownerRole ?? ''}
            onChange={(e) =>
              onUpdate(node.id, { meta: updateMeta(node, { ownerRole: e.target.value }) })
            }
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </div>

        <div>
          {fieldLabel('Standard reference')}
          <input
            value={meta.standardRef ?? ''}
            onChange={(e) =>
              onUpdate(node.id, { meta: updateMeta(node, { standardRef: e.target.value }) })
            }
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </div>

        <div>
          {fieldLabel('Expected completion')}
          <input
            value={meta.expectedCompletion ?? ''}
            onChange={(e) =>
              onUpdate(node.id, {
                meta: updateMeta(node, { expectedCompletion: e.target.value }),
              })
            }
            placeholder="e.g. 15 min"
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </div>

        <div>
          {fieldLabel('Escalation level')}
          <input
            value={meta.escalationLevel ?? ''}
            onChange={(e) =>
              onUpdate(node.id, { meta: updateMeta(node, { escalationLevel: e.target.value }) })
            }
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </div>

        <div>
          {fieldLabel('Tags (comma-separated)')}
          <input
            value={(meta.tags ?? []).join(', ')}
            onChange={(e) =>
              onUpdate(node.id, {
                meta: updateMeta(node, {
                  tags: e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                }),
              })
            }
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </div>

        <div>
          {fieldLabel('Status')}
          <select
            value={meta.status ?? ''}
            onChange={(e) =>
              onUpdate(node.id, {
                meta: updateMeta(node, {
                  status: (e.target.value || undefined) as SwpNodeStatus | undefined,
                }),
              })
            }
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'none'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-auto flex gap-1.5 border-t border-slate-100 p-2.5">
        <button
          type="button"
          onClick={() => onDuplicate(node.id)}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium hover:bg-slate-50"
        >
          <Copy className="size-3" />
          Duplicate
        </button>
        <button
          type="button"
          onClick={() => onDelete(node.id)}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-rose-300 bg-rose-50 px-2 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
        >
          <Trash2 className="size-3" />
          Delete
        </button>
      </div>
    </aside>
  )
}
