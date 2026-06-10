import type { BmsCatalogRow, BmsProcessRow } from './types'

type Props = {
  processes: BmsProcessRow[]
  roles: BmsCatalogRow[]
  forums: BmsCatalogRow[]
  systems: BmsCatalogRow[]
  embedded?: boolean
}

export function BmsBrainProcessSummaryPanel({ processes, roles, forums, systems, embedded }: Props) {
  if (processes.length === 0) {
    return (
      <div className={embedded ? 'p-4 text-sm text-muted' : 'rounded-2xl border border-dashed border-border bg-surface-raised/40 p-4 text-sm text-muted lg:w-80'}>
        No flows match the current filters. Adjust filters or edit flows under Systems &amp; Tools.
      </div>
    )
  }

  const primary = processes[0]
  const owner = roles.find((r) => r.id === primary.owner_role_id)
  const systemIds = new Set<string>()
  const forumIds = new Set<string>()
  for (const p of processes) {
    for (const n of p.flow?.nodes ?? []) {
      n.systemIds?.forEach((id) => systemIds.add(id))
      if (n.forumId) forumIds.add(n.forumId)
    }
  }

  return (
    <div className={embedded ? 'space-y-4 p-4 text-sm' : 'flex w-full max-w-sm shrink-0 flex-col rounded-2xl border border-border bg-surface-raised/80 shadow-sm lg:w-80'}>
      {!embedded ? (
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-sm font-semibold">Flow details</h2>
          <p className="text-xs text-muted">
            {processes.length === 1 ? primary.name : `${processes.length} flows in view`}
          </p>
        </div>
      ) : null}
      <div className={embedded ? 'space-y-4' : 'space-y-4 overflow-y-auto p-4 text-sm'}>
        <div>
          <p className="text-xs font-medium text-muted">Description</p>
          <p className="mt-1">{primary.description || '—'}</p>
        </div>
        {owner ? (
          <div>
            <p className="text-xs font-medium text-muted">Owner role</p>
            <p style={{ color: owner.color }}>{owner.name}</p>
          </div>
        ) : null}
        <div>
          <p className="text-xs font-medium text-muted">Systems in view</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {[...systemIds].map((id) => {
              const s = systems.find((x) => x.id === id)
              if (!s) return null
              return (
                <span
                  key={id}
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: `${s.color}22`, color: s.color }}
                >
                  {s.name}
                </span>
              )
            })}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">Forums covered</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {[...forumIds].map((id) => {
              const f = forums.find((x) => x.id === id)
              if (!f) return null
              return (
                <span
                  key={id}
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: `${f.color}22`, color: f.color }}
                >
                  {f.name}
                </span>
              )
            })}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">Last updated</p>
          <p className="text-muted">{new Date(primary.updated_at).toLocaleString()}</p>
        </div>
        {processes.length > 1 ? (
          <div>
            <p className="text-xs font-medium text-muted">All flows</p>
            <ul className="mt-1 space-y-1 text-xs text-muted">
              {processes.map((p) => (
                <li key={p.id}>• {p.name}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
