import { X } from 'lucide-react'
import { BmsBrainStepAttachments } from './BmsBrainStepAttachments'
import type { BmsCatalogRow, BmsFlowNode, BmsProcessRow } from './types'

type Props = {
  node: BmsFlowNode
  process: BmsProcessRow
  roles: BmsCatalogRow[]
  forums: BmsCatalogRow[]
  systems: BmsCatalogRow[]
  onClose?: () => void
  embedded?: boolean
}

export function BmsBrainStepPanel({ node, process, roles, forums, systems, onClose, embedded }: Props) {
  const role = roles.find((r) => r.id === node.roleId)
  const forum = forums.find((f) => f.id === node.forumId)
  const sys = (node.systemIds ?? []).map((id) => systems.find((s) => s.id === id)).filter(Boolean) as BmsCatalogRow[]

  return (
    <div className={embedded ? 'p-4' : 'flex w-full max-w-sm shrink-0 flex-col rounded-2xl border border-border bg-surface-raised/80 shadow-sm lg:w-80'}>
      {!embedded ? (
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-sm font-semibold">Step details</h2>
          {onClose ? (
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-black/[0.06]">
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="space-y-4 text-sm">
        <div>
          <p className="text-xs font-medium text-muted">Step</p>
          <p className="font-semibold text-fg">{node.label}</p>
          {node.description ? <p className="mt-1 text-muted">{node.description}</p> : null}
        </div>
        <div>
          <p className="text-xs font-medium text-muted">System / tool flow</p>
          <p>{process.name}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">Role</p>
          <p style={{ color: role?.color }}>{role?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">Forum</p>
          <p style={{ color: forum?.color }}>{forum?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">Systems</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {sys.length ? (
              sys.map((s) => (
                <span
                  key={s.id}
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: `${s.color}22`, color: s.color }}
                >
                  {s.name}
                </span>
              ))
            ) : (
              <span className="text-muted">—</span>
            )}
          </div>
        </div>
        {node.owner ? (
          <div>
            <p className="text-xs font-medium text-muted">Owner</p>
            <p>{node.owner}</p>
          </div>
        ) : null}
        {node.inputs ? (
          <div>
            <p className="text-xs font-medium text-muted">Inputs</p>
            <p className="whitespace-pre-wrap text-muted">{node.inputs}</p>
          </div>
        ) : null}
        {node.outputs ? (
          <div>
            <p className="text-xs font-medium text-muted">Outputs</p>
            <p className="whitespace-pre-wrap text-muted">{node.outputs}</p>
          </div>
        ) : null}
        {node.links?.length ? (
          <div>
            <p className="text-xs font-medium text-muted">Links</p>
            <ul className="mt-1 space-y-1">
              {node.links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
                    {l.label || l.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <p className="text-xs font-medium text-muted">Last updated</p>
          <p className="text-muted">{new Date(process.updated_at).toLocaleString()}</p>
        </div>
        <BmsBrainStepAttachments processId={process.id} stepId={node.id} />
      </div>
    </div>
  )
}
