import type { GapKind, SkillKind } from './gapLogic'
import { formatLevel, gapKindClasses } from './gapLogic'

export type MatrixSkillColumn = {
  id: string
  name: string
  kind: SkillKind
  groupName: string
}

export type MatrixRowModel = {
  personId: string
  displayName: string
  roleText: string
  cells: Record<
    string,
    {
      gap: GapKind
      kind: SkillKind
      required: number | null
      actual: number | null
    }
  >
}

type MatrixGridProps = {
  skills: MatrixSkillColumn[]
  rows: MatrixRowModel[]
  loading: boolean
  emptyMessage: string
}

function cellTitle(kind: SkillKind, required: number | null, actual: number | null, gap: GapKind): string {
  const req = formatLevel(kind, required)
  const act = formatLevel(kind, actual)
  const bits = [`Required: ${req}`, `Actual: ${act}`, `Status: ${gap}`]
  return bits.join(' · ')
}

export function MatrixGrid({ skills, rows, loading, emptyMessage }: MatrixGridProps) {
  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-border bg-surface-raised/40 text-sm text-muted">
        Loading matrix…
      </div>
    )
  }

  if (skills.length === 0) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-border bg-surface-raised/40 px-6 text-center text-sm text-muted">
        No skills in the catalog yet.
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-border bg-surface-raised/40 px-6 text-center text-sm text-muted">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="relative max-h-[min(70vh,52rem)] max-w-full overflow-auto rounded-2xl border border-border bg-surface-raised/40 shadow-inner ring-1 ring-white/[0.04]">
      <table className="w-max min-w-full border-collapse text-left text-xs">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 top-0 z-30 min-w-[10rem] border-b border-r border-border bg-surface px-3 py-2.5 font-medium uppercase tracking-wider text-muted backdrop-blur-md"
            >
              Person
            </th>
            {skills.map((s) => (
              <th
                key={s.id}
                scope="col"
                title={s.groupName}
                className="sticky top-0 z-20 min-w-[3.25rem] max-w-[5rem] border-b border-border bg-surface px-1 py-2 text-center align-bottom font-medium text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted backdrop-blur-md"
              >
                <span className="line-clamp-3 text-balance">{s.name}</span>
                <span className="mt-1 block font-mono text-[9px] font-normal normal-case text-muted/70">
                  {s.kind === 'certification' ? 'cert' : '1–4'}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/80">
          {rows.map((row) => (
            <tr key={row.personId} className="hover:bg-white/[0.02]">
              <th
                scope="row"
                className="sticky left-0 z-10 border-r border-border bg-canvas/95 px-3 py-2 text-left align-middle backdrop-blur-sm"
              >
                <div className="font-medium text-fg">{row.displayName}</div>
                <div className="mt-0.5 line-clamp-2 text-[10px] font-normal text-muted">{row.roleText}</div>
              </th>
              {skills.map((s) => {
                const c = row.cells[s.id]
                const gap = c?.gap ?? 'na'
                const cls = gapKindClasses(gap)
                const act = c?.actual ?? null
                const req = c?.required ?? null
                const k = c?.kind ?? s.kind
                return (
                  <td key={s.id} className="p-0.5 align-middle">
                    <div
                      className={`flex h-9 min-w-[2.75rem] items-center justify-center rounded-md px-0.5 text-[11px] font-semibold tabular-nums ${cls}`}
                      title={cellTitle(k, req, act, gap)}
                    >
                      {formatLevel(k, act)}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
