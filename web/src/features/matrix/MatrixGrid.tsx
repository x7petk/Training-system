import { useState } from 'react'
import type { GapKind, SkillKind } from './gapLogic'
import { formatLevel, gapKindClasses } from './gapLogic'
import { MatrixCellEditor, type CellEditorAnchor, type CellEditorContext } from './MatrixCellEditor'

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
      isExtra: boolean
      dueDate: string | null
    }
  >
}

type MatrixGridProps = {
  skills: MatrixSkillColumn[]
  rows: MatrixRowModel[]
  loading: boolean
  emptyMessage: string
  canEditPerson: (personId: string) => boolean
  onDataChanged: () => void
}

function cellTitle(kind: SkillKind, required: number | null, actual: number | null, gap: GapKind): string {
  const req = formatLevel(kind, required)
  const act = formatLevel(kind, actual)
  const bits = [`Required: ${req}`, `Actual: ${act}`, `Status: ${gap}`]
  return bits.join(' · ')
}

export function MatrixGrid({ skills, rows, loading, emptyMessage, canEditPerson, onDataChanged }: MatrixGridProps) {
  const [editor, setEditor] = useState<CellEditorContext | null>(null)
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
    <>
      <MatrixCellEditor ctx={editor} onDismiss={() => setEditor(null)} onSaved={onDataChanged} />
      <div className="relative -mx-1 max-w-full overflow-x-auto rounded-xl border border-border bg-surface-raised/80 shadow-inner ring-1 ring-black/[0.06] sm:mx-0 sm:rounded-2xl">
        <table className="w-max min-w-full border-collapse text-left text-xs">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 top-0 z-30 w-[5.75rem] min-w-[5.75rem] max-w-[9rem] border-b border-r border-border bg-surface px-1.5 py-1.5 align-bottom text-[10px] font-medium uppercase tracking-wider text-muted backdrop-blur-md sm:w-[6.75rem] sm:min-w-[6.75rem] sm:max-w-[10rem] sm:px-2 sm:text-xs"
              >
                Person
              </th>
              {skills.map((s) => (
                <th
                  key={s.id}
                  scope="col"
                  title={`${s.groupName} · ${s.name}`}
                  className="sticky top-0 z-20 w-9 min-w-9 max-w-9 border-b border-l border-border/70 bg-surface p-0 align-bottom backdrop-blur-md sm:w-10 sm:min-w-10 sm:max-w-10"
                >
                  <div className="flex flex-col items-center justify-end px-0.5 pb-1 pt-0">
                    <span
                      className="w-max text-center text-[9px] font-semibold uppercase leading-[1.05] tracking-wide text-muted [text-orientation:mixed] [writing-mode:vertical-rl] rotate-180 sm:text-[10px]"
                    >
                      {s.name}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {rows.map((row) => (
              <tr key={row.personId} className="hover:bg-black/[0.03]">
                <th
                  scope="row"
                  className="sticky left-0 z-10 w-[5.75rem] min-w-[5.75rem] max-w-[9rem] border-r border-border bg-canvas/95 px-1.5 py-1 text-left align-middle backdrop-blur-sm sm:w-[6.75rem] sm:min-w-[6.75rem] sm:max-w-[10rem] sm:px-2 sm:py-1.5"
                >
                  <div className="truncate font-medium text-fg" title={row.displayName}>
                    {row.displayName}
                  </div>
                  <div
                    className="mt-0.5 line-clamp-2 text-[9px] font-normal text-muted sm:text-[10px]"
                    title={row.roleText}
                  >
                    {row.roleText}
                  </div>
                </th>
                {skills.map((s) => {
                  const c = row.cells[s.id]
                  const gap = c?.gap ?? 'na'
                  const cls = gapKindClasses(gap)
                  const act = c?.actual ?? null
                  const req = c?.required ?? null
                  const k = c?.kind ?? s.kind
                  const editable = canEditPerson(row.personId)
                  return (
                    <td key={s.id} className="w-9 min-w-9 max-w-9 p-0.5 align-middle sm:w-10 sm:min-w-10 sm:max-w-10">
                      <button
                        type="button"
                        disabled={!editable}
                        onClick={(e) => {
                          if (!editable) return
                          const r = e.currentTarget.getBoundingClientRect()
                          const anchor: CellEditorAnchor = {
                            top: r.top,
                            left: r.left,
                            width: r.width,
                            height: r.height,
                          }
                          setEditor({
                            personId: row.personId,
                            personName: row.displayName,
                            skillId: s.id,
                            skillName: s.name,
                            kind: k,
                            required: req,
                            actual: act,
                            isExtra: c?.isExtra ?? false,
                            dueDate: c?.dueDate ?? null,
                            anchorRect: anchor,
                          })
                        }}
                        className={`flex h-10 min-h-10 w-full min-w-0 touch-manipulation items-center justify-center rounded-md px-0.5 text-[10px] font-semibold tabular-nums transition-[filter,opacity] sm:h-9 sm:min-h-9 sm:text-[11px] ${cls} ${editable ? 'cursor-pointer hover:brightness-110 active:brightness-95' : 'cursor-default opacity-90'} ${!editable ? '' : 'motion-safe:active:scale-[0.98]'}`}
                        title={(editable ? 'Click to edit · ' : '') + cellTitle(k, req, act, gap)}
                      >
                        {formatLevel(k, act)}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
